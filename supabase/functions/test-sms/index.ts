import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone } = await req.json();

    if (!telefone) {
      return new Response(JSON.stringify({ error: "telefone is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check credentials
    console.log("[TEST-SMS] Checking Twilio credentials...");
    console.log("[TEST-SMS] Account SID configured:", !!twilioAccountSid);
    console.log("[TEST-SMS] Auth Token configured:", !!twilioAuthToken);
    console.log("[TEST-SMS] Phone Number configured:", !!twilioPhoneNumber);

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return new Response(JSON.stringify({ 
        error: "Twilio não configurado",
        details: {
          accountSid: !!twilioAccountSid,
          authToken: !!twilioAuthToken,
          phoneNumber: !!twilioPhoneNumber,
        }
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Format phone number
    let formattedPhone = telefone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }
    formattedPhone = "+" + formattedPhone;

    console.log("[TEST-SMS] Sending test SMS to:", formattedPhone);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: twilioPhoneNumber,
        To: formattedPhone,
        Body: "🧪 TESTE - CivitaInfra\n\nEste é um SMS de teste para verificar a integração com Twilio.\n\nSe você recebeu esta mensagem, a configuração está funcionando corretamente!",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[TEST-SMS] Twilio error:", data);
      return new Response(JSON.stringify({ 
        success: false, 
        error: data.message || "Erro ao enviar SMS",
        code: data.code,
        moreInfo: data.more_info
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[TEST-SMS] SMS sent successfully:", data.sid);
    
    return new Response(JSON.stringify({ 
      success: true, 
      messageId: data.sid,
      to: formattedPhone,
      status: data.status
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error("[TEST-SMS] Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
