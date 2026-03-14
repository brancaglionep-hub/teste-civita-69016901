import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PrefeituraConfig {
  // SLA
  sla_padrao_dias: number;
  sla_alerta_percentual: number;
  sla_alertas_ativos: boolean;
  // Mídia
  exigir_foto_padrao: boolean;
  permitir_video: boolean;
  limite_imagens: number;
  permitir_anexo: boolean;
  // Notificações
  notif_email_ativo: boolean;
  notif_whatsapp_ativo: boolean;
  notif_sistema_ativo: boolean;
  notif_ao_criar: boolean;
  notif_ao_mudar_status: boolean;
  notif_sla_proximo: boolean;
  notif_ao_concluir: boolean;
  // Avaliações
  avaliacao_nota_destaque: number;
  avaliacao_comentarios_publicos: boolean;
  avaliacao_permitir_resposta: boolean;
  avaliacao_obrigatoria: boolean;
  // LGPD
  lgpd_texto_consentimento: string;
  lgpd_anonimizar_relatorios: boolean;
  lgpd_retencao_anos: number;
}

const defaultConfig: PrefeituraConfig = {
  sla_padrao_dias: 7,
  sla_alerta_percentual: 80,
  sla_alertas_ativos: true,
  exigir_foto_padrao: false,
  permitir_video: true,
  limite_imagens: 5,
  permitir_anexo: true,
  notif_email_ativo: true,
  notif_whatsapp_ativo: false,
  notif_sistema_ativo: true,
  notif_ao_criar: true,
  notif_ao_mudar_status: true,
  notif_sla_proximo: true,
  notif_ao_concluir: true,
  avaliacao_nota_destaque: 4,
  avaliacao_comentarios_publicos: true,
  avaliacao_permitir_resposta: true,
  avaliacao_obrigatoria: false,
  lgpd_texto_consentimento: 'Ao enviar esta reclamação, você concorda com o tratamento dos seus dados pessoais conforme nossa política de privacidade.',
  lgpd_anonimizar_relatorios: false,
  lgpd_retencao_anos: 5,
};

export const usePrefeituraConfig = (prefeituraId: string | undefined, isPublic: boolean = false) => {
  const [config, setConfig] = useState<PrefeituraConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!prefeituraId) {
        setLoading(false);
        return;
      }

      if (isPublic) {
        // Usar função pública para acesso não autenticado
        const { data, error } = await supabase.rpc('get_prefeitura_config_publica', {
          _prefeitura_id: prefeituraId
        });

        if (!error && data && data.length > 0) {
          const publicData = data[0];
          setConfig({
            ...defaultConfig,
            exigir_foto_padrao: publicData.exigir_foto_padrao,
            permitir_video: publicData.permitir_video,
            limite_imagens: publicData.limite_imagens,
            permitir_anexo: publicData.permitir_anexo,
            lgpd_texto_consentimento: publicData.lgpd_texto_consentimento || defaultConfig.lgpd_texto_consentimento,
          });
        }
        setLoading(false);
        return;
      }

      // Acesso autenticado (admin)
      const { data, error } = await supabase
        .from("prefeitura_configuracoes")
        .select("*")
        .eq("prefeitura_id", prefeituraId)
        .maybeSingle();

      if (!error && data) {
        setConfig({
          sla_padrao_dias: data.sla_padrao_dias,
          sla_alerta_percentual: data.sla_alerta_percentual,
          sla_alertas_ativos: data.sla_alertas_ativos,
          exigir_foto_padrao: data.exigir_foto_padrao,
          permitir_video: data.permitir_video,
          limite_imagens: data.limite_imagens,
          permitir_anexo: data.permitir_anexo,
          notif_email_ativo: data.notif_email_ativo,
          notif_whatsapp_ativo: data.notif_whatsapp_ativo,
          notif_sistema_ativo: data.notif_sistema_ativo,
          notif_ao_criar: data.notif_ao_criar,
          notif_ao_mudar_status: data.notif_ao_mudar_status,
          notif_sla_proximo: data.notif_sla_proximo,
          notif_ao_concluir: data.notif_ao_concluir,
          avaliacao_nota_destaque: data.avaliacao_nota_destaque,
          avaliacao_comentarios_publicos: data.avaliacao_comentarios_publicos,
          avaliacao_permitir_resposta: data.avaliacao_permitir_resposta,
          avaliacao_obrigatoria: data.avaliacao_obrigatoria,
          lgpd_texto_consentimento: data.lgpd_texto_consentimento || defaultConfig.lgpd_texto_consentimento,
          lgpd_anonimizar_relatorios: data.lgpd_anonimizar_relatorios,
          lgpd_retencao_anos: data.lgpd_retencao_anos,
        });
      }
      setLoading(false);
    };

    fetchConfig();
  }, [prefeituraId, isPublic]);

  return { config, loading };
};
