-- Adicionar campos de bloqueio por operador na conversa
ALTER TABLE public.whatsapp_conversas 
ADD COLUMN operador_atendendo_id uuid REFERENCES auth.users(id),
ADD COLUMN operador_atendendo_desde timestamp with time zone;

-- Criar tabela de templates de respostas rápidas
CREATE TABLE public.whatsapp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  atalho text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índices
CREATE INDEX idx_whatsapp_templates_prefeitura ON public.whatsapp_templates(prefeitura_id);
CREATE INDEX idx_whatsapp_conversas_operador ON public.whatsapp_conversas(operador_atendendo_id);

-- RLS para templates
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode gerenciar templates da sua prefeitura"
ON public.whatsapp_templates
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir alguns templates padrão (serão criados por prefeitura depois)
-- Templates globais de exemplo não necessários, cada prefeitura cria os seus