-- Adicionar campo para imagem de capa das prefeituras
ALTER TABLE public.prefeituras 
ADD COLUMN imagem_capa_url TEXT;