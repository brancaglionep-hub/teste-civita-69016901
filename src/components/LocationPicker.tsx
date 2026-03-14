import { MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import MapPicker from "./MapPicker";

interface Bairro {
  id: string;
  nome: string;
}

interface LocationPickerProps {
  bairro: string;
  rua: string;
  numero: string;
  referencia: string;
  localizacao: { lat: number; lng: number } | null;
  bairroError?: string;
  bairros: Bairro[];
  onBairroChange: (value: string) => void;
  onRuaChange: (value: string) => void;
  onNumeroChange: (value: string) => void;
  onReferenciaChange: (value: string) => void;
  onLocationCapture: (coords: { lat: number; lng: number }) => void;
}

interface NominatimAddress {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  village?: string;
  town?: string;
  city?: string;
  house_number?: string;
}

const LocationPicker = ({
  bairro,
  rua,
  numero,
  referencia,
  localizacao,
  bairroError,
  bairros,
  onBairroChange,
  onRuaChange,
  onNumeroChange,
  onReferenciaChange,
  onLocationCapture
}: LocationPickerProps) => {
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const findMatchingBairro = (addressParts: NominatimAddress): string => {
    const possibleBairros = [
      addressParts.suburb,
      addressParts.neighbourhood,
      addressParts.city_district,
      addressParts.village
    ].filter(Boolean);

    for (const part of possibleBairros) {
      if (!part) continue;
      const normalizedPart = part.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      for (const b of bairros) {
        const normalizedBairro = b.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedPart.includes(normalizedBairro) || normalizedBairro.includes(normalizedPart)) {
          return b.nome;
        }
      }
    }
    
    return "";
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'pt-BR',
            'User-Agent': 'ReclamaBuraco/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao buscar endereço");
      }

      const data = await response.json();
      const address: NominatimAddress = data.address || {};

      // Fill street
      if (address.road) {
        onRuaChange(address.road);
      }

      // Fill number
      if (address.house_number) {
        onNumeroChange(address.house_number);
      }

      // Find matching bairro
      const matchedBairro = findMatchingBairro(address);
      onBairroChange(matchedBairro);

      setLocationSuccess(true);
      toast({
        title: "Localização aproximada obtida",
        description: "Verifique se o bairro e a rua estão corretos. Corrija se necessário."
      });

      // Reset success state after 3 seconds
      setTimeout(() => setLocationSuccess(false), 3000);

    } catch (error) {
      console.error("Geocoding error:", error);
      toast({
        title: "Localização obtida",
        description: "Não foi possível preencher o endereço automaticamente. Por favor, preencha manualmente.",
        variant: "destructive"
      });
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Seu navegador não suporta localização.");
      return;
    }

    setIsLoadingLocation(true);
    setLocationError("");
    setLocationSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        onLocationCapture(coords);
        setShowMap(true);
        
        // Reverse geocode to fill address
        await reverseGeocode(coords.lat, coords.lng);
        
        setIsLoadingLocation(false);
      },
      (error) => {
        let errorMessage = "Não foi possível obter sua localização.";
        
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Permissão de localização negada. Ative nas configurações do navegador.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Tempo esgotado. Tente novamente.";
        }
        
        setLocationError(errorMessage);
        setIsLoadingLocation(false);
        
        toast({
          title: "Erro de localização",
          description: errorMessage,
          variant: "destructive"
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleMapPositionChange = async (coords: { lat: number; lng: number }) => {
    onLocationCapture(coords);
    await reverseGeocode(coords.lat, coords.lng);
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleGetLocation}
        disabled={isLoadingLocation}
        className={`w-full card-problem flex items-center justify-center gap-3 min-h-[70px] transition-all ${
          locationSuccess ? "border-secondary bg-secondary/10" : ""
        }`}
      >
        {isLoadingLocation ? (
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        ) : locationSuccess ? (
          <CheckCircle2 className="w-6 h-6 text-secondary" />
        ) : (
          <MapPin className="w-6 h-6 text-primary" />
        )}
        <span className="font-medium">
          {isLoadingLocation 
            ? "Obtendo localização..." 
            : locationSuccess 
              ? "Localização obtida!" 
              : "Usar minha localização"}
        </span>
      </button>

      {locationError && (
        <p className="text-destructive text-sm text-center">{locationError}</p>
      )}

      {locationSuccess && (
        <p className="text-amber-600 text-sm text-center bg-amber-50 p-2 rounded-lg">
          ⚠️ Arraste o marcador no mapa para ajustar a localização exata.
        </p>
      )}

      {/* Interactive Map */}
      {(showMap || localizacao) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Marque o local exato no mapa</label>
          <MapPicker 
            position={localizacao} 
            onPositionChange={handleMapPositionChange} 
          />
          <p className="text-xs text-muted-foreground text-center">
            Clique ou arraste o marcador para o local do problema
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Bairro *</label>
          {bairros.length > 0 ? (
            <select
              value={bairro}
              onChange={(e) => onBairroChange(e.target.value)}
              className="input-large"
              required
            >
              <option value="" disabled>Selecionar o bairro</option>
              {bairros.map((b) => (
                <option key={b.id} value={b.nome}>{b.nome}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={bairro}
              placeholder="Digite o nome do bairro"
              className={`input-large ${bairroError ? "border-destructive ring-destructive/20" : ""}`}
              onChange={(e) => onBairroChange(e.target.value)}
              required
            />
          )}
          {bairroError && (
            <p className="text-destructive text-sm mt-1">{bairroError}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Nome da Rua *</label>
          <input
            type="text"
            value={rua}
            onChange={(e) => onRuaChange(e.target.value)}
            placeholder="Ex: Rua das Flores"
            className="input-large"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Número aproximado (opcional)</label>
          <input
            type="text"
            value={numero}
            onChange={(e) => onNumeroChange(e.target.value)}
            placeholder="Ex: próximo ao 150"
            className="input-large"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Ponto de referência (opcional)</label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => onReferenciaChange(e.target.value)}
            placeholder="Ex: em frente ao mercado"
            className="input-large"
          />
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
