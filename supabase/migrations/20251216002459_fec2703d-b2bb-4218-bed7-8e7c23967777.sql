-- Permitir UPDATE (necessário para upload com upsert=true) apenas para logos
CREATE POLICY "Admin pode atualizar logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'reclamacoes-media'
  AND name LIKE 'logos/%'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_prefeitura'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'reclamacoes-media'
  AND name LIKE 'logos/%'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_prefeitura'::public.app_role)
  )
);

-- Correção do linter: garantir search_path fixo em funções (exemplo: generate_protocolo)
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.protocolo := 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;