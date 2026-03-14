-- Função para auto-cadastrar cidadão a partir de reclamação
CREATE OR REPLACE FUNCTION public.auto_cadastrar_cidadao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cidadao_existente uuid;
BEGIN
  -- Verifica se já existe cidadão com mesmo telefone na mesma prefeitura
  IF NEW.telefone_cidadao IS NOT NULL AND NEW.telefone_cidadao != '' THEN
    SELECT id INTO v_cidadao_existente
    FROM public.cidadaos
    WHERE prefeitura_id = NEW.prefeitura_id
      AND telefone = NEW.telefone_cidadao
    LIMIT 1;
  END IF;

  -- Se não encontrou por telefone, tenta por email
  IF v_cidadao_existente IS NULL AND NEW.email_cidadao IS NOT NULL AND NEW.email_cidadao != '' THEN
    SELECT id INTO v_cidadao_existente
    FROM public.cidadaos
    WHERE prefeitura_id = NEW.prefeitura_id
      AND email = NEW.email_cidadao
    LIMIT 1;
  END IF;

  -- Se não existe, cria novo cidadão
  IF v_cidadao_existente IS NULL THEN
    INSERT INTO public.cidadaos (
      prefeitura_id,
      nome,
      email,
      telefone,
      bairro_id,
      aceita_alertas,
      ativo
    ) VALUES (
      NEW.prefeitura_id,
      NEW.nome_cidadao,
      NULLIF(NEW.email_cidadao, ''),
      NULLIF(NEW.telefone_cidadao, ''),
      NEW.bairro_id,
      true,
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger que executa após inserir reclamação
CREATE TRIGGER trigger_auto_cadastrar_cidadao
  AFTER INSERT ON public.reclamacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cadastrar_cidadao();

-- Índices para otimizar busca de duplicatas
CREATE INDEX IF NOT EXISTS idx_cidadaos_telefone_prefeitura 
  ON public.cidadaos(prefeitura_id, telefone) 
  WHERE telefone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cidadaos_email_prefeitura 
  ON public.cidadaos(prefeitura_id, email) 
  WHERE email IS NOT NULL;