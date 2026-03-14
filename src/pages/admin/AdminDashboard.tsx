import { useEffect, useState } from "react";
import { Building2, FileText, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Stats {
  totalPrefeituras: number;
  totalReclamacoes: number;
  reclamacoesAbertas: number;
  reclamacoesResolvidas: number;
}

interface PrefeituraStats {
  nome: string;
  total: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalPrefeituras: 0,
    totalReclamacoes: 0,
    reclamacoesAbertas: 0,
    reclamacoesResolvidas: 0
  });
  const [prefeituraStats, setPrefeituraStats] = useState<PrefeituraStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Total prefeituras
      const { count: totalPrefeituras } = await supabase
        .from("prefeituras")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true);

      // Total reclamações
      const { count: totalReclamacoes } = await supabase
        .from("reclamacoes")
        .select("*", { count: "exact", head: true });

      // Abertas
      const { count: reclamacoesAbertas } = await supabase
        .from("reclamacoes")
        .select("*", { count: "exact", head: true })
        .in("status", ["recebida", "em_andamento"] as any);

      // Resolvidas
      const { count: reclamacoesResolvidas } = await supabase
        .from("reclamacoes")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolvida");

      setStats({
        totalPrefeituras: totalPrefeituras || 0,
        totalReclamacoes: totalReclamacoes || 0,
        reclamacoesAbertas: reclamacoesAbertas || 0,
        reclamacoesResolvidas: reclamacoesResolvidas || 0
      });

      // Stats por prefeitura
      const { data: prefeituras } = await supabase
        .from("prefeituras")
        .select("id, cidade")
        .eq("ativo", true);

      if (prefeituras) {
        const statsPromises = prefeituras.map(async (p) => {
          const { count } = await supabase
            .from("reclamacoes")
            .select("*", { count: "exact", head: true })
            .eq("prefeitura_id", p.id);
          return { nome: p.cidade, total: count || 0 };
        });

        const results = await Promise.all(statsPromises);
        setPrefeituraStats(results.filter(r => r.total > 0).sort((a, b) => b.total - a.total));
      }

      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard Geral</h1>
        <p className="text-muted-foreground mt-1">Visão geral de todo o sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prefeituras</CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalPrefeituras}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reclamações</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalReclamacoes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Aberto</CardTitle>
            <TrendingUp className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.reclamacoesAbertas}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolvidas</CardTitle>
            <Users className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.reclamacoesResolvidas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Reclamações por Cidade</CardTitle>
          </CardHeader>
          <CardContent>
            {prefeituraStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prefeituraStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhuma reclamação registrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Cidade</CardTitle>
          </CardHeader>
          <CardContent>
            {prefeituraStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={prefeituraStats}
                    dataKey="total"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ nome, percent }) => `${nome} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {prefeituraStats.map((_, index) => (
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
    </div>
  );
};

export default AdminDashboard;
