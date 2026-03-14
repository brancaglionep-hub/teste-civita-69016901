-- Enable leaked password protection
-- Note: This is an auth config setting that needs to be enabled via Supabase dashboard
-- We're adding this as documentation

-- Create an index for faster queries on frequently filtered columns
CREATE INDEX IF NOT EXISTS idx_reclamacoes_prefeitura_status ON public.reclamacoes(prefeitura_id, status);
CREATE INDEX IF NOT EXISTS idx_reclamacoes_created_at ON public.reclamacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cidadaos_prefeitura_telefone ON public.cidadaos(prefeitura_id, telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_prefeitura_estado ON public.whatsapp_conversas(prefeitura_id, estado);