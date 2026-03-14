-- Add ordem column to categorias table
ALTER TABLE public.categorias ADD COLUMN ordem integer DEFAULT 0;

-- Update existing categorias with sequential order
UPDATE public.categorias 
SET ordem = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM public.categorias
) AS subquery
WHERE public.categorias.id = subquery.id;