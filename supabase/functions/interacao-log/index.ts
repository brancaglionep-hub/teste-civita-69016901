import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get webhook secret from header or query param
    const webhookSecret = req.headers.get('x-webhook-secret') || 
      new URL(req.url).searchParams.get('secret');

    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Webhook secret is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate webhook secret and get prefeitura
    const { data: prefeitura, error: prefError } = await supabase
      .from('prefeituras')
      .select('id, nome')
      .eq('webhook_secret', webhookSecret)
      .eq('ativo', true)
      .single();

    if (prefError || !prefeitura) {
      console.error('Invalid webhook secret:', webhookSecret);
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      source = 'n8n',
      payload,
      status = 'received',
      reclamacao_id = null,
      error_message = null
    } = body;

    // Insert log into webhook_logs table
    const { data: log, error: logError } = await supabase
      .from('webhook_logs')
      .insert({
        prefeitura_id: prefeitura.id,
        source,
        payload: payload || body,
        status,
        reclamacao_id,
        error_message
      })
      .select('id, created_at')
      .single();

    if (logError) {
      console.error('Error inserting log:', logError);
      return new Response(
        JSON.stringify({ error: 'Failed to create log', details: logError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Log created for prefeitura ${prefeitura.nome}:`, log.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        log_id: log.id,
        created_at: log.created_at,
        prefeitura: prefeitura.nome
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in interacao-log:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
