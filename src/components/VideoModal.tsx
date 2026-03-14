import { useState } from "react";
import { Play, Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VideoModalProps {
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const VideoModal = ({ videoUrl, isOpen, onClose, title }: VideoModalProps) => {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = title || "video";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{title || "Vídeo"}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar
            </Button>
          </div>
        </DialogHeader>
        <div className="p-4">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full max-h-[70vh] rounded-lg bg-black"
          >
            Seu navegador não suporta reprodução de vídeo.
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface VideoThumbnailProps {
  videoUrl: string;
  index: number;
  onClick: () => void;
}

export const VideoThumbnail = ({ videoUrl, index, onClick }: VideoThumbnailProps) => {
  const [thumbnailError, setThumbnailError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="relative w-full h-32 bg-muted rounded-lg overflow-hidden group hover:ring-2 hover:ring-primary transition-all"
    >
      {!thumbnailError ? (
        <video
          src={videoUrl}
          className="w-full h-full object-cover"
          preload="metadata"
          onError={() => setThumbnailError(true)}
          muted
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Play className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 group-hover:bg-black/60 transition-all">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
          <Play className="w-6 h-6 text-foreground fill-current ml-1" />
        </div>
      </div>
      <span className="absolute bottom-2 left-2 text-xs text-white bg-black/60 px-2 py-1 rounded">
        Vídeo {index + 1}
      </span>
    </button>
  );
};
