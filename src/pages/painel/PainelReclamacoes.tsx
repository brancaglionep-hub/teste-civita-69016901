import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Eye, Printer, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Reclamacao, ReclamacaoComSla, statusConfig, slaConfig } from "@/components/painel/reclamacoes/types";
import { processarReclamacoes, ordenarPorUrgencia, formatarTempoEspera } from "@/components/painel/reclamacoes/utils";
import { SlaBadge } from "@/components/painel/reclamacoes/SlaBadge";
import { RecorrenciaBadge } from "@/components/painel/reclamacoes/RecorrenciaBadge";
import { AcoesRapidas } from "@/components/painel/reclamacoes/AcoesRapidas";
import { FiltrosAvancados } from "@/components/painel/reclamacoes/FiltrosAvancados";

interface OutletContext {
  prefeituraId: string;
}

const ITEMS_PER_PAGE = 10;

const PainelReclamacoes = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tempoFilter, setTempoFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Buscar reclamações
  const { data: reclamacoes = [], isLoading, refetch } = useQuery({
    queryKey: ["painel-reclamacoes", prefeituraId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("reclamacoes")
        .select(`
          id,
          protocolo,
          status,
          rua,
          created_at,
          updated_at,
          resposta_prefeitura,
          nome_cidadao,
          email_cidadao,
          telefone_cidadao,
          descricao,
          categoria_id,
          visualizada,
          bairros (nome),
          categorias (nome, icone)
        `)
        .eq("prefeitura_id", prefeituraId);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Reclamacao[];
    },
    enabled: !!prefeituraId,
    staleTime: 1000 * 60,
  });

  // Buscar categorias para o filtro
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-filtro", prefeituraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nome")
        .or(`prefeitura_id.eq.${prefeituraId},global.eq.true`)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: !!prefeituraId,
  });

  // Buscar configurações de SLA da prefeitura
  const { data: configSla } = useQuery({
    queryKey: ["config-sla", prefeituraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prefeitura_configuracoes")
        .select("sla_padrao_dias, sla_alerta_percentual")
        .eq("prefeitura_id", prefeituraId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!prefeituraId,
  });

  const slaPadraoDias = configSla?.sla_padrao_dias ?? 7;
  const slaAlertaPercentual = configSla?.sla_alerta_percentual ?? 80;
  const slaAlertaDias = Math.floor(slaPadraoDias * (slaAlertaPercentual / 100));

  // Processar reclamações com SLA e recorrência
  const reclamacoesProcessadas = processarReclamacoes(reclamacoes, slaPadraoDias, slaAlertaDias);
  
  // Filtrar reclamações
  const filteredReclamacoes = reclamacoesProcessadas.filter(r => {
    // Busca por texto
    const matchesSearch = r.protocolo.toLowerCase().includes(search.toLowerCase()) ||
      r.rua.toLowerCase().includes(search.toLowerCase()) ||
      r.bairros?.nome.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    // Filtro por SLA
    if (slaFilter !== "all" && r.slaStatus !== slaFilter) return false;

    // Filtro por categoria
    if (categoriaFilter !== "all" && r.categoria_id !== categoriaFilter) return false;

    // Filtro por tempo
    if (tempoFilter === "all") return true;

    switch (tempoFilter) {
      case "hoje": return r.diasEspera === 0;
      case "1-3": return r.diasEspera >= 1 && r.diasEspera <= 3;
      case "4-7": return r.diasEspera >= 4 && r.diasEspera <= 7;
      case "8-15": return r.diasEspera >= 8 && r.diasEspera <= 15;
      case "16-30": return r.diasEspera >= 16 && r.diasEspera <= 30;
      case "30+": return r.diasEspera > 30;
      default: return true;
    }
  });

  // Ordenar por data mais recente primeiro
  const sortedReclamacoes = [...filteredReclamacoes].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Pagination logic
  const totalPages = Math.ceil(sortedReclamacoes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReclamacoes = sortedReclamacoes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const markAsReadOptimistic = (reclamacaoId: string) => {
    queryClient
      .getQueryCache()
      .findAll({ queryKey: ["painel-reclamacoes", prefeituraId] })
      .forEach((query) => {
        queryClient.setQueryData(query.queryKey, (old) => {
          if (!Array.isArray(old)) return old;
          return (old as Reclamacao[]).map((r) =>
            r.id === reclamacaoId ? { ...r, visualizada: true } : r
          );
        });
      });
  };

  const exportToExcel = () => {
    const headers = [
      "Protocolo",
      "Nome Cidadão",
      "E-mail",
      "Telefone",
      "Bairro",
      "Rua",
      "Categoria",
      "Descrição",
      "Status",
      "SLA",
      "Dias em Aberto",
      "Data Registro",
      "Última Atualização",
      "Recorrente",
      "Resposta Prefeitura"
    ];

    const rows = sortedReclamacoes.map(r => {
      return [
        r.protocolo,
        r.nome_cidadao,
        r.email_cidadao,
        r.telefone_cidadao || "",
        r.bairros?.nome || "",
        r.rua,
        r.categorias?.nome || "",
        r.descricao?.replace(/[\n\r]/g, " ") || "",
        statusConfig[r.status]?.label || r.status,
        slaConfig[r.slaStatus]?.label || "",
        r.diasEspera.toString(),
        new Date(r.created_at).toLocaleDateString("pt-BR"),
        new Date(r.updated_at).toLocaleDateString("pt-BR"),
        r.isRecorrente ? "Sim" : "Não",
        r.resposta_prefeitura?.replace(/[\n\r]/g, " ") || ""
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(";"))
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reclamacoes_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Arquivo exportado com sucesso!" });
  };

  const handlePrint = async (reclamacaoId: string) => {
    const { data, error } = await supabase
      .from("reclamacoes")
      .select(`
        *,
        bairros (nome),
        categorias (nome)
      `)
      .eq("id", reclamacaoId)
      .single();

    if (error || !data) {
      toast({ title: "Erro ao carregar reclamação", variant: "destructive" });
      return;
    }

    const rec = data as any;
    const status = statusConfig[rec.status] || statusConfig.recebida;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reclamação ${rec.protocolo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid #333; padding-bottom: 4px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 3px solid #333; padding-bottom: 16px; }
          .protocolo { font-size: 28px; font-weight: bold; }
          .status { padding: 8px 16px; border-radius: 20px; font-weight: bold; background: #e5e5e5; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .info-item { margin-bottom: 12px; }
          .info-label { font-weight: bold; color: #555; font-size: 12px; text-transform: uppercase; }
          .info-value { font-size: 16px; margin-top: 4px; }
          .descricao { background: #f5f5f5; padding: 16px; border-radius: 8px; margin-top: 8px; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 12px; color: #666; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="protocolo">${rec.protocolo}</div>
            <div style="color: #666;">Reclamação de Via Pública</div>
          </div>
          <div class="status">${status.label}</div>
        </div>

        <h2>Dados do Cidadão</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Nome</div>
            <div class="info-value">${rec.nome_cidadao}</div>
          </div>
          <div class="info-item">
            <div class="info-label">E-mail</div>
            <div class="info-value">${rec.email_cidadao}</div>
          </div>
          ${rec.telefone_cidadao ? `
          <div class="info-item">
            <div class="info-label">Telefone</div>
            <div class="info-value">${rec.telefone_cidadao}</div>
          </div>
          ` : ''}
        </div>

        <h2>Informações do Registro</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Data de Registro</div>
            <div class="info-value">${new Date(rec.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Última Atualização</div>
            <div class="info-value">${new Date(rec.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
          </div>
        </div>

        ${rec.resposta_prefeitura ? `
        <h2>Resposta da Prefeitura</h2>
        <div class="descricao">${rec.resposta_prefeitura}</div>
        ` : ''}

        <h2>Problema Relatado</h2>
        <div class="info-item">
          <div class="info-label">Tipo</div>
          <div class="info-value">${rec.categorias?.nome || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Descrição</div>
          <div class="descricao">${rec.descricao || 'Sem descrição'}</div>
        </div>

        ${rec.fotos?.length > 0 ? `
        <h2>Fotos Anexadas</h2>
        <p>${rec.fotos.length} foto(s) anexada(s) - visualizar no sistema</p>
        ` : ''}

        <h2>Localização</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Rua</div>
            <div class="info-value">${rec.rua}${rec.numero ? `, ${rec.numero}` : ''}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Bairro</div>
            <div class="info-value">${rec.bairros?.nome || '-'}</div>
          </div>
          ${rec.referencia ? `
          <div class="info-item">
            <div class="info-label">Ponto de Referência</div>
            <div class="info-value">${rec.referencia}</div>
          </div>
          ` : ''}
        </div>

        <div class="footer">
          Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Estatísticas de SLA e novas reclamações
  const stats = {
    novas: reclamacoesProcessadas.filter(r => !r.visualizada).length,
    vencidos: reclamacoesProcessadas.filter(r => r.slaStatus === 'vencido').length,
    proximos: reclamacoesProcessadas.filter(r => r.slaStatus === 'proximo').length,
    noPrazo: reclamacoesProcessadas.filter(r => r.slaStatus === 'dentro').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Reclamações</h1>
          <p className="text-muted-foreground mt-1">Gerencie as reclamações recebidas</p>
        </div>
        
        {/* Cards de resumo SLA */}
        <div className="flex gap-3">
          {stats.novas > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
              <span className="text-lg">🔵</span>
              <div>
                <div className="text-lg font-bold text-blue-700">{stats.novas}</div>
                <div className="text-xs text-blue-600">Novas</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
            <span className="text-lg">🔴</span>
            <div>
              <div className="text-lg font-bold text-red-700">{stats.vencidos}</div>
              <div className="text-xs text-red-600">Vencidos</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200">
            <span className="text-lg">🟡</span>
            <div>
              <div className="text-lg font-bold text-yellow-700">{stats.proximos}</div>
              <div className="text-xs text-yellow-600">Próximos</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
            <span className="text-lg">🟢</span>
            <div>
              <div className="text-lg font-bold text-green-700">{stats.noPrazo}</div>
              <div className="text-xs text-green-600">No prazo</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <FiltrosAvancados
          search={search}
          onSearchChange={handleFilterChange(setSearch)}
          statusFilter={statusFilter}
          onStatusFilterChange={handleFilterChange(setStatusFilter)}
          tempoFilter={tempoFilter}
          onTempoFilterChange={handleFilterChange(setTempoFilter)}
          slaFilter={slaFilter}
          onSlaFilterChange={handleFilterChange(setSlaFilter)}
          categoriaFilter={categoriaFilter}
          onCategoriaFilterChange={handleFilterChange(setCategoriaFilter)}
          categorias={categorias}
          onExport={exportToExcel}
        />
        <Button onClick={exportToExcel} variant="outline" className="gap-2 shrink-0">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">SLA</TableHead>
              <TableHead>Protocolo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Bairro / Rua</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedReclamacoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma reclamação encontrada
                </TableCell>
              </TableRow>
            ) : (
              paginatedReclamacoes.map((reclamacao) => {
                const status = statusConfig[reclamacao.status] || statusConfig.recebida;
                const isNaoLida = !reclamacao.visualizada;
                
                return (
                  <TableRow 
                    key={reclamacao.id} 
                    className={`
                      ${reclamacao.slaStatus === 'vencido' ? 'bg-red-50/50' : ''}
                      ${isNaoLida ? 'bg-blue-50/30 hover:bg-blue-50/50' : ''}
                    `}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isNaoLida && (
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Nova reclamação" />
                        )}
                        <SlaBadge status={reclamacao.slaStatus} dias={reclamacao.diasEspera} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={`font-mono text-sm ${isNaoLida ? 'font-bold text-foreground' : 'font-medium'}`}>
                          {reclamacao.protocolo}
                        </span>
                        {reclamacao.isRecorrente && <RecorrenciaBadge />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${isNaoLida ? 'font-semibold' : ''}`}>
                        {reclamacao.categorias?.nome || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className={`text-sm ${isNaoLida ? 'font-bold' : 'font-medium'}`}>
                          {reclamacao.bairros?.nome || "-"}
                        </span>
                        <span className={`text-xs text-muted-foreground truncate max-w-[200px] ${isNaoLida ? 'font-medium' : ''}`}>
                          {reclamacao.rua}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bgClass} ${status.color}`}>
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className={`text-sm ${isNaoLida ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {new Date(reclamacao.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Instantâneo: atualiza o cache local antes de navegar
                            if (!reclamacao.visualizada) {
                              markAsReadOptimistic(reclamacao.id);
                              void supabase
                                .from("reclamacoes")
                                .update({ visualizada: true })
                                .eq("id", reclamacao.id)
                                .then(({ error }) => {
                                  if (error) {
                                    toast({
                                      title: "Não foi possível marcar como lida",
                                      variant: "destructive",
                                    });
                                    queryClient.invalidateQueries({
                                      queryKey: ["painel-reclamacoes", prefeituraId],
                                    });
                                  }
                                });
                            }

                            navigate(`/painel/${prefeituraId}/reclamacoes/${reclamacao.id}`);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(reclamacao.id)}
                          title="Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <AcoesRapidas
                          reclamacaoId={reclamacao.id}
                          statusAtual={reclamacao.status}
                          onStatusChange={() => refetch()}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, sortedReclamacoes.length)} de {sortedReclamacoes.length} reclamações
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Legenda SLA */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground border-t pt-4">
        <span className="font-medium">Legenda SLA (prazo: {slaPadraoDias} dias):</span>
        <span className="flex items-center gap-1">🟢 No prazo</span>
        <span className="flex items-center gap-1">🟡 Próximo do vencimento ({slaAlertaDias}+ dias)</span>
        <span className="flex items-center gap-1">🔴 Vencido ({slaPadraoDias}+ dias)</span>
      </div>
    </div>
  );
};

export default PainelReclamacoes;
