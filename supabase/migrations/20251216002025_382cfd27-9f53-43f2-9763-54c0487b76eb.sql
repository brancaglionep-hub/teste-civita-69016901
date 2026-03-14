-- Adicionar política de INSERT para admins (a que está faltando)
CREATE POLICY "Admin pode fazer upload de logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'reclamacoes-media' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'admin_prefeitura'::app_role)
  )
);