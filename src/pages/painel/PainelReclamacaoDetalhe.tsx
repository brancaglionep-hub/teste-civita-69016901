import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, User, Mail, Phone, FileText, Send, Clock, CheckCircle2, AlertCircle, Image, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VideoModal, VideoThumbnail } from "@/components/VideoModal";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface OutletContext {
  prefeituraId: string;
}

interface Reclamacao {
  id: string;
  protocolo: string;
  status: string;
  nome_cidadao: string;
  email_cidadao: string;
  telefone_cidadao: string | null;
  rua: string;
  numero: string | null;
  referencia: string | null;
  descricao: string;
  resposta_prefeitura: string | null;
  fotos: string[];
  videos: string[];
  created_at: string;
  updated_at: string;
  bairros: { nome: string } | null;
  categorias: { nome: string } | null;
}

interface HistoricoItem {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  observacao: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  recebida: { label: "Recebida", color: "bg-blue-100 text-blue-700", icon: Clock },
  em_andamento: { label: "Em Andamento", color: "bg-orange-100 text-orange-700", icon: Clock },
  resolvida: { label: "Resolvida", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  arquivada: { label: "Arquivada", color: "bg-gray-100 text-gray-700", icon: AlertCircle }
};

const PainelReclamacaoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [reclamacao, setReclamacao] = useState<Reclamacao | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [resposta, setResposta] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  useEffect(() => {
    const fetchReclamacao = async () => {
      const { data, error } = await supabase
        .from("reclamacoes")
        .select(`
          *,
          bairros (nome),
          categorias (nome)
        `)
        .eq("id", id)
        .single();

      if (!error && data) {
        setReclamacao(data as any);
        setNewStatus(data.status);
        setResposta(data.resposta_prefeitura || "");
        
        // Marcar como visualizada se ainda não foi
        if (!data.visualizada) {
          await supabase
            .from("reclamacoes")
            .update({ visualizada: true })
            .eq("id", id);
        }
      }

      // Fetch historico
      const { data: hist } = await supabase
        .from("historico_status")
        .select("*")
        .eq("reclamacao_id", id)
        .order("created_at", { ascending: false });

      if (hist) {
        setHistorico(hist);
      }

      setLoading(false);
    };

    if (id) {
      fetchReclamacao();
    }
  }, [id]);

  const handleSave = async () => {
    if (!reclamacao) return;
    setSaving(true);

    try {
      // Update reclamacao
      const { error } = await supabase
        .from("reclamacoes")
        .update({
          status: newStatus as any,
          resposta_prefeitura: resposta || null
        })
        .eq("id", reclamacao.id);

      if (error) throw error;

      // Add to historico if status changed
      if (newStatus !== reclamacao.status) {
        await supabase.from("historico_status").insert({
          reclamacao_id: reclamacao.id,
          status_anterior: reclamacao.status,
          status_novo: newStatus,
          observacao: resposta ? "Resposta atualizada" : null
        } as any);

        // If status is "resolvida", create avaliacao record
        let avaliacaoToken = null;
        if (newStatus === "resolvida") {
          const { data: avaliacaoData } = await supabase
            .from("avaliacoes")
            .insert({
              reclamacao_id: reclamacao.id,
              prefeitura_id: prefeituraId,
              estrelas: 5 // Default, will be updated by citizen
            } as any)
            .select("token")
            .single();
          
          if (avaliacaoData) {
            avaliacaoToken = avaliacaoData.token;
          }
        }

        // Fetch prefeitura name for email
        const { data: prefeituraData } = await supabase
          .from("prefeituras")
          .select("nome")
          .eq("id", prefeituraId)
          .single();

        // Send email notification to citizen
        try {
          await supabase.functions.invoke("send-status-notification", {
            body: {
              email: reclamacao.email_cidadao,
              nome: reclamacao.nome_cidadao,
              protocolo: reclamacao.protocolo,
              status_anterior: reclamacao.status,
              status_novo: newStatus,
              resposta: resposta || null,
              rua: reclamacao.rua,
              bairro: reclamacao.bairros?.nome || null,
              categoria: reclamacao.categorias?.nome || null,
              prefeitura_nome: prefeituraData?.nome || "Prefeitura",
              prefeitura_id: prefeituraId,
              avaliacao_token: avaliacaoToken,
              telefone: reclamacao.telefone_cidadao || null
            }
          });
          // Email notification sent successfully
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          // Don't fail the save if email fails
        }
      }

      toast({ title: "Reclamação atualizada!" });
      setReclamacao({ ...reclamacao, status: newStatus, resposta_prefeitura: resposta });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!reclamacao) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Reclamação não encontrada</p>
      </div>
    );
  }

  const status = statusConfig[reclamacao.status] || statusConfig.recebida;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/painel/${prefeituraId}/reclamacoes`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">{reclamacao.protocolo}</h1>
          <p className="text-muted-foreground">Detalhes da reclamação</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Localização */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Localização
            </h2>
            <div className="space-y-2">
              <p className="text-foreground">
                <strong>{reclamacao.rua}</strong>
                {reclamacao.numero && `, ${reclamacao.numero}`}
              </p>
              {reclamacao.bairros && (
                <p className="text-muted-foreground">{reclamacao.bairros.nome}</p>
              )}
              {reclamacao.referencia && (
                <p className="text-sm text-muted-foreground">Ref: {reclamacao.referencia}</p>
              )}
            </div>
          </div>

          {/* Problema */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Problema Relatado
            </h2>
            {reclamacao.categorias && (
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm mb-3">
                {reclamacao.categorias.nome}
              </span>
            )}
            <p className="text-foreground">{reclamacao.descricao}</p>
          </div>

          {/* Mídia */}
          {(reclamacao.fotos?.length > 0 || reclamacao.videos?.length > 0) && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="font-semibold text-foreground mb-4">Mídia Anexada</h2>
              {reclamacao.fotos?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Image className="w-4 h-4" /> Fotos ({reclamacao.fotos.length})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {reclamacao.fotos.map((foto, i) => (
                      <a key={i} href={foto} target="_blank" rel="noopener noreferrer">
                        <img src={foto} alt={`Foto ${i + 1}`} className="w-full h-32 object-cover rounded-lg" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {reclamacao.videos?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Video className="w-4 h-4" /> Vídeos ({reclamacao.videos.length})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {reclamacao.videos.map((video, i) => (
                      <VideoThumbnail
                        key={i}
                        videoUrl={video}
                        index={i}
                        onClick={() => setSelectedVideo(video)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Modal */}
          <VideoModal
            videoUrl={selectedVideo || ""}
            isOpen={!!selectedVideo}
            onClose={() => setSelectedVideo(null)}
            title={`Vídeo - ${reclamacao.protocolo}`}
          />

          {/* Resposta */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Resposta ao Cidadão
            </h2>
            <Textarea
              placeholder="Digite uma resposta para o cidadão..."
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cidadão */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4">Dados do Cidadão</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">{reclamacao.nome_cidadao}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <a href={`mailto:${reclamacao.email_cidadao}`} className="text-primary hover:underline">
                  {reclamacao.email_cidadao}
                </a>
              </div>
              {reclamacao.telefone_cidadao && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <a href={`tel:${reclamacao.telefone_cidadao}`} className="text-primary hover:underline">
                    {reclamacao.telefone_cidadao}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {new Date(reclamacao.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Status Update */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4">Atualizar Status</h2>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recebida">Recebida</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="resolvida">Resolvida</SelectItem>
                <SelectItem value="arquivada">Arquivada</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>

          {/* Histórico */}
          {historico.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="font-semibold text-foreground mb-4">Histórico</h2>
              <div className="space-y-3">
                {historico.map((item) => (
                  <div key={item.id} className="text-sm border-l-2 border-border pl-3">
                    <p className="text-foreground">
                      {statusConfig[item.status_novo]?.label || item.status_novo}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PainelReclamacaoDetalhe;
