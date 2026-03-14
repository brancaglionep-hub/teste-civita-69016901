import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import EvolutionQrConnect from "@/components/painel/integracoes/EvolutionQrConnect";

interface PrefeituraData {
  slug: string;
  evolution_connected: boolean;
  evolution_phone: string | null;
}

interface OutletContextType {
  prefeitura: { id: string; nome: string } | null;
  prefeituraId: string;
}

const PainelIntegracoes = () => {
  const { prefeituraId } = useOutletContext<OutletContextType>();
  const [prefeituraData, setPrefeituraData] = useState<PrefeituraData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (prefeituraId) {
      fetchData();
    }
  }, [prefeituraId]);

  const fetchData = async () => {
    try {
      const { data: prefeitura } = await supabase
        .from("prefeituras")
        .select("slug, evolution_connected, evolution_phone")
        .eq("id", prefeituraId)
        .single();

      if (prefeitura) {
        setPrefeituraData({
          slug: prefeitura.slug,
          evolution_connected: prefeitura.evolution_connected || false,
          evolution_phone: prefeitura.evolution_phone,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground">
          Conecte seu WhatsApp para receber reclamações automaticamente
        </p>
      </div>

      {prefeituraData && (
        <EvolutionQrConnect 
          prefeituraId={prefeituraId}
          prefeituraSlug={prefeituraData.slug}
          evolutionConnected={prefeituraData.evolution_connected}
          evolutionPhone={prefeituraData.evolution_phone}
          onConfigUpdate={fetchData}
        />
      )}
    </div>
  );
};

export default PainelIntegracoes;
