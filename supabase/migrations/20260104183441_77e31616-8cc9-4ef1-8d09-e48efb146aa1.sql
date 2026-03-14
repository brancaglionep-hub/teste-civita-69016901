-- Fix security definer view issue by recreating view with SECURITY INVOKER
DROP VIEW IF EXISTS public.prefeituras_publico;

CREATE VIEW public.prefeituras_publico
WITH (security_invoker = on)
AS
SELECT 
  id,
  ativo,
  created_at,
  updated_at,
  plano,
  nome,
  cidade,
  estado,
  slug,
  logo_url,
  cor_primaria,
  cor_secundaria,
  texto_institucional,
  email_contato,
  telefone_contato,
  imagem_capa_url,
  evolution_connected
FROM public.prefeituras;

-- Grant public SELECT on the safe view
GRANT SELECT ON public.prefeituras_publico TO anon, authenticated;