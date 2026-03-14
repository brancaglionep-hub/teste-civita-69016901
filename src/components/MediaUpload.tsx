import { Camera, Video, X, ImagePlus, AlertCircle } from "lucide-react";
import { useRef } from "react";
import { toast } from "@/hooks/use-toast";

interface MediaUploadProps {
  photos: File[];
  videos: File[];
  onPhotosChange: (files: File[]) => void;
  onVideosChange: (files: File[]) => void;
  limiteImagens?: number;
  permitirVideo?: boolean;
}

const MediaUpload = ({ 
  photos, 
  videos, 
  onPhotosChange, 
  onVideosChange,
  limiteImagens = 5,
  permitirVideo = true
}: MediaUploadProps) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const totalAfterAdd = photos.length + newFiles.length;
      
      if (totalAfterAdd > limiteImagens) {
        toast({
          title: "Limite de imagens",
          description: `Você pode adicionar no máximo ${limiteImagens} imagem(ns).`,
          variant: "destructive"
        });
        // Add only what fits
        const canAdd = limiteImagens - photos.length;
        if (canAdd > 0) {
          onPhotosChange([...photos, ...newFiles.slice(0, canAdd)]);
        }
        return;
      }
      
      onPhotosChange([...photos, ...newFiles]);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      onVideosChange([...videos, ...newFiles]);
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const removeVideo = (index: number) => {
    onVideosChange(videos.filter((_, i) => i !== index));
  };

  const fotosRestantes = limiteImagens - photos.length;
  const podeAdicionarFoto = fotosRestantes > 0;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-center">
        Fotos{permitirVideo ? ' e vídeos' : ''} ajudam a Prefeitura a resolver mais rápido.
      </p>

      {/* Limite de fotos */}
      <div className="text-center text-sm text-muted-foreground">
        {photos.length} de {limiteImagens} foto(s)
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => podeAdicionarFoto && cameraInputRef.current?.click()}
          disabled={!podeAdicionarFoto}
          className={`card-problem flex flex-col items-center justify-center gap-3 min-h-[120px] ${!podeAdicionarFoto ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Camera className="w-10 h-10 text-primary" />
          <span className="text-sm font-medium">Tirar Foto</span>
        </button>

        <button
          type="button"
          onClick={() => podeAdicionarFoto && photoInputRef.current?.click()}
          disabled={!podeAdicionarFoto}
          className={`card-problem flex flex-col items-center justify-center gap-3 min-h-[120px] ${!podeAdicionarFoto ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <ImagePlus className="w-10 h-10 text-primary" />
          <span className="text-sm font-medium">Galeria</span>
        </button>
      </div>

      {permitirVideo && (
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          className="card-problem w-full flex flex-col items-center justify-center gap-3 min-h-[100px]"
        >
          <Video className="w-10 h-10 text-primary" />
          <span className="text-sm font-medium">Adicionar Vídeo</span>
        </button>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="hidden"
      />

      {(photos.length > 0 || videos.length > 0) && (
        <div className="space-y-4">
          <h4 className="font-medium text-foreground">Arquivos selecionados:</h4>
          
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {videos.length > 0 && (
            <div className="space-y-2">
              {videos.map((video, index) => (
                <div key={index} className="flex items-center justify-between bg-muted rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-primary" />
                    <span className="text-sm truncate max-w-[180px]">{video.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVideo(index)}
                    className="w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaUpload;
