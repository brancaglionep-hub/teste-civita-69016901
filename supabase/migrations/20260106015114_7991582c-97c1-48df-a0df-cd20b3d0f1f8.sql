-- Recriar a view prefeituras_publico como SECURITY DEFINER para permitir acesso público
DROP VIEW IF EXISTS public.prefeituras_publico;

CREATE OR REPLACE VIEW public.prefeituras_publico
WITH (security_invoker = false)
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
FROM prefeituras;

-- Dar permissão de SELECT para usuários anônimos e autenticados
GRANT SELECT ON public.prefeituras_publico TO anon, authenticated;