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
      .select('id, nome, cidade')
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
    console.log('Received complaint data:', JSON.stringify(body));

    // Extract and validate required fields
    const {
      nome_cidadao,
      email_cidadao,
      telefone_cidadao,
      rua,
      numero,
      bairro_id,
      bairro_nome, // Alternative: find bairro by name
      categoria_id,
      categoria_nome, // Alternative: find categoria by name
      referencia,
      descricao,
      localizacao, // { lat, lng }
      fotos,
      videos
    } = body;

    // Validate required fields
    if (!nome_cidadao || nome_cidadao.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'nome_cidadao is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email_cidadao || !email_cidadao.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return new Response(
        JSON.stringify({ error: 'Valid email_cidadao is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rua || rua.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'rua is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve bairro_id from name if not provided directly
    let resolvedBairroId = bairro_id;
    if (!resolvedBairroId && bairro_nome) {
      const { data: bairro } = await supabase
        .from('bairros')
        .select('id')
        .eq('prefeitura_id', prefeitura.id)
        .ilike('nome', bairro_nome.trim())
        .eq('ativo', true)
        .single();
      
      if (bairro) {
        resolvedBairroId = bairro.id;
      }
    }

    // Resolve categoria_id from name if not provided directly
    let resolvedCategoriaId = categoria_id;
    if (!resolvedCategoriaId && categoria_nome) {
      const { data: categoria } = await supabase
        .from('categorias')
        .select('id')
        .or(`prefeitura_id.eq.${prefeitura.id},global.eq.true`)
        .ilike('nome', categoria_nome.trim())
        .eq('ativo', true)
        .single();
      
      if (categoria) {
        resolvedCategoriaId = categoria.id;
      }
    }

    // Format location if provided
    let formattedLocation = null;
    if (localizacao) {
      if (typeof localizacao === 'object' && (localizacao.lat || localizacao.latitude)) {
        formattedLocation = {
          lat: localizacao.lat || localizacao.latitude,
          lng: localizacao.lng || localizacao.longitude || localizacao.lon
        };
      } else if (typeof localizacao === 'string') {
        try {
          formattedLocation = JSON.parse(localizacao);
        } catch {
          console.log('Could not parse location string:', localizacao);
        }
      }
    }

    // Call the RPC function to create the complaint
    const { data: result, error: rpcError } = await supabase.rpc('criar_reclamacao_publica', {
      _prefeitura_id: prefeitura.id,
      _nome_cidadao: nome_cidadao.trim().substring(0, 120),
      _email_cidadao: email_cidadao.trim().toLowerCase().substring(0, 255),
      _telefone_cidadao: telefone_cidadao ? telefone_cidadao.replace(/\D/g, '').substring(0, 20) : null,
      _rua: rua.trim().substring(0, 200),
      _numero: numero ? String(numero).trim().substring(0, 20) : null,
      _bairro_id: resolvedBairroId || null,
      _categoria_id: resolvedCategoriaId || null,
      _referencia: referencia ? referencia.trim().substring(0, 500) : null,
      _descricao: descricao ? descricao.trim().substring(0, 2000) : 'Reclamação via WhatsApp',
      _localizacao: formattedLocation,
      _fotos: Array.isArray(fotos) ? fotos : [],
      _videos: Array.isArray(videos) ? videos : []
    });

    if (rpcError) {
      console.error('Error creating complaint:', rpcError);
      
      // Map known error messages
      const errorMap: Record<string, string> = {
        'prefeitura_obrigatoria': 'Prefeitura ID is required',
        'prefeitura_invalida': 'Invalid or inactive prefeitura',
        'nome_invalido': 'Invalid name (must be 1-120 characters)',
        'email_invalido': 'Invalid email address',
        'rua_invalida': 'Invalid street (must be 1-200 characters)',
        'descricao_longa': 'Description too long (max 2000 characters)',
        'bairro_invalido': 'Invalid neighborhood for this prefeitura',
        'categoria_invalida': 'Invalid category'
      };

      const friendlyError = errorMap[rpcError.message] || rpcError.message;

      // Log error to webhook_logs
      await supabase.from('webhook_logs').insert({
        prefeitura_id: prefeitura.id,
        source: 'n8n-criar-reclamacao',
        payload: body,
        status: 'error',
        error_message: friendlyError
      });

      return new Response(
        JSON.stringify({ error: friendlyError, code: rpcError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const protocolo = result?.[0]?.protocolo;

    if (!protocolo) {
      console.error('No protocol returned from RPC');
      return new Response(
        JSON.stringify({ error: 'Failed to create complaint - no protocol returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Complaint created successfully: ${protocolo} for ${prefeitura.nome}`);

    // Log success to webhook_logs
    await supabase.from('webhook_logs').insert({
      prefeitura_id: prefeitura.id,
      source: 'n8n-criar-reclamacao',
      payload: { ...body, protocolo },
      status: 'success'
    });

    // Trigger confirmation email (non-blocking)
    supabase.functions.invoke('send-complaint-confirmation', {
      body: {
        protocolo,
        prefeitura_id: prefeitura.id
      }
    }).catch(err => console.error('Error triggering confirmation email:', err));

    return new Response(
      JSON.stringify({ 
        success: true,
        protocolo,
        prefeitura: {
          id: prefeitura.id,
          nome: prefeitura.nome,
          cidade: prefeitura.cidade
        },
        dados: {
          nome_cidadao: nome_cidadao.trim(),
          email_cidadao: email_cidadao.trim().toLowerCase(),
          telefone_cidadao: telefone_cidadao || null,
          rua: rua.trim(),
          numero: numero || null,
          bairro_id: resolvedBairroId,
          categoria_id: resolvedCategoriaId,
          descricao: descricao || 'Reclamação via WhatsApp'
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in criar-reclamacao-n8n:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
