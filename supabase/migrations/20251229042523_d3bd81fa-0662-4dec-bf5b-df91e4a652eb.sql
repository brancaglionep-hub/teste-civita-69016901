-- Criar enum para planos
CREATE TYPE public.plano_prefeitura AS ENUM ('starter', 'pro');

-- Adicionar coluna de plano na tabela prefeituras
ALTER TABLE public.prefeituras 
ADD COLUMN plano public.plano_prefeitura NOT NULL DEFAULT 'starter';