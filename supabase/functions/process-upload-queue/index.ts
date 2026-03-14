import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueItem {
  id: string;
  prefeitura_id: string;
  reclamacao_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string | null;
  status: string;
  retry_count: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending uploads (limit to prevent overwhelming)
    const { data: pendingUploads, error: fetchError } = await supabase
      .from('upload_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching queue:', fetchError);
      throw fetchError;
    }

    if (!pendingUploads || pendingUploads.length === 0) {
      console.log('No pending uploads in queue');
      return new Response(
        JSON.stringify({ message: 'No pending uploads', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingUploads.length} uploads`);

    let processed = 0;
    let failed = 0;

    for (const item of pendingUploads as QueueItem[]) {
      try {
        // Mark as processing
        await supabase
          .from('upload_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', item.id);

        // Simulate processing delay (in real scenario, this would be the actual upload)
        // The file is already in storage, we just need to update the record
        
        if (item.storage_path) {
          // Mark as completed
          await supabase
            .from('upload_queue')
            .update({ 
              status: 'completed', 
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          processed++;
          console.log(`Processed upload ${item.id}: ${item.file_name}`);
        } else {
          throw new Error('No storage path available');
        }
      } catch (itemError: unknown) {
        const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
        console.error(`Error processing item ${item.id}:`, itemError);
        
        // Mark as failed with retry count
        await supabase
          .from('upload_queue')
          .update({ 
            status: item.retry_count >= 2 ? 'failed' : 'pending',
            retry_count: item.retry_count + 1,
            error_message: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        failed++;
      }
    }

    console.log(`Queue processing complete. Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        message: 'Queue processed',
        processed,
        failed,
        total: pendingUploads.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-upload-queue:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});