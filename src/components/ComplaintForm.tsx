import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Send, CheckCircle2, Pencil, Building2, Loader2, AlertTriangle } from "lucide-react";
import StepIndicator from "./StepIndicator";
import LocationPicker from "./LocationPicker";
import ProblemTypeSelector from "./ProblemTypeSelector";
import MediaUpload from "./MediaUpload";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PrefeituraConfig } from "@/hooks/usePrefeituraConfig";
import { Checkbox } from "@/components/ui/checkbox";

const PREFEITURA_ID = "fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7";

// Mapeamento de tipo de problema para categoria_id
const categoriasMap: Record<string, string> = {
  buraco: "8f2d827f-5443-4295-b2df-e74c1560c625",
  danificada: "56fdd1de-3d07-4573-b7a8-229e9513576f",
  alagada: "a9debd9c-6c7e-4bd9-99b1-5443573570bb",
  desnivel: "e470a352-f7d0-4e17-aa6e-a114c4f2216e",
  dificil: "672d8638-481d-488e-b6c1-4661c6bd21a4",
  outro: "0d5f7468-9dad-4a5e-bca2-698d0029280e"
};

interface FormData {
  nome: string;
  email: string;
  telefone: string;
  bairro: string;
  rua: string;
  numero: string;
  referencia: string;
  tipoProblema: string;
  outroProblema: string;
  descricao: string;
  fotos: File[];
  videos: File[];
  localizacao: { lat: number; lng: number } | null;
}

interface FormErrors {
  nome?: string;
  email?: string;
  telefone?: string;
  bairro?: string;
}

const stepLabels = ["Dados", "Local", "Problema", "Detalhes", "Mídia", "Enviar"];

const problemLabels: Record<string, string> = {
  buraco: "Buraco na rua",
  danificada: "Rua danificada",
  alagada: "Rua alagada",
  desnivel: "Desnível na pista",
  dificil: "Rua difícil de trafegar",
  outro: "Outro problema"
};

// Validation functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateName = (name: string): boolean => {
  const trimmed = name.trim();
  // Must have at least 2 words, each with 2+ chars, only letters and spaces
  const nameRegex = /^[A-Za-zÀ-ÿ]{2,}(\s+[A-Za-zÀ-ÿ]{2,})+$/;
  return nameRegex.test(trimmed);
};

const validatePhone = (phone: string): boolean => {
  // Optional, but if filled must be valid
  if (!phone.trim()) return true;
  // Must match (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  const phoneRegex = /^\(\d{2}\)\s?\d{4,5}-\d{4}$/;
  return phoneRegex.test(phone);
};

const formatPhone = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "").slice(0, 11);
  
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

interface ComplaintFormProps {
  onClose: () => void;
  prefeituraId?: string;
  bairroId?: string | null;
  config?: PrefeituraConfig;
}

interface Bairro {
  id: string;
  nome: string;
}

const defaultConfig: PrefeituraConfig = {
  sla_padrao_dias: 7,
  sla_alerta_percentual: 80,
  sla_alertas_ativos: true,
  exigir_foto_padrao: false,
  permitir_video: true,
  limite_imagens: 5,
  permitir_anexo: true,
  notif_email_ativo: true,
  notif_whatsapp_ativo: false,
  notif_sistema_ativo: true,
  notif_ao_criar: true,
  notif_ao_mudar_status: true,
  notif_sla_proximo: true,
  notif_ao_concluir: true,
  avaliacao_nota_destaque: 4,
  avaliacao_comentarios_publicos: true,
  avaliacao_permitir_resposta: true,
  avaliacao_obrigatoria: false,
  lgpd_texto_consentimento: 'Ao enviar esta reclamação, você concorda com o tratamento dos seus dados pessoais conforme nossa política de privacidade.',
  lgpd_anonimizar_relatorios: false,
  lgpd_retencao_anos: 5,
};

const ComplaintForm = ({ onClose, prefeituraId = PREFEITURA_ID, bairroId, config = defaultConfig }: ComplaintFormProps) => {
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [protocolo, setProtocolo] = useState<string>("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [prefeituraCidade, setPrefeituraCidade] = useState<string>("");
  const [lgpdAceito, setLgpdAceito] = useState(true);
  const [showLgpdConfirm, setShowLgpdConfirm] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    email: "",
    telefone: "",
    bairro: "",
    rua: "",
    numero: "",
    referencia: "",
    tipoProblema: "",
    outroProblema: "",
    descricao: "",
    fotos: [],
    videos: [],
    localizacao: null
  });

  // Fetch prefeitura data
  useEffect(() => {
    const fetchPrefeitura = async () => {
      const { data } = await supabase
        .from("prefeituras_publico")
        .select("cidade")
        .eq("id", prefeituraId)
        .single();

      if (data) {
        setPrefeituraCidade(data.cidade);
      }
    };

    if (prefeituraId) {
      fetchPrefeitura();
    }
  }, [prefeituraId]);

  // Fetch bairros for this prefeitura
  useEffect(() => {
    const fetchBairros = async () => {
      const { data, error } = await supabase
        .from("bairros")
        .select("id, nome")
        .eq("prefeitura_id", prefeituraId)
        .eq("ativo", true)
        .order("nome");

      if (!error && data) {
        setBairros(data);
      }
    };

    if (prefeituraId) {
      fetchBairros();
    }
  }, [prefeituraId]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    updateField("telefone", formatted);
  };

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!validateName(formData.nome)) {
      newErrors.nome = "Digite seu nome completo (nome e sobrenome)";
    }
    
    if (!validateEmail(formData.email)) {
      newErrors.email = "Digite um e-mail válido";
    }
    
    if (!validatePhone(formData.telefone)) {
      newErrors.telefone = "Formato: (48) 99999-9999";
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      toast({
        title: "Verifique os campos",
        description: "Corrija os erros antes de continuar.",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const canAdvance = () => {
    switch (step) {
      case 1:
        return formData.nome.trim() !== "" && formData.email.trim() !== "";
      case 2:
        // Se bairro for "Outro", precisa ter um valor personalizado preenchido
        const bairroValido = formData.bairro !== "" && formData.bairro !== "Outro";
        return bairroValido && formData.rua.trim() !== "";
      case 3:
        return formData.tipoProblema !== "";
      case 5:
        // Se exigir foto, precisa ter pelo menos uma
        if (config.exigir_foto_padrao && formData.fotos.length === 0) {
          return false;
        }
        return true;
      case 6:
        // Precisa aceitar LGPD para enviar
        return lgpdAceito;
      default:
        return true;
    }
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (formData.bairro === "" || formData.bairro === "Outro") {
      newErrors.bairro = "Digite o nome do bairro";
    }
    
    if (formData.rua.trim() === "") {
      // Rua error could be added here too if needed
    }
    
    setErrors((prev) => ({ ...prev, ...newErrors }));
    
    if (Object.keys(newErrors).length > 0) {
      toast({
        title: "Campo obrigatório",
        description: "Preencha o nome do bairro para continuar.",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) return;
    }
    
    if (step === 2) {
      if (!validateStep2()) return;
    }
    
    if (step < 6 && canAdvance()) {
      setStep(step + 1);
    }
  };

  const goToStep = (targetStep: number) => {
    if (targetStep >= 1 && targetStep <= 6) {
      setStep(targetStep);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onClose();
    }
  };

  const uploadMedia = async (files: File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reclamacoes-media')
        .upload(fileName, file);
      
      if (uploadError) {
        console.error('Erro ao fazer upload:', uploadError);
        continue;
      }
      
      const { data: urlData } = supabase.storage
        .from('reclamacoes-media')
        .getPublicUrl(fileName);
      
      if (urlData?.publicUrl) {
        urls.push(urlData.publicUrl);
      }
    }
    
    return urls;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Buscar bairro_id pelo nome (validando que pertence à prefeitura)
      let bairroIdToUse = bairroId;
      
      if (!bairroIdToUse && formData.bairro) {
        // Tentar encontrar o bairro pelo nome na prefeitura atual
        const matchedBairro = bairros.find(b => b.nome === formData.bairro);
        bairroIdToUse = matchedBairro?.id || null;
        
        // Se há bairros cadastrados mas o usuário digitou um que não existe, buscar no banco
        if (!bairroIdToUse && bairros.length === 0) {
          const { data: bairroData } = await supabase
            .from("bairros")
            .select("id")
            .eq("nome", formData.bairro)
            .eq("prefeitura_id", prefeituraId)
            .eq("ativo", true)
            .maybeSingle();
          bairroIdToUse = bairroData?.id || null;
        }
      }

      const categoriaId = categoriasMap[formData.tipoProblema] || categoriasMap.outro;

      // Upload de fotos e vídeos
      const fotoUrls = await uploadMedia(formData.fotos, 'fotos');
      const videoUrls = await uploadMedia(formData.videos, 'videos');

      const { data, error } = await supabase
        .rpc("criar_reclamacao_publica", {
          _prefeitura_id: prefeituraId,
          _nome_cidadao: formData.nome,
          _email_cidadao: formData.email,
          _rua: formData.rua,
          _telefone_cidadao: formData.telefone || null,
          _bairro_id: bairroIdToUse,
          _categoria_id: categoriaId,
          _numero: formData.numero || null,
          _referencia: formData.referencia || null,
          _descricao: formData.descricao || formData.outroProblema || "Sem descrição adicional",
          _localizacao: formData.localizacao ? { lat: formData.localizacao.lat, lng: formData.localizacao.lng } : null,
          _fotos: fotoUrls,
          _videos: videoUrls
        })
        .single();

      if (error) throw error;

      setProtocolo(data.protocolo);
      setIsSubmitted(true);
      
      // Enviar email de confirmação
      try {
        const bairroNome = bairros.find(b => b.id === bairroIdToUse)?.nome || formData.bairro || '';
        const categoriaNome = problemLabels[formData.tipoProblema] || 'Outro problema';
        
        await supabase.functions.invoke('send-complaint-confirmation', {
          body: {
            to_email: formData.email,
            nome_cidadao: formData.nome,
            protocolo: data.protocolo,
            rua: formData.rua,
            bairro: bairroNome,
            categoria: categoriaNome,
            prefeitura_nome: `Prefeitura Municipal de ${prefeituraCidade}`,
            prefeitura_id: prefeituraId,
            telefone_cidadao: formData.telefone || null
          }
        });
      } catch (emailError) {
        console.error("Erro ao enviar email de confirmação:", emailError);
        // Não interrompe o fluxo se o email falhar
      }
      
      toast({
        title: "✅ Reclamação enviada!",
        description: `Protocolo: ${data.protocolo}`,
        className: "bg-green-600 text-white border-green-700",
      });
    } catch (error) {
      console.error("Erro ao enviar reclamação:", error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 lg:w-14 lg:h-14 text-secondary" />
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
            Reclamação enviada com sucesso!
          </h2>
          {protocolo && (
            <div className="bg-primary/10 rounded-xl p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-1">Número do protocolo:</p>
              <p className="text-xl font-bold text-primary">{protocolo}</p>
            </div>
          )}
          <p className="text-muted-foreground mb-8 lg:text-lg">
            A {prefeituraCidade ? `Prefeitura de ${prefeituraCidade}` : 'Prefeitura'} irá analisar sua solicitação e tomar as providências necessárias.
          </p>
          <button onClick={onClose} className="btn-hero">
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96 bg-primary text-primary-foreground p-8 xl:p-10">
        <div className="flex items-center gap-3 mb-10">
          <Building2 className="w-8 h-8" />
          <div>
            <p className="font-bold text-lg">Civita Infra</p>
            <p className="text-sm opacity-80">Sistema de Gestão de Infraestrutura</p>
          </div>
        </div>

        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-4">Nova Reclamação</h2>
          <p className="opacity-80 mb-8">
            Preencha as informações para registrar um problema na sua rua.
          </p>

          {/* Desktop Step List */}
          <div className="space-y-4">
            {stepLabels.map((label, i) => {
              const stepNum = i + 1;
              const isCompleted = stepNum < step;
              const isActive = stepNum === step;
              
              return (
                <button
                  key={i}
                  onClick={() => isCompleted && goToStep(stepNum)}
                  disabled={!isCompleted}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                    isActive 
                      ? "bg-primary-foreground/20" 
                      : isCompleted 
                        ? "hover:bg-primary-foreground/10 cursor-pointer" 
                        : "opacity-50"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isCompleted 
                      ? "bg-secondary text-secondary-foreground" 
                      : isActive 
                        ? "bg-primary-foreground text-primary" 
                        : "bg-primary-foreground/20"
                  }`}>
                    {isCompleted ? "✓" : stepNum}
                  </div>
                  <span className={`font-medium ${isActive ? "text-primary-foreground" : ""}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto pt-8 border-t border-primary-foreground/20">
          <p className="text-sm opacity-70">
            Seus dados estão protegidos conforme a LGPD.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="bg-card border-b border-border sticky top-0 z-10 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={handleBack} className="p-2 -ml-2 text-foreground">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Nova Reclamação</h1>
            <div className="w-10" />
          </div>
          <StepIndicator currentStep={step} totalSteps={6} labels={stepLabels} onStepClick={goToStep} />
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-10 py-6 border-b border-border">
          <button 
            onClick={handleBack} 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar</span>
          </button>
          <p className="text-sm text-muted-foreground">
            Etapa {step} de 6
          </p>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-10 xl:p-16">
          <div className="max-w-lg mx-auto animate-slide-up" key={step}>
            {step === 1 && (
              <div className="space-y-5">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Seus Dados</h2>
                  <p className="text-muted-foreground text-sm lg:text-base">
                    Seus dados serão usados apenas para contato sobre essa solicitação.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Nome completo *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => updateField("nome", e.target.value)}
                    placeholder="Digite seu nome completo"
                    className={`input-large ${errors.nome ? "border-destructive ring-destructive/20" : ""}`}
                    required
                  />
                  {errors.nome && (
                    <p className="text-destructive text-sm mt-1">{errors.nome}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">E-mail *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="seu@email.com"
                    className={`input-large ${errors.email ? "border-destructive ring-destructive/20" : ""}`}
                    required
                  />
                  {errors.email && (
                    <p className="text-destructive text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Telefone / WhatsApp (opcional)</label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(48) 99999-9999"
                    className={`input-large ${errors.telefone ? "border-destructive ring-destructive/20" : ""}`}
                  />
                  {errors.telefone && (
                    <p className="text-destructive text-sm mt-1">{errors.telefone}</p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Local da Rua</h2>
                  <p className="text-muted-foreground text-sm lg:text-base">
                    Informe onde está o problema.
                  </p>
                </div>
                
                <LocationPicker
                  bairro={formData.bairro}
                  rua={formData.rua}
                  numero={formData.numero}
                  referencia={formData.referencia}
                  localizacao={formData.localizacao}
                  bairroError={errors.bairro}
                  bairros={bairros}
                  onBairroChange={(v) => {
                    updateField("bairro", v);
                    if (errors.bairro) setErrors((prev) => ({ ...prev, bairro: undefined }));
                  }}
                  onRuaChange={(v) => updateField("rua", v)}
                  onNumeroChange={(v) => updateField("numero", v)}
                  onReferenciaChange={(v) => updateField("referencia", v)}
                  onLocationCapture={(coords) => updateField("localizacao", coords)}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Tipo de Problema</h2>
                  <p className="text-muted-foreground text-sm lg:text-base">
                    Selecione o que melhor descreve o problema.
                  </p>
                </div>
                
                <ProblemTypeSelector
                  selected={formData.tipoProblema}
                  onSelect={(id) => updateField("tipoProblema", id)}
                />

                {formData.tipoProblema === "outro" && (
                  <div className="animate-fade-in">
                    <label className="block text-sm font-medium mb-2">Descreva o problema</label>
                    <input
                      type="text"
                      value={formData.outroProblema}
                      onChange={(e) => updateField("outroProblema", e.target.value)}
                      placeholder="Qual é o problema?"
                      className="input-large"
                    />
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Descrição</h2>
                  <p className="text-muted-foreground text-sm lg:text-base">
                    Se quiser, descreva melhor o problema da rua.
                  </p>
                </div>
                
                <textarea
                  value={formData.descricao}
                  onChange={(e) => updateField("descricao", e.target.value)}
                  placeholder="Conte mais detalhes sobre o problema..."
                  className="input-large min-h-[180px] lg:min-h-[220px] resize-none"
                  rows={6}
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Fotos e Vídeos</h2>
                </div>
                
                <MediaUpload
                  photos={formData.fotos}
                  videos={formData.videos}
                  onPhotosChange={(files) => updateField("fotos", files)}
                  onVideosChange={(files) => updateField("videos", files)}
                  limiteImagens={config.limite_imagens}
                  permitirVideo={config.permitir_video}
                />

                {config.exigir_foto_padrao && formData.fotos.length === 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <p className="text-sm text-amber-700">
                        Esta prefeitura exige pelo menos uma foto para enviar a reclamação.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 6 && (
              <div className="space-y-5">
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Confirmar Envio</h2>
                  <p className="text-muted-foreground text-sm lg:text-base">
                    Revise as informações. Toque em "Editar" para alterar.
                  </p>
                </div>
                
                <div className="card-elevated space-y-4">
                  {/* Dados do cidadão */}
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-muted-foreground text-sm">Cidadão:</span>
                      <p className="font-medium text-foreground">{formData.nome}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => goToStep(1)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      aria-label="Editar dados"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="border-t border-border" />

                  {/* Local */}
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-muted-foreground text-sm">Local:</span>
                      <p className="font-medium text-foreground">{formData.rua}</p>
                      <p className="text-sm text-muted-foreground">{formData.bairro}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => goToStep(2)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      aria-label="Editar local"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="border-t border-border" />

                  {/* Problema */}
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-muted-foreground text-sm">Problema:</span>
                      <p className="font-medium text-foreground">
                        {formData.tipoProblema === "outro" 
                          ? formData.outroProblema || "Outro problema"
                          : problemLabels[formData.tipoProblema]}
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => goToStep(3)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      aria-label="Editar problema"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  {formData.descricao && (
                    <>
                      <div className="border-t border-border" />
                      <div className="flex justify-between items-start">
                        <div className="flex-1 mr-2">
                          <span className="text-muted-foreground text-sm">Descrição:</span>
                          <p className="text-sm text-foreground">{formData.descricao}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => goToStep(4)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          aria-label="Editar descrição"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}

                  {(formData.fotos.length > 0 || formData.videos.length > 0) && (
                    <>
                      <div className="border-t border-border" />
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-muted-foreground text-sm">Mídia:</span>
                          <p className="font-medium text-foreground">
                            {formData.fotos.length > 0 && `${formData.fotos.length} foto(s)`}
                            {formData.fotos.length > 0 && formData.videos.length > 0 && ", "}
                            {formData.videos.length > 0 && `${formData.videos.length} vídeo(s)`}
                          </p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => goToStep(5)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          aria-label="Editar mídia"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* LGPD Consent */}
                <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="lgpd-consent"
                      checked={lgpdAceito}
                      onCheckedChange={(checked) => {
                        if (checked === false) {
                          setShowLgpdConfirm(true);
                        } else {
                          setLgpdAceito(true);
                        }
                      }}
                      className="mt-0.5"
                    />
                    <label htmlFor="lgpd-consent" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                      {config.lgpd_texto_consentimento}
                    </label>
                  </div>
                </div>

                {/* LGPD Confirmation Dialog */}
                {showLgpdConfirm && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                        <h3 className="text-lg font-semibold text-foreground">Atenção</h3>
                      </div>
                      <p className="text-muted-foreground mb-6">
                        Você precisa concordar com o tratamento dos seus dados pessoais para enviar a reclamação. Deseja realmente desmarcar esta opção?
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setLgpdAceito(false);
                            setShowLgpdConfirm(false);
                          }}
                          className="flex-1 px-4 py-3 rounded-xl border-2 border-border text-foreground hover:bg-muted transition-colors"
                        >
                          Sim, desmarcar
                        </button>
                        <button
                          onClick={() => setShowLgpdConfirm(false)}
                          className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                        >
                          Manter selecionado
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-card border-t border-border p-4 lg:p-6 sticky bottom-0">
          <div className="max-w-lg mx-auto lg:flex lg:gap-4">
            {/* Desktop back button */}
            <button
              onClick={handleBack}
              className="hidden lg:flex items-center justify-center gap-2 px-6 py-4 rounded-xl border-2 border-border text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            
            {step < 6 ? (
              <button
                onClick={handleNext}
                disabled={!canAdvance()}
                className="btn-hero w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !lgpdAceito}
                className="btn-hero w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: lgpdAceito ? "var(--gradient-success)" : undefined }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar Reclamação
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ComplaintForm;
