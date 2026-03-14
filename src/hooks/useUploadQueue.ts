import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadQueueItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  storagePath?: string;
  error?: string;
}

interface UseUploadQueueOptions {
  prefeituraId: string;
  reclamacaoId?: string;
  maxConcurrent?: number;
  onComplete?: (paths: string[]) => void;
}

export const useUploadQueue = ({
  prefeituraId,
  reclamacaoId,
  maxConcurrent = 2,
  onComplete
}: UseUploadQueueOptions) => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addToQueue = useCallback((files: File[]) => {
    const newItems: UploadQueueItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
      progress: 0
    }));

    setQueue(prev => [...prev, ...newItems]);
    return newItems.map(item => item.id);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const uploadFile = async (item: UploadQueueItem): Promise<string | null> => {
    try {
      const fileExt = item.file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${prefeituraId}/${fileName}`;

      // Update status to uploading
      setQueue(prev => prev.map(q => 
        q.id === item.id ? { ...q, status: 'uploading' as const, progress: 10 } : q
      ));

      // Register in queue table first
      const { error: queueError } = await supabase
        .from('upload_queue')
        .insert({
          prefeitura_id: prefeituraId,
          reclamacao_id: reclamacaoId || null,
          file_name: item.file.name,
          file_type: item.file.type,
          file_size: item.file.size,
          status: 'processing'
        });

      if (queueError) {
        console.error('Error registering in queue:', queueError);
      }

      // Update progress
      setQueue(prev => prev.map(q => 
        q.id === item.id ? { ...q, progress: 30 } : q
      ));

      // Upload to storage
      const { error: uploadError, data } = await supabase.storage
        .from('reclamacoes-media')
        .upload(filePath, item.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Update progress
      setQueue(prev => prev.map(q => 
        q.id === item.id ? { ...q, progress: 80 } : q
      ));

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('reclamacoes-media')
        .getPublicUrl(filePath);

      // Update queue record
      await supabase
        .from('upload_queue')
        .update({ 
          status: 'completed',
          storage_path: urlData.publicUrl,
          completed_at: new Date().toISOString()
        })
        .eq('file_name', item.file.name)
        .eq('prefeitura_id', prefeituraId);

      // Mark as completed
      setQueue(prev => prev.map(q => 
        q.id === item.id ? { 
          ...q, 
          status: 'completed' as const, 
          progress: 100,
          storagePath: urlData.publicUrl 
        } : q
      ));

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Mark as failed
      setQueue(prev => prev.map(q => 
        q.id === item.id ? { 
          ...q, 
          status: 'failed' as const, 
          error: error.message 
        } : q
      ));

      return null;
    }
  };

  const processQueue = useCallback(async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    const pendingItems = queue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      setIsProcessing(false);
      return;
    }

    const completedPaths: string[] = [];
    
    // Process in batches
    for (let i = 0; i < pendingItems.length; i += maxConcurrent) {
      const batch = pendingItems.slice(i, i + maxConcurrent);
      
      const results = await Promise.allSettled(
        batch.map(item => uploadFile(item))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          completedPaths.push(result.value);
        }
      });

      // Small delay between batches to prevent overwhelming
      if (i + maxConcurrent < pendingItems.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsProcessing(false);

    if (completedPaths.length > 0) {
      onComplete?.(completedPaths);
    }

    const failedCount = queue.filter(item => item.status === 'failed').length;
    if (failedCount > 0) {
      toast.error(`${failedCount} arquivo(s) falharam no upload`);
    }
  }, [queue, isProcessing, maxConcurrent, onComplete, prefeituraId, reclamacaoId]);

  const retryFailed = useCallback(() => {
    setQueue(prev => prev.map(item => 
      item.status === 'failed' ? { ...item, status: 'pending' as const, error: undefined } : item
    ));
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(item => item.status !== 'completed'));
  }, []);

  const getCompletedPaths = useCallback(() => {
    return queue
      .filter(item => item.status === 'completed' && item.storagePath)
      .map(item => item.storagePath!);
  }, [queue]);

  return {
    queue,
    isProcessing,
    addToQueue,
    removeFromQueue,
    processQueue,
    retryFailed,
    clearCompleted,
    getCompletedPaths,
    pendingCount: queue.filter(item => item.status === 'pending').length,
    uploadingCount: queue.filter(item => item.status === 'uploading').length,
    completedCount: queue.filter(item => item.status === 'completed').length,
    failedCount: queue.filter(item => item.status === 'failed').length
  };
};