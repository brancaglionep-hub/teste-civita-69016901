-- Adicionar campo de visualização nas reclamações
ALTER TABLE public.reclamacoes 
ADD COLUMN IF NOT EXISTS visualizada boolean DEFAULT false;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_reclamacoes_visualizada ON public.reclamacoes(visualizada);

-- Atualizar reclamações existentes como já visualizadas
UPDATE public.reclamacoes SET visualizada = true WHERE visualizada IS NULL;