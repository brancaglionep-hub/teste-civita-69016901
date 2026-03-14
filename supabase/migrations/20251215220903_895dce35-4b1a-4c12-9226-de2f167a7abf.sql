-- Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin_prefeitura', 'user');

-- Enum para status de reclamação
CREATE TYPE public.complaint_status AS ENUM ('recebida', 'em_andamento', 'resolvida', 'arquivada');

-- Tabela de Prefeituras
CREATE TABLE public.prefeituras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'SC',
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  cor_primaria TEXT DEFAULT '#1e40af',
  cor_secundaria TEXT DEFAULT '#3b82f6',
  texto_institucional TEXT,
  email_contato TEXT,
  telefone_contato TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Bairros
CREATE TABLE public.bairros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id UUID REFERENCES public.prefeituras(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Categorias de Problemas
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id UUID REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT DEFAULT 'AlertCircle',
  global BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Reclamações
CREATE TABLE public.reclamacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT UNIQUE NOT NULL,
  prefeitura_id UUID REFERENCES public.prefeituras(id) ON DELETE CASCADE NOT NULL,
  bairro_id UUID REFERENCES public.bairros(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  nome_cidadao TEXT NOT NULL,
  email_cidadao TEXT NOT NULL,
  telefone_cidadao TEXT,
  rua TEXT NOT NULL,
  numero TEXT,
  referencia TEXT,
  descricao TEXT NOT NULL,
  fotos TEXT[] DEFAULT '{}',
  videos TEXT[] DEFAULT '{}',
  localizacao JSONB,
  status public.complaint_status DEFAULT 'recebida',
  resposta_prefeitura TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Histórico de Status
CREATE TABLE public.historico_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamacao_id UUID REFERENCES public.reclamacoes(id) ON DELETE CASCADE NOT NULL,
  status_anterior public.complaint_status,
  status_novo public.complaint_status NOT NULL,
  observacao TEXT,
  usuario_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Profiles (para usuários autenticados)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefeitura_id UUID REFERENCES public.prefeituras(id) ON DELETE SET NULL,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Roles de Usuário
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  prefeitura_id UUID REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role, prefeitura_id)
);

-- Tabela de Visitas (analytics)
CREATE TABLE public.visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id UUID REFERENCES public.prefeituras(id) ON DELETE CASCADE,
  pagina TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prefeituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reclamacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- Function para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function para verificar admin de prefeitura
CREATE OR REPLACE FUNCTION public.is_prefeitura_admin(_user_id UUID, _prefeitura_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role = 'admin_prefeitura'
    AND prefeitura_id = _prefeitura_id
  )
$$;

-- Function para criar profile após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'nome', NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger para criar profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function para gerar protocolo
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.protocolo := 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- Trigger para gerar protocolo
CREATE TRIGGER generate_protocolo_trigger
  BEFORE INSERT ON public.reclamacoes
  FOR EACH ROW EXECUTE FUNCTION public.generate_protocolo();

-- RLS Policies

-- Prefeituras: leitura pública, escrita para super_admin
CREATE POLICY "Prefeituras são públicas para leitura" ON public.prefeituras FOR SELECT USING (true);
CREATE POLICY "Super admin pode gerenciar prefeituras" ON public.prefeituras FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Bairros: leitura pública
CREATE POLICY "Bairros são públicos para leitura" ON public.bairros FOR SELECT USING (true);
CREATE POLICY "Admin pode gerenciar bairros da sua prefeitura" ON public.bairros FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.is_prefeitura_admin(auth.uid(), prefeitura_id)
);

-- Categorias: leitura pública
CREATE POLICY "Categorias são públicas para leitura" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Admin pode gerenciar categorias" ON public.categorias FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  (prefeitura_id IS NOT NULL AND public.is_prefeitura_admin(auth.uid(), prefeitura_id))
);

-- Reclamações: cidadão pode criar, admin pode ver/editar
CREATE POLICY "Qualquer pessoa pode criar reclamação" ON public.reclamacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Cidadão pode ver sua reclamação por email" ON public.reclamacoes FOR SELECT USING (true);
CREATE POLICY "Admin pode gerenciar reclamações" ON public.reclamacoes FOR UPDATE USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.is_prefeitura_admin(auth.uid(), prefeitura_id)
);

-- Histórico: leitura pública, escrita para admin
CREATE POLICY "Histórico é público para leitura" ON public.historico_status FOR SELECT USING (true);
CREATE POLICY "Admin pode criar histórico" ON public.historico_status FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'super_admin') OR 
  EXISTS (SELECT 1 FROM public.reclamacoes r WHERE r.id = reclamacao_id AND public.is_prefeitura_admin(auth.uid(), r.prefeitura_id))
);

-- Profiles
CREATE POLICY "Usuário pode ver seu próprio profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuário pode atualizar seu profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User Roles
CREATE POLICY "Usuário pode ver suas roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

-- Visitas: inserção pública
CREATE POLICY "Qualquer pessoa pode registrar visita" ON public.visitas FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin pode ver visitas" ON public.visitas FOR SELECT USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  (prefeitura_id IS NOT NULL AND public.is_prefeitura_admin(auth.uid(), prefeitura_id))
);

-- Inserir categorias globais padrão
INSERT INTO public.categorias (nome, descricao, icone, global) VALUES
  ('Buraco na rua', 'Buracos, crateras ou depressões no asfalto', 'CircleOff', true),
  ('Iluminação pública', 'Postes apagados ou com problemas', 'Lightbulb', true),
  ('Asfalto danificado', 'Rachaduras, ondulações ou desgaste no asfalto', 'Construction', true),
  ('Calçada quebrada', 'Calçadas com buracos ou irregularidades', 'Footprints', true),
  ('Drenagem/Alagamento', 'Problemas de escoamento de água', 'Droplets', true),
  ('Sinalização', 'Placas danificadas ou faltando', 'SignpostBig', true),
  ('Outro', 'Outros problemas urbanos', 'HelpCircle', true);

-- Inserir prefeitura inicial (Biguaçu)
INSERT INTO public.prefeituras (nome, cidade, estado, slug, texto_institucional) VALUES
  ('Prefeitura Municipal de Biguaçu', 'Biguaçu', 'SC', 'biguacu', 'A Prefeitura de Biguaçu está comprometida em melhorar a infraestrutura urbana da cidade.');

-- Inserir bairros de Biguaçu
INSERT INTO public.bairros (prefeitura_id, nome) 
SELECT id, unnest(ARRAY[
  'Centro', 'Fundos', 'Jardim Janaína', 'Vendaval', 'Prado', 'Serraria', 
  'Jardim Carandaí', 'Bom Viver', 'Bela Vista', 'Rio Caveiras', 
  'Três Riachos', 'Guaporanga', 'Sorocaba do Sul', 'Tijuquinhas', 'Praia de São Miguel'
])
FROM public.prefeituras WHERE slug = 'biguacu';