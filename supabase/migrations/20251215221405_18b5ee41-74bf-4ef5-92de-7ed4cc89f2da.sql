-- Criar bucket para uploads de fotos e vídeos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reclamacoes-media', 'reclamacoes-media', true);

-- Políticas de storage para o bucket
CREATE POLICY "Qualquer pessoa pode fazer upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'reclamacoes-media');

CREATE POLICY "Arquivos são públicos para visualização" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'reclamacoes-media');

CREATE POLICY "Admin pode deletar arquivos" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'reclamacoes-media' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'admin_prefeitura'::app_role)
  )
);