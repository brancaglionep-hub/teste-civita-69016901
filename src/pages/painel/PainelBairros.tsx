import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search, MapPin, 
  TrendingUp, TrendingDown, AlertTriangle, Clock, Star, FileText,
  Download, Eye, BarChart3, ArrowUpRight, ArrowDownRight, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OutletContext {
  prefeituraId: string;
}

interface Bairro {
  id: string;
  nome: string;
  ativo: boolean;
}

interface BairroMetricas {
  id: string;
  nome: string;
  ativo: boolean;
  totalReclamacoes: number;
  resolvidas: number;
  percentualResolvidas: number;
  foraDoSLA: number;
  percentualForaSLA: number;
  tempoMedioResolucao: number;
  notaMedia: number;
  totalAvaliacoes: number;
  status: 'controlado' | 'atencao' | 'critico';
}

interface BairroDetalhes {
  categoriasMaisRecorrentes: { nome: string; total: number }[];
  reclamacoesRecorrentes: number;
  historicoMensal: { mes: string; total: number; resolvidas: number; slaEstourado: number }[];
  reclamacoesRecentes: { id: string; protocolo: string; status: string; rua: string; created_at: string; categoria: string }[];
}

interface Reclamacao {
  id: string;
  bairro_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  categoria_id: string | null;
  rua: string;
  protocolo: string;
}

interface Avaliacao {
  reclamacao_id: string;
  estrelas: number;
}

interface Categoria {
  id: string;
  nome: string;
}

const ITEMS_PER_PAGE = 10;
const SLA_DIAS = 7;

const PainelBairros = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [bairrosMetricas, setBairrosMetricas] = useState<BairroMetricas[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingBairro, setEditingBairro] = useState<Bairro | null>(null);
  const [viewingBairro, setViewingBairro] = useState<BairroMetricas | null>(null);
  const [bairroDetalhes, setBairroDetalhes] = useState<BairroDetalhes | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [nome, setNome] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Indicadores gerais
  const [indicadores, setIndicadores] = useState({
    totalBairros: 0,
    bairroMaisReclamacoes: "",
    tempoMedioGeral: 0,
    percentualForaSLA: 0,
    notaMediaGeral: 0,
  });

  const fetchData = async () => {
    try {
      const [bairrosRes, reclamacoesRes, avaliacoesRes, categoriasRes] = await Promise.all([
        supabase
          .from("bairros")
          .select("*")
          .eq("prefeitura_id", prefeituraId)
          .order("nome"),
        supabase
          .from("reclamacoes")
          .select("id, bairro_id, status, created_at, updated_at, categoria_id, rua, protocolo")
          .eq("prefeitura_id", prefeituraId),
        supabase
          .from("avaliacoes")
          .select("reclamacao_id, estrelas")
          .eq("prefeitura_id", prefeituraId)
          .not("avaliado_em", "is", null),
        supabase
          .from("categorias")
          .select("id, nome")
          .or(`prefeitura_id.eq.${prefeituraId},global.eq.true`),
      ]);

      const bairrosData = bairrosRes.data || [];
      const reclamacoes = (reclamacoesRes.data || []) as Reclamacao[];
      const avaliacoes = (avaliacoesRes.data || []) as Avaliacao[];
      const categorias = (categoriasRes.data || []) as Categoria[];

      setBairros(bairrosData);

      // Calculate metrics for each bairro
      const metricas: BairroMetricas[] = bairrosData.map((bairro) => {
        const recBairro = reclamacoes.filter(r => r.bairro_id === bairro.id);
        const total = recBairro.length;
        const resolvidas = recBairro.filter(r => r.status === 'resolvida').length;
        
        // SLA calculation
        const foraDoSLA = recBairro.filter(r => {
          const dias = differenceInDays(
            r.status === 'resolvida' ? parseISO(r.updated_at) : new Date(),
            parseISO(r.created_at)
          );
          return dias > SLA_DIAS;
        }).length;

        // Average resolution time
        const resolvidasComTempo = recBairro.filter(r => r.status === 'resolvida');
        const temposResolucao = resolvidasComTempo.map(r => 
          differenceInDays(parseISO(r.updated_at), parseISO(r.created_at))
        );
        const tempoMedio = temposResolucao.length > 0 
          ? temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length 
          : 0;

        // Average rating
        const recIds = recBairro.map(r => r.id);
        const avaliacoesBairro = avaliacoes.filter(a => recIds.includes(a.reclamacao_id));
        const notaMedia = avaliacoesBairro.length > 0 
          ? avaliacoesBairro.reduce((sum, a) => sum + a.estrelas, 0) / avaliacoesBairro.length 
          : 0;

        // Determine status
        let status: 'controlado' | 'atencao' | 'critico' = 'controlado';
        const percentualForaSLA = total > 0 ? (foraDoSLA / total) * 100 : 0;
        const percentualResolvidas = total > 0 ? (resolvidas / total) * 100 : 100;
        
        if (percentualForaSLA > 30 || (notaMedia > 0 && notaMedia < 2.5) || (total > 10 && percentualResolvidas < 50)) {
          status = 'critico';
        } else if (percentualForaSLA > 15 || (notaMedia > 0 && notaMedia < 3.5) || (total > 5 && percentualResolvidas < 70)) {
          status = 'atencao';
        }

        return {
          id: bairro.id,
          nome: bairro.nome,
          ativo: bairro.ativo,
          totalReclamacoes: total,
          resolvidas,
          percentualResolvidas,
          foraDoSLA,
          percentualForaSLA,
          tempoMedioResolucao: Math.round(tempoMedio),
          notaMedia,
          totalAvaliacoes: avaliacoesBairro.length,
          status,
        };
      });

      setBairrosMetricas(metricas);

      // Calculate general indicators
      const totalReclamacoesGeral = reclamacoes.length;
      const bairroTop = metricas.length > 0 
        ? metricas.reduce((max, b) => b.totalReclamacoes > max.totalReclamacoes ? b : max, metricas[0])
        : null;
      
      const todasResolvidas = reclamacoes.filter(r => r.status === 'resolvida');
      const temposGeral = todasResolvidas.map(r => 
        differenceInDays(parseISO(r.updated_at), parseISO(r.created_at))
      );
      const tempoMedioGeral = temposGeral.length > 0 
        ? temposGeral.reduce((a, b) => a + b, 0) / temposGeral.length 
        : 0;

      const foraDoSLAGeral = reclamacoes.filter(r => {
        const dias = differenceInDays(
          r.status === 'resolvida' ? parseISO(r.updated_at) : new Date(),
          parseISO(r.created_at)
        );
        return dias > SLA_DIAS;
      }).length;

      const notaMediaGeral = avaliacoes.length > 0 
        ? avaliacoes.reduce((sum, a) => sum + a.estrelas, 0) / avaliacoes.length 
        : 0;

      setIndicadores({
        totalBairros: bairrosData.length,
        bairroMaisReclamacoes: bairroTop?.nome || "-",
        tempoMedioGeral: Math.round(tempoMedioGeral),
        percentualForaSLA: totalReclamacoesGeral > 0 ? Math.round((foraDoSLAGeral / totalReclamacoesGeral) * 100) : 0,
        notaMediaGeral,
      });

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBairroDetalhes = async (bairro: BairroMetricas) => {
    setLoadingDetalhes(true);
    try {
      // Fetch complaints for this neighborhood
      const { data: reclamacoes } = await supabase
        .from("reclamacoes")
        .select(`
          id, protocolo, status, created_at, updated_at, rua, categoria_id,
          categoria:categorias(nome)
        `)
        .eq("prefeitura_id", prefeituraId)
        .eq("bairro_id", bairro.id)
        .order("created_at", { ascending: false });

      const recs = reclamacoes || [];

      // Categories count
      const categoriasCount: Record<string, number> = {};
      recs.forEach((r: any) => {
        const catNome = r.categoria?.nome || "Sem categoria";
        categoriasCount[catNome] = (categoriasCount[catNome] || 0) + 1;
      });
      const categoriasMaisRecorrentes = Object.entries(categoriasCount)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Recurring complaints (same street within 90 days)
      const recorrentes = recs.filter((r: any, i: number, arr: any[]) => {
        return arr.some((other, j) => 
          i !== j && 
          r.rua === other.rua && 
          Math.abs(differenceInDays(parseISO(r.created_at), parseISO(other.created_at))) <= 90
        );
      }).length;

      // Monthly history (last 6 months)
      const historicoMensal: { mes: string; total: number; resolvidas: number; slaEstourado: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const mesData = subMonths(new Date(), i);
        const inicio = startOfMonth(mesData);
        const fim = endOfMonth(mesData);
        
        const recsMes = recs.filter((r: any) => {
          const created = parseISO(r.created_at);
          return created >= inicio && created <= fim;
        });

        const resolvidas = recsMes.filter((r: any) => r.status === 'resolvida').length;
        const slaEstourado = recsMes.filter((r: any) => {
          const dias = differenceInDays(
            r.status === 'resolvida' ? parseISO(r.updated_at) : new Date(),
            parseISO(r.created_at)
          );
          return dias > SLA_DIAS;
        }).length;

        historicoMensal.push({
          mes: format(mesData, "MMM/yy", { locale: ptBR }),
          total: recsMes.length,
          resolvidas,
          slaEstourado,
        });
      }

      // Recent complaints
      const reclamacoesRecentes = recs.slice(0, 10).map((r: any) => ({
        id: r.id,
        protocolo: r.protocolo,
        status: r.status,
        rua: r.rua,
        created_at: r.created_at,
        categoria: r.categoria?.nome || "Sem categoria",
      }));

      setBairroDetalhes({
        categoriasMaisRecorrentes,
        reclamacoesRecorrentes: recorrentes,
        historicoMensal,
        reclamacoesRecentes,
      });
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  useEffect(() => {
    if (prefeituraId) {
      fetchData();
    }
  }, [prefeituraId]);

  // Filter and pagination logic
  const filteredBairros = bairrosMetricas.filter((bairro) =>
    bairro.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredBairros.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBairros = filteredBairros.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Rankings
  const rankingReclamacoes = [...bairrosMetricas]
    .filter(b => b.totalReclamacoes > 0)
    .sort((a, b) => b.totalReclamacoes - a.totalReclamacoes)
    .slice(0, 5);

  const rankingMelhorSLA = [...bairrosMetricas]
    .filter(b => b.totalReclamacoes > 0)
    .sort((a, b) => a.percentualForaSLA - b.percentualForaSLA)
    .slice(0, 5);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleOpenDialog = (bairro?: Bairro) => {
    if (bairro) {
      setEditingBairro(bairro);
      setNome(bairro.nome);
    } else {
      setEditingBairro(null);
      setNome("");
    }
    setDialogOpen(true);
  };

  const handleViewProfile = (bairro: BairroMetricas) => {
    setViewingBairro(bairro);
    setProfileDialogOpen(true);
    fetchBairroDetalhes(bairro);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Digite o nome do bairro", variant: "destructive" });
      return;
    }

    if (editingBairro) {
      const { error } = await supabase
        .from("bairros")
        .update({ nome: nome.trim() })
        .eq("id", editingBairro.id);

      if (error) {
        toast({ title: "Erro ao atualizar", variant: "destructive" });
      } else {
        toast({ title: "Bairro atualizado!" });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("bairros")
        .insert({
          nome: nome.trim(),
          prefeitura_id: prefeituraId
        });

      if (error) {
        toast({ title: "Erro ao criar", variant: "destructive" });
      } else {
        toast({ title: "Bairro criado!" });
        setDialogOpen(false);
        fetchData();
      }
    }
  };

  const handleToggleAtivo = async (bairro: BairroMetricas) => {
    const { error } = await supabase
      .from("bairros")
      .update({ ativo: !bairro.ativo })
      .eq("id", bairro.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: bairro.ativo ? "Bairro desativado" : "Bairro ativado" });
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este bairro?")) return;

    const { error } = await supabase
      .from("bairros")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao excluir", description: "Pode haver reclamações vinculadas", variant: "destructive" });
    } else {
      toast({ title: "Bairro excluído!" });
      fetchData();
      if (paginatedBairros.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    }
  };

  const handleExportCSV = () => {
    // Ordenar por total de reclamações (maior para menor)
    const bairrosOrdenados = [...bairrosMetricas].sort((a, b) => b.totalReclamacoes - a.totalReclamacoes);
    
    // Calcular totais gerais
    const totalReclamacoes = bairrosOrdenados.reduce((sum, b) => sum + b.totalReclamacoes, 0);
    const totalResolvidas = bairrosOrdenados.reduce((sum, b) => sum + b.resolvidas, 0);
    const totalForaSLA = bairrosOrdenados.reduce((sum, b) => sum + b.foraDoSLA, 0);
    const bairrosAtivos = bairrosOrdenados.filter(b => b.ativo).length;
    const bairrosControlados = bairrosOrdenados.filter(b => b.status === 'controlado').length;
    const bairrosAtencao = bairrosOrdenados.filter(b => b.status === 'atencao').length;
    const bairrosCriticos = bairrosOrdenados.filter(b => b.status === 'critico').length;

    // Resumo executivo no início
    const resumo = [
      ["RELATÓRIO DE BAIRROS"],
      [`Data: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`],
      [""],
      ["RESUMO GERAL"],
      [`Total de bairros;${bairrosOrdenados.length}`],
      [`Bairros ativos;${bairrosAtivos}`],
      [`Total de reclamações;${totalReclamacoes}`],
      [`Resolvidas;${totalResolvidas} (${totalReclamacoes > 0 ? Math.round((totalResolvidas / totalReclamacoes) * 100) : 0}%)`],
      [`Fora do SLA;${totalForaSLA} (${totalReclamacoes > 0 ? Math.round((totalForaSLA / totalReclamacoes) * 100) : 0}%)`],
      [""],
      ["SITUAÇÃO DOS BAIRROS"],
      [`Controlados (sem problemas);${bairrosControlados}`],
      [`Em Atenção (monitorar);${bairrosAtencao}`],
      [`Críticos (ação urgente);${bairrosCriticos}`],
      [""],
      [""],
      ["DADOS POR BAIRRO (ordenado por volume de reclamações)"],
    ];

    const headers = [
      "Ranking",
      "Bairro",
      "Situação",
      "Ativo",
      "Reclamações",
      "Resolvidas",
      "Pendentes",
      "% Resolução",
      "Fora SLA",
      "% Fora SLA",
      "Tempo Médio",
      "Nota Cidadãos",
      "Avaliações",
    ];

    const rows = bairrosOrdenados.map((b, index) => {
      const pendentes = b.totalReclamacoes - b.resolvidas;
      const situacaoTexto = b.status === 'controlado' ? "Controlado" : b.status === 'atencao' ? "Atenção" : "Crítico";
      
      return [
        `${index + 1}º`,
        b.nome,
        situacaoTexto,
        b.ativo ? "Sim" : "Não",
        b.totalReclamacoes,
        b.resolvidas,
        pendentes,
        b.totalReclamacoes > 0 ? `${Math.round(b.percentualResolvidas)}%` : "-",
        b.foraDoSLA,
        b.totalReclamacoes > 0 ? `${Math.round(b.percentualForaSLA)}%` : "-",
        b.tempoMedioResolucao > 0 ? `${b.tempoMedioResolucao} dias` : "-",
        b.notaMedia > 0 ? `${b.notaMedia.toFixed(1)}` : "-",
        b.totalAvaliacoes,
      ];
    });

    const csvContent = [
      ...resumo.map(row => row.join(";")),
      headers.join(";"),
      ...rows.map(row => row.map(cell => `${cell}`).join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_bairros_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exportado", description: "Relatório CSV gerado com sucesso" });
  };

  const getStatusBadge = (status: 'controlado' | 'atencao' | 'critico') => {
    switch (status) {
      case 'controlado':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30 gap-1">🟢 Controlado</Badge>;
      case 'atencao':
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 gap-1">🟡 Atenção</Badge>;
      case 'critico':
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30 gap-1">🔴 Crítico</Badge>;
    }
  };

  const getReclamacaoStatusBadge = (status: string) => {
    switch (status) {
      case 'recebida':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Recebida</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Em Andamento</Badge>;
      case 'resolvida':
        return <Badge variant="outline" className="text-green-600 border-green-600">Resolvida</Badge>;
      case 'arquivada':
        return <Badge variant="outline" className="text-muted-foreground">Arquivada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Bairros</h1>
            <p className="text-muted-foreground mt-1">Gerencie e analise os bairros da cidade</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Bairro
          </Button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{indicadores.totalBairros}</p>
                <p className="text-sm text-muted-foreground">Bairros</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold truncate max-w-[120px]" title={indicadores.bairroMaisReclamacoes}>
                  {indicadores.bairroMaisReclamacoes}
                </p>
                <p className="text-sm text-muted-foreground">Mais reclamações</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{indicadores.tempoMedioGeral}d</p>
                <p className="text-sm text-muted-foreground">Tempo médio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${indicadores.percentualForaSLA > 20 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                <AlertTriangle className={`w-5 h-5 ${indicadores.percentualForaSLA > 20 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{indicadores.percentualForaSLA}%</p>
                <p className="text-sm text-muted-foreground">Fora do SLA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {indicadores.notaMediaGeral > 0 ? indicadores.notaMediaGeral.toFixed(1) : "N/A"}
                </p>
                <p className="text-sm text-muted-foreground">Nota média</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-600" />
              Top 5 - Mais Reclamações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingReclamacoes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              <div className="space-y-2">
                {rankingReclamacoes.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 text-sm font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="font-medium">{b.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{b.totalReclamacoes}</Badge>
                      {getStatusBadge(b.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              Top 5 - Melhor SLA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingMelhorSLA.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              <div className="space-y-2">
                {rankingMelhorSLA.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-700 text-sm font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="font-medium">{b.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{Math.round(b.percentualForaSLA)}% fora</span>
                      <Badge variant="secondary">{b.tempoMedioResolucao}d médio</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar bairro..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-center">Reclamações</TableHead>
              <TableHead className="text-center">% Resolvidas</TableHead>
              <TableHead className="text-center">Fora SLA</TableHead>
              <TableHead className="text-center">Nota</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBairros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Nenhum bairro encontrado" : "Nenhum bairro cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedBairros.map((bairro) => (
                <TableRow key={bairro.id}>
                  <TableCell className="font-medium">{bairro.nome}</TableCell>
                  <TableCell>
                    {getStatusBadge(bairro.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="w-3 h-3" />
                      {bairro.totalReclamacoes}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={bairro.percentualResolvidas >= 70 ? "text-green-600" : bairro.percentualResolvidas >= 50 ? "text-amber-600" : "text-red-600"}>
                      {bairro.totalReclamacoes > 0 ? `${Math.round(bairro.percentualResolvidas)}%` : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {bairro.foraDoSLA > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {bairro.foraDoSLA}
                      </Badge>
                    ) : (
                      <span className="text-green-600">✓</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {bairro.notaMedia > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        {bairro.notaMedia.toFixed(1)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      bairro.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      {bairro.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewProfile(bairro)}
                        title="Ver perfil"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleAtivo(bairro)}
                        title={bairro.ativo ? "Desativar" : "Ativar"}
                      >
                        {bairro.ativo ? (
                          <ToggleRight className="w-5 h-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(bairro)}
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(bairro.id)}
                        className="text-destructive hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, filteredBairros.length)} de {filteredBairros.length} bairros
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => handlePageChange(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
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

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Perfil do Bairro: {viewingBairro?.nome}
            </DialogTitle>
            <DialogDescription>
              Visão 360° do bairro com métricas e histórico
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetalhes ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewingBairro && bairroDetalhes ? (
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-6 pr-4">
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{viewingBairro.totalReclamacoes}</p>
                      <p className="text-xs text-muted-foreground">Total Reclamações</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{Math.round(viewingBairro.percentualResolvidas)}%</p>
                      <p className="text-xs text-muted-foreground">Resolvidas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{viewingBairro.tempoMedioResolucao}d</p>
                      <p className="text-xs text-muted-foreground">Tempo Médio</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <p className="text-2xl font-bold">{viewingBairro.notaMedia > 0 ? viewingBairro.notaMedia.toFixed(1) : "N/A"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Nota Média</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Status and Warnings */}
                <div className="flex flex-wrap gap-2">
                  {getStatusBadge(viewingBairro.status)}
                  {viewingBairro.foraDoSLA > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {viewingBairro.foraDoSLA} fora do SLA ({Math.round(viewingBairro.percentualForaSLA)}%)
                    </Badge>
                  )}
                  {bairroDetalhes.reclamacoesRecorrentes > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-700 gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {bairroDetalhes.reclamacoesRecorrentes} reclamações recorrentes
                    </Badge>
                  )}
                </div>

                {/* Monthly History Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Histórico Mensal (últimos 6 meses)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bairroDetalhes.historicoMensal}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="mes" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="resolvidas" name="Resolvidas" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="slaEstourado" name="Fora SLA" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Categories */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Categorias Mais Recorrentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bairroDetalhes.categoriasMaisRecorrentes.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Sem dados</p>
                    ) : (
                      <div className="space-y-2">
                        {bairroDetalhes.categoriasMaisRecorrentes.map((cat, i) => (
                          <div key={cat.nome} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <span className="font-medium">{cat.nome}</span>
                            <Badge variant="secondary">{cat.total}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Complaints */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Reclamações Recentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bairroDetalhes.reclamacoesRecentes.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhuma reclamação</p>
                    ) : (
                      <div className="space-y-2">
                        {bairroDetalhes.reclamacoesRecentes.map((rec) => (
                          <div key={rec.id} className="flex items-center justify-between p-2 rounded-lg border">
                            <div>
                              <span className="font-mono text-sm text-muted-foreground">{rec.protocolo}</span>
                              <p className="text-sm">{rec.rua} • {rec.categoria}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getReclamacaoStatusBadge(rec.status)}
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(rec.created_at), "dd/MM/yy", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBairro ? "Editar Bairro" : "Novo Bairro"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome do Bairro</label>
              <Input
                placeholder="Ex: Centro"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingBairro ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PainelBairros;
