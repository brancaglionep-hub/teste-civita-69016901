import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversaData {
  id: string;
  prefeitura_id: string;
  telefone: string;
  nome_cidadao: string | null;
  estado: string;
  dados_coletados: {
    nome?: string;
    email?: string;
    telefone?: string;
    rua?: string;
    numero?: string;
    bairro?: string;
    bairro_id?: string;
    categoria?: string;
    categoria_id?: string;
    descricao?: string;
    referencia?: string;
  };
  midias_coletadas: {
    fotos: string[];
    videos: string[];
  };
  localizacao: { lat: number; lng: number } | null;
}

interface CidadaoData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bairro_id: string | null;
  total_reclamacoes?: number;
  bairro?: { nome: string }[] | null;
}

interface ReclamacaoHistorico {
  id: string;
  protocolo: string;
  status: string;
  rua: string;
  created_at: string;
  categoria?: { nome: string }[] | null;
}

interface PrefeituraData {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
}

interface MensagemRecebida {
  texto: string;
  fotos: string[];
  videos: string[];
  localizacao: { lat: number; lng: number } | null;
  telefone: string;
  nome: string;
}

// Fluxo de etapas igual ao do site
const ETAPAS_FLUXO = [
  'dados_pessoais',    // Etapa 1: Nome, Email, Telefone
  'localizacao',       // Etapa 2: Bairro, Rua, Número, Referência
  'tipo_problema',     // Etapa 3: Categoria do problema
  'descricao',         // Etapa 4: Descrição detalhada
  'midia',             // Etapa 5: Fotos/Vídeos
  'confirmacao',       // Etapa 6: Confirmar e enviar
];

// Tipos de problema (igual ao ProblemTypeSelector) - com números para facilitar seleção
const TIPOS_PROBLEMA = [
  { id: 'buraco', label: 'Buraco na rua', numero: 1 },
  { id: 'danificada', label: 'Rua danificada', numero: 2 },
  { id: 'alagada', label: 'Rua alagada', numero: 3 },
  { id: 'desnivel', label: 'Desnível na pista', numero: 4 },
  { id: 'dificil', label: 'Rua difícil de trafegar', numero: 5 },
  { id: 'outro', label: 'Outro problema', numero: 6 },
];

function normText(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isPularMidia(textoNormalizado: string) {
  if (!textoNormalizado) return false;
  return [
    '1',            // Número 1 para continuar/revisar
    'proximo',
    'seguir',
    'continuar',
    'avancar',
    'sem foto',
    'sem fotos',
    'sem midia',
    'sem midias',
    'nao',
    'nao tenho',
    'nao tenho foto',
    'nao tenho fotos',
    'nao tenho video',
    'nao tenho videos',
  ].includes(textoNormalizado);
}

function isSaudacao(textoNormalizado: string) {
  if (!textoNormalizado) return false;
  return [
    'oi',
    'ola',
    'olá',
    'bom dia',
    'boa tarde',
    'boa noite',
    'e ai',
    'eai',
  ].includes(textoNormalizado);
}

function isConfirmacao(textoNormalizado: string) {
  if (!textoNormalizado) return false;
  return [
    '1',            // Número 1 para confirmar
    'confirmar',
    'confirmo',
    'sim',
    's',
    'ok',
    'pode enviar',
    'enviar',
  ].includes(textoNormalizado) || textoNormalizado.startsWith('confirm');
}

function formatQtd(qtd: number, singular: string, plural: string) {
  if (qtd === 1) return `1 ${singular}`;
  return `${qtd} ${plural}`;
}

function buildResumoConfirmacao(args: {
  dados: ConversaData['dados_coletados'];
  fotos: number;
  videos: number;
  prefeituraNome: string;
}) {
  const { dados, fotos, videos, prefeituraNome } = args;

  const tipoLabel = TIPOS_PROBLEMA.find((t) => t.id === dados.categoria)?.label || dados.categoria;
  const midiaLinha =
    fotos === 0 && videos === 0
      ? 'Nenhuma'
      : [
          fotos > 0 ? formatQtd(fotos, 'foto enviada', 'fotos enviadas') : null,
          videos > 0 ? formatQtd(videos, 'vídeo enviado', 'vídeos enviados') : null,
        ]
          .filter(Boolean)
          .join(' e ');

  return (
    `📋 *Revisão da sua reclamação*\n\n` +
    `*Nome:* ${dados.nome || '-'}\n` +
    `*Email:* ${dados.email || '-'}\n` +
    `*Telefone:* ${dados.telefone || '-'}\n` +
    `*Bairro:* ${dados.bairro || '-'}\n` +
    `*Rua:* ${dados.rua || '-'}${dados.numero ? ', ' + dados.numero : ''}\n` +
    (dados.referencia ? `*Referência:* ${dados.referencia}\n` : '') +
    `*Tipo do problema:* ${tipoLabel || '-'}\n` +
    `*Descrição:* ${dados.descricao || '-'}\n` +
    `*Mídia:* ${midiaLinha}\n\n` +
    `Se estiver tudo certo, digite 1️⃣ para enviar.\n` +
    `_${prefeituraNome}_`
  );
}

Deno.serve(async (req) => {
  console.log('=== WhatsApp AI Agent v2 - Fluxo Guiado ===');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { prefeitura, mensagem, instanceName } = await req.json() as {
      prefeitura: PrefeituraData;
      mensagem: MensagemRecebida;
      instanceName: string;
    };

    console.log('Processando mensagem de:', mensagem.telefone);
    console.log('Prefeitura:', prefeitura.nome, '-', prefeitura.cidade, '/', prefeitura.estado);

    // Limpar telefone (remover @s.whatsapp.net e caracteres especiais)
    const telefoneLimpo = mensagem.telefone.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    
    // Buscar cidadão existente pelo telefone
    const { data: cidadaoExistente } = await supabase
      .from('cidadaos')
      .select(`
        id,
        nome,
        email,
        telefone,
        bairro_id,
        bairro:bairros(nome)
      `)
      .eq('prefeitura_id', prefeitura.id)
      .eq('telefone', telefoneLimpo)
      .maybeSingle();

    // Contar reclamações anteriores
    let totalReclamacoes = 0;
    let reclamacoesAnteriores: ReclamacaoHistorico[] = [];
    
    if (cidadaoExistente) {
      const { count } = await supabase
        .from('reclamacoes')
        .select('*', { count: 'exact', head: true })
        .eq('prefeitura_id', prefeitura.id)
        .eq('telefone_cidadao', telefoneLimpo);
      
      totalReclamacoes = count || 0;

      // Buscar últimas 3 reclamações
      const { data: ultimas } = await supabase
        .from('reclamacoes')
        .select('id, protocolo, status, rua, created_at, categoria:categorias(nome)')
        .eq('prefeitura_id', prefeitura.id)
        .eq('telefone_cidadao', telefoneLimpo)
        .order('created_at', { ascending: false })
        .limit(3);

      reclamacoesAnteriores = ultimas || [];
    }

    const usuarioRecorrente = totalReclamacoes > 0;
    console.log('Usuário recorrente:', usuarioRecorrente, '- Total reclamações:', totalReclamacoes);

    // Buscar ou criar conversa
    let { data: conversa, error: conversaError } = await supabase
      .from('whatsapp_conversas')
      .select('*')
      .eq('prefeitura_id', prefeitura.id)
      .eq('telefone', mensagem.telefone)
      .single();

    if (conversaError && conversaError.code === 'PGRST116') {
      // Criar nova conversa - já preencher dados se usuário existente
      const dadosIniciais: Record<string, string> = {};
      
      if (cidadaoExistente) {
        if (cidadaoExistente.nome) dadosIniciais.nome = cidadaoExistente.nome;
        if (cidadaoExistente.email) dadosIniciais.email = cidadaoExistente.email;
        if (cidadaoExistente.telefone) dadosIniciais.telefone = cidadaoExistente.telefone;
        if (cidadaoExistente.bairro_id) dadosIniciais.bairro_id = cidadaoExistente.bairro_id;
        if (cidadaoExistente.bairro?.[0]?.nome) dadosIniciais.bairro = cidadaoExistente.bairro[0].nome;
      }

      const { data: novaConversa, error: createError } = await supabase
        .from('whatsapp_conversas')
        .insert({
          prefeitura_id: prefeitura.id,
          telefone: mensagem.telefone,
          nome_cidadao: cidadaoExistente?.nome || mensagem.nome,
          estado: 'inicio',
          dados_coletados: dadosIniciais,
          midias_coletadas: { fotos: [], videos: [] },
        })
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar conversa:', createError);
        throw new Error('Erro ao criar conversa');
      }
      conversa = novaConversa;
    } else if (conversaError) {
      console.error('Erro ao buscar conversa:', conversaError);
      throw new Error('Erro ao buscar conversa');
    }

    const conversaData = conversa as ConversaData;

    // Atualizar mídias se recebidas (evitar duplicação por reenvio do webhook)
    // Garantir que midias_coletadas sempre tenha estrutura correta
    const midiasBase = {
      fotos: Array.isArray(conversaData.midias_coletadas?.fotos) ? conversaData.midias_coletadas.fotos : [],
      videos: Array.isArray(conversaData.midias_coletadas?.videos) ? conversaData.midias_coletadas.videos : [],
    };
    let midiasAtualizadas = { ...midiasBase };
    if (mensagem.fotos.length > 0) {
      midiasAtualizadas.fotos = Array.from(new Set([...midiasAtualizadas.fotos, ...mensagem.fotos]));
    }
    if (mensagem.videos.length > 0) {
      midiasAtualizadas.videos = Array.from(new Set([...midiasAtualizadas.videos, ...mensagem.videos]));
    }

    // Atualizar localização se recebida
    let localizacaoAtualizada = conversaData.localizacao;
    if (mensagem.localizacao) {
      localizacaoAtualizada = mensagem.localizacao;
    }

    // Buscar bairros e categorias para contexto
    const [bairrosResult, categoriasResult] = await Promise.all([
      supabase
        .from('bairros')
        .select('id, nome')
        .eq('prefeitura_id', prefeitura.id)
        .eq('ativo', true)
        .order('nome'),
      supabase
        .from('categorias')
        .select('id, nome, icone')
        .or(`prefeitura_id.eq.${prefeitura.id},global.eq.true`)
        .eq('ativo', true)
        .order('ordem')
        .order('nome'),
    ]);

    const bairros = bairrosResult.data || [];
    const categorias = categoriasResult.data || [];

    // Verificar comando de consulta ou protocolo direto
    const textoLower = mensagem.texto.toLowerCase().trim();
    const textoNorm = normText(mensagem.texto);
    const textoUpper = mensagem.texto.toUpperCase().trim();
    
    // Função para verificar se parece um protocolo (ex: REC-2025-12345, 2025-001, etc.)
    const pareceProtocolo = (texto: string): boolean => {
      // Padrões comuns de protocolo
      const padroes = [
        /^REC-\d{4,}-\d+$/i,          // REC-2025-12345 ou REC-20250101-1234
        /^\d{4}-\d{3,}$/,             // 2025-00123
        /^[A-Z]{2,4}-\d{4,}-\d+$/i,   // ABC-2025-123
        /^[A-Z]{2,4}\d{4,}/i,         // ABC20250001
        /^\d{6,}$/,                   // 123456 (só números, 6+ dígitos)
      ];
      return padroes.some(p => p.test(texto.replace(/\s/g, '')));
    };
    
    // Extrair protocolo de texto (pode estar em uma frase)
    const extrairProtocolo = (texto: string): string | null => {
      // Padrão REC-XXXXXXXX-XXXX
      const matchRec = texto.match(/REC-\d{4,}-\d+/i);
      if (matchRec) return matchRec[0].toUpperCase();
      
      // Outros padrões
      const matchGeneric = texto.match(/[A-Z]{2,4}-\d{4,}-\d+/i);
      if (matchGeneric) return matchGeneric[0].toUpperCase();
      
      return null;
    };
    
    // Detectar intenção de consulta de andamento/status
    const frasesConsulta = [
      'quero ver',
      'ver andamento',
      'ver o andamento',
      'ver status',
      'ver o status',
      'como esta',
      'como ta',
      'andamento da reclamacao',
      'andamento da minha reclamacao',
      'status da reclamacao',
      'status da minha reclamacao',
      'acompanhar reclamacao',
      'acompanhar minha reclamacao',
      'consultar reclamacao',
      'minha reclamacao',
      'situacao da reclamacao',
      'qual o status',
      'qual status',
      'qual andamento',
      'qual o andamento',
    ];
    
    const querConsultarAndamento = frasesConsulta.some(f => textoNorm.includes(f));
    
    // Detectar se é consulta de protocolo (comando explícito ou parece protocolo)
    const isConsultaExplicita = textoLower.startsWith('/consultar ') || textoLower.startsWith('/status ') || textoLower.startsWith('consultar ');
    const isProtocoloDireto = pareceProtocolo(mensagem.texto.trim());
    const protocoloNoTexto = extrairProtocolo(mensagem.texto);
    
    // Se quer consultar andamento mas não mandou protocolo, perguntar
    if (querConsultarAndamento && !protocoloNoTexto && !isProtocoloDireto) {
      // Verificar se tem reclamações anteriores
      if (reclamacoesAnteriores.length > 0) {
        const statusEmoji: Record<string, string> = {
          recebida: '📥',
          em_andamento: '🔄',
          resolvida: '✅',
          arquivada: '📁',
        };
        
        let resposta = `📋 *Suas reclamações recentes:*\n\n`;
        reclamacoesAnteriores.forEach((rec, i) => {
          resposta += `${i + 1}. ${statusEmoji[rec.status] || '📌'} *${rec.protocolo}*\n`;
          resposta += `   ${rec.categoria?.[0]?.nome || 'Problema'} - ${rec.rua}\n\n`;
        });
        resposta += `Digite o *protocolo completo* para ver os detalhes (ex: REC-20250101-1234).`;
        
        return new Response(
          JSON.stringify({ resposta, acao: 'listar_consulta' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            resposta: `📋 Você ainda não tem reclamações registradas com este número.\n\nSe quiser consultar uma reclamação, me envie o número do *protocolo* (ex: REC-20250101-1234).`,
            acao: 'consulta',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Não interpretar números simples (1, 2, 3...) como consulta.
    // Para consultar, o cidadão deve:
    // - enviar o comando explícito "consultar ..." / "/consultar ..."
    // - ou enviar o protocolo completo (ex: REC-20250101-1234)

    // Usar protocolo extraído do texto ou o texto direto
    const protocoloParaConsultar = protocoloNoTexto || (isProtocoloDireto ? textoUpper.replace(/\s/g, '') : null);
    
    if (isConsultaExplicita || protocoloParaConsultar) {
      // Usar protocolo já extraído ou extrair do comando
      let protocolo = '';
      if (protocoloParaConsultar) {
        protocolo = protocoloParaConsultar;
      } else if (isConsultaExplicita) {
        protocolo = mensagem.texto.substring(mensagem.texto.indexOf(' ') + 1).trim().toUpperCase();
      } else {
        protocolo = textoUpper.replace(/\s/g, '');
      }
      
      console.log(`Consultando protocolo: ${protocolo}`);
      
      const { data: consultaResult } = await supabase
        .rpc('consultar_protocolo', {
          _protocolo: protocolo,
          _prefeitura_id: prefeitura.id,
        });

      // Se encontrou o protocolo, retorna os detalhes
      if (consultaResult && consultaResult.length > 0) {
        const rec = consultaResult[0];
        const statusMap: Record<string, string> = {
          recebida: '📥 Recebida - Aguardando análise',
          em_andamento: '🔄 Em Andamento - Equipe trabalhando',
          resolvida: '✅ Resolvida',
          arquivada: '📁 Arquivada',
        };
        
        // Buscar histórico de movimentações
        const { data: historicoResult } = await supabase
          .rpc('consultar_historico_protocolo', {
            _protocolo: protocolo,
            _prefeitura_id: prefeitura.id,
          });
        
        let respostaConsulta = `📋 *Consulta de Protocolo*\n\n` +
          `*Protocolo:* ${rec.protocolo}\n` +
          `*Status:* ${statusMap[rec.status] || rec.status}\n` +
          `*Local:* ${rec.rua}${rec.bairro_nome ? `, ${rec.bairro_nome}` : ''}\n` +
          `*Categoria:* ${rec.categoria_nome || 'Não especificada'}\n` +
          `*Data:* ${new Date(rec.created_at).toLocaleDateString('pt-BR')}\n`;
        
        // Adicionar histórico de movimentações
        if (historicoResult && historicoResult.length > 0) {
          respostaConsulta += `\n📜 *Histórico de Movimentações:*\n`;
          historicoResult.slice(0, 5).forEach((h: any) => {
            const dataHist = new Date(h.created_at).toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
            const statusAnterior = h.status_anterior ? statusMap[h.status_anterior]?.split(' ')[0] || h.status_anterior : 'Novo';
            const statusNovo = statusMap[h.status_novo]?.split(' ')[0] || h.status_novo;
            respostaConsulta += `• ${dataHist} - ${statusAnterior} ➔ ${statusNovo}\n`;
            if (h.observacao) {
              respostaConsulta += `  _${h.observacao}_\n`;
            }
          });
        }
        
        if (rec.resposta_prefeitura) {
          respostaConsulta += `\n💬 *Resposta da Prefeitura:*\n${rec.resposta_prefeitura}`;
        }
        respostaConsulta += `\n\n_${prefeitura.nome}_`;

        return new Response(
          JSON.stringify({ resposta: respostaConsulta, acao: 'consulta' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (isConsultaExplicita) {
        // Só mostra erro se foi consulta explícita, não se só parecia protocolo
        const respostaConsulta = `❌ Protocolo *${protocolo}* não encontrado.\n\nVerifique se digitou corretamente ou entre em contato com a ${prefeitura.nome}.`;
        return new Response(
          JSON.stringify({ resposta: respostaConsulta, acao: 'consulta' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Se parecia protocolo mas não encontrou, continua o fluxo normal
    }

    // Verificar comando de minhas reclamações
    if (textoLower === '/minhas' || textoLower === 'minhas reclamações' || textoLower === 'minhas reclamacoes') {
      if (reclamacoesAnteriores.length === 0) {
        return new Response(
          JSON.stringify({
            resposta: `📋 Você ainda não tem reclamações registradas com este número.\n\nPara registrar uma nova, me conte qual o problema!`,
            acao: 'listar',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusEmoji: Record<string, string> = {
        recebida: '📥',
        em_andamento: '🔄',
        resolvida: '✅',
        arquivada: '📁',
      };

      let lista = `📋 *Suas Reclamações* (${totalReclamacoes} total)\n\n`;
      reclamacoesAnteriores.forEach((rec, i) => {
        lista += `${i + 1}. ${statusEmoji[rec.status] || '📌'} *${rec.protocolo}*\n`;
        lista += `   ${rec.categoria?.[0]?.nome || 'Problema'} - ${rec.rua}\n`;
        lista += `   ${new Date(rec.created_at).toLocaleDateString('pt-BR')}\n\n`;
      });
      lista += `Para consultar uma, digite:\n*consultar PROTOCOLO*`;

      return new Response(
        JSON.stringify({ resposta: lista, acao: 'listar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar comando de cancelamento
    if (textoLower === '/cancelar' || textoLower === 'cancelar') {
      await supabase
        .from('whatsapp_conversas')
        .update({
          estado: 'inicio',
          dados_coletados: cidadaoExistente ? {
            nome: cidadaoExistente.nome,
            email: cidadaoExistente.email,
            telefone: cidadaoExistente.telefone,
            bairro_id: cidadaoExistente.bairro_id,
            bairro: cidadaoExistente.bairro?.[0]?.nome,
          } : {},
          midias_coletadas: { fotos: [], videos: [] },
          localizacao: null,
          ultima_mensagem_at: new Date().toISOString(),
        })
        .eq('id', conversaData.id);

      return new Response(
        JSON.stringify({
          resposta: `❌ Reclamação cancelada.\n\nSe precisar registrar uma nova reclamação, é só me descrever o problema! 😊`,
          acao: 'cancelar',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir prompt para a IA seguindo o fluxo do site
    const dadosAtuais = conversaData.dados_coletados;
    
    // Determinar etapa atual baseado nos dados coletados
    // FLUXO: dados_pessoais -> localizacao (bairro+rua+numero) -> tipo_problema -> descricao -> midia -> confirmacao
    let etapaAtual = 'dados_pessoais';
    if (dadosAtuais.nome && dadosAtuais.email) {
      etapaAtual = 'localizacao';
    }
    // Só avança para tipo_problema se tiver rua, bairro E número confirmados
    if (dadosAtuais.nome && dadosAtuais.email && dadosAtuais.rua && dadosAtuais.bairro && dadosAtuais.numero) {
      etapaAtual = 'tipo_problema';
    }
    if (dadosAtuais.nome && dadosAtuais.email && dadosAtuais.rua && dadosAtuais.bairro && dadosAtuais.numero && dadosAtuais.categoria) {
      etapaAtual = 'descricao';
    }
    if (dadosAtuais.nome && dadosAtuais.email && dadosAtuais.rua && dadosAtuais.bairro && dadosAtuais.numero && dadosAtuais.categoria && dadosAtuais.descricao) {
      etapaAtual = 'midia';
    }
    if (conversaData.estado === 'confirmando') {
      etapaAtual = 'confirmacao';
    }
    if (conversaData.estado === 'aguardando_midia') {
      etapaAtual = 'midia';
    }
    
    console.log('Etapa atual determinada:', etapaAtual, '| Dados:', JSON.stringify(dadosAtuais));

     const tiposProblemaTexto = TIPOS_PROBLEMA.map(t => `${t.numero}️⃣ ${t.label}`).join('\n');

      // Ajustes de fluxo na etapa de mídia (evitar perguntas repetidas)
      const textoNormalizado = normText(mensagem.texto || '');
      const temNovaMidia = mensagem.fotos.length > 0 || mensagem.videos.length > 0;

      // Saudação: reconhecer cidadão no primeiro "olá" e só pedir nome quando for novo.
      if (
        conversaData.estado === 'inicio' &&
        isSaudacao(textoNormalizado) &&
        !temNovaMidia &&
        !mensagem.localizacao
      ) {
        const respostaSaudacao = cidadaoExistente?.nome
          ? `Olá, *${cidadaoExistente.nome}*! 😊 Já te reconheci por aqui.\n\nMe diga o *bairro* e a *rua* onde está o problema.`
          : `Olá! 😊 Para começar seu cadastro, qual é o seu *nome completo*?`;

        await supabase
          .from('whatsapp_conversas')
          .update({
            estado: 'coletando_dados',
            midias_coletadas: midiasAtualizadas,
            localizacao: localizacaoAtualizada,
            ultima_mensagem_at: new Date().toISOString(),
          })
          .eq('id', conversaData.id);

        return new Response(
          JSON.stringify({
            resposta: respostaSaudacao,
            acao: 'continuar',
            protocolo: null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (etapaAtual === 'midia') {
        // Se chegou mídia agora, apenas confirmar recebimento e orientar "próximo".
        if (temNovaMidia) {
          await supabase
            .from('whatsapp_conversas')
            .update({
              estado: 'aguardando_midia',
              midias_coletadas: midiasAtualizadas,
              localizacao: localizacaoAtualizada,
              ultima_mensagem_at: new Date().toISOString(),
            })
            .eq('id', conversaData.id);

          const fotosTxt = midiasAtualizadas.fotos.length > 0
            ? formatQtd(midiasAtualizadas.fotos.length, 'foto recebida', 'fotos recebidas')
            : null;
          const videosTxt = midiasAtualizadas.videos.length > 0
            ? formatQtd(midiasAtualizadas.videos.length, 'vídeo recebido', 'vídeos recebidos')
            : null;

          const lista = [fotosTxt, videosTxt].filter(Boolean).join(' e ');

          return new Response(
            JSON.stringify({
              resposta: `✅ Mídia recebida: ${lista}.\n\nSe quiser enviar mais, pode mandar agora.\n\nOu digite 1️⃣ para *revisar e enviar*`,
              acao: 'continuar',
              protocolo: null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Se o cidadão disser "não"/"próximo"/"seguir", ir direto para revisão.
        if (isPularMidia(textoNormalizado)) {
          await supabase
            .from('whatsapp_conversas')
            .update({
              estado: 'confirmando',
              midias_coletadas: midiasAtualizadas,
              localizacao: localizacaoAtualizada,
              ultima_mensagem_at: new Date().toISOString(),
            })
            .eq('id', conversaData.id);

          return new Response(
            JSON.stringify({
              resposta: buildResumoConfirmacao({
                dados: conversaData.dados_coletados,
                fotos: midiasAtualizadas.fotos.length,
                videos: midiasAtualizadas.videos.length,
                prefeituraNome: prefeitura.nome,
              }),
              acao: 'continuar',
              protocolo: null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Se ainda não pedimos mídia (estado não é aguardando_midia), perguntar agora
        if (conversaData.estado !== 'aguardando_midia') {
          await supabase
            .from('whatsapp_conversas')
            .update({
              estado: 'aguardando_midia',
              midias_coletadas: midiasAtualizadas,
              localizacao: localizacaoAtualizada,
              ultima_mensagem_at: new Date().toISOString(),
            })
            .eq('id', conversaData.id);

          return new Response(
            JSON.stringify({
              resposta: `📷 Agora você pode enviar *fotos* ou *vídeos* do problema.\n\nIsso ajuda muito a equipe a entender a situação!\n\n*Envie as mídias agora* ou digite 1️⃣ para *continuar sem mídia*.`,
              acao: 'continuar',
              protocolo: null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Confirmação: evitar mandar a revisão 2x. Quando o cidadão digitar confirmar/sim, cria a reclamação direto.
      if (conversaData.estado === 'confirmando') {
        if (!isConfirmacao(textoNormalizado)) {
          return new Response(
            JSON.stringify({
              resposta: buildResumoConfirmacao({
                dados: conversaData.dados_coletados,
                fotos: midiasAtualizadas.fotos.length,
                videos: midiasAtualizadas.videos.length,
                prefeituraNome: prefeitura.nome,
              }),
              acao: 'continuar',
              protocolo: null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const dadosConfirmacao = { ...conversaData.dados_coletados } as Record<string, string>;
        if (!dadosConfirmacao.telefone) dadosConfirmacao.telefone = telefoneLimpo;

        const camposObrigatorios = ['nome', 'email', 'rua', 'bairro', 'descricao'] as const;
        const faltando = camposObrigatorios.filter((c) => !dadosConfirmacao[c]);

        if (faltando.length > 0) {
          await supabase
            .from('whatsapp_conversas')
            .update({
              estado: 'coletando_dados',
              ultima_mensagem_at: new Date().toISOString(),
            })
            .eq('id', conversaData.id);

          return new Response(
            JSON.stringify({
              resposta: `⚠️ Antes de enviar, faltou informar: *${faltando.join(', ')}*.\n\nPode me mandar esses dados agora?`,
              acao: 'continuar',
              protocolo: null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: reclamacao, error: recError } = await supabase.rpc('criar_reclamacao_publica', {
          _prefeitura_id: prefeitura.id,
          _nome_cidadao: dadosConfirmacao.nome || mensagem.nome,
          _email_cidadao: dadosConfirmacao.email || `${telefoneLimpo}@whatsapp.temp`,
          _telefone_cidadao: telefoneLimpo,
          _rua: dadosConfirmacao.rua,
          _numero: dadosConfirmacao.numero || null,
          _bairro_id: dadosConfirmacao.bairro_id || null,
          _categoria_id: dadosConfirmacao.categoria_id || null,
          _referencia: dadosConfirmacao.referencia || null,
          _descricao: dadosConfirmacao.descricao,
          _localizacao: localizacaoAtualizada,
          _fotos: midiasAtualizadas.fotos,
          _videos: midiasAtualizadas.videos,
        });

        if (recError) {
          console.error('Erro ao criar reclamação (confirmacao):', recError);
          return new Response(
            JSON.stringify({
              resposta: `❌ Desculpe, ocorreu um erro ao registrar sua reclamação.\n\nPor favor, tente novamente em alguns instantes.`,
              acao: 'continuar',
              protocolo: null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const reclamacaoCriada = reclamacao?.[0];

        const { data: recCriada } = await supabase
          .from('reclamacoes')
          .select('id')
          .eq('protocolo', reclamacaoCriada.protocolo)
          .single();

        await supabase
          .from('whatsapp_conversas')
          .update({
            estado: 'inicio',
            dados_coletados: {
              nome: dadosConfirmacao.nome,
              email: dadosConfirmacao.email,
              telefone: telefoneLimpo,
              bairro: dadosConfirmacao.bairro,
              bairro_id: dadosConfirmacao.bairro_id,
            },
            midias_coletadas: { fotos: [], videos: [] },
            localizacao: null,
            ultima_mensagem_at: new Date().toISOString(),
            reclamacao_id: recCriada?.id || null,
          })
          .eq('id', conversaData.id);

        const respostaFinal = `✅ Reclamação registrada com sucesso.\n\n` +
          `📋 *Protocolo:* ${reclamacaoCriada.protocolo}\n\n` +
          `📍 *Local:* ${dadosConfirmacao.rua}${dadosConfirmacao.numero ? ', ' + dadosConfirmacao.numero : ''}${dadosConfirmacao.bairro ? ' - ' + dadosConfirmacao.bairro : ''}\n` +
          `🏷️ *Problema:* ${dadosConfirmacao.categoria || dadosConfirmacao.descricao?.substring(0, 50)}\n` +
          `📷 *Mídia:* ${midiasAtualizadas.fotos.length} foto(s), ${midiasAtualizadas.videos.length} vídeo(s)\n\n` +
          `Para acompanhar, digite:\n` +
          `👉 *consultar ${reclamacaoCriada.protocolo}*\n\n` +
          `_${prefeitura.nome}_`;

        return new Response(
          JSON.stringify({
            resposta: respostaFinal,
            acao: 'reclamacao_criada',
            protocolo: reclamacaoCriada.protocolo,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    // Buscar últimas mensagens da conversa para contexto
    const { data: historicoMensagens } = await supabase
      .from('whatsapp_mensagens')
      .select('conteudo, direcao, created_at')
      .eq('conversa_id', conversaData.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Formatar histórico para contexto (ordem cronológica)
    const historicoFormatado = (historicoMensagens || [])
      .reverse()
      .map(m => `${m.direcao === 'entrada' ? 'CIDADÃO' : 'ASSISTENTE'}: ${m.conteudo}`)
      .join('\n');

    // Identificar claramente o que já foi coletado
    const dadosJaColetados: string[] = [];
    if (dadosAtuais.nome) dadosJaColetados.push(`✅ Nome: ${dadosAtuais.nome}`);
    if (dadosAtuais.email) dadosJaColetados.push(`✅ Email: ${dadosAtuais.email}`);
    if (dadosAtuais.telefone) dadosJaColetados.push(`✅ Telefone: ${dadosAtuais.telefone}`);
    if (dadosAtuais.bairro) dadosJaColetados.push(`✅ Bairro: ${dadosAtuais.bairro}`);
    if (dadosAtuais.rua) dadosJaColetados.push(`✅ Rua: ${dadosAtuais.rua}`);
    if (dadosAtuais.numero) dadosJaColetados.push(`✅ Número: ${dadosAtuais.numero}`);
    if (dadosAtuais.referencia) dadosJaColetados.push(`✅ Referência: ${dadosAtuais.referencia}`);
    if (dadosAtuais.categoria) dadosJaColetados.push(`✅ Categoria: ${dadosAtuais.categoria}`);
    if (dadosAtuais.descricao) dadosJaColetados.push(`✅ Descrição: ${dadosAtuais.descricao}`);

    // Identificar o que ainda falta
    const dadosFaltando: string[] = [];
    if (!dadosAtuais.nome) dadosFaltando.push('❌ Nome');
    if (!dadosAtuais.email) dadosFaltando.push('❌ Email');
    if (!dadosAtuais.bairro) dadosFaltando.push('❌ Bairro');
    if (!dadosAtuais.rua) dadosFaltando.push('❌ Rua');
    if (!dadosAtuais.categoria) dadosFaltando.push('❌ Categoria');
    if (!dadosAtuais.descricao) dadosFaltando.push('❌ Descrição');

    const systemPrompt = `Você é a assistente virtual da ${prefeitura.nome} (${prefeitura.cidade}/${prefeitura.estado}).
Você ajuda os cidadãos a registrar reclamações sobre problemas na cidade.

⚠️ REGRA CRÍTICA - NUNCA PERGUNTE NOVAMENTE O QUE JÁ FOI COLETADO!
Se um dado já está na lista "DADOS JÁ COLETADOS", NÃO PERGUNTE DE NOVO. Use o dado salvo.

${usuarioRecorrente ? `
🎉 USUÁRIO RECORRENTE - ${cidadaoExistente?.nome}
- Já fez ${totalReclamacoes} reclamação(ões)
- Use os dados já conhecidos, não pergunte nome/email novamente
` : `
👋 NOVO USUÁRIO - Seja direto
`}

📊 DADOS JÁ COLETADOS (NÃO PERGUNTE DE NOVO):
${dadosJaColetados.length > 0 ? dadosJaColetados.join('\n') : '(Nenhum dado coletado ainda)'}

📋 DADOS QUE AINDA FALTAM:
${dadosFaltando.length > 0 ? dadosFaltando.join('\n') : '(Todos os dados obrigatórios coletados!)'}

📱 HISTÓRICO DA CONVERSA (últimas mensagens):
${historicoFormatado || '(Início da conversa)'}

🔄 ESTADO ATUAL:
- Etapa: ${etapaAtual}
- Estado: ${conversaData.estado}
- Fotos: ${midiasAtualizadas.fotos.length} | Vídeos: ${midiasAtualizadas.videos.length}
- Localização GPS: ${localizacaoAtualizada ? 'Sim' : 'Não'}

📍 BAIRROS DA CIDADE:
${bairros.map(b => `- ${b.nome} (id: ${b.id})`).join('\n') || 'Nenhum cadastrado - aceitar qualquer nome'}

🏷️ CATEGORIAS DE PROBLEMAS:
${categorias.length > 0 
  ? categorias.map((c, i) => `${i + 1}️⃣ ${c.nome} (id: ${c.id})`).join('\n')
  : TIPOS_PROBLEMA.map(t => `${t.numero}️⃣ ${t.label}`).join('\n')
}

🎯 REGRAS IMPORTANTES:
1. ⚠️ NUNCA PERGUNTE DADOS QUE JÁ ESTÃO NA LISTA "DADOS JÁ COLETADOS"
2. Seja breve e objetivo - mensagens curtas no WhatsApp
3. Use emojis 😊
4. Pergunte APENAS o próximo dado que falta
5. Se o cidadão mandar tudo de uma vez, extraia todos os dados
6. Antes de criar, mostre resumo e peça confirmação
7. Use markdown do WhatsApp: *negrito* _itálico_
8. ⚠️ FORMATAÇÃO CRÍTICA: Use QUEBRAS DE LINHA REAIS (enter) no texto. NUNCA escreva literalmente "\\n" ou "\\n\\n" - essas são sequências de escape que aparecem como texto!

📍 CONFIRMAÇÃO DE RUA (OBRIGATÓRIO):
Quando identificar a rua na mensagem do cidadão, SEMPRE pergunte para confirmar.
Use QUEBRAS DE LINHA REAIS (aperte enter) e NÃO escreva "\\n" literalmente.
Exemplo correto:

Entendi! A reclamação é para a *Rua [nome da rua identificada]*?

1️⃣ Sim, é essa rua
2️⃣ Não, é outra rua

Digite o número da opção.

- Se o cidadão responder "1" ou "sim", prossiga para perguntar o NÚMERO da casa
- Se responder "2" ou "não", peça para informar a rua correta
- NÃO salve a rua nos dados_extraidos até o cidadão confirmar com "1" ou "sim"
- Isso evita registrar reclamações no endereço errado!

📍 CONFIRMAÇÃO DE NÚMERO DA CASA (OBRIGATÓRIO - APÓS CONFIRMAR RUA):
**IMPORTANTE**: Se o número já existir nos dados_coletados, NÃO peça confirmação novamente! Vá direto para a próxima etapa (tipo_problema).

Se ainda não tiver o número, depois que o cidadão confirmar a RUA, pergunte:
Qual é o *número* da casa ou próximo? 🏠

Se não souber o número exato, digite 1️⃣ para continuar.

Após o cidadão informar o número, pergunte para confirmar:
O número é *[número informado]*?

1️⃣ Sim, o número é este mesmo
2️⃣ Não, é outro número

Digite o número da opção.

- Se o cidadão responder "1" ou "sim", salve o número nos dados_extraidos e prossiga IMEDIATAMENTE para tipo_problema
- Se responder "2" ou "não", peça para informar o número correto
- Se o cidadão digitar "1" quando perguntado "qual o número", salve numero como "S/N" e prossiga
- **NUNCA** peça confirmação do número mais de uma vez! Após confirmar, vá direto para tipo_problema.

📲 COMANDOS:
- *consultar PROTOCOLO* - Ver status
- *minhas reclamações* - Listar reclamações
- *cancelar* - Cancelar atual

📋 FORMATO DE RESPOSTA (JSON):
{
  "resposta": "mensagem para o cidadão",
  "dados_extraidos": {
    "nome": "se identificou novo dado",
    "email": "se identificou novo dado",
    "telefone": "se identificou novo dado",
    "rua": "se identificou novo dado",
    "numero": "se identificou novo dado",
    "bairro": "nome do bairro",
    "bairro_id": "id do bairro se corresponde à lista",
    "categoria": "tipo do problema",
    "categoria_id": "id da categoria",
    "descricao": "descrição do problema",
    "referencia": "ponto de referência"
  },
  "nova_etapa": "dados_pessoais|localizacao|tipo_problema|descricao|midia|confirmacao",
  "pronto_para_confirmar": true/false,
  "criar_reclamacao": true/false
}

⚠️ IMPORTANTE: 
- Responda APENAS com JSON válido
- NÃO inclua dados que já existem em dados_extraidos (só novos dados)
- Se o dado já foi coletado, NÃO pergunte novamente!`;

    const userMessage = mensagem.texto || 
      (midiasAtualizadas.fotos.length > 0 ? '[Cidadão enviou foto(s)]' : '') +
      (midiasAtualizadas.videos.length > 0 ? '[Cidadão enviou vídeo(s)]' : '') +
      (localizacaoAtualizada ? '[Cidadão enviou localização GPS]' : '') ||
      '[Mensagem vazia]';

    // Chamar Lovable AI
    console.log('Chamando Lovable AI...');
    console.log('Etapa atual:', etapaAtual);
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro da AI:', errorText);
      throw new Error(`Erro da AI: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0]?.message?.content || '';
    console.log('Resposta da AI:', aiContent);

    // Parsear JSON da resposta
    let aiResult: {
      resposta: string;
      dados_extraidos?: Record<string, string>;
      nova_etapa?: string;
      pronto_para_confirmar?: boolean;
      criar_reclamacao?: boolean;
    };

    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        aiResult = { resposta: aiContent };
      }
    } catch {
      console.error('Erro ao parsear JSON da AI, usando texto direto');
      aiResult = { resposta: aiContent };
    }

    // Atualizar dados coletados
    const dadosAtualizados = {
      ...conversaData.dados_coletados,
      ...aiResult.dados_extraidos,
    };

    // Se nome veio da mensagem e não temos, usar
    if (!dadosAtualizados.nome && mensagem.nome) {
      dadosAtualizados.nome = mensagem.nome;
    }
    
    // Telefone do WhatsApp
    if (!dadosAtualizados.telefone) {
      dadosAtualizados.telefone = telefoneLimpo;
    }

    // Verificar se deve criar reclamação
    let reclamacaoCriada = null;
    const camposObrigatorios = ['nome', 'email', 'rua', 'bairro', 'descricao'];
    const todosObrigatorios = camposObrigatorios.every(campo => dadosAtualizados[campo as keyof typeof dadosAtualizados]);
    
    if (aiResult.criar_reclamacao && todosObrigatorios) {
      console.log('Criando reclamação...');
      
      // Criar reclamação usando a função do banco
      const { data: reclamacao, error: recError } = await supabase.rpc('criar_reclamacao_publica', {
        _prefeitura_id: prefeitura.id,
        _nome_cidadao: dadosAtualizados.nome || mensagem.nome,
        _email_cidadao: dadosAtualizados.email || `${telefoneLimpo}@whatsapp.temp`,
        _telefone_cidadao: telefoneLimpo,
        _rua: dadosAtualizados.rua,
        _numero: dadosAtualizados.numero || null,
        _bairro_id: dadosAtualizados.bairro_id || null,
        _categoria_id: dadosAtualizados.categoria_id || null,
        _referencia: dadosAtualizados.referencia || null,
        _descricao: dadosAtualizados.descricao,
        _localizacao: localizacaoAtualizada,
        _fotos: midiasAtualizadas.fotos,
        _videos: midiasAtualizadas.videos,
      });

      if (recError) {
        console.error('Erro ao criar reclamação:', recError);
        aiResult.resposta = `❌ Desculpe, ocorreu um erro ao registrar sua reclamação.\n\nPor favor, tente novamente em alguns instantes.`;
      } else {
        reclamacaoCriada = reclamacao[0];
        console.log('Reclamação criada:', reclamacaoCriada);

        // Buscar ID da reclamação
        const { data: recCriada } = await supabase
          .from('reclamacoes')
          .select('id')
          .eq('protocolo', reclamacaoCriada.protocolo)
          .single();

        // Resetar conversa mas manter dados do cidadão para próxima
        await supabase
          .from('whatsapp_conversas')
          .update({
            estado: 'inicio',
            dados_coletados: {
              nome: dadosAtualizados.nome,
              email: dadosAtualizados.email,
              telefone: telefoneLimpo,
              bairro: dadosAtualizados.bairro,
              bairro_id: dadosAtualizados.bairro_id,
            },
            midias_coletadas: { fotos: [], videos: [] },
            localizacao: null,
            ultima_mensagem_at: new Date().toISOString(),
            reclamacao_id: recCriada?.id || null,
          })
          .eq('id', conversaData.id);

         aiResult.resposta = `✅ Reclamação registrada com sucesso.\n\n` +
           `📋 *Protocolo:* ${reclamacaoCriada.protocolo}\n\n` +
           `📍 *Local:* ${dadosAtualizados.rua}${dadosAtualizados.numero ? ', ' + dadosAtualizados.numero : ''}${dadosAtualizados.bairro ? ' - ' + dadosAtualizados.bairro : ''}\n` +
           `🏷️ *Problema:* ${dadosAtualizados.categoria || dadosAtualizados.descricao?.substring(0, 50)}\n` +
           `📷 *Mídia:* ${midiasAtualizadas.fotos.length} foto(s), ${midiasAtualizadas.videos.length} vídeo(s)\n\n` +
           `Para acompanhar, digite:\n` +
           `👉 *consultar ${reclamacaoCriada.protocolo}*\n\n` +
           `_${prefeitura.nome}_`;
      }
    } else {
      // Atualizar conversa com novos dados
      let novoEstado = 'coletando_dados';
      
      // Verificar se todos os dados obrigatórios (exceto número que é opcional) foram coletados
      const todosDadosColetados = dadosAtualizados.nome && 
                                   dadosAtualizados.email && 
                                   dadosAtualizados.rua && 
                                   dadosAtualizados.bairro && 
                                   dadosAtualizados.categoria && 
                                   dadosAtualizados.descricao;
      
      // CORREÇÃO CRÍTICA: Se todos os dados foram coletados e não estamos na etapa de mídia, forçar transição
      if (todosDadosColetados && conversaData.estado !== 'aguardando_midia' && conversaData.estado !== 'confirmando') {
        console.log('Todos os dados coletados! Forçando transição para etapa de mídia');
        novoEstado = 'aguardando_midia';
        
        // Substituir resposta da IA pela pergunta de mídia
        aiResult.resposta = `✅ Ótimo, já tenho todas as informações!\n\n📷 Agora você pode enviar *fotos* ou *vídeos* do problema.\n\nIsso ajuda muito a equipe a entender a situação!\n\n*Envie as mídias agora* ou digite 1️⃣ para *continuar sem mídia*.`;
      }
      // CORREÇÃO: Verificar se a IA indicou que é hora de pedir mídia
      else if (aiResult.nova_etapa === 'midia' && conversaData.estado !== 'aguardando_midia') {
        console.log('IA indicou etapa de mídia, mudando estado para aguardando_midia');
        novoEstado = 'aguardando_midia';
        
        // Adicionar pergunta sobre mídia à resposta se a IA não incluiu
        const respostaLower = aiResult.resposta.toLowerCase();
        if (!respostaLower.includes('foto') && !respostaLower.includes('video') && !respostaLower.includes('vídeo') && !respostaLower.includes('mídia')) {
          aiResult.resposta += `\n\n📷 Agora você pode enviar *fotos* ou *vídeos* do problema.\n\nIsso ajuda muito a equipe a entender a situação!\n\n*Envie as mídias agora* ou digite 1️⃣ para *continuar sem mídia*.`;
        }
      } else if (aiResult.pronto_para_confirmar) {
        novoEstado = 'confirmando';
        // Usar diretamente o resumo de confirmação ao invés da resposta da IA
        aiResult.resposta = buildResumoConfirmacao({
          dados: dadosAtualizados,
          fotos: midiasAtualizadas.fotos.length,
          videos: midiasAtualizadas.videos.length,
          prefeituraNome: prefeitura.nome,
        });
      }

      await supabase
        .from('whatsapp_conversas')
        .update({
          estado: novoEstado,
          dados_coletados: dadosAtualizados,
          midias_coletadas: midiasAtualizadas,
          localizacao: localizacaoAtualizada,
          ultima_mensagem_at: new Date().toISOString(),
          nome_cidadao: dadosAtualizados.nome || mensagem.nome || conversaData.nome_cidadao,
        })
        .eq('id', conversaData.id);
    }

    return new Response(
      JSON.stringify({
        resposta: aiResult.resposta,
        acao: reclamacaoCriada ? 'reclamacao_criada' : 'continuar',
        protocolo: reclamacaoCriada?.protocolo || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no agente:', error);
    return new Response(
      JSON.stringify({
        resposta: 'Desculpe, ocorreu um erro. Por favor, tente novamente em alguns instantes.',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
