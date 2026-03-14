import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionMessage {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      imageMessage?: {
        url?: string;
        caption?: string;
        mimetype?: string;
        base64?: string;
      };
      videoMessage?: {
        url?: string;
        caption?: string;
        mimetype?: string;
      };
      audioMessage?: {
        url?: string;
        mimetype?: string;
      };
      documentMessage?: {
        url?: string;
        fileName?: string;
        mimetype?: string;
      };
      locationMessage?: {
        degreesLatitude?: number;
        degreesLongitude?: number;
      };
    };
    messageTimestamp?: number;
  };
  sender?: string;
  apikey?: string;
}

const processedIncomingMessageIds = new Map<string, number>();
const INCOMING_DEDUPE_TTL_MS = 2 * 60 * 1000;

// Função para baixar mídia e salvar no Storage
async function downloadAndUploadMedia(
  supabase: any,
  evolutionUrl: string,
  evolutionKey: string,
  instanceName: string,
  messageId: string,
  mediaType: 'image' | 'video',
  prefeituraId: string
): Promise<string | null> {
  try {
    console.log(`Baixando mídia ${mediaType} via Evolution API...`);
    
    // Usar o endpoint getBase64FromMediaMessage da Evolution API
    const mediaResponse = await fetch(`${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': evolutionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          key: {
            id: messageId,
          },
        },
        convertToMp4: mediaType === 'video',
      }),
    });

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error('Erro ao baixar mídia:', errorText);
      return null;
    }

    const mediaData = await mediaResponse.json();
    const base64 = mediaData.base64;
    const mimetype = mediaData.mimetype || (mediaType === 'image' ? 'image/jpeg' : 'video/mp4');

    if (!base64) {
      console.error('Base64 não retornado pela Evolution API');
      return null;
    }

    // Converter base64 para Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Gerar nome do arquivo
    const extension = mimetype.split('/')[1] || (mediaType === 'image' ? 'jpg' : 'mp4');
    const fileName = `whatsapp/${prefeituraId}/${Date.now()}-${messageId.substring(0, 8)}.${extension}`;

    console.log(`Fazendo upload para Storage: ${fileName}`);

    // Upload para o Storage
    const { data, error } = await supabase.storage
      .from('reclamacoes-media')
      .upload(fileName, bytes, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Erro ao fazer upload:', error);
      return null;
    }

    // Retornar URL pública
    const { data: publicUrlData } = supabase.storage
      .from('reclamacoes-media')
      .getPublicUrl(fileName);

    console.log('Upload concluído:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Erro ao processar mídia:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  console.log('=== Receive Evolution Webhook ===');
  console.log('Method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: EvolutionMessage = await req.json();
    console.log('Evento recebido:', body.event);
    console.log('Instância:', body.instance);

    // Apenas processar mensagens recebidas (não enviadas)
    if (body.event !== 'messages.upsert' || body.data?.key?.fromMe) {
      console.log('Evento ignorado (não é mensagem recebida)');
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'Not an incoming message' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ignorar mensagens de grupos (remoteJid contém @g.us para grupos)
    const remoteJid = body.data?.key?.remoteJid || '';
    if (remoteJid.includes('@g.us')) {
      console.log('Mensagem de grupo ignorada:', remoteJid);
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'Group message ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicar mensagens (Evolution pode reenviar o mesmo evento)
    const incomingMessageId = body.data?.key?.id;
    if (incomingMessageId) {
      const now = Date.now();
      // limpeza simples
      for (const [id, ts] of processedIncomingMessageIds.entries()) {
        if (now - ts > INCOMING_DEDUPE_TTL_MS) processedIncomingMessageIds.delete(id);
      }
      if (processedIncomingMessageIds.has(incomingMessageId)) {
        console.log('Mensagem duplicada ignorada:', incomingMessageId);
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'Duplicate message' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      processedIncomingMessageIds.set(incomingMessageId, now);
    }

    // Buscar prefeitura pela instância
    console.log('Buscando prefeitura pela instância:', body.instance);
    
    // Primeiro tentar buscar configuração global
    const { data: globalConfig } = await supabase
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'evolution_api')
      .single();

    let evolutionUrl = '';
    let evolutionKey = '';

    // Buscar prefeitura
    const { data: prefeitura, error: prefeituraError } = await supabase
      .from('prefeituras')
      .select('id, nome, slug, cidade, estado, evolution_api_url, evolution_api_key, evolution_instance_name')
      .eq('evolution_instance_name', body.instance)
      .eq('ativo', true)
      .single();

    if (prefeituraError || !prefeitura) {
      console.error('Prefeitura não encontrada para instância:', body.instance);
      return new Response(
        JSON.stringify({ success: false, error: 'Prefeitura não encontrada para esta instância' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Prefeitura encontrada:', prefeitura.nome);

    // Definir URL e chave da Evolution (priorizar global, depois local)
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

    // Extrair dados da mensagem
    const phoneNumber = body.data.key.remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
    const senderName = body.data.pushName || 'Cidadão';
    const messageId = body.data.key.id;

    // Extrair texto da mensagem
    let messageText = '';
    if (body.data.message?.conversation) {
      messageText = body.data.message.conversation;
    } else if (body.data.message?.extendedTextMessage?.text) {
      messageText = body.data.message.extendedTextMessage.text;
    } else if (body.data.message?.imageMessage?.caption) {
      messageText = body.data.message.imageMessage.caption;
    } else if (body.data.message?.videoMessage?.caption) {
      messageText = body.data.message.videoMessage.caption;
    }

    // Extrair localização se disponível
    let localizacao: { lat: number; lng: number } | null = null;
    if (body.data.message?.locationMessage) {
      localizacao = {
        lat: body.data.message.locationMessage.degreesLatitude || 0,
        lng: body.data.message.locationMessage.degreesLongitude || 0,
      };
    }

    // Processar mídia - baixar e fazer upload para o Storage
    const fotos: string[] = [];
    const videos: string[] = [];

    if (body.data.message?.imageMessage && evolutionUrl && evolutionKey) {
      console.log('Imagem detectada, fazendo download...');
      const uploadedUrl = await downloadAndUploadMedia(
        supabase,
        evolutionUrl,
        evolutionKey,
        body.instance,
        messageId,
        'image',
        prefeitura.id
      );
      if (uploadedUrl) {
        fotos.push(uploadedUrl);
      }
    }

    if (body.data.message?.videoMessage && evolutionUrl && evolutionKey) {
      console.log('Vídeo detectado, fazendo download...');
      const uploadedUrl = await downloadAndUploadMedia(
        supabase,
        evolutionUrl,
        evolutionKey,
        body.instance,
        messageId,
        'video',
        prefeitura.id
      );
      if (uploadedUrl) {
        videos.push(uploadedUrl);
      }
    }

    console.log('Mensagem recebida:', { phoneNumber, senderName, messageText: messageText.substring(0, 100), localizacao: !!localizacao, fotos: fotos.length, videos: videos.length });

    // Buscar ou criar conversa para salvar mensagem
    let conversaId: string | null = null;
    const { data: conversaExistente } = await supabase
      .from('whatsapp_conversas')
      .select('id')
      .eq('prefeitura_id', prefeitura.id)
      .eq('telefone', phoneNumber)
      .single();

    if (conversaExistente) {
      conversaId = conversaExistente.id;
    }

    // Determinar tipo da mensagem
    let tipoMensagem = 'texto';
    let conteudoMensagem = messageText || '[Mensagem sem texto]';
    let midiaUrl: string | null = null;

    if (fotos.length > 0) {
      tipoMensagem = 'imagem';
      midiaUrl = fotos[0];
      if (!messageText) conteudoMensagem = '[Imagem]';
    } else if (videos.length > 0) {
      tipoMensagem = 'video';
      midiaUrl = videos[0];
      if (!messageText) conteudoMensagem = '[Vídeo]';
    } else if (localizacao) {
      tipoMensagem = 'localizacao';
      conteudoMensagem = `📍 Localização: ${localizacao.lat}, ${localizacao.lng}`;
    }

    // Salvar mensagem do cidadão se tiver conversa
    if (conversaId) {
      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversaId,
        prefeitura_id: prefeitura.id,
        direcao: 'entrada',
        tipo: tipoMensagem,
        conteudo: conteudoMensagem,
        midia_url: midiaUrl,
        enviado_por: 'cidadao',
      });
    }

    // Registrar no webhook_logs
    const logPayload = {
      event: body.event,
      instance: body.instance,
      phone: phoneNumber,
      name: senderName,
      message: messageText.substring(0, 500),
      hasLocation: !!localizacao,
      hasMedia: fotos.length > 0 || videos.length > 0,
    };

    await supabase.from('webhook_logs').insert({
      prefeitura_id: prefeitura.id,
      source: 'evolution-ai',
      payload: logPayload,
      status: 'received',
    });

    // Chamar o agente de IA
    console.log('Chamando agente de IA...');
    const agentResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-agent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefeitura: {
          id: prefeitura.id,
          nome: prefeitura.nome,
          slug: prefeitura.slug,
          evolution_api_url: evolutionUrl,
          evolution_api_key: evolutionKey,
          evolution_instance_name: prefeitura.evolution_instance_name,
        },
        mensagem: {
          texto: messageText,
          fotos,
          videos,
          localizacao,
          telefone: phoneNumber,
          nome: senderName,
        },
        instanceName: body.instance,
      }),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('Erro do agente:', errorText);
      throw new Error(`Erro do agente: ${agentResponse.status}`);
    }

    const agentResult = await agentResponse.json();
    console.log('Resposta do agente:', agentResult.acao, agentResult.protocolo || '');

    // Enviar resposta ao cidadão
    if (evolutionUrl && evolutionKey && agentResult.resposta) {
      try {
        console.log('Enviando resposta via Evolution API...');
        const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${body.instance}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: agentResult.resposta,
          }),
        });

        if (!sendResponse.ok) {
          const sendError = await sendResponse.text();
          console.error('Erro ao enviar resposta:', sendError);
        } else {
          console.log('Resposta enviada com sucesso');
          
          // Salvar mensagem de resposta (do agente ou operador)
          if (conversaId) {
            await supabase.from('whatsapp_mensagens').insert({
              conversa_id: conversaId,
              prefeitura_id: prefeitura.id,
              direcao: 'saida',
              tipo: 'texto',
              conteudo: agentResult.resposta,
              enviado_por: 'agente_ia',
            });
          }
        }
      } catch (sendError) {
        console.error('Erro ao enviar resposta:', sendError);
      }
    }

    // Atualizar log com resultado
    if (agentResult.protocolo) {
      const { data: recCriada } = await supabase
        .from('reclamacoes')
        .select('id')
        .eq('protocolo', agentResult.protocolo)
        .single();

      await supabase.from('webhook_logs').insert({
        prefeitura_id: prefeitura.id,
        source: 'evolution-ai',
        payload: { ...logPayload, action: 'reclamacao_criada', protocolo: agentResult.protocolo },
        status: 'success',
        reclamacao_id: recCriada?.id || null,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        acao: agentResult.acao,
        protocolo: agentResult.protocolo || null,
        prefeitura: prefeitura.nome,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro não tratado:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
