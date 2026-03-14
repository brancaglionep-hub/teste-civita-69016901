-- Add policy for admins to insert avaliacoes
CREATE POLICY "Admin pode criar avaliação"
ON public.avaliacoes
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);