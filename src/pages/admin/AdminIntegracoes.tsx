import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Smartphone, 
  Save, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EvolutionConfig {
  url: string | null;
  api_key: string | null;
}

const AdminIntegracoes = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [config, setConfig] = useState<EvolutionConfig>({
    url: "",
    api_key: ""
  });
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes_sistema")
        .select("valor")
        .eq("chave", "evolution_api")
        .single();

      if (error) throw error;

      if (data?.valor) {
        const valor = data.valor as unknown as EvolutionConfig;
        setConfig({
          url: valor.url || "",
          api_key: valor.api_key || ""
        });
        setIsConfigured(!!valor.url && !!valor.api_key);
      }
    } catch (error) {
      console.error("Erro ao carregar configuração:", error);
    } finally {
      setLoading(false);
    }
  };

  const cleanEvolutionUrl = (url: string): string => {
    let cleanUrl = url.trim().replace(/\/$/, "");
    if (cleanUrl.endsWith("/manager")) {
      cleanUrl = cleanUrl.slice(0, -8);
    }
    return cleanUrl;
  };

  const validateConnection = async (url: string, key: string): Promise<{ valid: boolean; error?: string }> => {
    try {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url)) {
        return { valid: false, error: "URL inválida. Deve começar com http:// ou https://" };
      }

      const cleanUrl = cleanEvolutionUrl(url);

      const response = await fetch(`${cleanUrl}/instance/fetchInstances`, {
        method: "GET",
        headers: {
          "apikey": key,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 401) {
        return { valid: false, error: "API Key inválida ou sem permissão" };
      }

      if (!response.ok) {
        return { valid: false, error: `Erro de conexão: ${response.status}` };
      }

      return { valid: true };
    } catch (error) {
      console.error("Erro ao validar:", error);
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        return { valid: false, error: "Não foi possível conectar. Verifique a URL e se o servidor está acessível." };
      }
      if (error instanceof DOMException && error.name === "TimeoutError") {
        return { valid: false, error: "Tempo limite excedido. O servidor não respondeu." };
      }
      return { valid: false, error: "Erro ao validar conexão." };
    }
  };

  const handleSave = async () => {
    if (!config.url?.trim() || !config.api_key?.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSaving(true);
    setValidating(true);

    try {
      toast.info("Validando conexão com a Evolution API...");
      const validation = await validateConnection(config.url.trim(), config.api_key.trim());

      if (!validation.valid) {
        toast.error(validation.error || "URL inválida");
        return;
      }

      toast.success("Conexão validada!");

      const cleanUrl = cleanEvolutionUrl(config.url.trim());

      const { error } = await supabase
        .from("configuracoes_sistema")
        .update({
          valor: {
            url: cleanUrl,
            api_key: config.api_key.trim()
          }
        })
        .eq("chave", "evolution_api");

      if (error) throw error;

      setConfig(prev => ({ ...prev, url: cleanUrl }));
      setIsConfigured(true);
      toast.success("Configuração salva com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground mt-1">
          Configure as integrações globais do sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              <CardTitle>Evolution API</CardTitle>
            </div>
            <Badge variant={isConfigured ? "default" : "secondary"} className="gap-1">
              {isConfigured ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Configurada
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Não configurada
                </>
              )}
            </Badge>
          </div>
          <CardDescription>
            Configure a Evolution API para permitir que as prefeituras conectem seus WhatsApp via QR Code.
            Esta configuração é compartilhada por todas as prefeituras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">URL da Evolution API</Label>
              <Input
                id="apiUrl"
                placeholder="https://sua-evolution-api.com"
                value={config.url || ""}
                onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                URL do servidor onde a Evolution API está hospedada
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key Global</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder="Sua chave de API"
                  value={config.api_key || ""}
                  onChange={(e) => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Chave de autenticação da Evolution API (será usada por todas as prefeituras)
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving || validating}>
              {saving || validating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {validating ? "Validando..." : "Salvar Configuração"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIntegracoes;
