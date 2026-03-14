import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationRequest {
  to_email: string;
  nome_cidadao: string;
  protocolo: string;
  rua: string;
  bairro: string;
  categoria: string;
  prefeitura_nome: string;
  prefeitura_id: string;
  telefone_cidadao?: string;
}

// Função auxiliar para enviar WhatsApp via Evolution API
async function sendWhatsAppConfirmation(
  supabase: any,
  prefeituraId: string,
  telefone: string,
  nomeCidadao: string,
  protocolo: string,
  rua: string,
  bairro: string,
  categoria: string,
  prefeituraNome: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Tentando enviar WhatsApp para:", telefone);

    // Buscar configuração da prefeitura
    const { data: prefeitura, error: prefError } = await supabase
      .from('prefeituras')
      .select('id, nome, evolution_api_url, evolution_api_key, evolution_instance_name, evolution_connected')
      .eq('id', prefeituraId)
      .single();

    if (prefError || !prefeitura) {
      console.log("Prefeitura não encontrada para WhatsApp");
      return { success: false, error: "Prefeitura não encontrada" };
    }

    // Buscar configuração global da Evolution API
    const { data: globalConfig } = await supabase
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'evolution_api')
      .single();

    let evolutionUrl = '';
    let evolutionKey = '';

    // Priorizar configuração global, depois local
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

    const instanceName = prefeitura.evolution_instance_name;

    if (!prefeitura.evolution_connected || !evolutionUrl || !evolutionKey || !instanceName) {
      console.log("WhatsApp não configurado para esta prefeitura");
      return { success: false, error: "WhatsApp não configurado" };
    }

    // Formatar número (garantir formato correto)
    let numero = telefone.replace(/\D/g, '');
    if (!numero.startsWith('55')) {
      numero = '55' + numero;
    }

    // Montar mensagem
    const mensagem = `✅ *Reclamação Registrada*

Olá, ${nomeCidadao}!

Sua reclamação foi registrada com sucesso na ${prefeituraNome}.

📋 *Protocolo:* ${protocolo}

📍 *Local:* ${rua}${bairro ? `, ${bairro}` : ''}
📂 *Categoria:* ${categoria}
📊 *Status:* Recebida

Você receberá atualizações quando houver mudanças no status da sua reclamação.

Obrigado por colaborar com a melhoria da nossa cidade!`;

    // Enviar via Evolution API
    const finalEvolutionUrl = evolutionUrl.replace(/\/$/, '');

    console.log('Enviando WhatsApp via Evolution API...');
    console.log('URL:', `${finalEvolutionUrl}/message/sendText/${instanceName}`);

    const evolutionResponse = await fetch(`${finalEvolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey,
      },
      body: JSON.stringify({
        number: numero,
        text: mensagem,
      }),
    });

    const evolutionResultText = await evolutionResponse.text();
    console.log('Status HTTP WhatsApp:', evolutionResponse.status);

    if (!evolutionResponse.ok) {
      console.error('Erro Evolution API:', evolutionResponse.status, evolutionResultText);
      return { success: false, error: `Erro HTTP ${evolutionResponse.status}` };
    }

    console.log("WhatsApp enviado com sucesso para:", numero);
    return { success: true };

  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      to_email,
      nome_cidadao,
      protocolo,
      rua,
      bairro,
      categoria,
      prefeitura_nome,
      prefeitura_id,
      telefone_cidadao
    }: ConfirmationRequest = await req.json();

    console.log("=== Send Complaint Confirmation ===");
    console.log("Email:", to_email);
    console.log("Telefone:", telefone_cidadao);
    console.log("Protocolo:", protocolo);

    // SECURITY: Validate required fields
    if (!to_email || !protocolo || !prefeitura_id) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // SECURITY: Verify the complaint exists and matches the provided data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: complaint, error: complaintError } = await supabase
      .from("reclamacoes")
      .select("id, protocolo, email_cidadao, telefone_cidadao, prefeitura_id")
      .eq("protocolo", protocolo)
      .eq("prefeitura_id", prefeitura_id)
      .eq("email_cidadao", to_email)
      .single();

    if (complaintError || !complaint) {
      console.error("Complaint verification failed:", complaintError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: complaint not found or email mismatch" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Complaint verified, sending confirmation for protocol:", protocolo);

    // ========== ENVIAR EMAIL ==========
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reclamação Registrada</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2273c3 0%, #1e5a99 100%); padding: 30px 40px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                      ✅ Reclamação Registrada
                    </h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                      ${prefeitura_nome}
                    </p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                      Olá, <strong>${nome_cidadao}</strong>!
                    </p>
                    
                    <p style="margin: 0 0 25px 0; color: #555555; font-size: 15px; line-height: 1.6;">
                      Sua reclamação foi registrada com sucesso. Acompanhe o andamento através do número de protocolo abaixo:
                    </p>

                    <!-- Protocol Box -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                      <tr>
                        <td style="background-color: #f0f7ff; border-radius: 8px; padding: 20px; text-align: center; border: 2px dashed #2273c3;">
                          <p style="margin: 0 0 5px 0; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                            Número do Protocolo
                          </p>
                          <p style="margin: 0; color: #2273c3; font-size: 24px; font-weight: 700; font-family: monospace;">
                            ${protocolo}
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Details -->
                    <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 16px; font-weight: 600;">
                      📋 Detalhes da Reclamação
                    </h3>
                    
                    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9f9f9; border-radius: 8px;">
                      <tr>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee;">
                          <span style="color: #888888; font-size: 13px;">Categoria</span><br>
                          <span style="color: #333333; font-size: 14px; font-weight: 500;">${categoria}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee;">
                          <span style="color: #888888; font-size: 13px;">Local</span><br>
                          <span style="color: #333333; font-size: 14px; font-weight: 500;">${rua}${bairro ? `, ${bairro}` : ''}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 15px;">
                          <span style="color: #888888; font-size: 13px;">Status</span><br>
                          <span style="display: inline-block; background-color: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;">
                            Recebida
                          </span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Você receberá um email quando houver atualizações no status da sua reclamação.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #eeeeee;">
                    <p style="margin: 0; color: #888888; font-size: 13px; text-align: center;">
                      ${prefeitura_nome}<br>
                      <span style="font-size: 12px;">Este é um email automático, não responda.</span>
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

    let emailSuccess = false;
    let emailError = null;

    try {
      const emailResponse = await resend.emails.send({
        from: "Civita Infra <naoresponda@civitainfra.com.br>",
        to: [to_email],
        subject: `Reclamação Registrada - Protocolo ${protocolo}`,
        html: htmlContent,
      });

      console.log("Email response:", emailResponse);

      if (emailResponse.error) {
        console.error("Resend API error:", emailResponse.error);
        emailError = emailResponse.error.message;
      } else {
        emailSuccess = true;
        console.log("Email enviado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      emailError = error instanceof Error ? error.message : "Erro desconhecido";
    }

    // ========== ENVIAR WHATSAPP ==========
    let whatsappSuccess = false;
    let whatsappError = null;

    // Usar telefone do parâmetro ou da reclamação
    const telefoneParaWhatsApp = telefone_cidadao || complaint.telefone_cidadao;

    if (telefoneParaWhatsApp) {
      const whatsappResult = await sendWhatsAppConfirmation(
        supabase,
        prefeitura_id,
        telefoneParaWhatsApp,
        nome_cidadao,
        protocolo,
        rua,
        bairro,
        categoria,
        prefeitura_nome
      );
      whatsappSuccess = whatsappResult.success;
      whatsappError = whatsappResult.error;
    } else {
      console.log("Telefone não informado, WhatsApp não será enviado");
    }

    // Retornar resultado
    return new Response(
      JSON.stringify({ 
        success: emailSuccess || whatsappSuccess,
        email: {
          sent: emailSuccess,
          error: emailError
        },
        whatsapp: {
          sent: whatsappSuccess,
          error: whatsappError,
          telefone: telefoneParaWhatsApp ? "***" + telefoneParaWhatsApp.slice(-4) : null
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-complaint-confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
