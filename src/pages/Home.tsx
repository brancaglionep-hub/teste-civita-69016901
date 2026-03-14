import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Building2, ChevronRight, Map, Clock, Shield, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import heroBg from "@/assets/hero-city-bg.jpg";

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  slug: string;
  logo_url: string | null;
}

// Memoized city card component - usando função regular para evitar warning de forwardRef
const CityCard = ({ prefeitura, onClick }: { prefeitura: Prefeitura; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group relative bg-card rounded-2xl border border-border p-6 text-left hover:border-primary hover:shadow-xl transition-all duration-300 overflow-hidden"
  >
    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full -mr-10 -mt-10 group-hover:from-primary/15 transition-colors" />
    
    <div className="relative flex items-center gap-4">
      {prefeitura.logo_url ? (
        <img 
          src={prefeitura.logo_url} 
          alt={prefeitura.cidade}
          loading="lazy"
          decoding="async"
          className="w-16 h-16 object-contain rounded-xl bg-white p-1"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-lg">
          <MapPin className="w-8 h-8 text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-foreground text-xl group-hover:text-primary transition-colors truncate">
          {prefeitura.cidade}
        </h3>
        <p className="text-sm text-muted-foreground truncate">
          {prefeitura.nome}
        </p>
      </div>
      <ChevronRight className="w-6 h-6 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
    </div>
  </button>
);

// Feature card component - usando função regular para evitar warning de forwardRef
const FeatureCard = ({ icon: Icon, title, description }: { icon: typeof Clock; title: string; description: string }) => (
  <div className="text-center group">
    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors">
      <Icon className="w-10 h-10 text-primary" />
    </div>
    <h4 className="font-bold text-foreground text-lg mb-2">{title}</h4>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

const Home = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrefeituras = async () => {
      const { data, error } = await supabase
        .from("prefeituras_publico")
        .select("id, nome, cidade, slug, logo_url")
        .eq("ativo", true)
        .order("cidade");

      if (!error && data) {
        setPrefeituras(data);
      }
      setLoading(false);
    };

    fetchPrefeituras();
  }, []);

  // Memoized search filter
  const filteredPrefeituras = useMemo(() => {
    if (!search.trim()) return prefeituras;
    const searchLower = search.toLowerCase();
    return prefeituras.filter(p => 
      p.cidade.toLowerCase().includes(searchLower) ||
      p.nome.toLowerCase().includes(searchLower)
    );
  }, [prefeituras, search]);

  // Memoized navigation handler
  const handleCityClick = useCallback((slug: string) => {
    navigate(`/${slug}`);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Background Image */}
      <section className="relative min-h-[70vh] lg:min-h-[80vh] flex items-center justify-center">
        {/* Background Image */}
        <img 
          src={heroBg} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />
        
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Civita Infra" 
              className="w-12 h-12 rounded-xl object-contain"
            />
            <div>
              <h1 className="font-bold text-white text-lg">Civita Infra</h1>
              <p className="text-xs text-white/70">Sistema de Gestão de Infraestrutura</p>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm font-medium text-white mb-6">
            <Building2 className="w-4 h-4" />
            Serviço Público Municipal
          </span>
          
          <h2 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Reporte problemas nas <span className="text-primary">ruas</span> da sua cidade
          </h2>
          
          <p className="text-lg lg:text-xl text-white/80 max-w-2xl mx-auto">
            Selecione sua cidade para registrar ou acompanhar reclamações sobre buracos, pavimentação e outros problemas nas vias públicas
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-white/40 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-white/60 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Cities Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
              Cidades Participantes
            </h3>
            <p className="text-muted-foreground mb-8">
              Selecione sua cidade para começar
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar sua cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 text-base rounded-xl border-border bg-card shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Cities Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {loading ? (
              <div className="col-span-full text-center py-20">
                <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Carregando cidades...</p>
              </div>
            ) : filteredPrefeituras.length === 0 ? (
              <div className="col-span-full text-center py-20">
                <Map className="w-20 h-20 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  {search ? "Nenhuma cidade encontrada" : "Nenhuma cidade cadastrada"}
                </p>
              </div>
            ) : (
              filteredPrefeituras.map((prefeitura) => (
                <CityCard
                  key={prefeitura.id}
                  prefeitura={prefeitura}
                  onClick={() => handleCityClick(prefeitura.slug)}
                />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
              Como funciona
            </h3>
            <p className="text-muted-foreground">
              Um processo simples e eficiente
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Clock}
              title="Rápido e Fácil"
              description="Registre sua reclamação em poucos minutos, direto do celular"
            />
            <FeatureCard
              icon={Navigation}
              title="Localização Exata"
              description="Use o GPS para marcar o local exato do problema na rua"
            />
            <FeatureCard
              icon={Shield}
              title="Dados Protegidos"
              description="Suas informações pessoais estão seguras e protegidas"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.png" alt="Civita Infra" className="w-6 h-6 object-contain" />
            <span className="font-semibold text-foreground">Civita Infra</span>
          </div>
          <p className="text-muted-foreground text-sm mb-2">
            © {new Date().getFullYear()} Todos os direitos reservados
          </p>
          <p className="text-muted-foreground/70 text-xs mb-4">
            Seus dados são protegidos conforme a Lei Geral de Proteção de Dados (LGPD)
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="text-xs text-muted-foreground/50 hover:text-primary transition-colors"
          >
            Acessar Painel
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Home;
