import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Building2, Phone, ArrowRight, Clock, MapPin, Shield, Home, Construction } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ComplaintForm from "@/components/ComplaintForm";
import ConsultaProtocolo from "@/components/ConsultaProtocolo";
import WeatherWidget from "@/components/WeatherWidget";
import heroImage from "@/assets/hero-street.png";
import { usePrefeituraConfig } from "@/hooks/usePrefeituraConfig";

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  slug: string;
  estado: string;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  texto_institucional: string | null;
  email_contato: string | null;
  telefone_contato: string | null;
  imagem_capa_url: string | null;
}

const CityPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const bairroId = searchParams.get("bairro");
  
  const [prefeitura, setPrefeitura] = useState<Prefeitura | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConsulta, setShowConsulta] = useState(false);

  // Carrega configurações da prefeitura (modo público)
  const { config: prefeituraConfig } = usePrefeituraConfig(prefeitura?.id, true);

  useEffect(() => {
    const fetchPrefeitura = async () => {
      const { data, error } = await supabase
        .from("prefeituras_publico")
        .select("*")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();

      if (!error && data) {
        setPrefeitura(data);
        // Registrar visita
        await supabase.from("visitas").insert({
          prefeitura_id: data.id,
          pagina: "home"
        });
      }
      setLoading(false);
    };

    if (slug) {
      fetchPrefeitura();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prefeitura) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        {/* Ícone de rua interditada com buraco */}
        <div className="relative mb-6">
          <div className="w-24 h-24 bg-muted rounded-2xl flex items-center justify-center relative overflow-hidden">
            {/* Linha da rua */}
            <div className="absolute bottom-3 left-2 right-2 h-2 bg-muted-foreground/20 rounded" />
            {/* Buraco */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-muted-foreground/40 rounded-t-full" />
            {/* Ícone de construção */}
            <Construction className="w-12 h-12 text-orange-500 relative z-10" />
          </div>
          {/* Cones */}
          <div className="absolute -bottom-1 -left-2 w-4 h-6 bg-orange-500 rounded-t-sm origin-bottom animate-swing" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
          <div className="absolute -bottom-1 -right-2 w-4 h-6 bg-orange-500 rounded-t-sm origin-bottom animate-swing-reverse" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">Cidade não encontrada</h1>
        <p className="text-muted-foreground mb-6">Verifique o endereço e tente novamente.</p>
        
        <Button asChild>
          <Link to="/" className="inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            Voltar ao início
          </Link>
        </Button>
      </div>
    );
  }

  if (showForm) {
    return (
      <ComplaintForm 
        onClose={() => setShowForm(false)} 
        prefeituraId={prefeitura.id} 
        bairroId={bairroId}
        config={prefeituraConfig}
      />
    );
  }

  if (showConsulta) {
    return <ConsultaProtocolo onClose={() => setShowConsulta(false)} prefeituraId={prefeitura.id} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              to="/" 
              className="p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors"
              title="Voltar ao início"
            >
              <Home className="w-5 h-5" />
            </Link>
            <div className="w-px h-6 bg-primary-foreground/20" />
            {prefeitura.logo_url ? (
              <img src={prefeitura.logo_url} alt={prefeitura.nome} className="w-9 h-9 object-contain" />
            ) : (
              <Building2 className="w-7 h-7" />
            )}
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm sm:text-base">{prefeitura.nome}</p>
              <span className="text-xs sm:text-sm text-primary-foreground/70">| {prefeitura.estado || "SC"}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {prefeitura.telefone_contato && (
              <a href={`tel:${prefeitura.telefone_contato}`} className="hidden sm:flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4" />
                {prefeitura.telefone_contato}
              </a>
            )}
            <WeatherWidget cidade={prefeitura.cidade} estado={prefeitura.estado || "SC"} />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1">
        <div className="max-w-6xl mx-auto px-5 py-8 sm:py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                Serviço Municipal de {prefeitura.cidade}
              </span>
              
              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-foreground leading-tight">
                  Registrar Ocorrência
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground">
                  Encontrou um problema na sua rua?
                </p>
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                  Avise a {prefeitura.nome} de forma rápida e fácil. Sua participação ajuda a melhorar nossa cidade.
                </p>
              </div>
              
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
                >
                  Informar problema na rua
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowConsulta(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-card text-foreground font-semibold rounded-xl border-2 border-border hover:border-primary hover:text-primary transition-all"
                >
                  Consultar protocolo
                </button>
              </div>

              {/* Features */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e1f3f9' }}>
                    <Clock className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#548695' }} />
                  </div>
                  <span className="text-muted-foreground text-xs sm:text-sm font-medium">Rápido e fácil</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgb(209 237 217 / 49%)' }}>
                    <MapPin className="w-6 h-6 sm:w-7 sm:h-7 text-green-600" />
                  </div>
                  <span className="text-muted-foreground text-xs sm:text-sm font-medium">Com localização</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e1f3f9' }}>
                    <Shield className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#548695' }} />
                  </div>
                  <span className="text-muted-foreground text-xs sm:text-sm font-medium">Dados protegidos</span>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl" />
              <img
                src={prefeitura.imagem_capa_url || heroImage}
                alt="Imagem de capa"
                className="w-full h-auto rounded-3xl shadow-2xl object-cover"
                style={{ minHeight: "400px", maxHeight: "500px" }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problem Types */}
      <section className="py-8 sm:py-12 bg-muted/30">
        <div className="max-w-5xl mx-auto px-5">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5 sm:p-8">
            <h2 className="text-base sm:text-lg font-bold text-foreground text-center mb-5 sm:mb-6">
              Tipos de problemas que você pode informar
            </h2>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {[
                { emoji: "⚫", label: "Buracos" },
                { emoji: "🚧", label: "Rua danificada" },
                { emoji: "🌊", label: "Alagamento" },
                { emoji: "⚠️", label: "Desnível" },
                { emoji: "🚗", label: "Tráfego difícil" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-muted rounded-full">
                  <span className="text-base sm:text-lg">{item.emoji}</span>
                  <span className="font-medium text-foreground text-xs sm:text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 sm:py-16 bg-background">
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center border border-border shadow-sm">
              <p className="text-xl sm:text-4xl font-bold text-primary mb-1">24h</p>
              <p className="text-muted-foreground text-[10px] sm:text-sm">Tempo de resposta</p>
            </div>
            <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center border border-border shadow-sm">
              <p className="text-xl sm:text-4xl font-bold text-green-600 mb-1">100%</p>
              <p className="text-muted-foreground text-[10px] sm:text-sm">Analisadas</p>
            </div>
            <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center border border-border shadow-sm">
              <p className="text-xl sm:text-4xl font-bold text-primary mb-1">Grátis</p>
              <p className="text-muted-foreground text-[10px] sm:text-sm">Para o cidadão</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-muted py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
            <div>
              <p className="font-semibold text-foreground text-sm">{prefeitura.nome}</p>
              <p className="text-xs text-muted-foreground">Trabalhando por uma cidade melhor</p>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} - Todos os direitos reservados</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CityPage;
