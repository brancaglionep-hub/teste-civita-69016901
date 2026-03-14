import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Eye, 
  AlertTriangle, Timer, Star, Zap, LayoutDashboard, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area 
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OutletContext {
  prefeitura: { id: string; nome: string; cidade: string } | null;
  prefeituraId: string;
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#6b7280", "#ef4444", "#8b5cf6"];

const PainelDashboard = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [modoExecutivo, setModoExecutivo] = useState(false);

  // Fetch all stats in a single optimized query
  const { data, isLoading } = useQuery({
    queryKey: ["painel-dashboard", prefeituraId],
    queryFn: async () => {
      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);

      // Get config for SLA
      const { data: configData } = await supabase
        .from("prefeitura_configuracoes")
        .select("sla_padrao_dias, sla_alerta_percentual")
        .eq("prefeitura_id", prefeituraId)
        .maybeSingle();

      const slaPadraoDias = configData?.sla_padrao_dias || 7;
      const slaAlertaPercentual = configData?.sla_alerta_percentual || 80;
      const diasAlerta = Math.floor(slaPadraoDias * (slaAlertaPercentual / 100));

      // Run all count queries in parallel
      const [
        totalRes,
        recebidasRes,
        emAndamentoRes,
        resolvidasRes,
        reclamacoesFullRes,
        bairrosRes,
        categoriasRes,
        visitasRes,
        avaliacoesRes
      ] = await Promise.all([
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId),
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId).eq("status", "recebida"),
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId).eq("status", "em_andamento"),
        supabase.from("reclamacoes").select("*", { count: "exact", head: true }).eq("prefeitura_id", prefeituraId).eq("status", "resolvida"),
        supabase.from("reclamacoes").select("id, bairro_id, categoria_id, created_at, status, updated_at").eq("prefeitura_id", prefeituraId),
        supabase.from("bairros").select("id, nome").eq("prefeitura_id", prefeituraId),
        supabase.from("categorias").select("id, nome").or(`prefeitura_id.eq.${prefeituraId},global.eq.true`),
        supabase.from("visitas").select("created_at").eq("prefeitura_id", prefeituraId).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("avaliacoes").select("estrelas, avaliado_em").eq("prefeitura_id", prefeituraId).not("avaliado_em", "is", null)
      ]);

      const reclamacoes = reclamacoesFullRes.data || [];
      const bairros = bairrosRes.data || [];
      const categorias = categoriasRes.data || [];
      const avaliacoes = avaliacoesRes.data || [];

      // Calculate SLA stats
      let slaVencido = 0;
      let slaPerto = 0;
      let slaNoPrazo = 0;
      let emAndamentoNoPrazo = 0;
      let emAndamentoForaPrazo = 0;

      const reclamacoesAbertas = reclamacoes.filter(r => r.status === "recebida" || r.status === "em_andamento");
      
      reclamacoesAbertas.forEach(r => {
        const diasPassados = differenceInDays(now, new Date(r.created_at));
        
        if (diasPassados > slaPadraoDias) {
          slaVencido++;
          if (r.status === "em_andamento") emAndamentoForaPrazo++;
        } else if (diasPassados >= diasAlerta) {
          slaPerto++;
          if (r.status === "em_andamento") emAndamentoNoPrazo++;
        } else {
          slaNoPrazo++;
          if (r.status === "em_andamento") emAndamentoNoPrazo++;
        }
      });

      // Process stats
      const stats = {
        total: totalRes.count || 0,
        recebidas: recebidasRes.count || 0,
        emAndamento: emAndamentoRes.count || 0,
        resolvidas: resolvidasRes.count || 0,
        doMes: reclamacoes.filter(r => new Date(r.created_at) >= startOfCurrentMonth).length,
        slaVencido,
        slaPerto,
        slaNoPrazo,
        emAndamentoNoPrazo,
        emAndamentoForaPrazo,
        slaPadraoDias
      };

      // Calculate average rating
      const notaMedia = avaliacoes.length > 0 
        ? avaliacoes.reduce((sum, a) => sum + a.estrelas, 0) / avaliacoes.length 
        : 0;
      const totalAvaliacoes = avaliacoes.length;

      const statusStats = [
        { name: "Recebidas", value: stats.recebidas },
        { name: "Em andamento", value: stats.emAndamento },
        { name: "Resolvidas", value: stats.resolvidas }
      ];

      // SLA stats for pie chart
      const slaStats = [
        { name: "No prazo", value: slaNoPrazo, color: "#10b981" },
        { name: "Perto do vencimento", value: slaPerto, color: "#f59e0b" },
        { name: "Vencido", value: slaVencido, color: "#ef4444" }
      ].filter(s => s.value > 0);

      // Process bairro stats with SLA info
      const bairroCountMap = new Map<string, { total: number; vencidos: number }>();
      reclamacoes.forEach(r => {
        if (r.bairro_id) {
          const current = bairroCountMap.get(r.bairro_id) || { total: 0, vencidos: 0 };
          current.total++;
          
          if ((r.status === "recebida" || r.status === "em_andamento") && 
              differenceInDays(now, new Date(r.created_at)) > slaPadraoDias) {
            current.vencidos++;
          }
          bairroCountMap.set(r.bairro_id, current);
        }
      });
      
      const bairroStats = bairros
        .map(b => {
          const data = bairroCountMap.get(b.id) || { total: 0, vencidos: 0 };
          return { nome: b.nome, total: data.total, vencidos: data.vencidos };
        })
        .filter(r => r.total > 0)
        .sort((a, b) => b.vencidos - a.vencidos || b.total - a.total)
        .slice(0, 10);

      // Top bairros com SLA estourado
      const bairrosCriticos = bairros
        .map(b => {
          const data = bairroCountMap.get(b.id) || { total: 0, vencidos: 0 };
          return { nome: b.nome, vencidos: data.vencidos };
        })
        .filter(r => r.vencidos > 0)
        .sort((a, b) => b.vencidos - a.vencidos)
        .slice(0, 5);

      // Process categoria stats with SLA info
      const categoriaCountMap = new Map<string, { total: number; vencidos: number }>();
      reclamacoes.forEach(r => {
        if (r.categoria_id) {
          const current = categoriaCountMap.get(r.categoria_id) || { total: 0, vencidos: 0 };
          current.total++;
          
          if ((r.status === "recebida" || r.status === "em_andamento") && 
              differenceInDays(now, new Date(r.created_at)) > slaPadraoDias) {
            current.vencidos++;
          }
          categoriaCountMap.set(r.categoria_id, current);
        }
      });
      
      const categoriaStats = categorias
        .map(c => {
          const data = categoriaCountMap.get(c.id) || { total: 0, vencidos: 0 };
          return { nome: c.nome, total: data.total, vencidos: data.vencidos };
        })
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total);

      // Categorias com mais SLA estourado
      const categoriasCriticas = categorias
        .map(c => {
          const data = categoriaCountMap.get(c.id) || { total: 0, vencidos: 0 };
          return { nome: c.nome, vencidos: data.vencidos };
        })
        .filter(r => r.vencidos > 0)
        .sort((a, b) => b.vencidos - a.vencidos)
        .slice(0, 5);

      // Process visitas stats - group by day
      const visitas = visitasRes.data || [];
      const visitasByDay = new Map<string, number>();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        visitasByDay.set(dateKey, 0);
      }
      
      visitas.forEach(v => {
        const dateKey = v.created_at.split('T')[0];
        if (visitasByDay.has(dateKey)) {
          visitasByDay.set(dateKey, (visitasByDay.get(dateKey) || 0) + 1);
        }
      });

      const visitasStats = Array.from(visitasByDay.entries()).map(([dateStr, count]) => ({
        date: new Date(dateStr).toLocaleDateString("pt-BR", { weekday: "short" }),
        visitas: count
      }));

      // Monthly trend (last 6 months)
      const tendenciaMensal = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = endOfMonth(subMonths(now, i));
        
        const abertas = reclamacoes.filter(r => {
          const createdAt = new Date(r.created_at);
          return createdAt >= monthStart && createdAt <= monthEnd;
        }).length;

        const resolvidas = reclamacoes.filter(r => {
          if (r.status !== "resolvida") return false;
          const updatedAt = new Date(r.updated_at);
          return updatedAt >= monthStart && updatedAt <= monthEnd;
        }).length;

        tendenciaMensal.push({
          mes: format(monthStart, "MMM", { locale: ptBR }),
          abertas,
          resolvidas
        });
      }

      // Alertas do dia
      const alertasHoje = [];
      
      if (slaVencido > 0) {
        alertasHoje.push({
          tipo: "critico",
          icone: "🔴",
          mensagem: `${slaVencido} reclamação(ões) com SLA vencido`
        });
      }
      
      if (slaPerto > 0) {
        alertasHoje.push({
          tipo: "alerta",
          icone: "🟡",
          mensagem: `${slaPerto} reclamação(ões) perto do vencimento`
        });
      }

      const reclamacoesRecentes = reclamacoes
        .filter(r => r.status === "recebida")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);

      if (reclamacoesRecentes.length > 0) {
        alertasHoje.push({
          tipo: "info",
          icone: "📥",
          mensagem: `${reclamacoesRecentes.length} reclamação(ões) aguardando análise`
        });
      }

      return { 
        stats, 
        statusStats, 
        slaStats,
        bairroStats, 
        bairrosCriticos,
        categoriaStats, 
        categoriasCriticas,
        visitasStats, 
        tendenciaMensal,
        notaMedia,
        totalAvaliacoes,
        alertasHoje
      };
    },
    enabled: !!prefeituraId,
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = data.stats || { total: 0, recebidas: 0, emAndamento: 0, resolvidas: 0, doMes: 0, slaVencido: 0, slaPerto: 0, slaNoPrazo: 0, emAndamentoNoPrazo: 0, emAndamentoForaPrazo: 0, slaPadraoDias: 7 };
  const statusStats = data.statusStats || [];
  const slaStats = data.slaStats || [];
  const bairroStats = data.bairroStats || [];
  const bairrosCriticos = data.bairrosCriticos || [];
  const categoriaStats = data.categoriaStats || [];
  const categoriasCriticas = data.categoriasCriticas || [];
  const visitasStats = data.visitasStats || [];
  const tendenciaMensal = data.tendenciaMensal || [];
  const notaMedia = data.notaMedia || 0;
  const totalAvaliacoes = data.totalAvaliacoes || 0;
  const alertasHoje = data.alertasHoje || [];

  return (
    <div className="space-y-8">
      {/* Header com toggle de modo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral das reclamações</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg">
            <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="modo-executivo" className="text-sm cursor-pointer">Modo Executivo</Label>
            <Switch 
              id="modo-executivo" 
              checked={modoExecutivo} 
              onCheckedChange={setModoExecutivo} 
            />
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline">Ajuda</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Entenda o Dashboard
                </DialogTitle>
                <DialogDescription>
                  Guia rápido dos indicadores do painel
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium mb-2">O que é SLA?</p>
                  <p className="text-muted-foreground">
                    SLA (Service Level Agreement) é o prazo máximo para resolver uma reclamação. 
                    O prazo configurado é de <strong>{stats.slaPadraoDias} dias</strong>.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="font-medium">Indicadores de prazo:</p>
                  
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                    <span className="text-lg">🟢</span>
                    <div>
                      <p className="font-medium text-green-700">No Prazo</p>
                      <p className="text-muted-foreground text-xs">
                        Reclamações dentro do prazo estipulado.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                    <span className="text-lg">🟡</span>
                    <div>
                      <p className="font-medium text-yellow-700">Perto do Vencimento</p>
                      <p className="text-muted-foreground text-xs">
                        Atingiram 80% do prazo. Atenção redobrada!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                    <span className="text-lg">🔴</span>
                    <div>
                      <p className="font-medium text-red-700">SLA Vencido</p>
                      <p className="text-muted-foreground text-xs">
                        Ultrapassaram o prazo. Prioridade máxima!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="font-medium text-blue-700 mb-1">💡 Dica</p>
                  <p className="text-muted-foreground text-xs">
                    Configure o prazo do SLA em <strong>Configurações → SLA e Prazos</strong>.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alertas do Dia */}
      {alertasHoje.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Atenção Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {alertasHoje.map((alerta, idx) => (
                <Badge 
                  key={idx} 
                  variant={alerta.tipo === "critico" ? "destructive" : alerta.tipo === "alerta" ? "secondary" : "outline"}
                  className="text-sm py-1.5 px-3"
                >
                  {alerta.icone} {alerta.mensagem}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards - Linha 1: Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolvidas</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.resolvidas}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.resolvidas / stats.total) * 100).toFixed(0) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            <Clock className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.emAndamento}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-green-600">{stats.emAndamentoNoPrazo} no prazo</span>
              {stats.emAndamentoForaPrazo > 0 && (
                <span className="text-xs text-red-600">{stats.emAndamentoForaPrazo} atrasado</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={stats.slaVencido > 0 ? "border-red-500/50 bg-red-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SLA Vencido</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${stats.slaVencido > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              {stats.slaVencido}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Prazo: {stats.slaPadraoDias} dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nota Média</CardTitle>
            <Star className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {notaMedia > 0 ? notaMedia.toFixed(1) : "-"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAvaliacoes} avaliação(ões)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards - Linha 2: SLA */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Indicadores de SLA</h3>
        
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700">🟢 No Prazo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.slaNoPrazo}</p>
            </CardContent>
          </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">🟡 Perto do Prazo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.slaPerto}</p>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700">🔴 Vencido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.slaVencido}</p>
          </CardContent>
        </Card>

        <Card className="hidden lg:block">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Este Mês</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.doMes}</p>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Gráficos - Apenas no modo completo ou executivo simplificado */}
      {!modoExecutivo ? (
        <>
          {/* Charts Row 1: Tendência + SLA */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Tendência Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tendenciaMensal.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={tendenciaMensal}>
                      <defs>
                        <linearGradient id="colorAbertas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorResolvidas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="abertas" name="Abertas" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAbertas)" />
                      <Area type="monotone" dataKey="resolvidas" name="Resolvidas" stroke="#10b981" fillOpacity={1} fill="url(#colorResolvidas)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados suficientes
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="w-5 h-5" />
                  Status de SLA
                </CardTitle>
              </CardHeader>
              <CardContent>
                {slaStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={slaStats}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {slaStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhuma reclamação aberta
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Críticos */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <Zap className="w-5 h-5" />
                  Bairros com SLA Estourado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bairrosCriticos.length > 0 ? (
                  <div className="space-y-3">
                    {bairrosCriticos.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                        <span className="font-medium">{b.nome}</span>
                        <Badge variant="destructive">{b.vencidos} vencido(s)</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-green-600">
                    ✓ Nenhum SLA estourado por bairro
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <Zap className="w-5 h-5" />
                  Categorias com SLA Estourado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoriasCriticas.length > 0 ? (
                  <div className="space-y-3">
                    {categoriasCriticas.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                        <span className="font-medium">{c.nome}</span>
                        <Badge variant="destructive">{c.vencidos} vencido(s)</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-green-600">
                    ✓ Nenhum SLA estourado por categoria
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 3: Bairros e Categorias */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bairros com mais reclamações</CardTitle>
              </CardHeader>
              <CardContent>
                {bairroStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={bairroStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="nome" width={100} />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhuma reclamação registrada
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reclamações por tipo</CardTitle>
              </CardHeader>
              <CardContent>
                {categoriaStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoriaStats}
                        dataKey="total"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ nome }) => nome}
                      >
                        {categoriaStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhuma reclamação registrada
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 4: Status e Visitas */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Reclamações por status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Visitas no site (últimos 7 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={visitasStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="visitas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        /* Modo Executivo - Simplificado */
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tendência Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tendenciaMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={tendenciaMensal}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="abertas" name="Abertas" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="resolvidas" name="Resolvidas" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Sem dados
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="w-5 h-5" />
                Status de SLA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slaStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={slaStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {slaStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-green-600">
                  ✓ Tudo em dia
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PainelDashboard;
