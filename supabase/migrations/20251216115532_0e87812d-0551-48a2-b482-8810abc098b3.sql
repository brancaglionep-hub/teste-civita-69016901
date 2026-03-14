-- Public RPC to create a complaint without exposing direct table INSERT to anonymous users

CREATE OR REPLACE FUNCTION public.criar_reclamacao_publica(
  _prefeitura_id uuid,
  _nome_cidadao text,
  _email_cidadao text,
  _rua text,
  _telefone_cidadao text DEFAULT NULL,
  _bairro_id uuid DEFAULT NULL,
  _categoria_id uuid DEFAULT NULL,
  _numero text DEFAULT NULL,
  _referencia text DEFAULT NULL,
  _descricao text DEFAULT NULL,
  _localizacao jsonb DEFAULT NULL,
  _fotos text[] DEFAULT '{}'::text[],
  _videos text[] DEFAULT '{}'::text[]
)
RETURNS TABLE (protocolo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_email text;
  v_rua text;
  v_descricao text;
  v_fotos text[];
  v_videos text[];
  v_protocolo text;
BEGIN
  v_nome := trim(coalesce(_nome_cidadao, ''));
  v_email := lower(trim(coalesce(_email_cidadao, '')));
  v_rua := trim(coalesce(_rua, ''));
  v_descricao := trim(coalesce(_descricao, ''));
  v_fotos := coalesce(_fotos, '{}'::text[]);
  v_videos := coalesce(_videos, '{}'::text[]);

  IF _prefeitura_id IS NULL THEN
    RAISE EXCEPTION 'prefeitura_obrigatoria';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.prefeituras p
    WHERE p.id = _prefeitura_id AND p.ativo = true
  ) THEN
    RAISE EXCEPTION 'prefeitura_invalida';
  END IF;

  IF v_nome = '' OR length(v_nome) > 120 THEN
    RAISE EXCEPTION 'nome_invalido';
  END IF;

  IF v_email = '' OR length(v_email) > 255 OR v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;

  IF v_rua = '' OR length(v_rua) > 200 THEN
    RAISE EXCEPTION 'rua_invalida';
  END IF;

  IF v_descricao = '' THEN
    v_descricao := 'Sem descrição adicional';
  END IF;

  IF length(v_descricao) > 2000 THEN
    RAISE EXCEPTION 'descricao_longa';
  END IF;

  IF _bairro_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bairros b
    WHERE b.id = _bairro_id AND b.prefeitura_id = _prefeitura_id
  ) THEN
    RAISE EXCEPTION 'bairro_invalido';
  END IF;

  IF _categoria_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categorias c
    WHERE c.id = _categoria_id
      AND c.ativo = true
      AND (c.global = true OR c.prefeitura_id = _prefeitura_id)
  ) THEN
    RAISE EXCEPTION 'categoria_invalida';
  END IF;

  INSERT INTO public.reclamacoes (
    prefeitura_id,
    nome_cidadao,
    email_cidadao,
    telefone_cidadao,
    bairro_id,
    categoria_id,
    rua,
    numero,
    referencia,
    descricao,
    localizacao,
    fotos,
    videos
  )
  VALUES (
    _prefeitura_id,
    v_nome,
    v_email,
    nullif(trim(coalesce(_telefone_cidadao, '')), ''),
    _bairro_id,
    _categoria_id,
    v_rua,
    nullif(trim(coalesce(_numero, '')), ''),
    nullif(trim(coalesce(_referencia, '')), ''),
    v_descricao,
    _localizacao,
    v_fotos,
    v_videos
  )
  RETURNING reclamacoes.protocolo INTO v_protocolo;

  RETURN QUERY SELECT v_protocolo;
END;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.criar_reclamacao_publica(
  uuid, text, text, text, text, uuid, uuid, text, text, text, jsonb, text[], text[]
) TO anon, authenticated;

-- Drop the broken public INSERT policy
DROP POLICY IF EXISTS "Qualquer pessoa pode criar reclamação" ON public.reclamacoes;

-- Admins can insert directly (they manage complaints from the panel)
CREATE POLICY "Admins podem criar reclamação"
ON public.reclamacoes
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_prefeitura_admin(auth.uid(), prefeitura_id)
);

NOTIFY pgrst, 'reload schema';