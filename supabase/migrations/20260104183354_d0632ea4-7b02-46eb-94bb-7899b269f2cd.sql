-- 1. Create a secure view for prefeituras that hides sensitive credentials
CREATE OR REPLACE VIEW public.prefeituras_publico AS
SELECT 
  id,
  ativo,
  created_at,
  updated_at,
  plano,
  nome,
  cidade,
  estado,
  slug,
  logo_url,
  cor_primaria,
  cor_secundaria,
  texto_institucional,
  email_contato,
  telefone_contato,
  imagem_capa_url,
  evolution_connected
  -- Campos sensíveis EXCLUÍDOS: evolution_api_key, evolution_api_url, evolution_instance_name, evolution_phone, webhook_secret
FROM public.prefeituras;

-- 2. Grant public SELECT on the safe view
GRANT SELECT ON public.prefeituras_publico TO anon, authenticated;

-- 3. Drop the existing public read policy on prefeituras
DROP POLICY IF EXISTS "Prefeituras são públicas para leitura" ON public.prefeituras;

-- 4. Create a new restrictive SELECT policy - only admins can see full data
CREATE POLICY "Admin pode ver prefeituras completas" 
ON public.prefeituras 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR is_prefeitura_admin(auth.uid(), id)
);

-- 5. Drop the public read policy on configuracoes_sistema (contains API keys)
DROP POLICY IF EXISTS "Configurações são públicas para leitura" ON public.configuracoes_sistema;

-- 6. Create restrictive policy for configuracoes_sistema - super_admin only
CREATE POLICY "Super admin pode ver configurações" 
ON public.configuracoes_sistema 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));