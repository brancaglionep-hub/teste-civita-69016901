import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Star, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface AvaliacaoInfo {
  protocolo: string;
  rua: string;
  bairro_nome: string | null;
  categoria_nome: string | null;
  prefeitura_nome: string;
  ja_avaliada: boolean;
}

const Avaliar = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<AvaliacaoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estrelas, setEstrelas] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comentario, setComentario] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!token) {
        setError("Link de avaliação inválido");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("buscar_avaliacao_por_token", {
        _token: token
      });

      if (error || !data || data.length === 0) {
        setError("Link de avaliação inválido ou expirado");
        setLoading(false);
        return;
      }

      const avaliacao = data[0];
      if (avaliacao.ja_avaliada) {
        setError("Esta reclamação já foi avaliada");
        setLoading(false);
        return;
      }

      setInfo(avaliacao);
      setLoading(false);
    };

    fetchInfo();
  }, [token]);

  const handleSubmit = async () => {
    if (estrelas === 0) {
      toast({
        title: "Selecione uma avaliação",
        description: "Por favor, selecione de 1 a 5 estrelas",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.rpc("submeter_avaliacao", {
      _token: token,
      _estrelas: estrelas,
      _comentario: comentario || null
    });

    if (error || !data || !data[0]?.success) {
      toast({
        title: "Erro ao enviar avaliação",
        description: data?.[0]?.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    toast({
      title: "Avaliação enviada!",
      description: "Obrigado pelo seu feedback"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Inválido</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Voltar ao Início
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Avaliação Enviada!</h1>
          <p className="text-gray-600 mb-6">
            Obrigado pelo seu feedback! Sua opinião é muito importante para melhorarmos nossos serviços.
          </p>
          <div className="flex justify-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-8 h-8 ${
                  star <= estrelas
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            Voltar ao Início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Avalie o Atendimento
          </h1>
          <p className="text-gray-600">{info?.prefeitura_nome}</p>
        </div>

        {/* Complaint Info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-500 mb-1">Protocolo</p>
          <p className="font-bold text-gray-900 mb-3">{info?.protocolo}</p>
          
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 mt-0.5 text-gray-400" />
            <span>
              {info?.rua}
              {info?.bairro_nome && `, ${info.bairro_nome}`}
            </span>
          </div>
          
          {info?.categoria_nome && (
            <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
              {info.categoria_nome}
            </span>
          )}
        </div>

        {/* Star Rating */}
        <div className="mb-6">
          <p className="text-center text-gray-700 mb-4 font-medium">
            Como você avalia o serviço prestado?
          </p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setEstrelas(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= (hoveredStar || estrelas)
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          {estrelas > 0 && (
            <p className="text-center text-sm text-gray-500 mt-2">
              {estrelas === 1 && "Muito insatisfeito"}
              {estrelas === 2 && "Insatisfeito"}
              {estrelas === 3 && "Regular"}
              {estrelas === 4 && "Satisfeito"}
              {estrelas === 5 && "Muito satisfeito"}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comentário (opcional)
          </label>
          <Textarea
            placeholder="Deixe seu comentário sobre o atendimento..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Submit Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || estrelas === 0}
        >
          {submitting ? "Enviando..." : "Enviar Avaliação"}
        </Button>
      </div>
    </div>
  );
};

export default Avaliar;