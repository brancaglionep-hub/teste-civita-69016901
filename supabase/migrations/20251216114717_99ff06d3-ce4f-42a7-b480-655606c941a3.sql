-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Qualquer pessoa pode criar reclamação" ON public.reclamacoes;

-- Recreate as a PERMISSIVE policy (default)
CREATE POLICY "Qualquer pessoa pode criar reclamação" 
ON public.reclamacoes 
FOR INSERT 
TO public
WITH CHECK (true);