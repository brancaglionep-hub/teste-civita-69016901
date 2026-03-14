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

    // Get instance name from query param or body
    let instanceName: string | null = null;

    if (req.method === 'GET') {
      instanceName = new URL(req.url).searchParams.get('instance');
    } else {
      const body = await req.json();
      instanceName = body.instance || body.instance_name || body.instanceName;
    }

    if (!instanceName) {
      return new Response(
        JSON.stringify({ error: 'Instance name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up prefeitura by instance: ${instanceName}`);

    // Find prefeitura by Evolution instance name
    const { data: prefeitura, error: prefError } = await supabase
      .from('prefeituras')
      .select(`
        id,
        nome,
        cidade,
        estado,
        slug,
        webhook_secret,
        evolution_instance_name,
        evolution_connected,
        evolution_phone,
        cor_primaria,
        logo_url
      `)
      .eq('evolution_instance_name', instanceName)
      .eq('ativo', true)
      .single();

    if (prefError && prefError.code === 'PGRST116') {
      console.log(`No prefeitura found for instance: ${instanceName}`);
      return new Response(
        JSON.stringify({ 
          error: 'Prefeitura not found',
          message: `No active prefeitura configured with instance name: ${instanceName}`
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prefError) {
      console.error('Database error:', prefError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: prefError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get categories for this prefeitura
    const { data: categorias } = await supabase
      .from('categorias')
      .select('id, nome, icone')
      .or(`prefeitura_id.eq.${prefeitura.id},global.eq.true`)
      .eq('ativo', true)
      .order('ordem');

    // Get bairros for this prefeitura
    const { data: bairros } = await supabase
      .from('bairros')
      .select('id, nome')
      .eq('prefeitura_id', prefeitura.id)
      .eq('ativo', true)
      .order('nome');

    console.log(`Found prefeitura: ${prefeitura.nome} (${prefeitura.id})`);

    return new Response(
      JSON.stringify({ 
        success: true,
        prefeitura: {
          id: prefeitura.id,
          nome: prefeitura.nome,
          cidade: prefeitura.cidade,
          estado: prefeitura.estado,
          slug: prefeitura.slug,
          webhook_secret: prefeitura.webhook_secret,
          evolution_connected: prefeitura.evolution_connected,
          evolution_phone: prefeitura.evolution_phone,
          cor_primaria: prefeitura.cor_primaria,
          logo_url: prefeitura.logo_url
        },
        categorias: categorias || [],
        bairros: bairros || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in prefeitura-by-instance:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
