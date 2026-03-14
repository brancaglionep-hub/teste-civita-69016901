-- Fix historico_status: restrict public read access to admins only
DROP POLICY IF EXISTS "Histórico é público para leitura" ON public.historico_status;

CREATE POLICY "Admin pode ver histórico" 
ON public.historico_status 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR (EXISTS (
    SELECT 1 FROM reclamacoes r 
    WHERE r.id = historico_status.reclamacao_id 
    AND is_prefeitura_admin(auth.uid(), r.prefeitura_id)
  ))
);

-- Create secure function for public history lookup (used with protocol)
CREATE OR REPLACE FUNCTION public.consultar_historico_protocolo(_protocolo text, _prefeitura_id uuid)
RETURNS TABLE (
  id uuid,
  status_anterior text,
  status_novo text,
  observacao text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    h.id,
    h.status_anterior::text,
    h.status_novo::text,
    h.observacao,
    h.created_at
  FROM historico_status h
  JOIN reclamacoes r ON r.id = h.reclamacao_id
  WHERE r.protocolo = _protocolo 
  AND r.prefeitura_id = _prefeitura_id
  ORDER BY h.created_at DESC
$$;