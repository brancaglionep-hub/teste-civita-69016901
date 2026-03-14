import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('=== Send WhatsApp Message ===');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prefeitura_id, conversa_id, telefone, mensagem } = await req.json();

    console.log('Enviando mensagem para:', telefone);
    console.log('Prefeitura:', prefeitura_id);

    // Verificar permissão do usuário
    const { data: role } = await supabase
      .from('user_roles')
      .select('role, prefeitura_id')
      .eq('user_id', user.id)
      .or(`role.eq.super_admin,and(role.eq.admin_prefeitura,prefeitura_id.eq.${prefeitura_id})`)
      .maybeSingle();

    if (!role) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para enviar mensagens' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração da prefeitura
    const { data: prefeitura, error: prefError } = await supabase
      .from('prefeituras')
      .select('id, nome, evolution_api_url, evolution_api_key, evolution_instance_name, evolution_connected')
      .eq('id', prefeitura_id)
      .single();

    if (prefError || !prefeitura) {
      return new Response(
        JSON.stringify({ error: 'Prefeitura não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração global da Evolution API (mesma lógica do receive-evolution-webhook)
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
      return new Response(
        JSON.stringify({ error: 'WhatsApp não está configurado para esta prefeitura' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar número (garantir formato correto)
    let numero = telefone.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    if (!numero.startsWith('55')) {
      numero = '55' + numero;
    }

    // Enviar via Evolution API
    const finalEvolutionUrl = evolutionUrl.replace(/\/$/, '');

    console.log('Enviando via Evolution API...');
    console.log('URL:', `${finalEvolutionUrl}/message/sendText/${instanceName}`);
    console.log('API Key (primeiros 8 chars):', evolutionKey?.substring(0, 8) + '...');

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
    console.log('Status HTTP:', evolutionResponse.status);
    console.log('Resposta Evolution (raw):', evolutionResultText);

    let evolutionResult;
    try {
      evolutionResult = JSON.parse(evolutionResultText);
    } catch {
      evolutionResult = { raw: evolutionResultText };
    }

    if (!evolutionResponse.ok) {
      console.error('Erro Evolution API:', evolutionResponse.status, evolutionResult);
      throw new Error(evolutionResult?.message || evolutionResult?.response?.message || `Erro HTTP ${evolutionResponse.status}`);
    }

    // Salvar mensagem no banco
    const { error: msgError } = await supabase
      .from('whatsapp_mensagens')
      .insert({
        conversa_id,
        prefeitura_id,
        direcao: 'saida',
        tipo: 'texto',
        conteudo: mensagem,
        enviado_por: 'operador',
        operador_id: user.id,
      });

    if (msgError) {
      console.error('Erro ao salvar mensagem:', msgError);
      // Não falhar se não conseguir salvar, mensagem já foi enviada
    }

    // Atualizar última mensagem da conversa
    await supabase
      .from('whatsapp_conversas')
      .update({ ultima_mensagem_at: new Date().toISOString() })
      .eq('id', conversa_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        evolution_response: evolutionResult 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao enviar mensagem',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
