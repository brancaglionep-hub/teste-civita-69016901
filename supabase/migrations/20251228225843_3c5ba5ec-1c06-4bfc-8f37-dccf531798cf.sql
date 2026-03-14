-- Criar tabela de mensagens do WhatsApp
CREATE TABLE public.whatsapp_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  prefeitura_id UUID NOT NULL REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  tipo TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'video', 'audio', 'localizacao', 'documento')),
  conteudo TEXT NOT NULL,
  midia_url TEXT,
  enviado_por TEXT, -- 'cidadao', 'agente_ia', 'operador'
  operador_id UUID, -- ID do usuário que enviou (se operador)
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_whatsapp_mensagens_conversa ON public.whatsapp_mensagens(conversa_id);
CREATE INDEX idx_whatsapp_mensagens_prefeitura ON public.whatsapp_mensagens(prefeitura_id);
CREATE INDEX idx_whatsapp_mensagens_created ON public.whatsapp_mensagens(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Admin pode ver mensagens da sua prefeitura"
ON public.whatsapp_mensagens
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

CREATE POLICY "Admin pode inserir mensagens da sua prefeitura"
ON public.whatsapp_mensagens
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

CREATE POLICY "Admin pode atualizar mensagens da sua prefeitura"
ON public.whatsapp_mensagens
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

-- Habilitar realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;