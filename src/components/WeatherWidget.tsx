import { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, CloudFog, CloudLightning, Loader2 } from "lucide-react";

interface WeatherWidgetProps {
  cidade: string;
  estado: string;
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
}

const getWeatherIcon = (code: number) => {
  // WMO Weather interpretation codes
  if (code === 0) return <Sun className="w-4 h-4" />;
  if (code >= 1 && code <= 3) return <Cloud className="w-4 h-4" />;
  if (code >= 45 && code <= 48) return <CloudFog className="w-4 h-4" />;
  if (code >= 51 && code <= 67) return <CloudRain className="w-4 h-4" />;
  if (code >= 71 && code <= 77) return <CloudSnow className="w-4 h-4" />;
  if (code >= 80 && code <= 82) return <CloudRain className="w-4 h-4" />;
  if (code >= 95 && code <= 99) return <CloudLightning className="w-4 h-4" />;
  return <Cloud className="w-4 h-4" />;
};

const WeatherWidget = ({ cidade, estado }: WeatherWidgetProps) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Geocoding para obter coordenadas da cidade
        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&country=BR`
        );
        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
          setLoading(false);
          return;
        }

        const { latitude, longitude } = geoData.results[0];

        // Buscar dados do tempo
        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=America/Sao_Paulo`
        );
        const weatherData = await weatherResponse.json();

        if (weatherData.current) {
          setWeather({
            temperature: Math.round(weatherData.current.temperature_2m),
            weatherCode: weatherData.current.weather_code
          });
        }
      } catch (error) {
        console.error("Erro ao buscar previsão do tempo:", error);
      } finally {
        setLoading(false);
      }
    };

    if (cidade) {
      fetchWeather();
    }
  }, [cidade, estado]);

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-primary-foreground/70">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (!weather) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-primary-foreground/90 bg-primary-foreground/10 px-3 py-1.5 rounded-full">
      <span className="text-sm font-medium">{cidade}</span>
      {getWeatherIcon(weather.weatherCode)}
      <span className="text-sm font-medium">
        {weather.temperature > 0 ? "+" : ""}{weather.temperature}
      </span>
    </div>
  );
};

export default WeatherWidget;