export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerta_envios: {
        Row: {
          alerta_id: string
          canal: Database["public"]["Enums"]["canal_envio"]
          cidadao_id: string
          created_at: string | null
          enviado_em: string | null
          erro_mensagem: string | null
          id: string
          status: Database["public"]["Enums"]["status_envio"] | null
        }
        Insert: {
          alerta_id: string
          canal: Database["public"]["Enums"]["canal_envio"]
          cidadao_id: string
          created_at?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          status?: Database["public"]["Enums"]["status_envio"] | null
        }
        Update: {
          alerta_id?: string
          canal?: Database["public"]["Enums"]["canal_envio"]
          cidadao_id?: string
          created_at?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          status?: Database["public"]["Enums"]["status_envio"] | null
        }
        Relationships: [
          {
            foreignKeyName: "alerta_envios_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_envios_cidadao_id_fkey"
            columns: ["cidadao_id"]
            isOneToOne: false
            referencedRelation: "cidadaos"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas: {
        Row: {
          bairro_id: string | null
          canais: Database["public"]["Enums"]["canal_envio"][]
          created_at: string | null
          criado_por: string | null
          id: string
          mensagem: string
          prefeitura_id: string
          tipo: Database["public"]["Enums"]["tipo_alerta"]
          titulo: string
          total_enviados: number | null
          total_erros: number | null
        }
        Insert: {
          bairro_id?: string | null
          canais?: Database["public"]["Enums"]["canal_envio"][]
          created_at?: string | null
          criado_por?: string | null
          id?: string
          mensagem: string
          prefeitura_id: string
          tipo: Database["public"]["Enums"]["tipo_alerta"]
          titulo: string
          total_enviados?: number | null
          total_erros?: number | null
        }
        Update: {
          bairro_id?: string | null
          canais?: Database["public"]["Enums"]["canal_envio"][]
          created_at?: string | null
          criado_por?: string | null
          id?: string
          mensagem?: string
          prefeitura_id?: string
          tipo?: Database["public"]["Enums"]["tipo_alerta"]
          titulo?: string
          total_enviados?: number | null
          total_erros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          avaliado_em: string | null
          comentario: string | null
          created_at: string
          estrelas: number
          id: string
          prefeitura_id: string
          reclamacao_id: string
          token: string
        }
        Insert: {
          avaliado_em?: string | null
          comentario?: string | null
          created_at?: string
          estrelas: number
          id?: string
          prefeitura_id: string
          reclamacao_id: string
          token?: string
        }
        Update: {
          avaliado_em?: string | null
          comentario?: string | null
          created_at?: string
          estrelas?: number
          id?: string
          prefeitura_id?: string
          reclamacao_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_reclamacao_id_fkey"
            columns: ["reclamacao_id"]
            isOneToOne: false
            referencedRelation: "reclamacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bairros: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          prefeitura_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          prefeitura_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          prefeitura_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bairros_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bairros_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          global: boolean | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          prefeitura_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          global?: boolean | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          prefeitura_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          global?: boolean | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          prefeitura_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      cidadaos: {
        Row: {
          aceita_alertas: boolean | null
          ativo: boolean | null
          bairro_id: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string
          prefeitura_id: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          aceita_alertas?: boolean | null
          ativo?: boolean | null
          bairro_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          prefeitura_id: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          aceita_alertas?: boolean | null
          ativo?: boolean | null
          bairro_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          prefeitura_id?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cidadaos_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cidadaos_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cidadaos_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_sistema: {
        Row: {
          chave: string
          created_at: string | null
          id: string
          updated_at: string | null
          valor: Json
        }
        Insert: {
          chave: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          valor?: Json
        }
        Update: {
          chave?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          valor?: Json
        }
        Relationships: []
      }
      historico_status: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          reclamacao_id: string
          status_anterior:
            | Database["public"]["Enums"]["complaint_status"]
            | null
          status_novo: Database["public"]["Enums"]["complaint_status"]
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          reclamacao_id: string
          status_anterior?:
            | Database["public"]["Enums"]["complaint_status"]
            | null
          status_novo: Database["public"]["Enums"]["complaint_status"]
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          reclamacao_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["complaint_status"]
            | null
          status_novo?: Database["public"]["Enums"]["complaint_status"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_status_reclamacao_id_fkey"
            columns: ["reclamacao_id"]
            isOneToOne: false
            referencedRelation: "reclamacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prefeitura_configuracoes: {
        Row: {
          avaliacao_comentarios_publicos: boolean
          avaliacao_nota_destaque: number
          avaliacao_obrigatoria: boolean
          avaliacao_permitir_resposta: boolean
          created_at: string | null
          exigir_foto_padrao: boolean
          id: string
          lgpd_anonimizar_relatorios: boolean
          lgpd_retencao_anos: number
          lgpd_texto_consentimento: string | null
          limite_imagens: number
          notif_ao_concluir: boolean
          notif_ao_criar: boolean
          notif_ao_mudar_status: boolean
          notif_email_ativo: boolean
          notif_sistema_ativo: boolean
          notif_sla_proximo: boolean
          notif_whatsapp_ativo: boolean
          permitir_anexo: boolean
          permitir_video: boolean
          prefeitura_id: string
          sla_alerta_percentual: number
          sla_alertas_ativos: boolean
          sla_padrao_dias: number
          updated_at: string | null
        }
        Insert: {
          avaliacao_comentarios_publicos?: boolean
          avaliacao_nota_destaque?: number
          avaliacao_obrigatoria?: boolean
          avaliacao_permitir_resposta?: boolean
          created_at?: string | null
          exigir_foto_padrao?: boolean
          id?: string
          lgpd_anonimizar_relatorios?: boolean
          lgpd_retencao_anos?: number
          lgpd_texto_consentimento?: string | null
          limite_imagens?: number
          notif_ao_concluir?: boolean
          notif_ao_criar?: boolean
          notif_ao_mudar_status?: boolean
          notif_email_ativo?: boolean
          notif_sistema_ativo?: boolean
          notif_sla_proximo?: boolean
          notif_whatsapp_ativo?: boolean
          permitir_anexo?: boolean
          permitir_video?: boolean
          prefeitura_id: string
          sla_alerta_percentual?: number
          sla_alertas_ativos?: boolean
          sla_padrao_dias?: number
          updated_at?: string | null
        }
        Update: {
          avaliacao_comentarios_publicos?: boolean
          avaliacao_nota_destaque?: number
          avaliacao_obrigatoria?: boolean
          avaliacao_permitir_resposta?: boolean
          created_at?: string | null
          exigir_foto_padrao?: boolean
          id?: string
          lgpd_anonimizar_relatorios?: boolean
          lgpd_retencao_anos?: number
          lgpd_texto_consentimento?: string | null
          limite_imagens?: number
          notif_ao_concluir?: boolean
          notif_ao_criar?: boolean
          notif_ao_mudar_status?: boolean
          notif_email_ativo?: boolean
          notif_sistema_ativo?: boolean
          notif_sla_proximo?: boolean
          notif_whatsapp_ativo?: boolean
          permitir_anexo?: boolean
          permitir_video?: boolean
          prefeitura_id?: string
          sla_alerta_percentual?: number
          sla_alertas_ativos?: boolean
          sla_padrao_dias?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefeitura_configuracoes_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: true
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prefeitura_configuracoes_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: true
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      prefeituras: {
        Row: {
          ativo: boolean | null
          cidade: string
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string | null
          email_contato: string | null
          estado: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_connected: boolean | null
          evolution_instance_name: string | null
          evolution_phone: string | null
          id: string
          imagem_capa_url: string | null
          logo_url: string | null
          nome: string
          plano: Database["public"]["Enums"]["plano_prefeitura"]
          slug: string
          telefone_contato: string | null
          texto_institucional: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          ativo?: boolean | null
          cidade: string
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string | null
          email_contato?: string | null
          estado?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_connected?: boolean | null
          evolution_instance_name?: string | null
          evolution_phone?: string | null
          id?: string
          imagem_capa_url?: string | null
          logo_url?: string | null
          nome: string
          plano?: Database["public"]["Enums"]["plano_prefeitura"]
          slug: string
          telefone_contato?: string | null
          texto_institucional?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          ativo?: boolean | null
          cidade?: string
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string | null
          email_contato?: string | null
          estado?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_connected?: boolean | null
          evolution_instance_name?: string | null
          evolution_phone?: string | null
          id?: string
          imagem_capa_url?: string | null
          logo_url?: string | null
          nome?: string
          plano?: Database["public"]["Enums"]["plano_prefeitura"]
          slug?: string
          telefone_contato?: string | null
          texto_institucional?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
          prefeitura_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          nome?: string | null
          prefeitura_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          prefeitura_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      reclamacoes: {
        Row: {
          bairro_id: string | null
          categoria_id: string | null
          created_at: string | null
          descricao: string
          email_cidadao: string
          fotos: string[] | null
          id: string
          localizacao: Json | null
          nome_cidadao: string
          numero: string | null
          prefeitura_id: string
          protocolo: string
          referencia: string | null
          resposta_prefeitura: string | null
          rua: string
          status: Database["public"]["Enums"]["complaint_status"] | null
          telefone_cidadao: string | null
          updated_at: string | null
          videos: string[] | null
          visualizada: boolean | null
        }
        Insert: {
          bairro_id?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao: string
          email_cidadao: string
          fotos?: string[] | null
          id?: string
          localizacao?: Json | null
          nome_cidadao: string
          numero?: string | null
          prefeitura_id: string
          protocolo: string
          referencia?: string | null
          resposta_prefeitura?: string | null
          rua: string
          status?: Database["public"]["Enums"]["complaint_status"] | null
          telefone_cidadao?: string | null
          updated_at?: string | null
          videos?: string[] | null
          visualizada?: boolean | null
        }
        Update: {
          bairro_id?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao?: string
          email_cidadao?: string
          fotos?: string[] | null
          id?: string
          localizacao?: Json | null
          nome_cidadao?: string
          numero?: string | null
          prefeitura_id?: string
          protocolo?: string
          referencia?: string | null
          resposta_prefeitura?: string | null
          rua?: string
          status?: Database["public"]["Enums"]["complaint_status"] | null
          telefone_cidadao?: string | null
          updated_at?: string | null
          videos?: string[] | null
          visualizada?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reclamacoes_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclamacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclamacoes_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclamacoes_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          prefeitura_id: string
          reclamacao_id: string | null
          retry_count: number | null
          status: string
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          prefeitura_id: string
          reclamacao_id?: string | null
          retry_count?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          prefeitura_id?: string
          reclamacao_id?: string | null
          retry_count?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_queue_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_queue_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_queue_reclamacao_id_fkey"
            columns: ["reclamacao_id"]
            isOneToOne: false
            referencedRelation: "reclamacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          prefeitura_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          prefeitura_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          prefeitura_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          created_at: string | null
          id: string
          pagina: string
          prefeitura_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pagina: string
          prefeitura_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pagina?: string
          prefeitura_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          prefeitura_id: string
          reclamacao_id: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload: Json
          prefeitura_id: string
          reclamacao_id?: string | null
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          prefeitura_id?: string
          reclamacao_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_reclamacao_id_fkey"
            columns: ["reclamacao_id"]
            isOneToOne: false
            referencedRelation: "reclamacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversas: {
        Row: {
          created_at: string
          dados_coletados: Json
          estado: string
          id: string
          localizacao: Json | null
          midias_coletadas: Json
          nome_cidadao: string | null
          operador_atendendo_desde: string | null
          operador_atendendo_id: string | null
          prefeitura_id: string
          reclamacao_id: string | null
          telefone: string
          ultima_mensagem_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dados_coletados?: Json
          estado?: string
          id?: string
          localizacao?: Json | null
          midias_coletadas?: Json
          nome_cidadao?: string | null
          operador_atendendo_desde?: string | null
          operador_atendendo_id?: string | null
          prefeitura_id: string
          reclamacao_id?: string | null
          telefone: string
          ultima_mensagem_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dados_coletados?: Json
          estado?: string
          id?: string
          localizacao?: Json | null
          midias_coletadas?: Json
          nome_cidadao?: string | null
          operador_atendendo_desde?: string | null
          operador_atendendo_id?: string | null
          prefeitura_id?: string
          reclamacao_id?: string | null
          telefone?: string
          ultima_mensagem_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversas_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversas_reclamacao_id_fkey"
            columns: ["reclamacao_id"]
            isOneToOne: false
            referencedRelation: "reclamacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          direcao: string
          enviado_por: string | null
          id: string
          lida: boolean | null
          midia_url: string | null
          operador_id: string | null
          prefeitura_id: string
          tipo: string
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          direcao: string
          enviado_por?: string | null
          id?: string
          lida?: boolean | null
          midia_url?: string | null
          operador_id?: string | null
          prefeitura_id: string
          tipo?: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          direcao?: string
          enviado_por?: string | null
          id?: string
          lida?: boolean | null
          midia_url?: string | null
          operador_id?: string | null
          prefeitura_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          atalho: string | null
          ativo: boolean | null
          conteudo: string
          created_at: string | null
          id: string
          ordem: number | null
          prefeitura_id: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          atalho?: string | null
          ativo?: boolean | null
          conteudo: string
          created_at?: string | null
          id?: string
          ordem?: number | null
          prefeitura_id: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          atalho?: string | null
          ativo?: boolean | null
          conteudo?: string
          created_at?: string | null
          id?: string
          ordem?: number | null
          prefeitura_id?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras_publico"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      prefeituras_publico: {
        Row: {
          ativo: boolean | null
          cidade: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string | null
          email_contato: string | null
          estado: string | null
          evolution_connected: boolean | null
          id: string | null
          imagem_capa_url: string | null
          logo_url: string | null
          nome: string | null
          plano: Database["public"]["Enums"]["plano_prefeitura"] | null
          slug: string | null
          telefone_contato: string | null
          texto_institucional: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cidade?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string | null
          email_contato?: string | null
          estado?: string | null
          evolution_connected?: boolean | null
          id?: string | null
          imagem_capa_url?: string | null
          logo_url?: string | null
          nome?: string | null
          plano?: Database["public"]["Enums"]["plano_prefeitura"] | null
          slug?: string | null
          telefone_contato?: string | null
          texto_institucional?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cidade?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string | null
          email_contato?: string | null
          estado?: string | null
          evolution_connected?: boolean | null
          id?: string | null
          imagem_capa_url?: string | null
          logo_url?: string | null
          nome?: string | null
          plano?: Database["public"]["Enums"]["plano_prefeitura"] | null
          slug?: string | null
          telefone_contato?: string | null
          texto_institucional?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      buscar_avaliacao_por_token: {
        Args: { _token: string }
        Returns: {
          bairro_nome: string
          categoria_nome: string
          ja_avaliada: boolean
          prefeitura_nome: string
          protocolo: string
          rua: string
        }[]
      }
      consultar_historico_protocolo: {
        Args: { _prefeitura_id: string; _protocolo: string }
        Returns: {
          created_at: string
          id: string
          observacao: string
          status_anterior: string
          status_novo: string
        }[]
      }
      consultar_protocolo: {
        Args: { _prefeitura_id: string; _protocolo: string }
        Returns: {
          bairro_nome: string
          categoria_nome: string
          created_at: string
          id: string
          protocolo: string
          resposta_prefeitura: string
          rua: string
          status: Database["public"]["Enums"]["complaint_status"]
          updated_at: string
        }[]
      }
      criar_reclamacao_publica: {
        Args: {
          _bairro_id?: string
          _categoria_id?: string
          _descricao?: string
          _email_cidadao: string
          _fotos?: string[]
          _localizacao?: Json
          _nome_cidadao: string
          _numero?: string
          _prefeitura_id: string
          _referencia?: string
          _rua: string
          _telefone_cidadao?: string
          _videos?: string[]
        }
        Returns: {
          protocolo: string
        }[]
      }
      get_prefeitura_config_publica: {
        Args: { _prefeitura_id: string }
        Returns: {
          exigir_foto_padrao: boolean
          lgpd_texto_consentimento: string
          limite_imagens: number
          permitir_anexo: boolean
          permitir_video: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_prefeitura_admin: {
        Args: { _prefeitura_id: string; _user_id: string }
        Returns: boolean
      }
      submeter_avaliacao: {
        Args: { _comentario?: string; _estrelas: number; _token: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "admin_prefeitura" | "user"
      canal_envio: "whatsapp" | "sms" | "push" | "email"
      complaint_status: "recebida" | "em_andamento" | "resolvida" | "arquivada"
      plano_prefeitura: "starter" | "pro"
      status_envio: "pendente" | "enviado" | "erro"
      tipo_alerta:
        | "enchente"
        | "chuva_forte"
        | "alagamento"
        | "emergencia"
        | "aviso_geral"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin_prefeitura", "user"],
      canal_envio: ["whatsapp", "sms", "push", "email"],
      complaint_status: ["recebida", "em_andamento", "resolvida", "arquivada"],
      plano_prefeitura: ["starter", "pro"],
      status_envio: ["pendente", "enviado", "erro"],
      tipo_alerta: [
        "enchente",
        "chuva_forte",
        "alagamento",
        "emergencia",
        "aviso_geral",
      ],
    },
  },
} as const
