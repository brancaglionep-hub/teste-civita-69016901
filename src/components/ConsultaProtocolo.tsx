import { useState } from "react";
import { ArrowLeft, Search, Clock, CheckCircle2, AlertCircle, FileText, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ConsultaProtocoloProps {
  onClose: () => void;
  prefeituraId: string;
}

interface Reclamacao {
  id: string;
  protocolo: string;
  status: string;
  rua: string;
  created_at: string;
  updated_at: string;
  resposta_prefeitura: string | null;
  bairro_nome: string | null;
  categoria_nome: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  recebida: { label: "Recebida", color: "bg-blue-100 text-blue-700", icon: Clock },
  em_analise: { label: "Em Análise", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  em_andamento: { label: "Em Andamento", color: "bg-orange-100 text-orange-700", icon: Clock },
  resolvida: { label: "Resolvida", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  arquivada: { label: "Arquivada", color: "bg-gray-100 text-gray-700", icon: FileText }
};

const ConsultaProtocolo = ({ onClose, prefeituraId }: ConsultaProtocoloProps) => {
  const [protocolo, setProtocolo] = useState("");
  const [loading, setLoading] = useState(false);
  const [reclamacao, setReclamacao] = useState<Reclamacao | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protocolo.trim()) return;

    setLoading(true);
    setNotFound(false);
    setReclamacao(null);

    const { data, error } = await supabase
      .rpc("consultar_protocolo", {
        _protocolo: protocolo.trim().toUpperCase(),
        _prefeitura_id: prefeituraId
      })
      .maybeSingle();

    if (error) {
      toast({
        title: "Erro na busca",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } else if (data) {
      setReclamacao(data as any);
    } else {
      setNotFound(true);
    }

    setLoading(false);
  };

  const status = reclamacao?.status ? statusConfig[reclamacao.status] || statusConfig.recebida : null;
  const StatusIcon = status?.icon || Clock;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-primary-foreground/10 rounded-lg">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">Consultar Reclamação</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Digite o número do protocolo
          </label>
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Ex: REC-20241215-1234"
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
              className="h-12 text-lg uppercase"
            />
            <Button type="submit" disabled={loading} className="h-12 px-6">
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>

        {/* Not Found */}
        {notFound && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Protocolo não encontrado</h2>
            <p className="text-muted-foreground">
              Verifique o número e tente novamente.
            </p>
          </div>
        )}

        {/* Result */}
        {reclamacao && status && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Status Header */}
            <div className={`px-6 py-4 ${status.color}`}>
              <div className="flex items-center gap-3">
                <StatusIcon className="w-6 h-6" />
                <div>
                  <p className="font-semibold">{status.label}</p>
                  <p className="text-sm opacity-80">Protocolo: {reclamacao.protocolo}</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">
                    {reclamacao.rua}
                  </p>
                  {reclamacao.bairro_nome && (
                    <p className="text-sm text-muted-foreground">{reclamacao.bairro_nome}</p>
                  )}
                </div>
              </div>

              {reclamacao.categoria_nome && (
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <p className="text-foreground">{reclamacao.categoria_nome}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <p className="text-foreground">
                  Registrado em {new Date(reclamacao.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>

              {reclamacao.resposta_prefeitura && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Resposta da Prefeitura:</p>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-foreground">{reclamacao.resposta_prefeitura}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ConsultaProtocolo;
