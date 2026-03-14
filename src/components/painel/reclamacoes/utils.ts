import { Reclamacao, ReclamacaoComSla, SlaStatus, SLA_LIMITE_DIAS_DEFAULT, SLA_ALERTA_PERCENTUAL_DEFAULT } from './types';

export const calcularTempoEspera = (created_at: string, updated_at: string, status: string): number => {
  const inicio = new Date(created_at);
  inicio.setHours(0, 0, 0, 0);
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const fimDate = new Date(updated_at);
  fimDate.setHours(0, 0, 0, 0);
  
  // Se está resolvida ou arquivada, considera o tempo até a resolução
  if (status === 'resolvida' || status === 'arquivada') {
    const diffMs = fimDate.getTime() - inicio.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  
  // Se ainda está pendente, conta até hoje
  const diffMs = hoje.getTime() - inicio.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const formatarTempoEspera = (dias: number): string => {
  if (dias === 0) return "Hoje";
  if (dias === 1) return "1 dia";
  return `${dias} dias`;
};

export const calcularSlaStatus = (dias: number, status: string, slaLimiteDias?: number, slaAlertaDias?: number): SlaStatus => {
  // Se já está resolvida ou arquivada, está "dentro do prazo"
  if (status === 'resolvida' || status === 'arquivada') {
    return 'dentro';
  }
  
  const limite = slaLimiteDias ?? SLA_LIMITE_DIAS_DEFAULT;
  const alerta = slaAlertaDias ?? Math.floor(limite * (SLA_ALERTA_PERCENTUAL_DEFAULT / 100));
  
  if (dias > limite) return 'vencido';
  if (dias >= alerta) return 'proximo';
  return 'dentro';
};

export const verificarRecorrencia = (
  reclamacao: Reclamacao, 
  todasReclamacoes: Reclamacao[]
): boolean => {
  const mesmaRuaCategoria = todasReclamacoes.filter(r => 
    r.id !== reclamacao.id &&
    r.rua.toLowerCase() === reclamacao.rua.toLowerCase() &&
    r.categoria_id === reclamacao.categoria_id &&
    r.categoria_id !== null
  );

  if (mesmaRuaCategoria.length === 0) return false;

  // Verifica se alguma foi criada nos últimos 90 dias
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 90);

  return mesmaRuaCategoria.some(r => new Date(r.created_at) >= dataLimite);
};

export const processarReclamacoes = (
  reclamacoes: Reclamacao[], 
  slaLimiteDias?: number, 
  slaAlertaDias?: number
): ReclamacaoComSla[] => {
  return reclamacoes.map(r => {
    const diasEspera = calcularTempoEspera(r.created_at, r.updated_at, r.status);
    const slaStatus = calcularSlaStatus(diasEspera, r.status, slaLimiteDias, slaAlertaDias);
    const isRecorrente = verificarRecorrencia(r, reclamacoes);
    
    return {
      ...r,
      diasEspera,
      slaStatus,
      isRecorrente
    };
  });
};

export const ordenarPorUrgencia = (reclamacoes: ReclamacaoComSla[]): ReclamacaoComSla[] => {
  return [...reclamacoes].sort((a, b) => {
    // Prioridade 1: SLA vencido
    if (a.slaStatus === 'vencido' && b.slaStatus !== 'vencido') return -1;
    if (b.slaStatus === 'vencido' && a.slaStatus !== 'vencido') return 1;
    
    // Prioridade 2: SLA próximo do vencimento
    if (a.slaStatus === 'proximo' && b.slaStatus === 'dentro') return -1;
    if (b.slaStatus === 'proximo' && a.slaStatus === 'dentro') return 1;
    
    // Prioridade 3: Ordenar por dias de espera (maior primeiro)
    if (a.slaStatus === b.slaStatus) {
      return b.diasEspera - a.diasEspera;
    }
    
    return 0;
  });
};
