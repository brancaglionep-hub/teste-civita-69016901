import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    [key: string]: unknown;
  };
}

async function verifyWebhookSignature(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): Promise<boolean> {
  // Remove the whsec_ prefix if present
  const secretBytes = secret.startsWith("whsec_") 
    ? Uint8Array.from(atob(secret.slice(6)), c => c.charCodeAt(0))
    : new TextEncoder().encode(secret);

  // Create the signed content
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  
  // Generate HMAC-SHA256 using Web Crypto API
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent)
  );
  
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  // Parse the signature header (format: v1,signature1 v1,signature2)
  const signatures = svixSignature.split(" ").map(s => {
    const [version, sig] = s.split(",");
    return { version, signature: sig };
  });
  
  // Check if any signature matches
  return signatures.some(s => s.version === "v1" && s.signature === expectedSignature);
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Resend webhook received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the raw body for signature verification
    const body = await req.text();
    
    // Get Svix headers for signature verification
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("Missing Svix headers");
      return new Response(
        JSON.stringify({ error: "Missing webhook signature headers" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify timestamp is within 5 minutes
    const timestamp = parseInt(svixTimestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      console.error("Webhook timestamp too old");
      return new Response(
        JSON.stringify({ error: "Webhook timestamp expired" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the webhook signature
    const isValid = await verifyWebhookSignature(body, svixId, svixTimestamp, svixSignature, webhookSecret);
    
    if (!isValid) {
      console.error("Webhook signature verification failed");
      return new Response(
        JSON.stringify({ error: "Invalid webhook signature" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const event: ResendWebhookEvent = JSON.parse(body);
    
    console.log("Resend webhook verified! Event type:", event.type);
    console.log("Resend webhook data:", JSON.stringify(event.data, null, 2));

    // Handle different event types
    switch (event.type) {
      case "email.sent":
        console.log(`Email sent to: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.delivered":
        console.log(`Email delivered to: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.delivery_delayed":
        console.log(`Email delivery delayed for: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.complained":
        console.log(`Email complaint from: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.bounced":
        console.log(`Email bounced for: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.opened":
        console.log(`Email opened by: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.clicked":
        console.log(`Email link clicked by: ${event.data.to?.join(", ")}`);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true, type: event.type }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing Resend webhook:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
