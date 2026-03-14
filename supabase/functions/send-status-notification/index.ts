import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusNotificationRequest {
  email: string;
  nome: string;
  protocolo: string;
  status_anterior: string;
  status_novo: string;
  resposta: string | null;
  rua: string;
  bairro: string | null;
  categoria: string | null;
  prefeitura_nome: string;
  prefeitura_id: string;
  avaliacao_token: string | null;
  telefone?: string | null;
}

const statusLabels: Record<string, string> = {
  recebida: "Recebida",
  em_andamento: "Em Andamento",
  resolvida: "Resolvida",
  arquivada: "Arquivada"
};

const statusColors: Record<string, string> = {
  recebida: "#3b82f6",
  em_andamento: "#f97316",
  resolvida: "#22c55e",
  arquivada: "#6b7280"
};

const statusEmojis: Record<string, string> = {
  recebida: "📥",
  em_andamento: "🔄",
  resolvida: "✅",
  arquivada: "📁"
};

interface PrefeituraEvolution {
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  evolution_connected: boolean | null;
}

async function sendWhatsAppNotification(
  prefeituraId: string,
  phoneNumber: string,
  message: string,
  supabaseAdmin: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // First check for global Evolution API config
    const { data: globalConfig } = await supabaseAdmin
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'evolution_api')
      .single();

    let evolutionUrl = '';
    let evolutionKey = '';

    // Get prefeitura Evolution API config
    const { data, error: prefError } = await supabaseAdmin
      .from('prefeituras')
      .select('evolution_api_url, evolution_api_key, evolution_instance_name, evolution_connected')
      .eq('id', prefeituraId)
      .single();

    const prefeitura = data as PrefeituraEvolution | null;

    if (prefError || !prefeitura) {
      console.log('Prefeitura not found for WhatsApp notification');
      return { success: false, error: 'Prefeitura not found' };
    }

    if (!prefeitura.evolution_connected || !prefeitura.evolution_instance_name) {
      console.log('WhatsApp not configured for this prefeitura');
      return { success: false, error: 'WhatsApp not configured' };
    }

    // Use global config first, then fallback to prefeitura config
    if (globalConfig?.valor) {
      const config = globalConfig.valor as { url?: string; api_key?: string };
      evolutionUrl = config.url || '';
      evolutionKey = config.api_key || '';
    }
    if (!evolutionUrl && prefeitura.evolution_api_url) {
      evolutionUrl = prefeitura.evolution_api_url;
    }
    if (!evolutionKey && prefeitura.evolution_api_key) {
      evolutionKey = prefeitura.evolution_api_key;
    }

    if (!evolutionUrl || !evolutionKey) {
      console.log('Evolution API URL or Key not configured');
      return { success: false, error: 'Evolution API not configured' };
    }

    // Clean phone number (remove non-digits)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Skip if phone looks like a WhatsApp email placeholder
    if (cleanPhone.length < 10 || phoneNumber.includes('@whatsapp')) {
      console.log('Invalid phone number for WhatsApp:', phoneNumber);
      return { success: false, error: 'Invalid phone number' };
    }

    console.log(`Sending WhatsApp notification to ${cleanPhone} via ${prefeitura.evolution_instance_name}`);
    console.log(`Using Evolution URL: ${evolutionUrl}`);

    const response = await fetch(`${evolutionUrl}/message/sendText/${prefeitura.evolution_instance_name}`, {
      method: 'POST',
      headers: {
        'apikey': evolutionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp send error:', errorText);
      return { success: false, error: errorText };
    }

    console.log('WhatsApp notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('WhatsApp notification error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Received request to send-status-notification");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized: missing authorization" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's token to verify their identity
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      console.error("User verification failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("User authenticated:", user.id);

    const data: StatusNotificationRequest = await req.json();
    console.log("Processing notification for:", data.protocolo);

    // Validate required fields
    if (!data.email || !data.protocolo || !data.status_novo || !data.prefeitura_id) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role client for admin checks
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Verify user is admin for this prefeitura
    const { data: isAdmin } = await supabaseAdmin.rpc("is_prefeitura_admin", {
      _user_id: user.id,
      _prefeitura_id: data.prefeitura_id,
    });

    const { data: isSuperAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });

    if (!isAdmin && !isSuperAdmin) {
      console.error("User is not admin for prefeitura:", data.prefeitura_id);
      return new Response(
        JSON.stringify({ error: "Forbidden: user is not admin for this prefeitura" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Admin verified, sending status notification email");

    const statusLabel = statusLabels[data.status_novo] || data.status_novo;
    const statusColor = statusColors[data.status_novo] || "#6b7280";
    const statusAnteriorLabel = statusLabels[data.status_anterior] || data.status_anterior;
    
    // Generate rating link if this is a resolved status
    const baseUrl = "https://www.civitainfra.com.br";
    const ratingLink = data.avaliacao_token 
      ? `${baseUrl}/avaliar?token=${data.avaliacao_token}`
      : null;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                ${data.prefeitura_nome}
              </h1>
              <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">
                Atualização da sua reclamação
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Olá, <strong>${data.nome}</strong>!
              </p>
              
              <p style="color: #6b7280; font-size: 15px; margin: 0 0 25px 0; line-height: 1.6;">
                Sua reclamação teve uma atualização de status. Confira os detalhes abaixo:
              </p>
              
              <!-- Protocol Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                      Protocolo
                    </p>
                    <p style="color: #1f2937; font-size: 20px; margin: 0; font-weight: 700;">
                      ${data.protocolo}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Status Change -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td style="text-align: center;">
                    <table cellpadding="0" cellspacing="0" style="display: inline-table;">
                      <tr>
                        <td style="padding: 10px 15px; background-color: #e5e7eb; border-radius: 6px; color: #6b7280; font-size: 14px;">
                          ${statusAnteriorLabel}
                        </td>
                        <td style="padding: 0 15px; color: #9ca3af; font-size: 20px;">
                          →
                        </td>
                        <td style="padding: 10px 15px; background-color: ${statusColor}; border-radius: 6px; color: #ffffff; font-size: 14px; font-weight: 600;">
                          ${statusLabel}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Location Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                      Local
                    </p>
                    <p style="color: #1f2937; font-size: 15px; margin: 0;">
                      ${data.rua}${data.bairro ? `, ${data.bairro}` : ''}
                    </p>
                    ${data.categoria ? `
                    <p style="color: #6b7280; font-size: 13px; margin: 8px 0 0 0;">
                      Categoria: ${data.categoria}
                    </p>
                    ` : ''}
                  </td>
                </tr>
              </table>
              
              ${data.resposta ? `
              <!-- Response -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #166534; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Resposta da Prefeitura
                    </p>
                    <p style="color: #15803d; font-size: 14px; margin: 0; line-height: 1.6;">
                      ${data.resposta}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              ${ratingLink ? `
              <!-- Rating CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="color: #92400e; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">
                      ⭐ Avalie nosso atendimento!
                    </p>
                    <p style="color: #a16207; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5;">
                      Sua opinião é muito importante para melhorarmos nossos serviços.
                    </p>
                    <a href="${ratingLink}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Avaliar Atendimento
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">
                Você pode acompanhar o andamento da sua reclamação a qualquer momento utilizando o número do protocolo.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Este é um email automático. Por favor, não responda.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
                ${data.prefeitura_nome} - Civita Infra
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Civita Infra <naoresponda@civitainfra.com.br>",
      to: [data.email],
      subject: `[${data.protocolo}] Status atualizado: ${statusLabel}`,
      html: emailHtml,
    });

    // Check if Resend returned an error
    if (emailResponse.error) {
      console.error("Resend API error:", JSON.stringify(emailResponse.error, null, 2));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error.message,
          hint: "Para enviar emails para outros destinatários, valide um domínio em resend.com/domains"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully to:", data.email);

    // Send WhatsApp notification if phone number is available
    let whatsappResult: { success: boolean; error?: string } = { success: false, error: 'No phone number' };
    if (data.telefone) {
      const statusEmoji = statusEmojis[data.status_novo] || "📋";
      const whatsappMessage = 
        `${statusEmoji} *Atualização da sua Reclamação*\n\n` +
        `📋 *Protocolo:* ${data.protocolo}\n` +
        `📍 *Local:* ${data.rua}${data.bairro ? `, ${data.bairro}` : ''}\n` +
        `🔄 *Novo Status:* ${statusLabel}\n` +
        (data.resposta ? `\n💬 *Resposta:*\n${data.resposta}\n` : '') +
        (ratingLink ? `\n⭐ *Avalie nosso atendimento:*\n${ratingLink}\n` : '') +
        `\n_${data.prefeitura_nome}_`;

      whatsappResult = await sendWhatsAppNotification(
        data.prefeitura_id,
        data.telefone,
        whatsappMessage,
        supabaseAdmin
      );
      
      console.log("WhatsApp notification result:", whatsappResult);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      email: emailResponse.data,
      whatsapp: whatsappResult
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-status-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
