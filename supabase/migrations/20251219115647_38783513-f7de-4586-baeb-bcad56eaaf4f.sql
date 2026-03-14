-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Enum para tipos de alerta
CREATE TYPE public.tipo_alerta AS ENUM ('enchente', 'chuva_forte', 'alagamento', 'emergencia', 'aviso_geral');

-- Enum para canais de envio
CREATE TYPE public.canal_envio AS ENUM ('whatsapp', 'sms', 'push');

-- Enum para status de envio
CREATE TYPE public.status_envio AS ENUM ('pendente', 'enviado', 'erro');

-- Tabela de cidadãos cadastrados
CREATE TABLE public.cidadaos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id UUID NOT NULL REFERENCES public.prefeituras(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    bairro_id UUID REFERENCES public.bairros(id),
    aceita_alertas BOOLEAN DEFAULT true,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de alertas
CREATE TABLE public.alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefeitura_id UUID NOT NULL REFERENCES public.prefeituras(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    tipo tipo_alerta NOT NULL,
    mensagem TEXT NOT NULL,
    bairro_id UUID REFERENCES public.bairros(id),
    canais canal_envio[] NOT NULL DEFAULT '{}',
    total_enviados INTEGER DEFAULT 0,
    total_erros INTEGER DEFAULT 0,
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de envios individuais
CREATE TABLE public.alerta_envios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alerta_id UUID NOT NULL REFERENCES public.alertas(id) ON DELETE CASCADE,
    cidadao_id UUID NOT NULL REFERENCES public.cidadaos(id) ON DELETE CASCADE,
    canal canal_envio NOT NULL,
    status status_envio DEFAULT 'pendente',
    erro_mensagem TEXT,
    enviado_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cidadaos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerta_envios ENABLE ROW LEVEL SECURITY;

-- RLS Policies para cidadaos
CREATE POLICY "Admin pode gerenciar cidadãos da sua prefeitura"
ON public.cidadaos
FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- RLS Policies para alertas
CREATE POLICY "Admin pode gerenciar alertas da sua prefeitura"
ON public.alertas
FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- RLS Policies para alerta_envios
CREATE POLICY "Admin pode ver envios de alertas da sua prefeitura"
ON public.alerta_envios
FOR SELECT
USING (
    has_role(auth.uid(), 'super_admin') OR 
    EXISTS (
        SELECT 1 FROM public.alertas a 
        WHERE a.id = alerta_envios.alerta_id 
        AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)
    )
);

CREATE POLICY "Admin pode criar envios de alertas"
ON public.alerta_envios
FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR 
    EXISTS (
        SELECT 1 FROM public.alertas a 
        WHERE a.id = alerta_envios.alerta_id 
        AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)
    )
);

CREATE POLICY "Admin pode atualizar envios de alertas"
ON public.alerta_envios
FOR UPDATE
USING (
    has_role(auth.uid(), 'super_admin') OR 
    EXISTS (
        SELECT 1 FROM public.alertas a 
        WHERE a.id = alerta_envios.alerta_id 
        AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)
    )
);

-- Indexes para performance
CREATE INDEX idx_cidadaos_prefeitura ON public.cidadaos(prefeitura_id);
CREATE INDEX idx_cidadaos_bairro ON public.cidadaos(bairro_id);
CREATE INDEX idx_alertas_prefeitura ON public.alertas(prefeitura_id);
CREATE INDEX idx_alertas_created ON public.alertas(created_at DESC);
CREATE INDEX idx_alerta_envios_alerta ON public.alerta_envios(alerta_id);

-- Trigger para updated_at em cidadaos
CREATE TRIGGER update_cidadaos_updated_at
BEFORE UPDATE ON public.cidadaos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();