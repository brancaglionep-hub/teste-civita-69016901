import { Camera, Video, X, ImagePlus, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useRef, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useUploadQueue } from "@/hooks/useUploadQueue";

interface MediaUploadQueueProps {
  prefeituraId: string;
  onPhotosUploaded: (urls: string[]) => void;
  onVideosUploaded: (urls: string[]) => void;
}

const MediaUploadQueue = ({ 
  prefeituraId, 
  onPhotosUploaded, 
  onVideosUploaded 
}: MediaUploadQueueProps) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const photoQueue = useUploadQueue({
    prefeituraId,
    maxConcurrent: 2,
    onComplete: (paths) => onPhotosUploaded(paths)
  });

  const videoQueue = useUploadQueue({
    prefeituraId,
    maxConcurrent: 1,
    onComplete: (paths) => onVideosUploaded(paths)
  });

  // Auto-process when items are added
  useEffect(() => {
    if (photoQueue.pendingCount > 0 && !photoQueue.isProcessing) {
      photoQueue.processQueue();
    }
  }, [photoQueue.pendingCount, photoQueue.isProcessing]);

  useEffect(() => {
    if (videoQueue.pendingCount > 0 && !videoQueue.isProcessing) {
      videoQueue.processQueue();
    }
  }, [videoQueue.pendingCount, videoQueue.isProcessing]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      photoQueue.addToQueue(newFiles);
    }
    e.target.value = '';
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      videoQueue.addToQueue(newFiles);
    }
    e.target.value = '';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-muted-foreground/30" />;
    }
  };

  const totalItems = photoQueue.queue.length + videoQueue.queue.length;
  const isProcessing = photoQueue.isProcessing || videoQueue.isProcessing;
  const hasFailures = photoQueue.failedCount > 0 || videoQueue.failedCount > 0;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-center">
        Fotos e vídeos ajudam a Prefeitura a resolver mais rápido.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="card-problem flex flex-col items-center justify-center gap-3 min-h-[120px]"
          disabled={isProcessing}
        >
          <Camera className="w-10 h-10 text-primary" />
          <span className="text-sm font-medium">Tirar Foto</span>
        </button>

        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="card-problem flex flex-col items-center justify-center gap-3 min-h-[120px]"
          disabled={isProcessing}
        >
          <ImagePlus className="w-10 h-10 text-primary" />
          <span className="text-sm font-medium">Galeria</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => videoInputRef.current?.click()}
        className="card-problem w-full flex flex-col items-center justify-center gap-3 min-h-[100px]"
        disabled={isProcessing}
      >
        <Video className="w-10 h-10 text-primary" />
        <span className="text-sm font-medium">Adicionar Vídeo</span>
      </button>

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

      {/* Upload Status */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Enviando arquivos...</span>
        </div>
      )}

      {/* Photo Queue */}
      {photoQueue.queue.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Fotos ({photoQueue.completedCount}/{photoQueue.queue.length})</h4>
            {photoQueue.failedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={photoQueue.retryFailed}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Tentar novamente
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {photoQueue.queue.map((item) => (
              <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                <img
                  src={URL.createObjectURL(item.file)}
                  alt={item.file.name}
                  className={`w-full h-full object-cover ${item.status === 'uploading' ? 'opacity-70' : ''}`}
                />
                
                {/* Progress overlay */}
                {item.status === 'uploading' && (
                  <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center p-2">
                    <Progress value={item.progress} className="w-full h-1" />
                    <span className="text-xs mt-1">{item.progress}%</span>
                  </div>
                )}

                {/* Status indicator */}
                <div className="absolute top-1 left-1">
                  {getStatusIcon(item.status)}
                </div>

                {/* Remove button */}
                {item.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => photoQueue.removeFromQueue(item.id)}
                    className="absolute top-1 right-1 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Error message */}
                {item.status === 'failed' && item.error && (
                  <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-destructive-foreground text-xs p-1 truncate">
                    {item.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Queue */}
      {videoQueue.queue.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Vídeos ({videoQueue.completedCount}/{videoQueue.queue.length})</h4>
            {videoQueue.failedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={videoQueue.retryFailed}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Tentar novamente
              </Button>
            )}
          </div>
          
          <div className="space-y-2">
            {videoQueue.queue.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-muted rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(item.status)}
                  <Video className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm truncate">{item.file.name}</span>
                </div>

                {item.status === 'uploading' && (
                  <div className="w-20 mx-2">
                    <Progress value={item.progress} className="h-1" />
                  </div>
                )}

                {item.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => videoQueue.removeFromQueue(item.id)}
                    className="w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retry all failed */}
      {hasFailures && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              photoQueue.retryFailed();
              videoQueue.retryFailed();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar enviar arquivos com falha
          </Button>
        </div>
      )}
    </div>
  );
};

export default MediaUploadQueue;