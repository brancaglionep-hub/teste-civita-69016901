-- Fix: Adicionar política SELECT para cidadaos (estava faltando SELECT explícito, apenas tinha ALL)
-- A política ALL já cobre SELECT, mas vamos garantir que está explícito

-- Primeiro dropar a política ALL existente e criar políticas separadas para melhor controle
DROP POLICY IF EXISTS "Admin pode gerenciar cidadãos da sua prefeitura" ON public.cidadaos;

-- Criar políticas separadas para maior clareza
CREATE POLICY "Admin pode ver cidadãos da sua prefeitura" 
ON public.cidadaos 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_prefeitura_admin(auth.uid(), prefeitura_id));

CREATE POLICY "Admin pode inserir cidadãos na sua prefeitura" 
ON public.cidadaos 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_prefeitura_admin(auth.uid(), prefeitura_id));

CREATE POLICY "Admin pode atualizar cidadãos da sua prefeitura" 
ON public.cidadaos 
FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_prefeitura_admin(auth.uid(), prefeitura_id));

CREATE POLICY "Admin pode deletar cidadãos da sua prefeitura" 
ON public.cidadaos 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_prefeitura_admin(auth.uid(), prefeitura_id));