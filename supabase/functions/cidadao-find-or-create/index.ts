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
    const { telefone, nome, email, bairro_id } = body;

    if (!telefone) {
      return new Response(
        JSON.stringify({ error: 'Telefone is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number (remove non-digits)
    const normalizedPhone = telefone.replace(/\D/g, '');

    // Try to find existing citizen by phone
    let { data: cidadao, error: findError } = await supabase
      .from('cidadaos')
      .select('*')
      .eq('prefeitura_id', prefeitura.id)
      .eq('telefone', normalizedPhone)
      .single();

    let created = false;

    if (findError && findError.code === 'PGRST116') {
      // Not found, try to find by email if provided
      if (email) {
        const { data: cidadaoByEmail } = await supabase
          .from('cidadaos')
          .select('*')
          .eq('prefeitura_id', prefeitura.id)
          .eq('email', email.toLowerCase())
          .single();

        if (cidadaoByEmail) {
          // Found by email, update phone
          const { data: updated, error: updateError } = await supabase
            .from('cidadaos')
            .update({ telefone: normalizedPhone, updated_at: new Date().toISOString() })
            .eq('id', cidadaoByEmail.id)
            .select()
            .single();

          if (!updateError) {
            cidadao = updated;
          }
        }
      }

      // If still not found, create new citizen
      if (!cidadao) {
        const { data: newCidadao, error: createError } = await supabase
          .from('cidadaos')
          .insert({
            prefeitura_id: prefeitura.id,
            telefone: normalizedPhone,
            nome: nome || 'Cidadão via WhatsApp',
            email: email ? email.toLowerCase() : null,
            bairro_id: bairro_id || null,
            aceita_alertas: true,
            ativo: true
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating citizen:', createError);
          return new Response(
            JSON.stringify({ error: 'Failed to create citizen', details: createError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        cidadao = newCidadao;
        created = true;
        console.log(`New citizen created for prefeitura ${prefeitura.nome}:`, cidadao.id);
      }
    } else if (findError) {
      console.error('Error finding citizen:', findError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update citizen info if provided and different
    if (!created && cidadao && (nome || email || bairro_id)) {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      
      if (nome && nome !== cidadao.nome) updates.nome = nome;
      if (email && email.toLowerCase() !== cidadao.email) updates.email = email.toLowerCase();
      if (bairro_id && bairro_id !== cidadao.bairro_id) updates.bairro_id = bairro_id;

      if (Object.keys(updates).length > 1) {
        const { data: updated } = await supabase
          .from('cidadaos')
          .update(updates)
          .eq('id', cidadao.id)
          .select()
          .single();

        if (updated) cidadao = updated;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        created,
        cidadao: {
          id: cidadao.id,
          nome: cidadao.nome,
          telefone: cidadao.telefone,
          email: cidadao.email,
          bairro_id: cidadao.bairro_id,
          aceita_alertas: cidadao.aceita_alertas
        },
        prefeitura: {
          id: prefeitura.id,
          nome: prefeitura.nome
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cidadao-find-or-create:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
