import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vonage credentials
const vonageApiKey = Deno.env.get("VONAGE_API_KEY");
const vonageApiSecret = Deno.env.get("VONAGE_API_SECRET");

// Resend for email
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Configuration
const BATCH_SIZE = 10; // Process 10 sends in parallel
const PROGRESS_UPDATE_INTERVAL = 5; // Update progress every 5 sends

interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

interface Cidadao {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
}

interface SendTask {
  cidadao: Cidadao;
  canal: string;
}

// Send Email via Resend
async function sendEmail(to: string, subject: string, message: string, prefeituraNome: string): Promise<SendResult> {
  if (!resend) {
    return { success: false, error: "Resend não configurado" };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { background: #333; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
          .alert-icon { font-size: 32px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="alert-icon">🚨</div>
            <h1 style="margin: 10px 0 0 0;">ALERTA OFICIAL</h1>
            <p style="margin: 5px 0 0 0;">${prefeituraNome}</p>
          </div>
          <div class="content">
            <h2 style="color: #dc2626; margin-top: 0;">${subject}</h2>
            <p>${message.replace(/\n/g, '<br>')}</p>
          </div>
          <div class="footer">
            <p style="margin: 0;">Em caso de emergência ligue <strong>199</strong></p>
            <p style="margin: 5px 0 0 0;">Mensagem oficial da ${prefeituraNome}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await resend.emails.send({
      from: `Alertas ${prefeituraNome} <alertas@civitainfra.com.br>`,
      to: [to],
      subject: `🚨 ALERTA: ${subject}`,
      html: htmlContent,
    });

    if (response.error) {
      return { success: false, error: response.error.message || "Erro ao enviar email" };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, error: message };
  }
}

// Send SMS via Vonage
async function sendSMS(to: string, message: string): Promise<SendResult> {
  if (!vonageApiKey || !vonageApiSecret) {
    return { success: false, error: "Vonage não configurado" };
  }

  try {
    let formattedPhone = to.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    const response = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: vonageApiKey,
        api_secret: vonageApiSecret,
        to: formattedPhone,
        from: "Prefeitura",
        text: message,
        type: "unicode",
      }),
    });

    const data = await response.json();

    if (data.messages && data.messages.length > 0) {
      const firstMessage = data.messages[0];
      if (firstMessage.status === "0") {
        return { success: true, messageId: firstMessage["message-id"] };
      } else {
        return { success: false, error: firstMessage["error-text"] || "Erro ao enviar SMS" };
      }
    }

    return { success: false, error: "Resposta inesperada da Vonage" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, error: message };
  }
}

// Send WhatsApp via Evolution API with retry
async function sendWhatsAppEvolution(to: string, message: string, config: EvolutionConfig, retries = 2): Promise<SendResult> {
  try {
    let formattedPhone = to.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    const apiUrl = config.apiUrl.replace(/\/$/, "");
    const url = `${apiUrl}/message/sendText/${config.instanceName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const data = await response.json();

    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id };
    } else {
      const errorMessage = data.message || data.error || data.response?.message || "Erro ao enviar WhatsApp";
      
      // Retry on temporary errors
      if (retries > 0 && (response.status >= 500 || response.status === 429)) {
        console.log(`[WHATSAPP] Retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendWhatsAppEvolution(to, message, config, retries - 1);
      }
      
      return { success: false, error: errorMessage };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    
    // Retry on network errors
    if (retries > 0) {
      console.log(`[WHATSAPP] Network error, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return sendWhatsAppEvolution(to, message, config, retries - 1);
    }
    
    return { success: false, error: message };
  }
}

// Process a single send task
async function processSendTask(
  task: SendTask,
  alerta: { titulo: string; mensagem: string },
  prefeituraNome: string,
  mensagemCompleta: string,
  evolutionConfig: EvolutionConfig | null
): Promise<{ cidadaoId: string; canal: string; success: boolean; error?: string }> {
  const { cidadao, canal } = task;
  let sendResult: SendResult = { success: false, error: "Canal não suportado" };

  switch (canal) {
    case "sms":
      if (!cidadao.telefone) {
        sendResult = { success: false, error: "Telefone não cadastrado" };
      } else {
        sendResult = await sendSMS(cidadao.telefone, mensagemCompleta);
      }
      break;
    case "email":
      if (!cidadao.email) {
        sendResult = { success: false, error: "Email não cadastrado" };
      } else {
        sendResult = await sendEmail(cidadao.email, alerta.titulo, alerta.mensagem, prefeituraNome);
      }
      break;
    case "push":
      sendResult = { success: false, error: "Push não implementado" };
      break;
    case "whatsapp":
      if (!cidadao.telefone) {
        sendResult = { success: false, error: "Telefone não cadastrado" };
      } else if (!evolutionConfig) {
        sendResult = { success: false, error: "WhatsApp não configurado" };
      } else {
        sendResult = await sendWhatsAppEvolution(cidadao.telefone, mensagemCompleta, evolutionConfig);
      }
      break;
  }

  return {
    cidadaoId: cidadao.id,
    canal,
    success: sendResult.success,
    error: sendResult.error,
  };
}

// Process sends in batches
async function processBatch(
  tasks: SendTask[],
  alerta: { titulo: string; mensagem: string },
  prefeituraNome: string,
  mensagemCompleta: string,
  evolutionConfig: EvolutionConfig | null
) {
  const promises = tasks.map(task =>
    processSendTask(task, alerta, prefeituraNome, mensagemCompleta, evolutionConfig)
  );
  return Promise.all(promises);
}

// Background task to process all sends
async function processAlertSends(
  alertaId: string,
  supabase: any,
  alerta: {
    titulo: string;
    mensagem: string;
    canais: string[];
    prefeitura_id: string;
    prefeitura: { nome: string } | null;
  },
  cidadaos: Cidadao[],
  evolutionConfig: EvolutionConfig | null
) {
  const prefeituraNome = alerta.prefeitura?.nome || "Prefeitura";
  const mensagemCompleta = `🚨 *ALERTA OFICIAL – ${prefeituraNome}*\n\n*${alerta.titulo}*\n\n${alerta.mensagem}\n\n_Em caso de emergência ligue 199._\n_Mensagem oficial da Prefeitura._`;

  // Build all tasks
  const allTasks: SendTask[] = [];
  for (const cidadao of cidadaos) {
    for (const canal of alerta.canais) {
      allTasks.push({ cidadao, canal });
    }
  }

  console.log(`[ALERT] Processing ${allTasks.length} sends in batches of ${BATCH_SIZE}`);

  let totalEnviados = 0;
  let totalErros = 0;
  const envioRecords: {
    alerta_id: string;
    cidadao_id: string;
    canal: string;
    status: "enviado" | "erro";
    enviado_em: string | null;
    erro_mensagem: string | null;
  }[] = [];

  // Process in batches
  for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
    const batch = allTasks.slice(i, i + BATCH_SIZE);
    const batchResults = await processBatch(batch, alerta, prefeituraNome, mensagemCompleta, evolutionConfig);

    // Collect results
    for (const result of batchResults) {
      if (result.success) {
        totalEnviados++;
        envioRecords.push({
          alerta_id: alertaId,
          cidadao_id: result.cidadaoId,
          canal: result.canal,
          status: "enviado",
          enviado_em: new Date().toISOString(),
          erro_mensagem: null,
        });
      } else {
        totalErros++;
        envioRecords.push({
          alerta_id: alertaId,
          cidadao_id: result.cidadaoId,
          canal: result.canal,
          status: "erro",
          enviado_em: null,
          erro_mensagem: result.error || "Erro desconhecido",
        });
      }
    }

    // Update progress periodically
    if ((i + BATCH_SIZE) % (BATCH_SIZE * PROGRESS_UPDATE_INTERVAL) === 0 || i + BATCH_SIZE >= allTasks.length) {
      await supabase
        .from("alertas")
        .update({ total_enviados: totalEnviados })
        .eq("id", alertaId);
      
      console.log(`[ALERT] Progress: ${totalEnviados + totalErros}/${allTasks.length} (${totalEnviados} sent, ${totalErros} errors)`);
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < allTasks.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Batch insert all send records
  if (envioRecords.length > 0) {
    const { error: insertError } = await supabase.from("alerta_envios").insert(envioRecords);
    if (insertError) {
      console.error("[ALERT] Error inserting send records:", insertError);
    }
  }

  // Final update
  await supabase
    .from("alertas")
    .update({
      total_enviados: totalEnviados,
      total_erros: totalErros,
    })
    .eq("id", alertaId);

  console.log(`[ALERT] Completed: ${totalEnviados} sent, ${totalErros} errors`);

  return { enviados: totalEnviados, erros: totalErros };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { alertaId } = await req.json();

    if (!alertaId) {
      return new Response(JSON.stringify({ error: "alertaId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch alert details
    const { data: alerta, error: alertaError } = await supabase
      .from("alertas")
      .select("*, prefeitura:prefeituras(nome, evolution_api_url, evolution_api_key, evolution_instance_name, evolution_connected)")
      .eq("id", alertaId)
      .single();

    if (alertaError || !alerta) {
      console.error("Erro ao buscar alerta:", alertaError);
      return new Response(JSON.stringify({ error: "Alert not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get Evolution API config
    let evolutionConfig: EvolutionConfig | null = null;
    if (alerta.canais.includes("whatsapp")) {
      const prefeitura = alerta.prefeitura;
      
      const { data: globalConfig } = await supabase
        .from("configuracoes_sistema")
        .select("valor")
        .eq("chave", "evolution_api")
        .single();

      let evolutionUrl = '';
      let evolutionKey = '';

      if (globalConfig?.valor) {
        const config = globalConfig.valor as { url?: string; api_key?: string };
        evolutionUrl = config.url || '';
        evolutionKey = config.api_key || '';
      }
      if (!evolutionUrl && prefeitura?.evolution_api_url) {
        evolutionUrl = prefeitura.evolution_api_url;
      }
      if (!evolutionKey && prefeitura?.evolution_api_key) {
        evolutionKey = prefeitura.evolution_api_key;
      }

      const instanceName = prefeitura?.evolution_instance_name;

      if (evolutionUrl && evolutionKey && instanceName && prefeitura?.evolution_connected) {
        evolutionConfig = { apiUrl: evolutionUrl, apiKey: evolutionKey, instanceName };
        console.log("[WHATSAPP] Evolution API configured:", instanceName);
      } else {
        console.warn("[WHATSAPP] Evolution API not properly configured");
      }
    }

    // Fetch citizens
    let query = supabase
      .from("cidadaos")
      .select("id, nome, telefone, email")
      .eq("prefeitura_id", alerta.prefeitura_id)
      .eq("ativo", true)
      .eq("aceita_alertas", true);

    if (alerta.bairro_id) {
      query = query.eq("bairro_id", alerta.bairro_id);
    }

    const { data: cidadaos, error: cidadaosError } = await query;

    if (cidadaosError) {
      console.error("Erro ao buscar cidadãos:", cidadaosError);
      return new Response(JSON.stringify({ error: "Error fetching citizens" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const totalCidadaos = cidadaos?.length || 0;
    const totalEnviosEsperados = totalCidadaos * (alerta.canais?.length || 1);

    console.log(`[ALERT] Starting alert ${alertaId}: ${totalCidadaos} citizens, ${alerta.canais.length} channels = ${totalEnviosEsperados} sends`);

    // Initialize progress
    await supabase
      .from("alertas")
      .update({ total_enviados: 0, total_erros: 0 })
      .eq("id", alertaId);

    // Start background processing
    const backgroundTask = processAlertSends(
      alertaId,
      supabase,
      alerta,
      cidadaos || [],
      evolutionConfig
    );

    // Use EdgeRuntime.waitUntil for background processing
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundTask);
      
      // Return immediately with expected totals
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Alerta sendo processado em segundo plano",
          total: totalEnviosEsperados,
          cidadaos: totalCidadaos,
          canais: alerta.canais,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      // Fallback: wait for completion (local development)
      const result = await backgroundTask;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          enviados: result.enviados, 
          erros: result.erros, 
          total: totalEnviosEsperados 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: unknown) {
    console.error("Error processing alert:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
