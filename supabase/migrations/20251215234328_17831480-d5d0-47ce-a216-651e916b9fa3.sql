-- Drop the current insecure policy
DROP POLICY IF EXISTS "Cidadão pode ver sua reclamação por email" ON public.reclamacoes;

-- Create a secure SELECT policy - only admins can read directly
CREATE POLICY "Admin pode ver reclamações" 
ON public.reclamacoes 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR is_prefeitura_admin(auth.uid(), prefeitura_id)
);

-- Create a secure function for public protocol lookup (returns limited data)
CREATE OR REPLACE FUNCTION public.consultar_protocolo(_protocolo text, _prefeitura_id uuid)
RETURNS TABLE (
  id uuid,
  protocolo text,
  status complaint_status,
  created_at timestamptz,
  updated_at timestamptz,
  categoria_nome text,
  bairro_nome text,
  rua text,
  resposta_prefeitura text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.protocolo,
    r.status,
    r.created_at,
    r.updated_at,
    c.nome as categoria_nome,
    b.nome as bairro_nome,
    r.rua,
    r.resposta_prefeitura
  FROM reclamacoes r
  LEFT JOIN categorias c ON r.categoria_id = c.id
  LEFT JOIN bairros b ON r.bairro_id = b.id
  WHERE r.protocolo = _protocolo 
  AND r.prefeitura_id = _prefeitura_id
$$;