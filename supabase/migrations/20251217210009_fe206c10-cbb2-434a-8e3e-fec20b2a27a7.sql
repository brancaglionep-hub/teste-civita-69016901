-- Create avaliacoes table for ratings
CREATE TABLE public.avaliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reclamacao_id UUID NOT NULL REFERENCES public.reclamacoes(id) ON DELETE CASCADE,
  prefeitura_id UUID NOT NULL REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  estrelas INTEGER NOT NULL CHECK (estrelas >= 1 AND estrelas <= 5),
  comentario TEXT,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  avaliado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Admin can view ratings for their prefeitura
CREATE POLICY "Admin pode ver avaliações"
ON public.avaliacoes
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

-- Create function to submit rating publicly (using token)
CREATE OR REPLACE FUNCTION public.submeter_avaliacao(
  _token UUID,
  _estrelas INTEGER,
  _comentario TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate stars
  IF _estrelas < 1 OR _estrelas > 5 THEN
    RETURN QUERY SELECT false, 'Avaliação deve ser entre 1 e 5 estrelas';
    RETURN;
  END IF;

  -- Check if token exists and hasn't been used
  IF NOT EXISTS (
    SELECT 1 FROM public.avaliacoes 
    WHERE token = _token AND avaliado_em IS NULL
  ) THEN
    RETURN QUERY SELECT false, 'Link de avaliação inválido ou já utilizado';
    RETURN;
  END IF;

  -- Update the rating
  UPDATE public.avaliacoes
  SET 
    estrelas = _estrelas,
    comentario = NULLIF(TRIM(COALESCE(_comentario, '')), ''),
    avaliado_em = now()
  WHERE token = _token AND avaliado_em IS NULL;

  RETURN QUERY SELECT true, 'Avaliação enviada com sucesso!';
END;
$$;

-- Create function to get rating info by token (public)
CREATE OR REPLACE FUNCTION public.buscar_avaliacao_por_token(_token UUID)
RETURNS TABLE(
  protocolo TEXT,
  rua TEXT,
  bairro_nome TEXT,
  categoria_nome TEXT,
  prefeitura_nome TEXT,
  ja_avaliada BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    r.protocolo,
    r.rua,
    b.nome as bairro_nome,
    c.nome as categoria_nome,
    p.nome as prefeitura_nome,
    (a.avaliado_em IS NOT NULL) as ja_avaliada
  FROM avaliacoes a
  JOIN reclamacoes r ON r.id = a.reclamacao_id
  JOIN prefeituras p ON p.id = a.prefeitura_id
  LEFT JOIN bairros b ON b.id = r.bairro_id
  LEFT JOIN categorias c ON c.id = r.categoria_id
  WHERE a.token = _token
$$;

-- Create index for performance
CREATE INDEX idx_avaliacoes_prefeitura ON public.avaliacoes(prefeitura_id);
CREATE INDEX idx_avaliacoes_token ON public.avaliacoes(token);
CREATE INDEX idx_avaliacoes_estrelas ON public.avaliacoes(estrelas);