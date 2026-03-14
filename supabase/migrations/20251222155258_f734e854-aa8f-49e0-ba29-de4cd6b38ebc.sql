-- Adicionar campo para webhook secret de cada prefeitura
ALTER TABLE public.prefeituras 
ADD COLUMN IF NOT EXISTS webhook_secret uuid DEFAULT gen_random_uuid();

-- Adicionar índice para busca rápida por webhook_secret
CREATE INDEX IF NOT EXISTS idx_prefeituras_webhook_secret ON public.prefeituras(webhook_secret);

-- Criar tabela para registrar logs de webhooks recebidos
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  source text NOT NULL DEFAULT 'whatsapp',
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  reclamacao_id uuid REFERENCES public.reclamacoes(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policies para webhook_logs
CREATE POLICY "Admin pode ver logs de webhook da sua prefeitura"
ON public.webhook_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

-- Comentário explicativo
COMMENT ON COLUMN public.prefeituras.webhook_secret IS 'Token secreto para autenticar webhooks do n8n/WhatsApp';