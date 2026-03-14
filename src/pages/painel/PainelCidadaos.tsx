import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Users, Plus, Pencil, Trash2, Bell, BellOff, Search, FileText, 
  Download, Eye, Star, TrendingUp, AlertTriangle, Clock, Calendar,
  Mail, Phone, MessageSquare, Filter, X, ChevronDown, ChevronUp, MapPin
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const ITEMS_PER_PAGE = 10;

interface OutletContext {
  prefeituraId: string;
}

interface Bairro {
  id: string;
  nome: string;
}

interface Reclamacao {
  id: string;
  protocolo: string;
  status: string;
  created_at: string;
  updated_at: string;
  rua: string;
  categoria: { nome: string } | null;
  bairro: { nome: string } | null;
}

interface Avaliacao {
  estrelas: number;
  comentario: string | null;
  avaliado_em: string | null;
}

interface CidadaoDetalhes {
  reclamacoes: Reclamacao[];
  avaliacoes: Avaliacao[];
  primeiroRegistro: string | null;
  ultimaInteracao: string | null;
  totalResolvidas: number;
  tempoMedioResolucao: number;
  notaMedia: number;
  recorrencias: number;
  slaEstourado: number;
}

interface Cidadao {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bairro_id: string | null;
  aceita_alertas: boolean;
  ativo: boolean;
  created_at?: string;
  bairro: { nome: string } | null;
  total_reclamacoes?: number;
  total_resolvidas?: number;
  nota_media?: number;
  engajamento?: 'ativo' | 'colaborador' | 'recorrente' | 'normal';
}

interface Filtros {
  bairro: string;
  minReclamacoes: string;
  maxReclamacoes: string;
  notaMinima: string;
  status: string;
}

const PainelCidadaos = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [loading, setLoading] = useState(true);
  const [cidadaos, setCidadaos] = useState<Cidadao[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingCidadao, setEditingCidadao] = useState<Cidadao | null>(null);
  const [viewingCidadao, setViewingCidadao] = useState<Cidadao | null>(null);
  const [cidadaoDetalhes, setCidadaoDetalhes] = useState<CidadaoDetalhes | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({
    bairro: "all",
    minReclamacoes: "",
    maxReclamacoes: "",
    notaMinima: "",
    status: "all",
  });

  // Form state
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bairroId, setBairroId] = useState<string>("none");
  const [aceitaAlertas, setAceitaAlertas] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = async () => {
    try {
      const [cidadaosRes, bairrosRes, reclamacoesRes, avaliacoesRes] = await Promise.all([
        supabase
          .from("cidadaos")
          .select(`
            id,
            nome,
            email,
            telefone,
            bairro_id,
            aceita_alertas,
            ativo,
            created_at,
            bairro:bairros(nome)
          `)
          .eq("prefeitura_id", prefeituraId)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("bairros")
          .select("id, nome")
          .eq("prefeitura_id", prefeituraId)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("reclamacoes")
          .select("id, telefone_cidadao, email_cidadao, status, created_at, updated_at")
          .eq("prefeitura_id", prefeituraId),
        supabase
          .from("avaliacoes")
          .select("reclamacao_id, estrelas")
          .eq("prefeitura_id", prefeituraId)
          .not("avaliado_em", "is", null),
      ]);

      if (cidadaosRes.data) {
        const reclamacoes = reclamacoesRes.data || [];
        const avaliacoes = avaliacoesRes.data || [];
        
        const cidadaosComMetricas = cidadaosRes.data.map((cidadao: any) => {
          // Find all complaints for this citizen
          const reclamacoesCidadao = reclamacoes.filter((r) => {
            if (cidadao.telefone && r.telefone_cidadao) {
              return r.telefone_cidadao === cidadao.telefone;
            }
            if (cidadao.email && r.email_cidadao) {
              return r.email_cidadao === cidadao.email;
            }
            return false;
          });
          
          const total = reclamacoesCidadao.length;
          const resolvidas = reclamacoesCidadao.filter(r => r.status === 'resolvida').length;
          
          // Get ratings for citizen's complaints
          const reclamacaoIds = reclamacoesCidadao.map(r => r.id);
          const avaliacoesCidadao = avaliacoes.filter(a => reclamacaoIds.includes(a.reclamacao_id));
          const notaMedia = avaliacoesCidadao.length > 0 
            ? avaliacoesCidadao.reduce((sum, a) => sum + a.estrelas, 0) / avaliacoesCidadao.length 
            : 0;
          
          // Determine engagement level
          let engajamento: 'ativo' | 'colaborador' | 'recorrente' | 'normal' = 'normal';
          if (total >= 5) {
            engajamento = 'ativo';
          }
          if (avaliacoesCidadao.length >= 3 && notaMedia >= 3) {
            engajamento = 'colaborador';
          }
          // Check for recurring complaints (same category in short period - simplified check)
          const reclamacoesMesmoMes = reclamacoesCidadao.filter(r => {
            const diff = differenceInDays(new Date(), parseISO(r.created_at));
            return diff <= 30;
          });
          if (reclamacoesMesmoMes.length >= 3) {
            engajamento = 'recorrente';
          }
          
          return { 
            ...cidadao, 
            total_reclamacoes: total,
            total_resolvidas: resolvidas,
            nota_media: notaMedia,
            engajamento,
          };
        });
        setCidadaos(cidadaosComMetricas as unknown as Cidadao[]);
      }
      if (bairrosRes.data) {
        setBairros(bairrosRes.data);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCidadaoDetalhes = async (cidadao: Cidadao) => {
    setLoadingDetalhes(true);
    try {
      // Fetch all complaints for this citizen
      let query = supabase
        .from("reclamacoes")
        .select(`
          id, protocolo, status, created_at, updated_at, rua,
          categoria:categorias(nome),
          bairro:bairros(nome)
        `)
        .eq("prefeitura_id", prefeituraId)
        .order("created_at", { ascending: false });

      if (cidadao.telefone) {
        query = query.eq("telefone_cidadao", cidadao.telefone);
      } else if (cidadao.email) {
        query = query.eq("email_cidadao", cidadao.email);
      }

      const { data: reclamacoes } = await query;
      
      // Fetch ratings
      const reclamacaoIds = reclamacoes?.map(r => r.id) || [];
      let avaliacoes: Avaliacao[] = [];
      if (reclamacaoIds.length > 0) {
        const { data: avData } = await supabase
          .from("avaliacoes")
          .select("estrelas, comentario, avaliado_em")
          .in("reclamacao_id", reclamacaoIds)
          .not("avaliado_em", "is", null);
        avaliacoes = avData || [];
      }

      // Calculate metrics
      const resolvidas = reclamacoes?.filter(r => r.status === 'resolvida') || [];
      const temposResolucao = resolvidas.map(r => {
        const created = parseISO(r.created_at);
        const updated = parseISO(r.updated_at);
        return differenceInDays(updated, created);
      });
      const tempoMedio = temposResolucao.length > 0 
        ? temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length 
        : 0;

      const notaMedia = avaliacoes.length > 0 
        ? avaliacoes.reduce((sum, a) => sum + a.estrelas, 0) / avaliacoes.length 
        : 0;

      // Count SLA violations (> 7 days)
      const slaEstourado = (reclamacoes || []).filter(r => {
        const dias = differenceInDays(
          r.status === 'resolvida' ? parseISO(r.updated_at) : new Date(),
          parseISO(r.created_at)
        );
        return dias > 7;
      }).length;

      // Count recurrences (simplified: same street in last 90 days)
      const recorrencias = (reclamacoes || []).filter((r, i, arr) => {
        return arr.some((other, j) => 
          i !== j && 
          r.rua === other.rua && 
          Math.abs(differenceInDays(parseISO(r.created_at), parseISO(other.created_at))) <= 90
        );
      }).length;

      const primeiroRegistro = reclamacoes && reclamacoes.length > 0 
        ? reclamacoes[reclamacoes.length - 1].created_at 
        : null;
      const ultimaInteracao = reclamacoes && reclamacoes.length > 0 
        ? reclamacoes[0].created_at 
        : null;

      setCidadaoDetalhes({
        reclamacoes: (reclamacoes || []) as Reclamacao[],
        avaliacoes,
        primeiroRegistro,
        ultimaInteracao,
        totalResolvidas: resolvidas.length,
        tempoMedioResolucao: Math.round(tempoMedio),
        notaMedia,
        recorrencias,
        slaEstourado,
      });
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  useEffect(() => {
    if (prefeituraId) fetchData();
  }, [prefeituraId]);

  const handleOpenDialog = (cidadao?: Cidadao) => {
    if (cidadao) {
      setEditingCidadao(cidadao);
      setNome(cidadao.nome);
      setEmail(cidadao.email || "");
      setTelefone(cidadao.telefone || "");
      setBairroId(cidadao.bairro_id || "none");
      setAceitaAlertas(cidadao.aceita_alertas);
    } else {
      setEditingCidadao(null);
      setNome("");
      setEmail("");
      setTelefone("");
      setBairroId("none");
      setAceitaAlertas(true);
    }
    setDialogOpen(true);
  };

  const handleViewProfile = (cidadao: Cidadao) => {
    setViewingCidadao(cidadao);
    setProfileDialogOpen(true);
    fetchCidadaoDetalhes(cidadao);
  };

  const validateEmail = (emailValue: string): boolean => {
    if (!emailValue.trim()) return true; // opcional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  };

  const validatePhone = (phoneValue: string): boolean => {
    if (!phoneValue.trim()) return true; // opcional
    // Aceita formatos: (XX) XXXXX-XXXX, (XX) XXXX-XXXX, ou apenas números
    const cleaned = phoneValue.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Erro", description: "Informe o nome do cidadão", variant: "destructive" });
      return;
    }

    if (email.trim() && !validateEmail(email)) {
      toast({ title: "Erro", description: "Email inválido. Use o formato: exemplo@email.com", variant: "destructive" });
      return;
    }

    if (telefone.trim() && !validatePhone(telefone)) {
      toast({ title: "Erro", description: "Telefone inválido. Use 10 ou 11 dígitos (DDD + número)", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const data = {
        nome: nome.trim(),
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        bairro_id: bairroId === "none" ? null : bairroId,
        aceita_alertas: aceitaAlertas,
        prefeitura_id: prefeituraId,
      };

      if (editingCidadao) {
        const { error } = await supabase
          .from("cidadaos")
          .update(data)
          .eq("id", editingCidadao.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cidadão atualizado com sucesso" });
      } else {
        const { error } = await supabase.from("cidadaos").insert(data);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cidadão cadastrado com sucesso" });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({ title: "Erro", description: "Não foi possível salvar o cidadão", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAlertas = async (cidadao: Cidadao) => {
    try {
      const { error } = await supabase
        .from("cidadaos")
        .update({ aceita_alertas: !cidadao.aceita_alertas })
        .eq("id", cidadao.id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    
    try {
      const { error } = await supabase
        .from("cidadaos")
        .update({ ativo: false })
        .eq("id", deletingId);
      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Cidadão removido com sucesso" });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchData();
    } catch (error) {
      console.error("Erro ao remover:", error);
      toast({ title: "Erro", description: "Não foi possível remover", variant: "destructive" });
    }
  };

  const handleContact = (type: 'whatsapp' | 'email', cidadao: Cidadao) => {
    if (type === 'whatsapp' && cidadao.telefone) {
      const phone = cidadao.telefone.replace(/\D/g, '');
      const message = encodeURIComponent(`Olá ${cidadao.nome}, entramos em contato da prefeitura.`);
      window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
      toast({ title: "WhatsApp", description: "Abrindo conversa..." });
    } else if (type === 'email' && cidadao.email) {
      const subject = encodeURIComponent("Contato da Prefeitura");
      const body = encodeURIComponent(`Olá ${cidadao.nome},\n\n`);
      window.open(`mailto:${cidadao.email}?subject=${subject}&body=${body}`, '_blank');
      toast({ title: "Email", description: "Abrindo cliente de email..." });
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Nome",
      "Email", 
      "Telefone",
      "Bairro",
      "Total Reclamações",
      "Resolvidas",
      "% Resolução",
      "Nota Média",
      "Engajamento",
      "Aceita Alertas",
      "Cadastro (LGPD)",
    ];

    const rows = filteredCidadaos.map(c => [
      c.nome,
      c.email || "",
      c.telefone || "",
      c.bairro?.nome || "",
      c.total_reclamacoes || 0,
      c.total_resolvidas || 0,
      c.total_reclamacoes && c.total_reclamacoes > 0 
        ? `${Math.round(((c.total_resolvidas || 0) / c.total_reclamacoes) * 100)}%` 
        : "N/A",
      c.nota_media ? c.nota_media.toFixed(1) : "N/A",
      getEngajamentoLabel(c.engajamento),
      c.aceita_alertas ? "Sim" : "Não",
      c.created_at ? format(parseISO(c.created_at), "dd/MM/yyyy", { locale: ptBR }) : "",
    ]);

    // Add summary
    const totalCidadaos = filteredCidadaos.length;
    const totalReclamacoes = filteredCidadaos.reduce((sum, c) => sum + (c.total_reclamacoes || 0), 0);
    const aceitamAlertas = filteredCidadaos.filter(c => c.aceita_alertas).length;
    
    const summary = [
      [""],
      ["=== RESUMO ==="],
      [`Total de cidadãos: ${totalCidadaos}`],
      [`Total de reclamações: ${totalReclamacoes}`],
      [`Aceitam alertas: ${aceitamAlertas} (${Math.round((aceitamAlertas / totalCidadaos) * 100)}%)`],
      [""],
      ["=== DADOS ==="],
    ];

    const csvContent = [
      ...summary.map(row => row.join(",")),
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cidadaos_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exportado", description: "CSV gerado com sucesso" });
  };

  const getEngajamentoLabel = (engajamento?: string) => {
    switch (engajamento) {
      case 'ativo': return 'Ativo';
      case 'colaborador': return 'Colaborador';
      case 'recorrente': return 'Alta Recorrência';
      default: return 'Normal';
    }
  };

  const getEngajamentoBadge = (engajamento?: string) => {
    switch (engajamento) {
      case 'ativo':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">🟢 Ativo</Badge>;
      case 'colaborador':
        return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">⭐ Colaborador</Badge>;
      case 'recorrente':
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">⚠️ Alta Recorrência</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
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

  const clearFilters = () => {
    setFiltros({
      bairro: "all",
      minReclamacoes: "",
      maxReclamacoes: "",
      notaMinima: "",
      status: "all",
    });
  };

  const hasActiveFilters = filtros.bairro !== "all" || 
    filtros.minReclamacoes !== "" || 
    filtros.maxReclamacoes !== "" || 
    filtros.notaMinima !== "" || 
    filtros.status !== "all";

  // Apply filters
  const filteredCidadaos = cidadaos.filter((c) => {
    // Text search
    const matchesSearch = 
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.telefone?.includes(search);
    
    if (!matchesSearch) return false;

    // Bairro filter
    if (filtros.bairro !== "all" && c.bairro_id !== filtros.bairro) return false;

    // Min reclamações
    if (filtros.minReclamacoes && (c.total_reclamacoes || 0) < parseInt(filtros.minReclamacoes)) return false;

    // Max reclamações
    if (filtros.maxReclamacoes && (c.total_reclamacoes || 0) > parseInt(filtros.maxReclamacoes)) return false;

    // Nota mínima
    if (filtros.notaMinima && (c.nota_media || 0) < parseFloat(filtros.notaMinima)) return false;

    // Status filter (based on engagement)
    if (filtros.status !== "all" && c.engajamento !== filtros.status) return false;

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredCidadaos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCidadaos = filteredCidadaos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cidadãos Cadastrados</h1>
            <p className="text-muted-foreground">
              Gerencie os cidadãos que receberão alertas
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cidadão
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                  !
                </Badge>
              )}
            </Button>
          </div>

          <Collapsible open={showFilters}>
            <CollapsibleContent className="space-y-4">
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Bairro</Label>
                  <Select value={filtros.bairro} onValueChange={(v) => setFiltros(f => ({ ...f, bairro: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {bairros.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Mín. Reclamações</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filtros.minReclamacoes}
                    onChange={(e) => setFiltros(f => ({ ...f, minReclamacoes: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Máx. Reclamações</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="∞"
                    value={filtros.maxReclamacoes}
                    onChange={(e) => setFiltros(f => ({ ...f, maxReclamacoes: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Nota Mínima</Label>
                  <Select value={filtros.notaMinima} onValueChange={(v) => setFiltros(f => ({ ...f, notaMinima: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      <SelectItem value="1">⭐ 1+</SelectItem>
                      <SelectItem value="2">⭐ 2+</SelectItem>
                      <SelectItem value="3">⭐ 3+</SelectItem>
                      <SelectItem value="4">⭐ 4+</SelectItem>
                      <SelectItem value="5">⭐ 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Engajamento</Label>
                  <Select value={filtros.status} onValueChange={(v) => setFiltros(f => ({ ...f, status: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ativo">🟢 Ativo</SelectItem>
                      <SelectItem value="colaborador">⭐ Colaborador</SelectItem>
                      <SelectItem value="recorrente">⚠️ Alta Recorrência</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                    <X className="w-4 h-4 mr-1" />
                    Limpar filtros
                  </Button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Cidadãos</CardTitle>
          <CardDescription>
            {paginatedCidadaos.length > 0 
              ? `Mostrando ${startIndex + 1} a ${Math.min(startIndex + ITEMS_PER_PAGE, filteredCidadaos.length)} de ${filteredCidadaos.length} cidadão(s)`
              : `${filteredCidadaos.length} cidadão(s) cadastrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCidadaos.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">Nenhum cidadão encontrado</h3>
              <p className="text-muted-foreground">
                {search || hasActiveFilters ? "Tente outro termo ou filtro" : "Cadastre o primeiro cidadão"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead className="text-center">Reclamações</TableHead>
                    <TableHead className="text-center">Nota</TableHead>
                    <TableHead>Engajamento</TableHead>
                    <TableHead className="text-center">Alertas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCidadaos.map((cidadao) => (
                    <TableRow key={cidadao.id}>
                      <TableCell className="font-medium">{cidadao.nome}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {cidadao.email && (
                            <span className="text-muted-foreground">{cidadao.email}</span>
                          )}
                          {cidadao.telefone && (
                            <span className="text-muted-foreground">{cidadao.telefone}</span>
                          )}
                          {!cidadao.email && !cidadao.telefone && "-"}
                        </div>
                      </TableCell>
                      <TableCell>{cidadao.bairro?.nome || "-"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="secondary" className="gap-1">
                            <FileText className="w-3 h-3" />
                            {cidadao.total_reclamacoes || 0}
                          </Badge>
                          {cidadao.total_resolvidas !== undefined && cidadao.total_resolvidas > 0 && (
                            <span className="text-xs text-green-600">
                              ✓ {cidadao.total_resolvidas} resolvidas
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {cidadao.nota_media && cidadao.nota_media > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span>{cidadao.nota_media.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getEngajamentoBadge(cidadao.engajamento)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAlertas(cidadao)}
                          className={cidadao.aceita_alertas ? "text-green-600" : "text-muted-foreground"}
                        >
                          {cidadao.aceita_alertas ? (
                            <Bell className="w-4 h-4" />
                          ) : (
                            <BellOff className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewProfile(cidadao)}
                            title="Ver perfil"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(cidadao)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingId(cidadao.id);
                              setDeleteDialogOpen(true);
                            }}
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 pt-4 border-t">
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
        </CardContent>
      </Card>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Perfil do Cidadão
            </DialogTitle>
            <DialogDescription>
              Informações detalhadas e histórico de interações
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetalhes ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewingCidadao && cidadaoDetalhes ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-muted-foreground text-sm">Nome</Label>
                          <p className="font-medium">{viewingCidadao.nome}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Bairro Principal</Label>
                          <p className="font-medium flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {viewingCidadao.bairro?.nome || "Não informado"}
                          </p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <Label className="text-muted-foreground">Primeiro Registro</Label>
                            <p className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {cidadaoDetalhes.primeiroRegistro 
                                ? format(parseISO(cidadaoDetalhes.primeiroRegistro), "dd/MM/yyyy", { locale: ptBR })
                                : "N/A"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Última Interação</Label>
                            <p className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {cidadaoDetalhes.ultimaInteracao 
                                ? format(parseISO(cidadaoDetalhes.ultimaInteracao), "dd/MM/yyyy", { locale: ptBR })
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        {getEngajamentoBadge(viewingCidadao.engajamento)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Metrics */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-2 bg-muted/50 rounded-lg">
                          <p className="text-2xl font-bold text-primary">{cidadaoDetalhes.reclamacoes.length}</p>
                          <p className="text-xs text-muted-foreground">Total Reclamações</p>
                        </div>
                        <div className="text-center p-2 bg-green-500/10 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{cidadaoDetalhes.totalResolvidas}</p>
                          <p className="text-xs text-muted-foreground">Resolvidas</p>
                        </div>
                        <div className="text-center p-2 bg-amber-500/10 rounded-lg">
                          <p className="text-2xl font-bold text-amber-600">
                            {cidadaoDetalhes.tempoMedioResolucao > 0 ? `${cidadaoDetalhes.tempoMedioResolucao}d` : "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground">Tempo Médio</p>
                        </div>
                        <div className="text-center p-2 bg-blue-500/10 rounded-lg">
                          <div className="flex items-center justify-center gap-1">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <p className="text-2xl font-bold text-blue-600">
                              {cidadaoDetalhes.notaMedia > 0 ? cidadaoDetalhes.notaMedia.toFixed(1) : "N/A"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">Nota Média</p>
                        </div>
                      </div>
                      
                      {/* Warning badges */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {cidadaoDetalhes.slaEstourado > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {cidadaoDetalhes.slaEstourado} fora do SLA
                          </Badge>
                        )}
                        {cidadaoDetalhes.recorrencias > 0 && (
                          <Badge className="bg-amber-500/20 text-amber-700 gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {cidadaoDetalhes.recorrencias} recorrentes
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Contact Actions */}
                <div className="flex gap-2">
                  {viewingCidadao.telefone && (
                    <Button 
                      variant="outline" 
                      onClick={() => handleContact('whatsapp', viewingCidadao)}
                      className="gap-2"
                    >
                      <MessageSquare className="w-4 h-4 text-green-600" />
                      WhatsApp
                    </Button>
                  )}
                  {viewingCidadao.email && (
                    <Button 
                      variant="outline" 
                      onClick={() => handleContact('email', viewingCidadao)}
                      className="gap-2"
                    >
                      <Mail className="w-4 h-4 text-blue-600" />
                      Email
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Badge variant={viewingCidadao.aceita_alertas ? "default" : "secondary"}>
                    {viewingCidadao.aceita_alertas ? "✓ Aceita alertas (LGPD)" : "Não aceita alertas"}
                  </Badge>
                </div>

                {/* Complaints History */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Histórico de Reclamações
                  </h4>
                  {cidadaoDetalhes.reclamacoes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhuma reclamação registrada</p>
                  ) : (
                    <div className="space-y-2">
                      {cidadaoDetalhes.reclamacoes.map((rec) => {
                        const dias = differenceInDays(
                          rec.status === 'resolvida' ? parseISO(rec.updated_at) : new Date(),
                          parseISO(rec.created_at)
                        );
                        const slaEstourado = dias > 7;
                        
                        return (
                          <div 
                            key={rec.id} 
                            className={`p-3 rounded-lg border ${slaEstourado ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">{rec.protocolo}</span>
                                {getStatusBadge(rec.status)}
                                {slaEstourado && (
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <AlertTriangle className="w-3 h-3" />
                                    SLA
                                  </Badge>
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {format(parseISO(rec.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                            <div className="mt-1 text-sm">
                              <span className="text-muted-foreground">{rec.categoria?.nome || "Sem categoria"}</span>
                              <span className="mx-2">•</span>
                              <span>{rec.rua}</span>
                              {rec.bairro?.nome && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span className="text-muted-foreground">{rec.bairro.nome}</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
              {editingCidadao ? "Editar Cidadão" : "Novo Cidadão"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do cidadão
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Select value={bairroId} onValueChange={setBairroId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o bairro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {bairros.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="aceita-alertas">Aceita receber alertas (LGPD)</Label>
              <Switch
                id="aceita-alertas"
                checked={aceitaAlertas}
                onCheckedChange={setAceitaAlertas}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este cidadão? Ele não receberá mais alertas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PainelCidadaos;
