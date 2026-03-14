-- ============================================================
-- ReclamaBuraco - Schema Completo para Supabase
-- Execute este arquivo no SQL Editor do Supabase Dashboard
-- ============================================================

-- ===================
-- 1. ENUMS
-- ===================

CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin_prefeitura', 'user');
CREATE TYPE public.canal_envio AS ENUM ('whatsapp', 'sms', 'push', 'email');
CREATE TYPE public.complaint_status AS ENUM ('recebida', 'em_andamento', 'resolvida', 'arquivada');
CREATE TYPE public.plano_prefeitura AS ENUM ('starter', 'pro');
CREATE TYPE public.status_envio AS ENUM ('pendente', 'enviado', 'erro');
CREATE TYPE public.tipo_alerta AS ENUM ('enchente', 'chuva_forte', 'alagamento', 'emergencia', 'aviso_geral');

-- ===================
-- 2. TABELAS
-- ===================

-- Prefeituras (multi-tenant principal)
CREATE TABLE public.prefeituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL DEFAULT 'SC',
  slug text NOT NULL UNIQUE,
  logo_url text,
  cor_primaria text DEFAULT '#1e40af',
  cor_secundaria text DEFAULT '#3b82f6',
  texto_institucional text,
  email_contato text,
  telefone_contato text,
  imagem_capa_url text,
  plano plano_prefeitura NOT NULL DEFAULT 'starter',
  ativo boolean DEFAULT true,
  evolution_api_url text,
  evolution_api_key text,
  evolution_instance_name text,
  evolution_connected boolean DEFAULT false,
  evolution_phone text,
  webhook_secret uuid DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles (vinculado a auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text,
  prefeitura_id uuid REFERENCES public.prefeituras(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Roles (sistema de permissões)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  prefeitura_id uuid REFERENCES public.prefeituras(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role, prefeitura_id)
);

-- Bairros
CREATE TABLE public.bairros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Categorias
CREATE TABLE public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid REFERENCES public.prefeituras(id),
  nome text NOT NULL,
  descricao text,
  icone text DEFAULT 'AlertCircle',
  global boolean DEFAULT false,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Reclamações
CREATE TABLE public.reclamacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  bairro_id uuid REFERENCES public.bairros(id),
  categoria_id uuid REFERENCES public.categorias(id),
  protocolo text NOT NULL,
  nome_cidadao text NOT NULL,
  email_cidadao text NOT NULL,
  telefone_cidadao text,
  rua text NOT NULL,
  numero text,
  referencia text,
  descricao text NOT NULL,
  localizacao jsonb,
  fotos text[] DEFAULT '{}',
  videos text[] DEFAULT '{}',
  status complaint_status DEFAULT 'recebida',
  resposta_prefeitura text,
  visualizada boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Histórico de Status
CREATE TABLE public.historico_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamacao_id uuid NOT NULL REFERENCES public.reclamacoes(id),
  status_anterior complaint_status,
  status_novo complaint_status NOT NULL,
  observacao text,
  usuario_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Cidadãos
CREATE TABLE public.cidadaos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  nome text NOT NULL,
  email text,
  telefone text,
  bairro_id uuid REFERENCES public.bairros(id),
  aceita_alertas boolean DEFAULT true,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Alertas
CREATE TABLE public.alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo tipo_alerta NOT NULL,
  bairro_id uuid REFERENCES public.bairros(id),
  canais canal_envio[] DEFAULT '{}',
  total_enviados integer DEFAULT 0,
  total_erros integer DEFAULT 0,
  criado_por uuid,
  created_at timestamptz DEFAULT now()
);

-- Alerta Envios
CREATE TABLE public.alerta_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id uuid NOT NULL REFERENCES public.alertas(id),
  cidadao_id uuid NOT NULL REFERENCES public.cidadaos(id),
  canal canal_envio NOT NULL,
  status status_envio DEFAULT 'pendente',
  enviado_em timestamptz,
  erro_mensagem text,
  created_at timestamptz DEFAULT now()
);

-- Avaliações
CREATE TABLE public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamacao_id uuid NOT NULL REFERENCES public.reclamacoes(id),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  estrelas integer NOT NULL,
  comentario text,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  avaliado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Configurações da Prefeitura
CREATE TABLE public.prefeitura_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL UNIQUE REFERENCES public.prefeituras(id),
  sla_padrao_dias integer NOT NULL DEFAULT 7,
  sla_alerta_percentual integer NOT NULL DEFAULT 80,
  sla_alertas_ativos boolean NOT NULL DEFAULT true,
  exigir_foto_padrao boolean NOT NULL DEFAULT false,
  permitir_video boolean NOT NULL DEFAULT true,
  limite_imagens integer NOT NULL DEFAULT 5,
  permitir_anexo boolean NOT NULL DEFAULT false,
  notif_email_ativo boolean NOT NULL DEFAULT true,
  notif_whatsapp_ativo boolean NOT NULL DEFAULT false,
  notif_sistema_ativo boolean NOT NULL DEFAULT true,
  notif_ao_criar boolean NOT NULL DEFAULT true,
  notif_ao_mudar_status boolean NOT NULL DEFAULT true,
  notif_sla_proximo boolean NOT NULL DEFAULT true,
  notif_ao_concluir boolean NOT NULL DEFAULT true,
  avaliacao_nota_destaque integer NOT NULL DEFAULT 4,
  avaliacao_comentarios_publicos boolean NOT NULL DEFAULT false,
  avaliacao_permitir_resposta boolean NOT NULL DEFAULT true,
  avaliacao_obrigatoria boolean NOT NULL DEFAULT false,
  lgpd_anonimizar_relatorios boolean NOT NULL DEFAULT false,
  lgpd_retencao_anos integer NOT NULL DEFAULT 5,
  lgpd_texto_consentimento text DEFAULT 'Ao enviar esta reclamação, você concorda com o tratamento dos seus dados pessoais conforme nossa política de privacidade.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Configurações do Sistema (global)
CREATE TABLE public.configuracoes_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Visitas
CREATE TABLE public.visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid REFERENCES public.prefeituras(id),
  pagina text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Upload Queue
CREATE TABLE public.upload_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  reclamacao_id uuid REFERENCES public.reclamacoes(id),
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  retry_count integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Webhook Logs
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  reclamacao_id uuid REFERENCES public.reclamacoes(id),
  source text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- WhatsApp Conversas
CREATE TABLE public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  reclamacao_id uuid REFERENCES public.reclamacoes(id),
  telefone text NOT NULL,
  nome_cidadao text,
  estado text NOT NULL DEFAULT 'inicio',
  dados_coletados jsonb NOT NULL DEFAULT '{}',
  midias_coletadas jsonb NOT NULL DEFAULT '{"fotos": [], "videos": []}',
  localizacao jsonb,
  operador_atendendo_id uuid,
  operador_atendendo_desde timestamptz,
  ultima_mensagem_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- WhatsApp Mensagens
CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  direcao text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto',
  conteudo text NOT NULL,
  midia_url text,
  enviado_por text,
  operador_id uuid,
  lida boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- WhatsApp Templates
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  atalho text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===================
-- 3. VIEW PÚBLICA
-- ===================

CREATE VIEW public.prefeituras_publico AS
SELECT
  id, nome, cidade, estado, slug, logo_url,
  cor_primaria, cor_secundaria, texto_institucional,
  email_contato, telefone_contato, imagem_capa_url,
  plano, ativo, evolution_connected, created_at, updated_at
FROM public.prefeituras;

-- ===================
-- 4. FUNÇÕES
-- ===================

-- Função para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para verificar admin de prefeitura
CREATE OR REPLACE FUNCTION public.is_prefeitura_admin(_user_id uuid, _prefeitura_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'admin_prefeitura'
    AND prefeitura_id = _prefeitura_id
  )
$$;

-- Função para gerar protocolo
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.protocolo := 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- Trigger de protocolo
CREATE TRIGGER generate_protocolo_trigger
BEFORE INSERT ON public.reclamacoes
FOR EACH ROW EXECUTE FUNCTION public.generate_protocolo();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers de updated_at
CREATE TRIGGER update_prefeituras_updated_at BEFORE UPDATE ON public.prefeituras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reclamacoes_updated_at BEFORE UPDATE ON public.reclamacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cidadaos_updated_at BEFORE UPDATE ON public.cidadaos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prefeitura_configuracoes_updated_at BEFORE UPDATE ON public.prefeitura_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configuracoes_sistema_updated_at BEFORE UPDATE ON public.configuracoes_sistema FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_upload_queue_updated_at BEFORE UPDATE ON public.upload_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whatsapp_conversas_updated_at BEFORE UPDATE ON public.whatsapp_conversas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-cadastrar cidadão ao criar reclamação
CREATE OR REPLACE FUNCTION public.auto_cadastrar_cidadao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cidadao_existente uuid;
BEGIN
  IF NEW.telefone_cidadao IS NOT NULL AND NEW.telefone_cidadao != '' THEN
    SELECT id INTO v_cidadao_existente
    FROM public.cidadaos
    WHERE prefeitura_id = NEW.prefeitura_id AND telefone = NEW.telefone_cidadao
    LIMIT 1;
  END IF;

  IF v_cidadao_existente IS NULL AND NEW.email_cidadao IS NOT NULL AND NEW.email_cidadao != '' THEN
    SELECT id INTO v_cidadao_existente
    FROM public.cidadaos
    WHERE prefeitura_id = NEW.prefeitura_id AND email = NEW.email_cidadao
    LIMIT 1;
  END IF;

  IF v_cidadao_existente IS NULL THEN
    INSERT INTO public.cidadaos (prefeitura_id, nome, email, telefone, bairro_id, aceita_alertas, ativo)
    VALUES (NEW.prefeitura_id, NEW.nome_cidadao, NULLIF(NEW.email_cidadao, ''), NULLIF(NEW.telefone_cidadao, ''), NEW.bairro_id, true, true);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_cadastrar_cidadao_trigger
AFTER INSERT ON public.reclamacoes
FOR EACH ROW EXECUTE FUNCTION public.auto_cadastrar_cidadao();

-- Handle new user (criar profile automaticamente)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'nome', NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC: Criar reclamação pública
CREATE OR REPLACE FUNCTION public.criar_reclamacao_publica(
  _prefeitura_id uuid, _nome_cidadao text, _email_cidadao text, _rua text,
  _telefone_cidadao text DEFAULT NULL, _bairro_id uuid DEFAULT NULL,
  _categoria_id uuid DEFAULT NULL, _numero text DEFAULT NULL,
  _referencia text DEFAULT NULL, _descricao text DEFAULT NULL,
  _localizacao jsonb DEFAULT NULL, _fotos text[] DEFAULT '{}', _videos text[] DEFAULT '{}'
)
RETURNS TABLE(protocolo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nome text; v_email text; v_rua text; v_descricao text;
  v_fotos text[]; v_videos text[]; v_protocolo text;
BEGIN
  v_nome := trim(coalesce(_nome_cidadao, ''));
  v_email := lower(trim(coalesce(_email_cidadao, '')));
  v_rua := trim(coalesce(_rua, ''));
  v_descricao := trim(coalesce(_descricao, ''));
  v_fotos := coalesce(_fotos, '{}');
  v_videos := coalesce(_videos, '{}');

  IF _prefeitura_id IS NULL THEN RAISE EXCEPTION 'prefeitura_obrigatoria'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prefeituras p WHERE p.id = _prefeitura_id AND p.ativo = true) THEN RAISE EXCEPTION 'prefeitura_invalida'; END IF;
  IF v_nome = '' OR length(v_nome) > 120 THEN RAISE EXCEPTION 'nome_invalido'; END IF;
  IF v_email = '' OR length(v_email) > 255 OR v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  IF v_rua = '' OR length(v_rua) > 200 THEN RAISE EXCEPTION 'rua_invalida'; END IF;
  IF v_descricao = '' THEN v_descricao := 'Sem descrição adicional'; END IF;
  IF length(v_descricao) > 2000 THEN RAISE EXCEPTION 'descricao_longa'; END IF;
  IF _bairro_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bairros b WHERE b.id = _bairro_id AND b.prefeitura_id = _prefeitura_id) THEN RAISE EXCEPTION 'bairro_invalido'; END IF;
  IF _categoria_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categorias c WHERE c.id = _categoria_id AND c.ativo = true AND (c.global = true OR c.prefeitura_id = _prefeitura_id)) THEN RAISE EXCEPTION 'categoria_invalida'; END IF;

  INSERT INTO public.reclamacoes (prefeitura_id, nome_cidadao, email_cidadao, telefone_cidadao, bairro_id, categoria_id, rua, numero, referencia, descricao, localizacao, fotos, videos)
  VALUES (_prefeitura_id, v_nome, v_email, nullif(trim(coalesce(_telefone_cidadao, '')), ''), _bairro_id, _categoria_id, v_rua, nullif(trim(coalesce(_numero, '')), ''), nullif(trim(coalesce(_referencia, '')), ''), v_descricao, _localizacao, v_fotos, v_videos)
  RETURNING reclamacoes.protocolo INTO v_protocolo;

  RETURN QUERY SELECT v_protocolo;
END;
$$;

-- RPC: Consultar protocolo
CREATE OR REPLACE FUNCTION public.consultar_protocolo(_protocolo text, _prefeitura_id uuid)
RETURNS TABLE(id uuid, protocolo text, status complaint_status, created_at timestamptz, updated_at timestamptz, categoria_nome text, bairro_nome text, rua text, resposta_prefeitura text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.protocolo, r.status, r.created_at, r.updated_at, c.nome, b.nome, r.rua, r.resposta_prefeitura
  FROM reclamacoes r
  LEFT JOIN categorias c ON r.categoria_id = c.id
  LEFT JOIN bairros b ON r.bairro_id = b.id
  WHERE r.protocolo = _protocolo AND r.prefeitura_id = _prefeitura_id
$$;

-- RPC: Consultar histórico do protocolo
CREATE OR REPLACE FUNCTION public.consultar_historico_protocolo(_protocolo text, _prefeitura_id uuid)
RETURNS TABLE(id uuid, status_anterior text, status_novo text, observacao text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.id, h.status_anterior::text, h.status_novo::text, h.observacao, h.created_at
  FROM historico_status h
  JOIN reclamacoes r ON r.id = h.reclamacao_id
  WHERE r.protocolo = _protocolo AND r.prefeitura_id = _prefeitura_id
  ORDER BY h.created_at DESC
$$;

-- RPC: Buscar avaliação por token
CREATE OR REPLACE FUNCTION public.buscar_avaliacao_por_token(_token uuid)
RETURNS TABLE(protocolo text, rua text, bairro_nome text, categoria_nome text, prefeitura_nome text, ja_avaliada boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.protocolo, r.rua, b.nome, c.nome, p.nome, (a.avaliado_em IS NOT NULL)
  FROM avaliacoes a
  JOIN reclamacoes r ON r.id = a.reclamacao_id
  JOIN prefeituras p ON p.id = a.prefeitura_id
  LEFT JOIN bairros b ON b.id = r.bairro_id
  LEFT JOIN categorias c ON c.id = r.categoria_id
  WHERE a.token = _token
$$;

-- RPC: Submeter avaliação
CREATE OR REPLACE FUNCTION public.submeter_avaliacao(_token uuid, _estrelas integer, _comentario text DEFAULT NULL)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _estrelas < 1 OR _estrelas > 5 THEN
    RETURN QUERY SELECT false, 'Avaliação deve ser entre 1 e 5 estrelas';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.avaliacoes WHERE token = _token AND avaliado_em IS NULL) THEN
    RETURN QUERY SELECT false, 'Link de avaliação inválido ou já utilizado';
    RETURN;
  END IF;
  UPDATE public.avaliacoes SET estrelas = _estrelas, comentario = NULLIF(TRIM(COALESCE(_comentario, '')), ''), avaliado_em = now() WHERE token = _token AND avaliado_em IS NULL;
  RETURN QUERY SELECT true, 'Avaliação enviada com sucesso!';
END;
$$;

-- RPC: Config pública da prefeitura
CREATE OR REPLACE FUNCTION public.get_prefeitura_config_publica(_prefeitura_id uuid)
RETURNS TABLE(exigir_foto_padrao boolean, permitir_video boolean, limite_imagens integer, permitir_anexo boolean, lgpd_texto_consentimento text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT exigir_foto_padrao, permitir_video, limite_imagens, permitir_anexo, lgpd_texto_consentimento
  FROM prefeitura_configuracoes WHERE prefeitura_id = _prefeitura_id
$$;

-- ===================
-- 5. RLS (Row Level Security)
-- ===================

ALTER TABLE public.prefeituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reclamacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cidadaos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerta_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prefeitura_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Prefeituras
CREATE POLICY "Super admin pode gerenciar prefeituras" ON public.prefeituras FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin pode ver prefeituras completas" ON public.prefeituras FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), id));
CREATE POLICY "Admin prefeitura pode atualizar sua prefeitura" ON public.prefeituras FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), id)) WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), id));

-- Profiles
CREATE POLICY "Usuário pode ver profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Usuário pode atualizar seu profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User Roles
CREATE POLICY "Super admin pode gerenciar roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Usuário pode ver suas roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'));

-- Bairros
CREATE POLICY "Bairros são públicos para leitura" ON public.bairros FOR SELECT USING (true);
CREATE POLICY "Admin pode gerenciar bairros da sua prefeitura" ON public.bairros FOR ALL USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- Categorias
CREATE POLICY "Categorias são públicas para leitura" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Admin pode gerenciar categorias" ON public.categorias FOR ALL USING (has_role(auth.uid(), 'super_admin') OR (prefeitura_id IS NOT NULL AND is_prefeitura_admin(auth.uid(), prefeitura_id)));

-- Reclamações
CREATE POLICY "Admin pode ver reclamações" ON public.reclamacoes FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admins podem criar reclamação" ON public.reclamacoes FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode gerenciar reclamações" ON public.reclamacoes FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- Histórico Status
CREATE POLICY "Admin pode ver histórico" ON public.historico_status FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM reclamacoes r WHERE r.id = historico_status.reclamacao_id AND is_prefeitura_admin(auth.uid(), r.prefeitura_id)));
CREATE POLICY "Admin pode criar histórico" ON public.historico_status FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM reclamacoes r WHERE r.id = historico_status.reclamacao_id AND is_prefeitura_admin(auth.uid(), r.prefeitura_id)));

-- Cidadãos
CREATE POLICY "Admin pode ver cidadãos da sua prefeitura" ON public.cidadaos FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode inserir cidadãos na sua prefeitura" ON public.cidadaos FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode atualizar cidadãos da sua prefeitura" ON public.cidadaos FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode deletar cidadãos da sua prefeitura" ON public.cidadaos FOR DELETE USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- Alertas
CREATE POLICY "Admin pode gerenciar alertas da sua prefeitura" ON public.alertas FOR ALL USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- Alerta Envios
CREATE POLICY "Admin pode ver envios de alertas da sua prefeitura" ON public.alerta_envios FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM alertas a WHERE a.id = alerta_envios.alerta_id AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)));
CREATE POLICY "Admin pode criar envios de alertas" ON public.alerta_envios FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM alertas a WHERE a.id = alerta_envios.alerta_id AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)));
CREATE POLICY "Admin pode atualizar envios de alertas" ON public.alerta_envios FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM alertas a WHERE a.id = alerta_envios.alerta_id AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)));

-- Avaliações
CREATE POLICY "Admin pode ver avaliações" ON public.avaliacoes FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode criar avaliação" ON public.avaliacoes FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- Prefeitura Configurações
CREATE POLICY "Admin pode ver configurações da sua prefeitura" ON public.prefeitura_configuracoes FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode criar configurações da sua prefeitura" ON public.prefeitura_configuracoes FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode atualizar configurações da sua prefeitura" ON public.prefeitura_configuracoes FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- Configurações Sistema
CREATE POLICY "Super admin pode gerenciar configurações" ON public.configuracoes_sistema FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin pode ver configurações" ON public.configuracoes_sistema FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

-- Visitas
CREATE POLICY "Qualquer pessoa pode registrar visita" ON public.visitas FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin pode ver visitas" ON public.visitas FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR (prefeitura_id IS NOT NULL AND is_prefeitura_admin(auth.uid(), prefeitura_id)));

-- Upload Queue
CREATE POLICY "Anyone can insert to upload queue" ON public.upload_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Prefeitura admins can view their uploads" ON public.upload_queue FOR SELECT USING (is_prefeitura_admin(auth.uid(), prefeitura_id) OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Service role can update uploads" ON public.upload_queue FOR UPDATE USING (true) WITH CHECK (true);

-- Webhook Logs
CREATE POLICY "Admin pode ver logs de webhook da sua prefeitura" ON public.webhook_logs FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- WhatsApp Conversas
CREATE POLICY "Admin pode gerenciar conversas da sua prefeitura" ON public.whatsapp_conversas FOR ALL USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode ver conversas da sua prefeitura" ON public.whatsapp_conversas FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- WhatsApp Mensagens
CREATE POLICY "Admin pode ver mensagens da sua prefeitura" ON public.whatsapp_mensagens FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode inserir mensagens da sua prefeitura" ON public.whatsapp_mensagens FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode atualizar mensagens da sua prefeitura" ON public.whatsapp_mensagens FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- WhatsApp Templates
CREATE POLICY "Admin pode gerenciar templates da sua prefeitura" ON public.whatsapp_templates FOR ALL USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- ===================
-- 6. STORAGE
-- ===================
-- Execute no SQL Editor:
INSERT INTO storage.buckets (id, name, public) VALUES ('reclamacoes-media', 'reclamacoes-media', true);

CREATE POLICY "Uploads públicos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reclamacoes-media');
CREATE POLICY "Downloads públicos" ON storage.objects FOR SELECT USING (bucket_id = 'reclamacoes-media');
