import { useState, useEffect, useCallback } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { AlertTriangle, Send, CloudRain, Droplets, Siren, Bell, Users, MapPin, History, CheckCircle2, Mail, MessageSquare, Smartphone, BellRing, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface OutletContext {
  prefeituraId: string;
  prefeitura: { nome: string; cidade: string; plano?: string } | null;
}

interface Bairro {
  id: string;
  nome: string;
}

interface Cidadao {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  bairro_id: string | null;
}

type TipoAlerta = 'enchente' | 'chuva_forte' | 'alagamento' | 'emergencia' | 'aviso_geral';
type CanalEnvio = 'email' | 'sms' | 'whatsapp';

const tiposAlerta: { value: TipoAlerta; label: string; icon: typeof AlertTriangle }[] = [
  { value: 'enchente', label: 'Enchente', icon: Droplets },
  { value: 'chuva_forte', label: 'Chuva Forte', icon: CloudRain },
  { value: 'alagamento', label: 'Alagamento', icon: Droplets },
  { value: 'emergencia', label: 'Emergência', icon: Siren },
  { value: 'aviso_geral', label: 'Aviso Geral', icon: Bell },
];

const canaisEnvio: { value: CanalEnvio; label: string; icon: typeof Mail; proOnly?: boolean }[] = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, proOnly: true },
];

const canaisEmBreve: { label: string; icon: typeof Mail }[] = [
  { label: 'SMS', icon: Smartphone },
  { label: 'Push Notification', icon: BellRing },
];

const PainelAlertas = () => {
  const { prefeituraId, prefeitura } = useOutletContext<OutletContext>();
  const isPro = prefeitura?.plano === 'pro';
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [cidadaosCount, setCidadaosCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  // Progress tracking state
  const [progressOpen, setProgressOpen] = useState(false);
  const [currentAlertaId, setCurrentAlertaId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState({ enviados: 0, total: 0, concluido: false });

  // Form state
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoAlerta | "">("");
  const [mensagem, setMensagem] = useState("");
  const [bairroId, setBairroId] = useState<string>("todos");
  const [canais, setCanais] = useState<CanalEnvio[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch bairros
        const { data: bairrosData } = await supabase
          .from("bairros")
          .select("id, nome")
          .eq("prefeitura_id", prefeituraId)
          .eq("ativo", true)
          .order("nome");

        if (bairrosData) setBairros(bairrosData);

        // Count cidadãos ativos que aceitam alertas
        const { count } = await supabase
          .from("cidadaos")
          .select("*", { count: "exact", head: true })
          .eq("prefeitura_id", prefeituraId)
          .eq("ativo", true)
          .eq("aceita_alertas", true);

        setCidadaosCount(count || 0);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    if (prefeituraId) fetchData();
  }, [prefeituraId]);

  // Count recipients based on selection
  const countRecipients = async () => {
    let query = supabase
      .from("cidadaos")
      .select("*", { count: "exact", head: true })
      .eq("prefeitura_id", prefeituraId)
      .eq("ativo", true)
      .eq("aceita_alertas", true);

    if (bairroId !== "todos") {
      query = query.eq("bairro_id", bairroId);
    }

    const { count } = await query;
    return count || 0;
  };

  const handleCanalChange = (canal: CanalEnvio, checked: boolean) => {
    if (checked) {
      setCanais([...canais, canal]);
    } else {
      setCanais(canais.filter((c) => c !== canal));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titulo.trim()) {
      toast({ title: "Erro", description: "Informe o título do alerta", variant: "destructive" });
      return;
    }
    if (!tipo) {
      toast({ title: "Erro", description: "Selecione o tipo de alerta", variant: "destructive" });
      return;
    }
    if (!mensagem.trim()) {
      toast({ title: "Erro", description: "Escreva a mensagem do alerta", variant: "destructive" });
      return;
    }
    if (canais.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um canal de envio", variant: "destructive" });
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    setProgressData({ enviados: 0, total: 0, concluido: false });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Count recipients to show expected total
      let countQuery = supabase
        .from("cidadaos")
        .select("*", { count: "exact", head: true })
        .eq("prefeitura_id", prefeituraId)
        .eq("ativo", true)
        .eq("aceita_alertas", true);
      
      if (bairroId !== "todos") {
        countQuery = countQuery.eq("bairro_id", bairroId);
      }
      
      const { count: recipientCount } = await countQuery;
      const expectedTotal = (recipientCount || 0) * canais.length;
      setProgressData({ enviados: 0, total: expectedTotal, concluido: false });
      
      // Create the alert
      const { data: alerta, error: alertaError } = await supabase
        .from("alertas")
        .insert({
          prefeitura_id: prefeituraId,
          titulo: titulo.trim(),
          tipo: tipo as TipoAlerta,
          mensagem: mensagem.trim(),
          bairro_id: bairroId === "todos" ? null : bairroId,
          canais: canais,
          criado_por: session?.user?.id,
        })
        .select()
        .single();

      if (alertaError) throw alertaError;

      // Open progress dialog and set current alert ID
      setCurrentAlertaId(alerta.id);
      setProgressOpen(true);
      setSending(false);

      // Call edge function to process the alert (don't await, let it run in background)
      supabase.functions.invoke("send-alert", {
        body: { alertaId: alerta.id },
      }).then(({ data, error: fnError }) => {
        if (fnError) {
          console.error("Erro ao processar envio:", fnError);
          toast({
            title: "Erro no envio",
            description: "Houve um erro no envio. Verifique o histórico.",
            variant: "destructive",
          });
        }
        // Mark as complete
        setProgressData(prev => ({ ...prev, concluido: true, enviados: data?.enviados || prev.enviados }));
      });

      // Reset form
      setTitulo("");
      setTipo("");
      setMensagem("");
      setBairroId("todos");
      setCanais([]);
    } catch (error: any) {
      console.error("Erro ao criar alerta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o alerta. Tente novamente.",
        variant: "destructive",
      });
      setSending(false);
    }
  };

  // Subscribe to realtime updates for progress tracking
  useEffect(() => {
    if (!currentAlertaId || !progressOpen) return;

    const channel = supabase
      .channel(`alerta-progress-${currentAlertaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'alertas',
          filter: `id=eq.${currentAlertaId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          setProgressData(prev => ({
            ...prev,
            enviados: newData.total_enviados || 0,
            // When total_erros becomes less than total (final update), mark as complete
            total: prev.total || newData.total_erros || 0,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAlertaId, progressOpen]);

  const handleCloseProgress = () => {
    setProgressOpen(false);
    setCurrentAlertaId(null);
    setProgressData({ enviados: 0, total: 0, concluido: false });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Alertas Oficiais</h1>
            <p className="text-muted-foreground">
              Envio de mensagens emergenciais para cidadãos cadastrados
            </p>
          </div>
        </div>
        <Link to={`/painel/${prefeituraId}/alertas/historico`}>
          <Button variant="outline" className="gap-2">
            <History className="w-4 h-4" />
            Histórico de Alertas
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{cidadaosCount}</p>
              <p className="text-sm text-muted-foreground">Cidadãos cadastrados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <MapPin className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{bairros.length}</p>
              <p className="text-sm text-muted-foreground">Bairros ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Novo Alerta</CardTitle>
          <CardDescription>
            Preencha os dados do alerta que será enviado aos cidadãos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">Título do Alerta *</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Alerta de chuva forte"
                  maxLength={100}
                />
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Alerta *</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAlerta)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAlerta.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <t.icon className="w-4 h-4" />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mensagem */}
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem do Alerta *</Label>
              <Textarea
                id="mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite a mensagem que será enviada aos cidadãos..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {mensagem.length}/500 caracteres
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bairro */}
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Select value={bairroId} onValueChange={setBairroId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Todos os bairros
                      </div>
                    </SelectItem>
                    {bairros.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Canais */}
              <div className="space-y-2">
                <Label>Canal de Envio *</Label>
                <TooltipProvider>
                  <div className="flex flex-wrap gap-4 pt-2">
                    {/* Canais ativos */}
                    {canaisEnvio.map((canal) => {
                      const isDisabled = canal.proOnly && !isPro;
                      
                      if (isDisabled) {
                        return (
                          <Tooltip key={canal.value}>
                            <TooltipTrigger asChild>
                              <div className="flex items-center space-x-2 opacity-50 cursor-not-allowed">
                                <Checkbox
                                  id={canal.value}
                                  disabled
                                  checked={false}
                                />
                                <label
                                  className="text-sm font-medium leading-none cursor-not-allowed flex items-center gap-1.5"
                                >
                                  <canal.icon className="w-4 h-4" />
                                  {canal.label}
                                  <Crown className="w-3 h-3 text-amber-500" />
                                </label>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Disponível apenas no plano PRO</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }
                      
                      return (
                        <div key={canal.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={canal.value}
                            checked={canais.includes(canal.value)}
                            onCheckedChange={(checked) =>
                              handleCanalChange(canal.value, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={canal.value}
                            className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1.5"
                          >
                            <canal.icon className="w-4 h-4" />
                            {canal.label}
                          </label>
                        </div>
                      );
                    })}
                    
                    {/* Canais em breve (desabilitados) */}
                    {canaisEmBreve.map((canal) => (
                      <Tooltip key={canal.label}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center space-x-2 opacity-50 cursor-not-allowed">
                            <Checkbox
                              id={canal.label}
                              disabled
                              checked={false}
                            />
                            <label
                              className="text-sm font-medium leading-none cursor-not-allowed flex items-center gap-1.5"
                            >
                              <canal.icon className="w-4 h-4" />
                              {canal.label}
                            </label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Em breve</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    DISPARAR ALERTA
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Envio de Alerta
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Este alerta será enviado apenas para cidadãos cadastrados desta prefeitura
                que aceitaram receber alertas.
              </p>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p><strong>Título:</strong> {titulo}</p>
                <p><strong>Tipo:</strong> {tiposAlerta.find(t => t.value === tipo)?.label}</p>
                <p><strong>Bairro:</strong> {bairroId === "todos" ? "Todos os bairros" : bairros.find(b => b.id === bairroId)?.nome}</p>
                <p><strong>Canais:</strong> {canais.map(c => canaisEnvio.find(ce => ce.value === c)?.label).join(", ")}</p>
              </div>
              <p className="font-medium">Deseja confirmar o envio?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSend}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar Envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress Dialog */}
      <Dialog open={progressOpen} onOpenChange={(open) => !open && progressData.concluido && handleCloseProgress()}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => !progressData.concluido && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {progressData.concluido ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Envio Concluído
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 text-primary animate-pulse" />
                  Enviando Alertas...
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {progressData.concluido 
                ? "Todos os alertas foram processados com sucesso."
                : "Acompanhe o progresso do envio em tempo real."
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso do envio</span>
                <span className="font-medium">
                  {progressData.enviados} / {progressData.total}
                </span>
              </div>
              <Progress 
                value={progressData.total > 0 ? (progressData.enviados / progressData.total) * 100 : 0} 
                className="h-3"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{progressData.enviados}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
              <div className="bg-muted p-3 rounded-lg text-center">
                <p className="text-2xl font-bold">{progressData.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>

            {!progressData.concluido && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Processando envios...
              </div>
            )}
          </div>

          {progressData.concluido && (
            <div className="flex justify-end">
              <Button onClick={handleCloseProgress}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PainelAlertas;
