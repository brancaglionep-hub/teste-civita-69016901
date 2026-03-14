import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { History, AlertTriangle, CheckCircle2, XCircle, CloudRain, Droplets, Siren, Bell, CalendarIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface OutletContext {
  prefeituraId: string;
}

interface Alerta {
  id: string;
  titulo: string;
  tipo: string;
  mensagem: string;
  canais: string[];
  total_enviados: number;
  total_erros: number;
  created_at: string;
  bairro: { nome: string } | null;
}

const tipoIcons: Record<string, typeof AlertTriangle> = {
  enchente: Droplets,
  chuva_forte: CloudRain,
  alagamento: Droplets,
  emergencia: Siren,
  aviso_geral: Bell,
};

const tipoLabels: Record<string, string> = {
  enchente: 'Enchente',
  chuva_forte: 'Chuva Forte',
  alagamento: 'Alagamento',
  emergencia: 'Emergência',
  aviso_geral: 'Aviso Geral',
};

const tipoColors: Record<string, string> = {
  enchente: 'bg-blue-500/10 text-blue-500',
  chuva_forte: 'bg-sky-500/10 text-sky-500',
  alagamento: 'bg-cyan-500/10 text-cyan-500',
  emergencia: 'bg-destructive/10 text-destructive',
  aviso_geral: 'bg-amber-500/10 text-amber-500',
};

const PainelAlertasHistorico = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [stats, setStats] = useState({ total: 0, enviados: 0, erros: 0 });
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  const fetchAlertas = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("alertas")
        .select(`
          id,
          titulo,
          tipo,
          mensagem,
          canais,
          total_enviados,
          total_erros,
          created_at,
          bairro:bairros(nome)
        `)
        .eq("prefeitura_id", prefeituraId)
        .order("created_at", { ascending: false });

      if (dataInicio) {
        query = query.gte("created_at", startOfDay(dataInicio).toISOString());
      }
      if (dataFim) {
        query = query.lte("created_at", endOfDay(dataFim).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const alertasData = (data || []) as unknown as Alerta[];
      setAlertas(alertasData);

      const totalEnviados = alertasData.reduce((acc, a) => acc + (a.total_enviados || 0), 0);
      const totalErros = alertasData.reduce((acc, a) => acc + (a.total_erros || 0), 0);
      setStats({
        total: alertasData.length,
        enviados: totalEnviados,
        erros: totalErros,
      });
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prefeituraId) fetchAlertas();
  }, [prefeituraId, dataInicio, dataFim]);

  const limparFiltros = () => {
    setDataInicio(undefined);
    setDataFim(undefined);
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
            <History className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Histórico de Alertas</h1>
            <p className="text-muted-foreground">
              Visualize todos os alertas enviados
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to={`/painel/${prefeituraId}/alertas`}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Novo Alerta
          </Link>
        </Button>
      </div>

      {/* Filtro de Data */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <span className="text-sm font-medium text-muted-foreground">Filtrar por data:</span>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[180px] justify-start text-left font-normal",
                  !dataInicio && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Data início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataInicio}
                onSelect={setDataInicio}
                initialFocus
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[180px] justify-start text-left font-normal",
                  !dataFim && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataFim}
                onSelect={setDataFim}
                initialFocus
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {(dataInicio || dataFim) && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1">
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total de alertas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.enviados}</p>
              <p className="text-sm text-muted-foreground">Mensagens enviadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.erros}</p>
              <p className="text-sm text-muted-foreground">Falhas no envio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas Enviados</CardTitle>
          <CardDescription>
            Lista completa de alertas disparados pela prefeitura
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">Nenhum alerta enviado</h3>
              <p className="text-muted-foreground">
                Os alertas enviados aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead className="text-center">Enviados</TableHead>
                    <TableHead className="text-center">Falhas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertas.map((alerta) => {
                    const TipoIcon = tipoIcons[alerta.tipo] || AlertTriangle;
                    return (
                      <TableRow key={alerta.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(alerta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${tipoColors[alerta.tipo] || 'bg-muted text-muted-foreground'} flex items-center gap-1 w-fit`}>
                            <TipoIcon className="w-3 h-3" />
                            {tipoLabels[alerta.tipo] || alerta.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {alerta.titulo}
                        </TableCell>
                        <TableCell>
                          {alerta.bairro?.nome || "Todos"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                            {alerta.total_enviados}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${alerta.total_erros > 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted text-muted-foreground'}`}>
                            {alerta.total_erros}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PainelAlertasHistorico;
