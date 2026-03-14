import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Save, Upload, Building2, ImageIcon, Bell, Clock, Shield, 
  FileText, Star, Users, Settings, ChevronDown, ChevronUp,
  Mail, MessageSquare, AlertTriangle, Camera, Video, Paperclip
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";

interface OutletContext {
  prefeitura: { id: string; nome: string; cidade: string } | null;
  prefeituraId: string;
}

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  texto_institucional: string | null;
  email_contato: string | null;
  telefone_contato: string | null;
  imagem_capa_url: string | null;
}

interface Configuracoes {
  id?: string;
  prefeitura_id: string;
  // SLA
  sla_padrao_dias: number;
  sla_alerta_percentual: number;
  sla_alertas_ativos: boolean;
  // Media
  exigir_foto_padrao: boolean;
  permitir_video: boolean;
  limite_imagens: number;
  permitir_anexo: boolean;
  // Notifications
  notif_email_ativo: boolean;
  notif_whatsapp_ativo: boolean;
  notif_sistema_ativo: boolean;
  notif_ao_criar: boolean;
  notif_ao_mudar_status: boolean;
  notif_sla_proximo: boolean;
  notif_ao_concluir: boolean;
  // Evaluation
  avaliacao_nota_destaque: number;
  avaliacao_comentarios_publicos: boolean;
  avaliacao_permitir_resposta: boolean;
  avaliacao_obrigatoria: boolean;
  // LGPD
  lgpd_texto_consentimento: string;
  lgpd_anonimizar_relatorios: boolean;
  lgpd_retencao_anos: number;
}

const defaultConfiguracoes: Omit<Configuracoes, 'prefeitura_id'> = {
  sla_padrao_dias: 7,
  sla_alerta_percentual: 80,
  sla_alertas_ativos: true,
  exigir_foto_padrao: false,
  permitir_video: true,
  limite_imagens: 5,
  permitir_anexo: false,
  notif_email_ativo: true,
  notif_whatsapp_ativo: false,
  notif_sistema_ativo: true,
  notif_ao_criar: true,
  notif_ao_mudar_status: true,
  notif_sla_proximo: true,
  notif_ao_concluir: true,
  avaliacao_nota_destaque: 4,
  avaliacao_comentarios_publicos: false,
  avaliacao_permitir_resposta: true,
  avaliacao_obrigatoria: false,
  lgpd_texto_consentimento: 'Ao enviar esta reclamação, você concorda com o tratamento dos seus dados pessoais conforme nossa política de privacidade.',
  lgpd_anonimizar_relatorios: false,
  lgpd_retencao_anos: 5,
};

const PainelConfiguracoes = () => {
  const { prefeituraId } = useOutletContext<OutletContext>();
  const [prefeitura, setPrefeitura] = useState<Prefeitura | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Sections state
  const [openSections, setOpenSections] = useState({
    identidade: true,
    notificacoes: false,
    sla: false,
    midias: false,
    avaliacoes: false,
    lgpd: false,
  });

  const [formData, setFormData] = useState({
    nome: "",
    cidade: "",
    logo_url: "",
    cor_primaria: "#1e40af",
    cor_secundaria: "#3b82f6",
    texto_institucional: "",
    email_contato: "",
    telefone_contato: "",
    imagem_capa_url: ""
  });

  const [config, setConfig] = useState<Configuracoes>({
    ...defaultConfiguracoes,
    prefeitura_id: prefeituraId,
  });

  useEffect(() => {
    const fetchData = async () => {
      const [prefRes, configRes] = await Promise.all([
        supabase
          .from("prefeituras")
          .select("*")
          .eq("id", prefeituraId)
          .single(),
        supabase
          .from("prefeitura_configuracoes")
          .select("*")
          .eq("prefeitura_id", prefeituraId)
          .single(),
      ]);

      if (!prefRes.error && prefRes.data) {
        setPrefeitura(prefRes.data);
        setFormData({
          nome: prefRes.data.nome,
          cidade: prefRes.data.cidade,
          logo_url: prefRes.data.logo_url || "",
          cor_primaria: prefRes.data.cor_primaria || "#1e40af",
          cor_secundaria: prefRes.data.cor_secundaria || "#3b82f6",
          texto_institucional: prefRes.data.texto_institucional || "",
          email_contato: prefRes.data.email_contato || "",
          telefone_contato: prefRes.data.telefone_contato || "",
          imagem_capa_url: prefRes.data.imagem_capa_url || ""
        });
      }

      if (!configRes.error && configRes.data) {
        setConfig(configRes.data as unknown as Configuracoes);
      }

      setLoading(false);
    };

    if (prefeituraId) {
      fetchData();
    }
  }, [prefeituraId]);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Save prefeitura data
      const { error: prefError } = await supabase
        .from("prefeituras")
        .update({
          nome: formData.nome,
          cidade: formData.cidade,
          logo_url: formData.logo_url || null,
          cor_primaria: formData.cor_primaria,
          cor_secundaria: formData.cor_secundaria,
          texto_institucional: formData.texto_institucional || null,
          email_contato: formData.email_contato || null,
          telefone_contato: formData.telefone_contato || null,
          imagem_capa_url: formData.imagem_capa_url || null
        })
        .eq("id", prefeituraId);

      if (prefError) throw prefError;

      // Save or create configurations
      const configData = {
        prefeitura_id: prefeituraId,
        sla_padrao_dias: config.sla_padrao_dias,
        sla_alerta_percentual: config.sla_alerta_percentual,
        sla_alertas_ativos: config.sla_alertas_ativos,
        exigir_foto_padrao: config.exigir_foto_padrao,
        permitir_video: config.permitir_video,
        limite_imagens: config.limite_imagens,
        permitir_anexo: config.permitir_anexo,
        notif_email_ativo: config.notif_email_ativo,
        notif_whatsapp_ativo: config.notif_whatsapp_ativo,
        notif_sistema_ativo: config.notif_sistema_ativo,
        notif_ao_criar: config.notif_ao_criar,
        notif_ao_mudar_status: config.notif_ao_mudar_status,
        notif_sla_proximo: config.notif_sla_proximo,
        notif_ao_concluir: config.notif_ao_concluir,
        avaliacao_nota_destaque: config.avaliacao_nota_destaque,
        avaliacao_comentarios_publicos: config.avaliacao_comentarios_publicos,
        avaliacao_permitir_resposta: config.avaliacao_permitir_resposta,
        avaliacao_obrigatoria: config.avaliacao_obrigatoria,
        lgpd_texto_consentimento: config.lgpd_texto_consentimento,
        lgpd_anonimizar_relatorios: config.lgpd_anonimizar_relatorios,
        lgpd_retencao_anos: config.lgpd_retencao_anos,
      };

      const { error: configError } = await supabase
        .from("prefeitura_configuracoes")
        .upsert(configData, { onConflict: 'prefeitura_id' });

      if (configError) throw configError;

      toast({ title: "Configurações salvas com sucesso!" });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }

    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `logos/${prefeituraId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("reclamacoes-media")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro ao fazer upload", variant: "destructive" });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("reclamacoes-media")
      .getPublicUrl(filePath);

    setFormData({ ...formData, logo_url: publicUrl });
    toast({ title: "Logo enviado! Clique em Salvar para aplicar." });
  };

  const handleCapaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `capas/${prefeituraId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("reclamacoes-media")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro ao fazer upload", variant: "destructive" });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("reclamacoes-media")
      .getPublicUrl(filePath);

    setFormData({ ...formData, imagem_capa_url: publicUrl });
    toast({ title: "Imagem de capa enviada! Clique em Salvar para aplicar." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground mt-1">Personalize sua prefeitura</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Tudo"}
        </Button>
      </div>

      <div className="space-y-4">
        {/* 1. IDENTIDADE */}
        <Collapsible open={openSections.identidade} onOpenChange={() => toggleSection('identidade')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Identidade da Prefeitura</CardTitle>
                      <CardDescription>Logo, cores e informações básicas</CardDescription>
                    </div>
                  </div>
                  {openSections.identidade ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Basic Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Prefeitura</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Texto Institucional</Label>
                  <Textarea
                    placeholder="Texto que aparecerá no site público..."
                    value={formData.texto_institucional}
                    onChange={(e) => setFormData({ ...formData, texto_institucional: e.target.value })}
                    rows={3}
                  />
                </div>

                <Separator />

                {/* Logo */}
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-lg border" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">Enviar Logo</span>
                      </div>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.cor_primaria}
                        onChange={(e) => setFormData({ ...formData, cor_primaria: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={formData.cor_primaria}
                        onChange={(e) => setFormData({ ...formData, cor_primaria: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.cor_secundaria}
                        onChange={(e) => setFormData({ ...formData, cor_secundaria: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={formData.cor_secundaria}
                        onChange={(e) => setFormData({ ...formData, cor_secundaria: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Cover Image */}
                <div className="space-y-2">
                  <Label>Imagem de Capa</Label>
                  <p className="text-sm text-muted-foreground">Aparece na página inicial da prefeitura</p>
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {formData.imagem_capa_url ? (
                      <img src={formData.imagem_capa_url} alt="Capa" className="w-full sm:w-48 h-32 object-cover rounded-lg border" />
                    ) : (
                      <div className="w-full sm:w-48 h-32 rounded-lg bg-muted flex items-center justify-center border border-dashed">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                          <Upload className="w-4 h-4" />
                          <span className="text-sm">Enviar Capa</span>
                        </div>
                        <input type="file" accept="image/*" onChange={handleCapaUpload} className="hidden" />
                      </label>
                      {formData.imagem_capa_url && (
                        <Button variant="outline" size="sm" onClick={() => setFormData({ ...formData, imagem_capa_url: "" })}>
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>E-mail de Contato</Label>
                    <Input
                      type="email"
                      placeholder="contato@prefeitura.gov.br"
                      value={formData.email_contato}
                      onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone de Contato</Label>
                    <Input
                      placeholder="(48) 3333-3333"
                      value={formData.telefone_contato}
                      onChange={(e) => setFormData({ ...formData, telefone_contato: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 2. NOTIFICAÇÕES */}
        <Collapsible open={openSections.notificacoes} onOpenChange={() => toggleSection('notificacoes')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-amber-500" />
                    <div>
                      <CardTitle className="text-lg">Notificações</CardTitle>
                      <CardDescription>Configure quando e como notificar cidadãos</CardDescription>
                    </div>
                  </div>
                  {openSections.notificacoes ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Channels */}
                <div>
                  <h4 className="font-medium mb-3">Canais de Notificação</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium">E-mail</p>
                          <p className="text-sm text-muted-foreground">Enviar notificações por e-mail</p>
                        </div>
                      </div>
                      <Switch
                        checked={config.notif_email_ativo}
                        onCheckedChange={(checked) => setConfig({ ...config, notif_email_ativo: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="font-medium">WhatsApp</p>
                          <p className="text-sm text-muted-foreground">Enviar notificações por WhatsApp</p>
                        </div>
                      </div>
                      <Switch
                        checked={config.notif_whatsapp_ativo}
                        onCheckedChange={(checked) => setConfig({ ...config, notif_whatsapp_ativo: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="font-medium">Sistema</p>
                          <p className="text-sm text-muted-foreground">Notificações internas do painel</p>
                        </div>
                      </div>
                      <Switch
                        checked={config.notif_sistema_ativo}
                        onCheckedChange={(checked) => setConfig({ ...config, notif_sistema_ativo: checked })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* When to notify */}
                <div>
                  <h4 className="font-medium mb-3">Quando Notificar</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <span>Ao criar reclamação</span>
                      <Switch
                        checked={config.notif_ao_criar}
                        onCheckedChange={(checked) => setConfig({ ...config, notif_ao_criar: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <span>Ao mudar status</span>
                      <Switch
                        checked={config.notif_ao_mudar_status}
                        onCheckedChange={(checked) => setConfig({ ...config, notif_ao_mudar_status: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <span>SLA próximo do vencimento</span>
                      <Switch
                        checked={config.notif_sla_proximo}
                        onCheckedChange={(checked) => setConfig({ ...config, notif_sla_proximo: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <span>Ao concluir reclamação</span>
                      <Switch
                        checked={config.notif_ao_concluir}
                        onCheckedChange={(checked) => setConfig({ ...config, notif_ao_concluir: checked })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 3. SLA */}
        <Collapsible open={openSections.sla} onOpenChange={() => toggleSection('sla')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <div>
                      <CardTitle className="text-lg">Configurações de SLA</CardTitle>
                      <CardDescription>Prazos padrão e alertas de vencimento</CardDescription>
                    </div>
                  </div>
                  {openSections.sla ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SLA Padrão (dias)</Label>
                    <p className="text-sm text-muted-foreground">Prazo padrão para resolução de reclamações</p>
                    <Select
                      value={String(config.sla_padrao_dias)}
                      onValueChange={(v) => setConfig({ ...config, sla_padrao_dias: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 dias</SelectItem>
                        <SelectItem value="5">5 dias</SelectItem>
                        <SelectItem value="7">7 dias</SelectItem>
                        <SelectItem value="10">10 dias</SelectItem>
                        <SelectItem value="14">14 dias</SelectItem>
                        <SelectItem value="30">30 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Alerta de SLA (%)</Label>
                    <p className="text-sm text-muted-foreground">Avisar quando atingir este percentual do prazo</p>
                    <Select
                      value={String(config.sla_alerta_percentual)}
                      onValueChange={(v) => setConfig({ ...config, sla_alerta_percentual: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="70">70%</SelectItem>
                        <SelectItem value="80">80%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Alertas de SLA Ativos</p>
                    <p className="text-sm text-muted-foreground">Exibir alertas visuais quando SLA estiver próximo</p>
                  </div>
                  <Switch
                    checked={config.sla_alertas_ativos}
                    onCheckedChange={(checked) => setConfig({ ...config, sla_alertas_ativos: checked })}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 4. MÍDIAS */}
        <Collapsible open={openSections.midias} onOpenChange={() => toggleSection('midias')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5 text-green-500" />
                    <div>
                      <CardTitle className="text-lg">Mídias e Anexos</CardTitle>
                      <CardDescription>Regras para fotos, vídeos e anexos</CardDescription>
                    </div>
                  </div>
                  {openSections.midias ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Exigir foto por padrão</p>
                      <p className="text-sm text-muted-foreground">Foto obrigatória ao criar reclamação</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.exigir_foto_padrao}
                    onCheckedChange={(checked) => setConfig({ ...config, exigir_foto_padrao: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Permitir vídeo</p>
                      <p className="text-sm text-muted-foreground">Cidadãos podem enviar vídeos</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.permitir_video}
                    onCheckedChange={(checked) => setConfig({ ...config, permitir_video: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Paperclip className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Permitir anexos</p>
                      <p className="text-sm text-muted-foreground">Documentos PDF, etc.</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.permitir_anexo}
                    onCheckedChange={(checked) => setConfig({ ...config, permitir_anexo: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Limite de Imagens</Label>
                  <Select
                    value={String(config.limite_imagens)}
                    onValueChange={(v) => setConfig({ ...config, limite_imagens: parseInt(v) })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 imagem</SelectItem>
                      <SelectItem value="3">3 imagens</SelectItem>
                      <SelectItem value="5">5 imagens</SelectItem>
                      <SelectItem value="10">10 imagens</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 5. AVALIAÇÕES */}
        <Collapsible open={openSections.avaliacoes} onOpenChange={() => toggleSection('avaliacoes')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-amber-500" />
                    <div>
                      <CardTitle className="text-lg">Avaliações</CardTitle>
                      <CardDescription>Regras de exibição e feedback</CardDescription>
                    </div>
                  </div>
                  {openSections.avaliacoes ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nota mínima para destaque</Label>
                  <p className="text-sm text-muted-foreground">Avaliações com essa nota ou maior serão destacadas</p>
                  <Select
                    value={String(config.avaliacao_nota_destaque)}
                    onValueChange={(v) => setConfig({ ...config, avaliacao_nota_destaque: parseInt(v) })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">⭐ 3+</SelectItem>
                      <SelectItem value="4">⭐ 4+</SelectItem>
                      <SelectItem value="5">⭐ 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Comentários públicos</p>
                    <p className="text-sm text-muted-foreground">Exibir comentários no site público</p>
                  </div>
                  <Switch
                    checked={config.avaliacao_comentarios_publicos}
                    onCheckedChange={(checked) => setConfig({ ...config, avaliacao_comentarios_publicos: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Permitir resposta da prefeitura</p>
                    <p className="text-sm text-muted-foreground">Prefeitura pode responder avaliações</p>
                  </div>
                  <Switch
                    checked={config.avaliacao_permitir_resposta}
                    onCheckedChange={(checked) => setConfig({ ...config, avaliacao_permitir_resposta: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Avaliação obrigatória</p>
                    <p className="text-sm text-muted-foreground">Solicitar avaliação após conclusão</p>
                  </div>
                  <Switch
                    checked={config.avaliacao_obrigatoria}
                    onCheckedChange={(checked) => setConfig({ ...config, avaliacao_obrigatoria: checked })}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 6. LGPD */}
        <Collapsible open={openSections.lgpd} onOpenChange={() => toggleSection('lgpd')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-red-500" />
                    <div>
                      <CardTitle className="text-lg">LGPD e Privacidade</CardTitle>
                      <CardDescription>Consentimento e retenção de dados</CardDescription>
                    </div>
                  </div>
                  {openSections.lgpd ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Texto de Consentimento</Label>
                  <p className="text-sm text-muted-foreground">Exibido ao cidadão antes de enviar reclamação</p>
                  <Textarea
                    value={config.lgpd_texto_consentimento}
                    onChange={(e) => setConfig({ ...config, lgpd_texto_consentimento: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Anonimizar relatórios</p>
                    <p className="text-sm text-muted-foreground">Ocultar dados pessoais em exportações</p>
                  </div>
                  <Switch
                    checked={config.lgpd_anonimizar_relatorios}
                    onCheckedChange={(checked) => setConfig({ ...config, lgpd_anonimizar_relatorios: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Retenção de Dados</Label>
                  <p className="text-sm text-muted-foreground">Período de armazenamento de dados pessoais</p>
                  <Select
                    value={String(config.lgpd_retencao_anos)}
                    onValueChange={(v) => setConfig({ ...config, lgpd_retencao_anos: parseInt(v) })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Nunca (manter indefinidamente)</SelectItem>
                      <SelectItem value="1">1 ano</SelectItem>
                      <SelectItem value="2">2 anos</SelectItem>
                      <SelectItem value="3">3 anos</SelectItem>
                      <SelectItem value="5">5 anos</SelectItem>
                      <SelectItem value="10">10 anos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-700">Importante</p>
                      <p className="text-sm text-amber-600">
                        Essas configurações ajudam na conformidade com a LGPD, mas é recomendável consultar um especialista jurídico para garantir adequação completa.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
};

export default PainelConfiguracoes;
