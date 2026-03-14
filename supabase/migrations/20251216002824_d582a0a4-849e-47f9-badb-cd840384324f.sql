-- Permitir que admin_prefeitura atualize apenas a sua própria prefeitura
-- (nome, cidade, logo_url, cores, contatos, texto institucional)
CREATE POLICY "Admin prefeitura pode atualizar sua prefeitura"
ON public.prefeituras
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.is_prefeitura_admin(auth.uid(), id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.is_prefeitura_admin(auth.uid(), id)
);
