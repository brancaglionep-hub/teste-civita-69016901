-- Criar função SECURITY DEFINER para buscar configurações públicas da prefeitura
CREATE OR REPLACE FUNCTION public.get_prefeitura_config_publica(_prefeitura_id uuid)
RETURNS TABLE(
  exigir_foto_padrao boolean,
  permitir_video boolean,
  limite_imagens integer,
  permitir_anexo boolean,
  lgpd_texto_consentimento text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    exigir_foto_padrao,
    permitir_video,
    limite_imagens,
    permitir_anexo,
    lgpd_texto_consentimento
  FROM prefeitura_configuracoes
  WHERE prefeitura_id = _prefeitura_id
$$;