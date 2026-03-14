import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Star, MessageSquare, Calendar, Filter, Download, TrendingUp, TrendingDown, AlertTriangle, Clock, MapPin, Tag, ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const ITEMS_PER_PAGE = 10;

interface OutletContext {
  prefeituraId: string;
}

interface Avaliacao {
  id: string;
  estrelas: number;
  comentario: string | null;
  avaliado_em: string;
  created_at: string;
  reclamacao_id: string;
  reclamacoes: {
    id: string;
    protocolo: string;
    rua: string;
    numero: string | null;
    nome_cidadao: string;
    email_cidadao: string;
    telefone_cidadao: string | null;
    descricao: string;
    status: string;
    created_at: string;
    updated_at: string;
    resposta_prefeitura: string | null;
    bairro_id: string | null;
    categoria_id: string | null;
    bairros: { id: string; nome: string } | null;
    categorias: { id: string; nome: string } | null;
  };
}

interface AvaliacaoProcessada extends Avaliacao {
  diasResolucao: number;
  slaEstourado: boolean;
}

const calcularDiasResolucao = (created_at: string, updated_at: string): number => {
  const inicio = new Date(created_at);
  const fim = new Date(updated_at);
  return Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
};

const PainelAvaliacoes = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [filtroEstrelas, setFiltroEstrelas] = useState<string>("todas");
  const [filtroBairro, setFiltroBairro] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroSla, setFiltroSla] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(1);

  // Buscar avaliações com dados completos da reclamação
  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ["painel-avaliacoes-completas", prefeituraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select(`
          id,
          estrelas,
          comentario,
          avaliado_em,
          created_at,
          reclamacao_id,
          reclamacoes (
            id,
            protocolo,
            rua,
            numero,
            nome_cidadao,
            email_cidadao,
            telefone_cidadao,
            descricao,
            status,
            created_at,
            updated_at,
            resposta_prefeitura,
            bairro_id,
            categoria_id,
            bairros (id, nome),
            categorias (id, nome)
          )
        `)
        .eq("prefeitura_id", prefeituraId)
        .not("avaliado_em", "is", null)
        .order("avaliado_em", { ascending: false });

      if (error) throw error;
      return (data || []) as Avaliacao[];
    },
    enabled: !!prefeituraId,
  });

  // Buscar bairros e categorias para filtros
  const { data: bairros = [] } = useQuery({
    queryKey: ["bairros-filtro-avaliacoes", prefeituraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bairros")
        .select("id, nome")
        .eq("prefeitura_id", prefeituraId)
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: !!prefeituraId,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-filtro-avaliacoes", prefeituraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias")
        .select("id, nome")
        .or(`prefeitura_id.eq.${prefeituraId},global.eq.true`)
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: !!prefeituraId,
  });

  // Buscar configurações de SLA da prefeitura
  const { data: configSla } = useQuery({
    queryKey: ["config-sla-avaliacoes", prefeituraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prefeitura_configuracoes")
        .select("sla_padrao_dias, sla_alerta_percentual")
        .eq("prefeitura_id", prefeituraId)
        .maybeSingle();
      return data;
    },
    enabled: !!prefeituraId,
  });

  const slaPadraoDias = configSla?.sla_padrao_dias ?? 7;

  // Processar avaliações com dados de SLA
  const avaliacoesProcessadas: AvaliacaoProcessada[] = avaliacoes.map(a => {
    const diasResolucao = a.reclamacoes ? calcularDiasResolucao(a.reclamacoes.created_at, a.reclamacoes.updated_at) : 0;
    const slaEstourado = diasResolucao > slaPadraoDias;
    return { ...a, diasResolucao, slaEstourado };
  });

  // Aplicar filtros
  const avaliacoesFiltradas = avaliacoesProcessadas.filter(a => {
    if (filtroEstrelas !== "todas" && a.estrelas !== parseInt(filtroEstrelas)) return false;
    if (filtroBairro !== "todos" && a.reclamacoes?.bairro_id !== filtroBairro) return false;
    if (filtroCategoria !== "todas" && a.reclamacoes?.categoria_id !== filtroCategoria) return false;
    if (filtroSla === "estourado" && !a.slaEstourado) return false;
    if (filtroSla === "dentro" && a.slaEstourado) return false;
    return true;
  });

  // Calcular estatísticas
  const stats = {
    total: avaliacoesProcessadas.length,
    media: avaliacoesProcessadas.length > 0 
      ? avaliacoesProcessadas.reduce((acc, a) => acc + a.estrelas, 0) / avaliacoesProcessadas.length 
      : 0,
    positivas: avaliacoesProcessadas.filter(a => a.estrelas >= 4).length,
    negativas: avaliacoesProcessadas.filter(a => a.estrelas <= 2).length,
    neutras: avaliacoesProcessadas.filter(a => a.estrelas === 3).length,
    percentPositivas: avaliacoesProcessadas.length > 0 
      ? (avaliacoesProcessadas.filter(a => a.estrelas >= 4).length / avaliacoesProcessadas.length) * 100 
      : 0,
    percentNegativas: avaliacoesProcessadas.length > 0 
      ? (avaliacoesProcessadas.filter(a => a.estrelas <= 2).length / avaliacoesProcessadas.length) * 100 
      : 0,
    tempoMedioPositivas: (() => {
      const positivas = avaliacoesProcessadas.filter(a => a.estrelas >= 4);
      if (positivas.length === 0) return 0;
      return positivas.reduce((acc, a) => acc + a.diasResolucao, 0) / positivas.length;
    })(),
    distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
  };

  avaliacoesProcessadas.forEach(a => {
    stats.distribuicao[a.estrelas]++;
  });

  // Categorias mais mal avaliadas
  const categoriaStats = categorias.map(cat => {
    const avaliacoesCat = avaliacoesProcessadas.filter(a => a.reclamacoes?.categoria_id === cat.id);
    const media = avaliacoesCat.length > 0 
      ? avaliacoesCat.reduce((acc, a) => acc + a.estrelas, 0) / avaliacoesCat.length 
      : 0;
    return { ...cat, media, total: avaliacoesCat.length };
  }).filter(c => c.total > 0).sort((a, b) => a.media - b.media);

  // Dados para gráfico de evolução mensal
  const evolucaoMensal = (() => {
    const meses: Record<string, { soma: number; count: number }> = {};
    avaliacoesProcessadas.forEach(a => {
      const data = new Date(a.avaliado_em);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      if (!meses[chave]) meses[chave] = { soma: 0, count: 0 };
      meses[chave].soma += a.estrelas;
      meses[chave].count++;
    });
    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, dados]) => ({
        mes: new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
        media: dados.count > 0 ? (dados.soma / dados.count) : 0,
      }));
  })();

  // Dados para gráfico de categorias
  const dadosCategorias = categoriaStats.slice(0, 5).map(c => ({
    nome: c.nome.length > 15 ? c.nome.substring(0, 15) + '...' : c.nome,
    media: c.media,
  }));

  // Pagination
  const totalPages = Math.ceil(avaliacoesFiltradas.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAvaliacoes = avaliacoesFiltradas.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const formatarStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      recebida: "Recebida",
      em_analise: "Em Análise",
      em_andamento: "Em Andamento",
      resolvida: "Resolvida",
      arquivada: "Arquivada"
    };
    return statusMap[status] || status;
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const exportToExcel = () => {
    const headers = [
      // Dados da Avaliação
      "Data da Avaliação",
      "Hora da Avaliação",
      "Nota (Estrelas)",
      "Classificação",
      "Comentário do Cidadão",
      
      // Dados da Reclamação
      "Protocolo",
      "Status da Reclamação",
      "Data de Abertura",
      "Data de Resolução",
      "Dias para Resolver",
      "SLA (15 dias)",
      "Prazo SLA",
      
      // Localização
      "Categoria do Problema",
      "Bairro",
      "Rua",
      "Número",
      
      // Dados do Cidadão
      "Nome do Cidadão",
      "E-mail",
      "Telefone",
      
      // Detalhes
      "Descrição do Problema",
      "Resposta da Prefeitura"
    ];

    const rows = avaliacoesFiltradas.map(a => {
      const dataAvaliacao = new Date(a.avaliado_em);
      const classificacao = a.estrelas >= 4 ? "Positiva" : a.estrelas === 3 ? "Neutra" : "Negativa";
      
      return [
        // Dados da Avaliação
        dataAvaliacao.toLocaleDateString("pt-BR"),
        dataAvaliacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        a.estrelas.toString(),
        classificacao,
        a.comentario?.replace(/[\n\r]/g, " ").trim() || "(Sem comentário)",
        
        // Dados da Reclamação
        a.reclamacoes?.protocolo || "",
        formatarStatus(a.reclamacoes?.status || ""),
        a.reclamacoes?.created_at ? new Date(a.reclamacoes.created_at).toLocaleDateString("pt-BR") : "",
        a.reclamacoes?.updated_at ? new Date(a.reclamacoes.updated_at).toLocaleDateString("pt-BR") : "",
        a.diasResolucao.toString(),
        a.slaEstourado ? "ESTOURADO" : "Dentro do prazo",
        a.slaEstourado ? `${a.diasResolucao - 15} dias de atraso` : `${15 - a.diasResolucao} dias de folga`,
        
        // Localização
        a.reclamacoes?.categorias?.nome || "(Sem categoria)",
        a.reclamacoes?.bairros?.nome || "(Sem bairro)",
        a.reclamacoes?.rua || "",
        a.reclamacoes?.numero || "",
        
        // Dados do Cidadão
        a.reclamacoes?.nome_cidadao || "",
        a.reclamacoes?.email_cidadao || "",
        a.reclamacoes?.telefone_cidadao || "",
        
        // Detalhes
        a.reclamacoes?.descricao?.replace(/[\n\r]/g, " ").trim() || "",
        a.reclamacoes?.resposta_prefeitura?.replace(/[\n\r]/g, " ").trim() || "(Sem resposta)"
      ];
    });

    // Adicionar linha de resumo no início
    const resumo = [
      ["RELATÓRIO DE AVALIAÇÕES"],
      [`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`],
      [`Total de avaliações: ${avaliacoesFiltradas.length}`],
      [`Nota média: ${(avaliacoesFiltradas.reduce((acc, a) => acc + a.estrelas, 0) / avaliacoesFiltradas.length || 0).toFixed(2)}`],
      [`Positivas (4-5 estrelas): ${avaliacoesFiltradas.filter(a => a.estrelas >= 4).length}`],
      [`Negativas (1-2 estrelas): ${avaliacoesFiltradas.filter(a => a.estrelas <= 2).length}`],
      [`Com SLA estourado: ${avaliacoesFiltradas.filter(a => a.slaEstourado).length}`],
      [""],
      ["--- DADOS DETALHADOS ---"],
      [""]
    ];

    const csvContent = [
      ...resumo.map(row => row.join(";")),
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(";"))
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_avaliacoes_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ 
      title: "Relatório exportado!", 
      description: `${avaliacoesFiltradas.length} avaliações exportadas com sucesso.`
    });
  };

  const renderStars = (count: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= count ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Avaliações</h1>
          <p className="text-muted-foreground">Feedback dos cidadãos sobre os serviços</p>
        </div>
        <Button onClick={exportToExcel} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </div>

      {/* Indicadores Principais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Star className="w-4 h-4" />
            <span className="text-sm">Nota Média</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-foreground">{stats.media.toFixed(1)}</span>
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ThumbsUp className="w-4 h-4" />
            <span className="text-sm">Positivas (4-5)</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-600">{stats.percentPositivas.toFixed(0)}%</span>
            <span className="text-sm text-muted-foreground">({stats.positivas})</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ThumbsDown className="w-4 h-4" />
            <span className="text-sm">Negativas (1-2)</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-red-600">{stats.percentNegativas.toFixed(0)}%</span>
            <span className="text-sm text-muted-foreground">({stats.negativas})</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Tempo Médio (4-5⭐)</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{stats.tempoMedioPositivas.toFixed(0)}</span>
            <span className="text-sm text-muted-foreground">dias</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Pior Categoria</span>
          </div>
          {categoriaStats[0] ? (
            <div>
              <span className="text-lg font-bold text-red-600 truncate block">{categoriaStats[0].nome}</span>
              <span className="text-xs text-muted-foreground">{categoriaStats[0].media.toFixed(1)}⭐ ({categoriaStats[0].total} aval.)</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Mensal */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Evolução da Nota Média (últimos 6 meses)
          </h3>
          {evolucaoMensal.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={evolucaoMensal}>
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [value.toFixed(2), 'Média']} />
                <Line type="monotone" dataKey="media" stroke="#eab308" strokeWidth={2} dot={{ fill: '#eab308' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-muted-foreground">
              Dados insuficientes
            </div>
          )}
        </div>

        {/* Notas por Categoria */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Nota Média por Categoria (top 5 piores)
          </h3>
          {dadosCategorias.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={dadosCategorias} layout="vertical">
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
                <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value: number) => [value.toFixed(2), 'Média']} />
                <Bar dataKey="media" radius={[0, 4, 4, 0]}>
                  {dadosCategorias.map((entry, index) => (
                    <Cell key={index} fill={entry.media <= 2 ? '#ef4444' : entry.media <= 3 ? '#f59e0b' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-muted-foreground">
              Dados insuficientes
            </div>
          )}
        </div>
      </div>

      {/* Distribuição de Estrelas */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Distribuição de Estrelas</h3>
        <div className="flex gap-4">
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star} className="flex-1">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="text-sm font-medium">{star}</span>
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              </div>
              <div className="h-20 bg-muted rounded-lg overflow-hidden flex flex-col-reverse">
                <div
                  className={`w-full transition-all ${star >= 4 ? 'bg-green-500' : star === 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{
                    height: stats.total > 0 ? `${(stats.distribuicao[star] / stats.total) * 100}%` : "0%"
                  }}
                />
              </div>
              <div className="text-center mt-1 text-xs text-muted-foreground">
                {stats.distribuicao[star]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtros:</span>
        </div>
        
        <Select value={filtroEstrelas} onValueChange={handleFilterChange(setFiltroEstrelas)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estrelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas notas</SelectItem>
            <SelectItem value="5">⭐⭐⭐⭐⭐ 5</SelectItem>
            <SelectItem value="4">⭐⭐⭐⭐ 4</SelectItem>
            <SelectItem value="3">⭐⭐⭐ 3</SelectItem>
            <SelectItem value="2">⭐⭐ 2</SelectItem>
            <SelectItem value="1">⭐ 1</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroBairro} onValueChange={handleFilterChange(setFiltroBairro)}>
          <SelectTrigger className="w-44">
            <MapPin className="w-4 h-4 mr-1" />
            <SelectValue placeholder="Bairro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos bairros</SelectItem>
            {bairros.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroCategoria} onValueChange={handleFilterChange(setFiltroCategoria)}>
          <SelectTrigger className="w-44">
            <Tag className="w-4 h-4 mr-1" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {categorias.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroSla} onValueChange={handleFilterChange(setFiltroSla)}>
          <SelectTrigger className="w-40">
            <Clock className="w-4 h-4 mr-1" />
            <SelectValue placeholder="SLA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos SLA</SelectItem>
            <SelectItem value="estourado">🔴 SLA estourado</SelectItem>
            <SelectItem value="dentro">🟢 Dentro do SLA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Avaliações */}
      {avaliacoesFiltradas.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma avaliação encontrada com os filtros aplicados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedAvaliacoes.map((avaliacao) => {
            const isNegativa = avaliacao.estrelas <= 2;
            return (
              <div
                key={avaliacao.id}
                className={`bg-card rounded-xl border p-4 ${isNegativa ? 'border-red-300 bg-red-50/30' : 'border-border'}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Cabeçalho com estrelas e badges */}
                    <div className="flex flex-wrap items-center gap-3">
                      {renderStars(avaliacao.estrelas)}
                      <span className="text-sm font-medium text-foreground">{avaliacao.estrelas}/5</span>
                      
                      {/* Badges */}
                      {isNegativa && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          ⚠️ Atenção
                        </span>
                      )}
                      {avaliacao.slaEstourado && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          ⏱️ SLA estourado ({avaliacao.diasResolucao}d)
                        </span>
                      )}
                    </div>
                    
                    {/* Comentário */}
                    {avaliacao.comentario && (
                      <div className={`flex items-start gap-2 ${isNegativa ? 'bg-red-100/50 p-3 rounded-lg' : ''}`}>
                        <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className={`text-sm ${isNegativa ? 'text-red-800 font-medium' : 'text-foreground'}`}>
                          {avaliacao.comentario}
                        </p>
                      </div>
                    )}

                    {/* Dados da reclamação */}
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="font-mono text-primary font-medium">
                        {avaliacao.reclamacoes?.protocolo}
                      </span>
                      {avaliacao.reclamacoes?.categorias?.nome && (
                        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {avaliacao.reclamacoes.categorias.nome}
                        </span>
                      )}
                      {avaliacao.reclamacoes?.bairros?.nome && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {avaliacao.reclamacoes.bairros.nome}
                        </span>
                      )}
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {avaliacao.reclamacoes?.rua}
                      </span>
                    </div>

                    {/* Tempo de resolução */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Resolvido em {avaliacao.diasResolucao} dias
                      </span>
                      <span>•</span>
                      <span>{avaliacao.reclamacoes?.nome_cidadao}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(avaliacao.avaliado_em).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, avaliacoesFiltradas.length)} de {avaliacoesFiltradas.length} avaliações
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
                if (totalPages <= 5) page = i + 1;
                else if (currentPage <= 3) page = i + 1;
                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                else page = currentPage - 2 + i;
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
    </div>
  );
};

export default PainelAvaliacoes;
