-- Tabela para fila de uploads de mídia
CREATE TABLE public.upload_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prefeitura_id UUID NOT NULL REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  reclamacao_id UUID REFERENCES public.reclamacoes(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_upload_queue_status ON public.upload_queue(status);
CREATE INDEX idx_upload_queue_prefeitura ON public.upload_queue(prefeitura_id);
CREATE INDEX idx_upload_queue_created ON public.upload_queue(created_at);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_upload_queue_updated_at
BEFORE UPDATE ON public.upload_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.upload_queue ENABLE ROW LEVEL SECURITY;

-- Política para inserção pública (cidadãos podem adicionar à fila)
CREATE POLICY "Anyone can insert to upload queue"
ON public.upload_queue
FOR INSERT
WITH CHECK (true);

-- Política para leitura (admins da prefeitura podem ver)
CREATE POLICY "Prefeitura admins can view their uploads"
ON public.upload_queue
FOR SELECT
USING (
  public.is_prefeitura_admin(auth.uid(), prefeitura_id) OR
  public.has_role(auth.uid(), 'super_admin')
);

-- Política para atualização via service role (edge function)
CREATE POLICY "Service role can update uploads"
ON public.upload_queue
FOR UPDATE
USING (true)
WITH CHECK (true);