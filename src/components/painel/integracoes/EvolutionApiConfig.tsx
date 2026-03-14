import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Wifi, 
  WifiOff, 
  Save, 
  RefreshCw, 
  Loader2,
  CheckCircle,
  XCircle,
  Smartphone,
  Settings,
  Link
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EvolutionConfig {
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  evolution_connected: boolean;
  evolution_phone: string | null;
}

interface EvolutionApiConfigProps {
  prefeituraId: string;
  config: EvolutionConfig;
  onConfigUpdate: () => void;
}

interface QrCodeData {
  base64?: string;
  code?: string;
}

interface ConnectionState {
  state: string;
  statusReason?: number;
}

const WEBHOOK_URL = "https://sfsjtljhrelctpxpzody.supabase.co/functions/v1/receive-evolution-webhook";
const PROXY_URL = "https://sfsjtljhrelctpxpzody.supabase.co/functions/v1/evolution-api-proxy";

const EvolutionApiConfig = ({ prefeituraId, config, onConfigUpdate }: EvolutionApiConfigProps) => {
  const [apiUrl, setApiUrl] = useState(config.evolution_api_url || "");
  const [apiKey, setApiKey] = useState(config.evolution_api_key || "");
  const [instanceName, setInstanceName] = useState(config.evolution_instance_name || "");
  const [saving, setSaving] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [qrCode, setQrCode] = useState<QrCodeData | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [validatingUrl, setValidatingUrl] = useState(false);

  const cleanEvolutionUrl = (url: string): string => {
    let cleanUrl = url.trim().replace(/\/$/, "");
    // Remove /manager suffix if present (that's the web UI, not the API)
    if (cleanUrl.endsWith("/manager")) {
      cleanUrl = cleanUrl.slice(0, -8);
    }
    return cleanUrl;
  };

  const validateEvolutionUrl = async (url: string, key: string): Promise<{ valid: boolean; error?: string; cleanedUrl?: string }> => {
    try {
      // Validate URL format
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url)) {
        return { valid: false, error: "URL inválida. Deve começar com http:// ou https://" };
      }

      // Clean the URL (remove trailing slash and /manager suffix)
      const cleanUrl = cleanEvolutionUrl(url);

      // Test connection to Evolution API
      const response = await fetch(`${cleanUrl}/instance/fetchInstances`, {
        method: "GET",
        headers: {
          "apikey": key,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.status === 401) {
        return { valid: false, error: "API Key inválida ou sem permissão" };
      }

      if (!response.ok) {
        return { valid: false, error: `Erro de conexão: ${response.status}` };
      }

      return { valid: true, cleanedUrl: cleanUrl };
    } catch (error) {
      console.error("Erro ao validar URL:", error);
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        return { valid: false, error: "Não foi possível conectar. Verifique a URL e se o servidor está acessível." };
      }
      if (error instanceof DOMException && error.name === "TimeoutError") {
        return { valid: false, error: "Tempo limite excedido. O servidor não respondeu." };
      }
      return { valid: false, error: "Erro ao validar URL. Verifique se está correta." };
    }
  };

  const saveConfig = async () => {
    if (!apiUrl.trim() || !apiKey.trim() || !instanceName.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSaving(true);
    setValidatingUrl(true);

    try {
      // Validate URL and API key first
      toast.info("Validando conexão com a Evolution API...");
      const validation = await validateEvolutionUrl(apiUrl.trim(), apiKey.trim());

      if (!validation.valid) {
        toast.error(validation.error || "URL inválida");
        return;
      }

      toast.success("Conexão validada!");

      // Use cleaned URL if available
      const urlToSave = validation.cleanedUrl || apiUrl.replace(/\/$/, "");
      
      const { error } = await supabase
        .from("prefeituras")
        .update({
          evolution_api_url: urlToSave,
          evolution_api_key: apiKey,
          evolution_instance_name: instanceName,
        })
        .eq("id", prefeituraId);

      if (error) throw error;

      toast.success("Configuração salva com sucesso!");
      onConfigUpdate();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
      setValidatingUrl(false);
    }
  };

  const callEvolutionProxy = async (endpoint: string, method = "GET", body?: object) => {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefeituraId,
        endpoint,
        method,
        body,
      }),
    });
    return response;
  };

  const checkConnectionSilent = useCallback(async () => {
    if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
      return false;
    }

    try {
      const response = await callEvolutionProxy(
        `/instance/connectionState/{instanceName}`
      );

      const data = await response.json();
      
      if (!response.ok) {
        return false;
      }

      const isConnected = data.instance?.state === "open" || data.state === "open";

      if (isConnected) {
        setQrCode(null);
        setConnectionState(data.instance || data);
        toast.success("WhatsApp conectado com sucesso!");
        onConfigUpdate();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
      return false;
    }
  }, [config.evolution_api_url, config.evolution_api_key, config.evolution_instance_name, onConfigUpdate]);

  // Auto-check connection every 30 seconds when QR code is displayed
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (qrCode?.base64 && !config.evolution_connected) {
      // Start polling
      pollingRef.current = setInterval(async () => {
        const connected = await checkConnectionSilent();
        if (connected && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }, 30000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [qrCode?.base64, config.evolution_connected, checkConnectionSilent]);

  const checkConnection = async () => {
    if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
      toast.error("Salve a configuração primeiro");
      return;
    }

    setCheckingConnection(true);
    setConnectionState(null);

    try {
      const response = await callEvolutionProxy(
        `/instance/connectionState/{instanceName}`
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erro ao verificar conexão");
      }

      setConnectionState(data.instance || data);

      const isConnected = data.instance?.state === "open" || data.state === "open";

      if (isConnected) {
        setQrCode(null);
        toast.success("WhatsApp conectado!");
      } else {
        toast.info("WhatsApp não conectado. Escaneie o QR Code.");
      }

      onConfigUpdate();
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
      toast.error("Erro ao verificar conexão. Verifique a URL e API Key.");
    } finally {
      setCheckingConnection(false);
    }
  };

  const fetchQrCode = async () => {
    if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
      toast.error("Salve a configuração primeiro");
      return;
    }

    setLoadingQr(true);
    setQrCode(null);

    try {
      // First check if instance exists, if not create it
      const instanceResponse = await callEvolutionProxy(`/instance/fetchInstances`);

      if (instanceResponse.ok) {
        const instances = await instanceResponse.json();
        const instanceExists = Array.isArray(instances) && instances.some((i: { name: string }) => i.name === config.evolution_instance_name);

        if (!instanceExists) {
          // Create instance
          const createResponse = await callEvolutionProxy(
            `/instance/create`,
            "POST",
            {
              instanceName: config.evolution_instance_name,
              qrcode: true,
            }
          );

          const createData = await createResponse.json();
          
          if (!createResponse.ok) {
            throw new Error(createData.error || "Erro ao criar instância");
          }

          if (createData.qrcode?.base64) {
            setQrCode({ base64: createData.qrcode.base64 });
            toast.success("Instância criada! Escaneie o QR Code.");
            setLoadingQr(false);
            return;
          }
        }
      }

      // Connect instance to get QR code
      const connectResponse = await callEvolutionProxy(`/instance/connect/{instanceName}`);
      const data = await connectResponse.json();

      if (!connectResponse.ok) {
        throw new Error(data.error || "Erro ao conectar instância");
      }
      
      if (data.base64 || data.qrcode?.base64) {
        setQrCode({ base64: data.base64 || data.qrcode?.base64 });
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else if (data.instance?.state === "open") {
        toast.success("WhatsApp já está conectado!");
        onConfigUpdate();
      } else {
        toast.info("Aguarde um momento e tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao buscar QR Code:", error);
      toast.error("Erro ao gerar QR Code. Verifique as configurações.");
    } finally {
      setLoadingQr(false);
    }
  };

  const configureWebhook = async () => {
    if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
      toast.error("Salve a configuração primeiro");
      return;
    }

    setConfiguringWebhook(true);
    setWebhookConfigured(false);

    try {
      const response = await callEvolutionProxy(
        `/webhook/set/{instanceName}`,
        "POST",
        {
          url: WEBHOOK_URL,
          webhook_by_events: true,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT"],
          ignore_groups: true,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao configurar webhook");
      }

      setWebhookConfigured(true);
      toast.success("Webhook configurado com sucesso! O sistema agora receberá mensagens automaticamente.");
    } catch (error) {
      console.error("Erro ao configurar webhook:", error);
      toast.error("Erro ao configurar webhook. Verifique as configurações da Evolution API.");
    } finally {
      setConfiguringWebhook(false);
    }
  };

  const isConfigured = config.evolution_api_url && config.evolution_api_key && config.evolution_instance_name;

  return (
    <div className="space-y-4">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Configuração da Evolution API
          </CardTitle>
          <CardDescription>
            Configure sua Evolution API para conectar o WhatsApp diretamente ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">URL da Evolution API</Label>
              <Input
                id="apiUrl"
                placeholder="https://sua-evolution-api.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL do servidor onde a Evolution API está hospedada
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Sua chave de API"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Chave de autenticação da Evolution API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instanceName">Nome da Instância</Label>
              <Input
                id="instanceName"
                placeholder="prefeitura-exemplo"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                Nome único para a instância do WhatsApp (apenas letras, números e hífens)
              </p>
            </div>

            <div className="flex items-end">
              <Button onClick={saveConfig} disabled={saving || validatingUrl} className="w-full">
                {saving || validatingUrl ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {validatingUrl ? "Validando..." : "Salvar Configuração"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status Card */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Status da Conexão
              </span>
              <Badge 
                variant={config.evolution_connected ? "default" : "secondary"}
                className="gap-1"
              >
                {config.evolution_connected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    Conectado
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Desconectado
                  </>
                )}
              </Badge>
            </CardTitle>
            <CardDescription>
              {config.evolution_connected 
                ? "Seu WhatsApp está conectado e pronto para receber mensagens"
                : "Escaneie o QR Code com seu WhatsApp para conectar"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={checkConnection}
                disabled={checkingConnection}
              >
                {checkingConnection ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Verificar Conexão
              </Button>
              
              {!config.evolution_connected && (
                <Button onClick={fetchQrCode} disabled={loadingQr}>
                  {loadingQr ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4 mr-2" />
                  )}
                  Gerar QR Code
                </Button>
              )}
            </div>

            {connectionState && (
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-2">
                  {connectionState.state === "open" ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="font-medium">
                    Estado: {connectionState.state === "open" ? "Conectado" : connectionState.state}
                  </span>
                </div>
              </div>
            )}

            {qrCode?.base64 && !config.evolution_connected && (
              <div className="flex flex-col items-center p-6 bg-white rounded-lg border">
                <img 
                  src={qrCode.base64.startsWith("data:") ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64"
                />
                <p className="mt-4 text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no seu celular → Configurações → Dispositivos conectados → Conectar dispositivo
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={fetchQrCode}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar QR Code
                </Button>
              </div>
            )}

            {config.evolution_phone && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm">
                  <strong>Telefone conectado:</strong> {config.evolution_phone}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Webhook Configuration Card */}
      {isConfigured && config.evolution_connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                Configuração do Webhook
              </span>
              {webhookConfigured && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Configurado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Configure o webhook para receber mensagens automaticamente e processá-las como reclamações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted space-y-2">
              <p className="text-sm font-medium">URL do Webhook:</p>
              <code className="text-xs break-all">{WEBHOOK_URL}</code>
            </div>

            <Button
              onClick={configureWebhook}
              disabled={configuringWebhook}
              className="w-full"
            >
              {configuringWebhook ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              Configurar Webhook Automaticamente
            </Button>

            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Como funciona:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Cidadãos enviam mensagens para o WhatsApp conectado</li>
                <li>Para registrar uma reclamação, devem enviar: <code className="bg-muted px-1 rounded">/reclamar [descrição]</code></li>
                <li>O sistema cria a reclamação e responde com o protocolo</li>
                <li>Mensagens normais recebem instruções de como usar o sistema</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Como Configurar a Evolution API</CardTitle>
          <CardDescription>
            Siga estes passos para configurar a integração com WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium">Instale a Evolution API</h4>
                <p className="text-sm text-muted-foreground">
                  Faça o deploy da Evolution API em um servidor VPS ou Docker. 
                  <a 
                    href="https://doc.evolution-api.com/v2/pt/get-started/introduction" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline ml-1"
                  >
                    Ver documentação
                  </a>
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium">Configure as credenciais</h4>
                <p className="text-sm text-muted-foreground">
                  Insira a URL, API Key e nome da instância nos campos acima e clique em salvar.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium">Escaneie o QR Code</h4>
                <p className="text-sm text-muted-foreground">
                  Clique em "Gerar QR Code" e escaneie com o WhatsApp do celular que receberá as mensagens.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h4 className="font-medium">Configure o Webhook</h4>
                <p className="text-sm text-muted-foreground">
                  Após conectar, clique em "Configurar Webhook Automaticamente" para ativar o recebimento de mensagens.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvolutionApiConfig;
