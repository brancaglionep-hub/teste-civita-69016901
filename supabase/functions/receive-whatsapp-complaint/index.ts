import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface WhatsAppComplaint {
  // Dados do cidadão
  nome: string;
  telefone: string;
  email?: string;
  
  // Dados do endereço
  rua: string;
  numero?: string;
  bairro?: string;
  referencia?: string;
  
  // Dados da reclamação
  descricao: string;
  categoria?: string;
  
  // Localização (opcional)
  latitude?: number;
  longitude?: number;
  
  // Mídia (opcional)
  fotos?: string[];
  videos?: string[];
}

Deno.serve(async (req) => {
  console.log('=== Receive WhatsApp Complaint ===');
  console.log('Method:', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Obter o webhook secret do header ou query param
    const url = new URL(req.url);
    const webhookSecret = req.headers.get('x-webhook-secret') || url.searchParams.get('secret');
    
    if (!webhookSecret) {
      console.error('Webhook secret não fornecido');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Webhook secret é obrigatório. Envie via header x-webhook-secret ou query param ?secret=' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar prefeitura pelo webhook secret
    console.log('Buscando prefeitura pelo webhook_secret...');
    const { data: prefeitura, error: prefeituraError } = await supabase
      .from('prefeituras')
      .select('id, nome, slug')
      .eq('webhook_secret', webhookSecret)
      .eq('ativo', true)
      .single();

    if (prefeituraError || !prefeitura) {
      console.error('Prefeitura não encontrada:', prefeituraError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Webhook secret inválido ou prefeitura não encontrada' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Prefeitura encontrada:', prefeitura.nome);

    // Parse do body
    const body: WhatsAppComplaint = await req.json();
    console.log('Dados recebidos:', JSON.stringify(body, null, 2));

    // Validar campos obrigatórios
    const camposObrigatorios = ['nome', 'telefone', 'rua', 'descricao'];
    const camposFaltando = camposObrigatorios.filter(campo => !body[campo as keyof WhatsAppComplaint]);
    
    if (camposFaltando.length > 0) {
      console.error('Campos obrigatórios faltando:', camposFaltando);
      
      // Registrar log do webhook com erro
      await supabase.from('webhook_logs').insert({
        prefeitura_id: prefeitura.id,
        source: 'whatsapp',
        payload: body as unknown as Record<string, unknown>,
        status: 'error',
        error_message: `Campos obrigatórios faltando: ${camposFaltando.join(', ')}`
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Campos obrigatórios faltando: ${camposFaltando.join(', ')}`,
          campos_obrigatorios: camposObrigatorios
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar bairro se fornecido
    let bairroId: string | null = null;
    if (body.bairro) {
      const { data: bairro } = await supabase
        .from('bairros')
        .select('id')
        .eq('prefeitura_id', prefeitura.id)
        .ilike('nome', body.bairro)
        .eq('ativo', true)
        .single();
      
      if (bairro) {
        bairroId = bairro.id;
        console.log('Bairro encontrado:', body.bairro);
      } else {
        console.log('Bairro não encontrado, será null:', body.bairro);
      }
    }

    // Buscar categoria se fornecida
    let categoriaId: string | null = null;
    if (body.categoria) {
      const { data: categoria } = await supabase
        .from('categorias')
        .select('id')
        .or(`prefeitura_id.eq.${prefeitura.id},global.eq.true`)
        .ilike('nome', `%${body.categoria}%`)
        .eq('ativo', true)
        .single();
      
      if (categoria) {
        categoriaId = categoria.id;
        console.log('Categoria encontrada:', body.categoria);
      } else {
        console.log('Categoria não encontrada, será null:', body.categoria);
      }
    }

    // Preparar localização se fornecida
    let localizacao: { lat: number; lng: number } | null = null;
    if (body.latitude && body.longitude) {
      localizacao = {
        lat: body.latitude,
        lng: body.longitude
      };
    }

    // Criar reclamação usando a função do banco
    console.log('Criando reclamação...');
    const { data: reclamacao, error: reclamacaoError } = await supabase.rpc('criar_reclamacao_publica', {
      p_prefeitura_id: prefeitura.id,
      p_nome_cidadao: body.nome,
      p_email_cidadao: body.email || `${body.telefone.replace(/\D/g, '')}@whatsapp.local`,
      p_telefone_cidadao: body.telefone,
      p_rua: body.rua,
      p_numero: body.numero || null,
      p_bairro_id: bairroId,
      p_referencia: body.referencia || null,
      p_descricao: `[Via WhatsApp] ${body.descricao}`,
      p_categoria_id: categoriaId,
      p_localizacao: localizacao,
      p_fotos: body.fotos || [],
      p_videos: body.videos || []
    });

    if (reclamacaoError) {
      console.error('Erro ao criar reclamação:', reclamacaoError);
      
      // Registrar log do webhook com erro
      await supabase.from('webhook_logs').insert({
        prefeitura_id: prefeitura.id,
        source: 'whatsapp',
        payload: body as unknown as Record<string, unknown>,
        status: 'error',
        error_message: reclamacaoError.message
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao criar reclamação',
          details: reclamacaoError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Reclamação criada com sucesso:', reclamacao);

    // Buscar o ID da reclamação pelo protocolo para registrar no log
    const { data: reclamacaoCriada } = await supabase
      .from('reclamacoes')
      .select('id')
      .eq('protocolo', reclamacao.protocolo)
      .single();

    // Registrar log do webhook com sucesso
    await supabase.from('webhook_logs').insert({
      prefeitura_id: prefeitura.id,
      source: 'whatsapp',
      payload: body as unknown as Record<string, unknown>,
      status: 'success',
      reclamacao_id: reclamacaoCriada?.id || null
    });

    // Resposta de sucesso com dados para o n8n usar
    return new Response(
      JSON.stringify({
        success: true,
        protocolo: reclamacao.protocolo,
        mensagem: `Reclamação registrada com sucesso! Seu protocolo é: ${reclamacao.protocolo}`,
        prefeitura: prefeitura.nome,
        data: {
          protocolo: reclamacao.protocolo,
          nome: body.nome,
          rua: body.rua,
          bairro: body.bairro || null,
          categoria: body.categoria || null
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro não tratado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
