-- Criar tabela de configuração global do sistema
CREATE TABLE public.configuracoes_sistema (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Super admin pode gerenciar configurações" 
ON public.configuracoes_sistema 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Configurações são públicas para leitura"
ON public.configuracoes_sistema
FOR SELECT
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_configuracoes_sistema_updated_at
BEFORE UPDATE ON public.configuracoes_sistema
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração inicial para Evolution API
INSERT INTO public.configuracoes_sistema (chave, valor)
VALUES ('evolution_api', '{"url": null, "api_key": null}'::jsonb);