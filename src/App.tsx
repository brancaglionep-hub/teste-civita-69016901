import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Eagerly load critical public pages
import Home from "./pages/Home";
import CityPage from "./pages/CityPage";

// Lazy load admin layout (pages load with it)
const Auth = lazy(() => import("./pages/Auth"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminPrefeituras = lazy(() => import("./pages/admin/AdminPrefeituras"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const AdminCategorias = lazy(() => import("./pages/admin/AdminCategorias"));
const AdminIntegracoes = lazy(() => import("./pages/admin/AdminIntegracoes"));
const AdminWhatsAppBot = lazy(() => import("./pages/admin/AdminWhatsAppBot"));

// Lazy load painel layout
const PainelLayout = lazy(() => import("./components/painel/PainelLayout"));

// Eagerly load painel pages after layout (they share dependencies)
import PainelDashboard from "./pages/painel/PainelDashboard";
import PainelReclamacoes from "./pages/painel/PainelReclamacoes";
import PainelReclamacaoDetalhe from "./pages/painel/PainelReclamacaoDetalhe";
import PainelBairros from "./pages/painel/PainelBairros";
import PainelCategorias from "./pages/painel/PainelCategorias";
import PainelConfiguracoes from "./pages/painel/PainelConfiguracoes";
import PainelAlertas from "./pages/painel/PainelAlertas";
import PainelAlertasHistorico from "./pages/painel/PainelAlertasHistorico";
import PainelCidadaos from "./pages/painel/PainelCidadaos";
import PainelAvaliacoes from "./pages/painel/PainelAvaliacoes";
import PainelIntegracoes from "./pages/painel/PainelIntegracoes";
import PainelWhatsApp from "./pages/painel/PainelWhatsApp";

const Avaliar = lazy(() => import("./pages/Avaliar"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient with caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading spinner
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={300}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/avaliar" element={<Avaliar />} />
            
            {/* Super Admin Routes - MUST come before /:slug */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="prefeituras" element={<AdminPrefeituras />} />
              <Route path="usuarios" element={<AdminUsuarios />} />
              <Route path="categorias" element={<AdminCategorias />} />
              <Route path="integracoes" element={<AdminIntegracoes />} />
              <Route path="whatsapp-bot" element={<AdminWhatsAppBot />} />
            </Route>
            
            {/* Painel Prefeitura Routes */}
            <Route path="/painel/:prefeituraId" element={<PainelLayout />}>
              <Route index element={<PainelDashboard />} />
              <Route path="reclamacoes" element={<PainelReclamacoes />} />
              <Route path="reclamacoes/:id" element={<PainelReclamacaoDetalhe />} />
              <Route path="avaliacoes" element={<PainelAvaliacoes />} />
              <Route path="alertas" element={<PainelAlertas />} />
              <Route path="alertas/historico" element={<PainelAlertasHistorico />} />
              <Route path="cidadaos" element={<PainelCidadaos />} />
              <Route path="bairros" element={<PainelBairros />} />
              <Route path="categorias" element={<PainelCategorias />} />
              <Route path="configuracoes" element={<PainelConfiguracoes />} />
              <Route path="integracoes" element={<PainelIntegracoes />} />
              <Route path="whatsapp" element={<PainelWhatsApp />} />
            </Route>
            
            {/* City page - must be LAST among dynamic routes */}
            <Route path="/:slug" element={<CityPage />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
