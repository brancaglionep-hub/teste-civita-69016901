-- Create table for city hall settings/configurations
CREATE TABLE public.prefeitura_configuracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prefeitura_id uuid NOT NULL UNIQUE REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  
  -- SLA Settings
  sla_padrao_dias integer NOT NULL DEFAULT 7,
  sla_alerta_percentual integer NOT NULL DEFAULT 80,
  sla_alertas_ativos boolean NOT NULL DEFAULT true,
  
  -- Media/Attachment Settings
  exigir_foto_padrao boolean NOT NULL DEFAULT false,
  permitir_video boolean NOT NULL DEFAULT true,
  limite_imagens integer NOT NULL DEFAULT 5,
  permitir_anexo boolean NOT NULL DEFAULT false,
  
  -- Notification Settings
  notif_email_ativo boolean NOT NULL DEFAULT true,
  notif_whatsapp_ativo boolean NOT NULL DEFAULT false,
  notif_sistema_ativo boolean NOT NULL DEFAULT true,
  notif_ao_criar boolean NOT NULL DEFAULT true,
  notif_ao_mudar_status boolean NOT NULL DEFAULT true,
  notif_sla_proximo boolean NOT NULL DEFAULT true,
  notif_ao_concluir boolean NOT NULL DEFAULT true,
  
  -- Evaluation Settings
  avaliacao_nota_destaque integer NOT NULL DEFAULT 4,
  avaliacao_comentarios_publicos boolean NOT NULL DEFAULT false,
  avaliacao_permitir_resposta boolean NOT NULL DEFAULT true,
  avaliacao_obrigatoria boolean NOT NULL DEFAULT false,
  
  -- LGPD Settings
  lgpd_texto_consentimento text DEFAULT 'Ao enviar esta reclamação, você concorda com o tratamento dos seus dados pessoais conforme nossa política de privacidade.',
  lgpd_anonimizar_relatorios boolean NOT NULL DEFAULT false,
  lgpd_retencao_anos integer NOT NULL DEFAULT 5,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prefeitura_configuracoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin pode ver configurações da sua prefeitura"
ON public.prefeitura_configuracoes
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

CREATE POLICY "Admin pode atualizar configurações da sua prefeitura"
ON public.prefeitura_configuracoes
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

CREATE POLICY "Admin pode criar configurações da sua prefeitura"
ON public.prefeitura_configuracoes
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  is_prefeitura_admin(auth.uid(), prefeitura_id)
);

-- Add trigger for updated_at
CREATE TRIGGER update_prefeitura_configuracoes_updated_at
BEFORE UPDATE ON public.prefeitura_configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create default configurations for existing prefeituras
INSERT INTO public.prefeitura_configuracoes (prefeitura_id)
SELECT id FROM public.prefeituras
ON CONFLICT (prefeitura_id) DO NOTHING;