import { useState } from "react";
import { ArrowRight, MapPin, Shield, Clock, Phone, Building2 } from "lucide-react";
import heroImage from "@/assets/hero-street.png";
import ComplaintForm from "@/components/ComplaintForm";
const Index = () => {
  const [showForm, setShowForm] = useState(false);
  if (showForm) {
    return <ComplaintForm onClose={() => setShowForm(false)} />;
  }
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-3 px-4 lg:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-3">
            <Building2 className="w-5 h-5 lg:w-6 lg:h-6" />
            <div>
              <span className="font-semibold text-sm lg:text-base">Prefeitura de Biguaçu</span>
              <span className="hidden lg:inline text-sm opacity-90 ml-2">| Santa Catarina</span>
            </div>
          </div>
          <a href="tel:4833463000" className="flex items-center gap-1 text-sm opacity-90 hover:opacity-100 transition-opacity">
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">(48) 3346-3000</span>
          </a>
        </div>
      </header>

      {/* Hero Section - Desktop enhanced */}
      <main className="max-w-6xl mx-auto px-4 py-8 lg:py-16">
        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Left Column - Content */}
          <div className="text-center lg:text-left mb-8 lg:mb-0">
            <div className="animate-fade-in">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4 lg:mb-6">
                Civita Infra
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-foreground mb-3 lg:mb-4 leading-tight">
                Registrar Ocorrência
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground mb-2 lg:mb-4">
                Encontrou um problema na sua rua?
              </p>
              <p className="text-muted-foreground lg:text-lg mb-8">
                Avise a Prefeitura de Biguaçu de forma rápida e fácil. Sua participação ajuda a melhorar nossa cidade.
              </p>
            </div>

            {/* CTA Button */}
            <div className="animate-slide-up" style={{
            animationDelay: "0.1s"
          }}>
              <button onClick={() => setShowForm(true)} className="btn-hero w-full lg:w-auto flex items-center justify-center gap-3">
                Informar problema na rua
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Features - Desktop horizontal */}
            <div className="grid grid-cols-3 gap-4 mt-10 lg:mt-12 animate-fade-in" style={{
            animationDelay: "0.2s"
          }}>
              <div className="text-center lg:text-left">
                <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto lg:mx-0 mb-2">
                  <Clock className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
                </div>
                <p className="text-xs lg:text-sm text-muted-foreground">Rápido e fácil</p>
              </div>
              <div className="text-center lg:text-left">
                <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto lg:mx-0 mb-2">
                  <MapPin className="w-6 h-6 lg:w-7 lg:h-7 text-secondary" />
                </div>
                <p className="text-xs lg:text-sm text-muted-foreground">Com localização</p>
              </div>
              <div className="text-center lg:text-left">
                <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto lg:mx-0 mb-2">
                  <Shield className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
                </div>
                <p className="text-xs lg:text-sm text-muted-foreground">Dados protegidos</p>
              </div>
            </div>
          </div>

          {/* Right Column - Hero Image */}
          <div className="animate-slide-up" style={{
          animationDelay: "0.15s"
        }}>
            <div className="rounded-3xl overflow-hidden shadow-elevated lg:rounded-[2rem]">
              <img src={heroImage} alt="Ilustração de manutenção de ruas - trabalhadores reparando buraco no asfalto" className="w-full h-auto" />
            </div>
          </div>
        </div>

        {/* Types of Problems - Enhanced for desktop */}
        <div className="mt-12 lg:mt-20 animate-fade-in" style={{
        animationDelay: "0.3s"
      }}>
          <div className="lg:bg-card lg:rounded-3xl lg:p-10 lg:shadow-card">
            <h2 className="text-lg lg:text-2xl font-semibold text-center mb-4 lg:mb-8 text-foreground">
              Tipos de problemas que você pode informar
            </h2>
            <div className="flex flex-wrap justify-center gap-2 lg:gap-3">
              {[{
              label: "Buracos",
              icon: "🕳️"
            }, {
              label: "Rua danificada",
              icon: "🚧"
            }, {
              label: "Alagamento",
              icon: "🌧️"
            }, {
              label: "Desnível",
              icon: "⚠️"
            }, {
              label: "Tráfego difícil",
              icon: "🚗"
            }].map(item => <span key={item.label} className="px-4 py-2 lg:px-6 lg:py-3 bg-muted text-foreground text-sm lg:text-base rounded-full flex items-center gap-2 hover:bg-primary/10 hover:text-primary transition-colors cursor-default">
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </span>)}
            </div>
          </div>
        </div>

        {/* Stats Section - Desktop only */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-8 mt-16 animate-fade-in" style={{
        animationDelay: "0.4s"
      }}>
          <div className="text-center p-8 bg-card rounded-2xl shadow-card">
            <div className="text-4xl font-bold text-primary mb-2">24h</div>
            <p className="text-muted-foreground">Tempo médio de resposta</p>
          </div>
          <div className="text-center p-8 bg-card rounded-2xl shadow-card">
            <div className="text-4xl font-bold text-secondary mb-2">100%</div>
            <p className="text-muted-foreground">Reclamações analisadas</p>
          </div>
          <div className="text-center p-8 bg-card rounded-2xl shadow-card">
            <div className="text-4xl font-bold text-primary mb-2">Grátis</div>
            <p className="text-muted-foreground">Serviço para o cidadão</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-6 lg:py-10 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="lg:flex lg:items-center lg:justify-between">
            <div className="text-center lg:text-left mb-4 lg:mb-0">
              <p className="font-semibold text-foreground mb-1">
                Prefeitura Municipal de Biguaçu
              </p>
              <p className="text-sm text-muted-foreground">
                Trabalhando por uma cidade melhor
              </p>
            </div>
            <div className="text-center lg:text-right">
              <p className="text-xs text-muted-foreground">
                Seus dados são protegidos conforme a LGPD.
              </p>
              <p className="text-xs text-muted-foreground mt-1">© 2026 Prefeitura de Biguaçu - Todos os direitos reservados</p>
            </div>
          </div>
        </div>
      </footer>
    </div>;
};
export default Index;