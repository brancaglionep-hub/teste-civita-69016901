-- Tabela para armazenar sessões de conversa do WhatsApp
CREATE TABLE public.whatsapp_conversas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prefeitura_id UUID NOT NULL REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  nome_cidadao TEXT,
  estado TEXT NOT NULL DEFAULT 'inicio',
  dados_coletados JSONB NOT NULL DEFAULT '{}'::jsonb,
  midias_coletadas JSONB NOT NULL DEFAULT '{"fotos": [], "videos": []}'::jsonb,
  localizacao JSONB DEFAULT NULL,
  ultima_mensagem_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reclamacao_id UUID REFERENCES public.reclamacoes(id) ON DELETE SET NULL,
  UNIQUE(prefeitura_id, telefone)
);

-- Enable RLS
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin pode ver conversas da sua prefeitura" 
ON public.whatsapp_conversas 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_prefeitura_admin(auth.uid(), prefeitura_id));

CREATE POLICY "Admin pode gerenciar conversas da sua prefeitura" 
ON public.whatsapp_conversas 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- Índices para performance
CREATE INDEX idx_whatsapp_conversas_telefone ON public.whatsapp_conversas(prefeitura_id, telefone);
CREATE INDEX idx_whatsapp_conversas_estado ON public.whatsapp_conversas(estado);
CREATE INDEX idx_whatsapp_conversas_ultima_mensagem ON public.whatsapp_conversas(ultima_mensagem_at);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_conversas_updated_at
BEFORE UPDATE ON public.whatsapp_conversas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();