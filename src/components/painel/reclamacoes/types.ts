export interface Reclamacao {
  id: string;
  protocolo: string;
  status: string;
  rua: string;
  created_at: string;
  updated_at: string;
  resposta_prefeitura: string | null;
  nome_cidadao: string;
  email_cidadao: string;
  telefone_cidadao: string | null;
  descricao: string;
  categoria_id: string | null;
  visualizada: boolean;
  bairros: { nome: string } | null;
  categorias: { nome: string; icone: string | null } | null;
}

export type SlaStatus = 'dentro' | 'proximo' | 'vencido';

export interface ReclamacaoComSla extends Reclamacao {
  diasEspera: number;
  slaStatus: SlaStatus;
  isRecorrente: boolean;
}

// Valores padrão, mas sempre deve-se usar as configurações da prefeitura quando disponíveis
export const SLA_LIMITE_DIAS_DEFAULT = 7;
export const SLA_ALERTA_PERCENTUAL_DEFAULT = 80;

export const statusConfig: Record<string, { label: string; color: string; bgClass: string }> = {
  recebida: { label: "Recebida", color: "text-blue-700", bgClass: "bg-blue-100" },
  em_andamento: { label: "Em Andamento", color: "text-orange-700", bgClass: "bg-orange-100" },
  resolvida: { label: "Resolvida", color: "text-green-700", bgClass: "bg-green-100" },
  arquivada: { label: "Arquivada", color: "text-gray-700", bgClass: "bg-gray-100" }
};

export const slaConfig: Record<SlaStatus, { label: string; color: string; bgClass: string; icon: string }> = {
  dentro: { label: "No prazo", color: "text-green-700", bgClass: "bg-green-100", icon: "🟢" },
  proximo: { label: "Próximo", color: "text-yellow-700", bgClass: "bg-yellow-100", icon: "🟡" },
  vencido: { label: "Vencido", color: "text-red-700", bgClass: "bg-red-100", icon: "🔴" }
};
