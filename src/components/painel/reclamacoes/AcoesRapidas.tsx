import { useState } from 'react';
import { MoreHorizontal, CheckCircle, Clock, Archive, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { statusConfig } from './types';

interface AcoesRapidasProps {
  reclamacaoId: string;
  statusAtual: string;
  onStatusChange: () => void;
}

export const AcoesRapidas = ({ reclamacaoId, statusAtual, onStatusChange }: AcoesRapidasProps) => {
  const [comentarioDialogOpen, setComentarioDialogOpen] = useState(false);
  const [comentario, setComentario] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = async (novoStatus: string) => {
    setIsLoading(true);
    try {
      // Buscar o user autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      // Atualizar status da reclamação
      const { error: updateError } = await supabase
        .from('reclamacoes')
        .update({ status: novoStatus as any })
        .eq('id', reclamacaoId);

      if (updateError) throw updateError;

      // Registrar no histórico
      const { error: historicoError } = await supabase
        .from('historico_status')
        .insert({
          reclamacao_id: reclamacaoId,
          status_anterior: statusAtual as any,
          status_novo: novoStatus as any,
          usuario_id: user?.id || null,
          observacao: `Status alterado de "${statusConfig[statusAtual]?.label}" para "${statusConfig[novoStatus]?.label}"`
        });

      if (historicoError) throw historicoError;

      toast({ title: 'Status atualizado com sucesso!' });
      onStatusChange();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({ title: 'Erro ao alterar status', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComentario = async () => {
    if (!comentario.trim()) return;
    
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('historico_status')
        .insert({
          reclamacao_id: reclamacaoId,
          status_anterior: statusAtual as any,
          status_novo: statusAtual as any,
          usuario_id: user?.id || null,
          observacao: comentario.trim()
        });

      if (error) throw error;

      toast({ title: 'Comentário adicionado!' });
      setComentario('');
      setComentarioDialogOpen(false);
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast({ title: 'Erro ao adicionar comentário', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const statusOptions = Object.entries(statusConfig).filter(([key]) => key !== statusAtual);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isLoading}>
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CheckCircle className="w-4 h-4 mr-2" />
              Alterar Status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {statusOptions.map(([key, config]) => (
                <DropdownMenuItem 
                  key={key} 
                  onClick={() => handleStatusChange(key)}
                  className="gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${config.bgClass}`} />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setComentarioDialogOpen(true)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Adicionar Nota
          </DropdownMenuItem>
          
          {statusAtual !== 'arquivada' && (
            <DropdownMenuItem 
              onClick={() => handleStatusChange('arquivada')}
              className="text-muted-foreground"
            >
              <Archive className="w-4 h-4 mr-2" />
              Arquivar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={comentarioDialogOpen} onOpenChange={setComentarioDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nota Interna</DialogTitle>
            <DialogDescription>
              Esta nota ficará registrada no histórico da reclamação.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Digite sua nota..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setComentarioDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddComentario} disabled={isLoading || !comentario.trim()}>
              Salvar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
