-- Permitir super_admin gerenciar roles
CREATE POLICY "Super admin pode gerenciar roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));