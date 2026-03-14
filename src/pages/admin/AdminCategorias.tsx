import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ativo: boolean;
  global: boolean;
  ordem: number;
}

const AdminCategorias = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({ nome: "", descricao: "" });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fetchCategorias = async () => {
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .eq("global", true)
      .order("ordem", { ascending: true });

    if (!error && data) {
      setCategorias(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = categorias.findIndex((c) => c.id === draggedId);
    const targetIndex = categorias.findIndex((c) => c.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    const newCategorias = [...categorias];
    const [removed] = newCategorias.splice(draggedIndex, 1);
    newCategorias.splice(targetIndex, 0, removed);

    setCategorias(newCategorias);
    setDraggedId(null);

    for (let i = 0; i < newCategorias.length; i++) {
      await supabase
        .from("categorias")
        .update({ ordem: i })
        .eq("id", newCategorias[i].id);
    }

    toast({ title: "Ordem atualizada!" });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleOpenDialog = (categoria?: Categoria) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({ nome: categoria.nome, descricao: categoria.descricao || "" });
    } else {
      setEditingCategoria(null);
      setFormData({ nome: "", descricao: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast({ title: "Digite o nome da categoria", variant: "destructive" });
      return;
    }

    if (editingCategoria) {
      const { error } = await supabase
        .from("categorias")
        .update({ nome: formData.nome.trim(), descricao: formData.descricao || null })
        .eq("id", editingCategoria.id);

      if (error) {
        toast({ title: "Erro ao atualizar", variant: "destructive" });
      } else {
        toast({ title: "Categoria atualizada!" });
        setDialogOpen(false);
        fetchCategorias();
      }
    } else {
      const maxOrdem = categorias.length > 0 ? Math.max(...categorias.map(c => c.ordem || 0)) : 0;
      
      const { error } = await supabase
        .from("categorias")
        .insert({
          nome: formData.nome.trim(),
          descricao: formData.descricao || null,
          global: true,
          ordem: maxOrdem + 1
        });

      if (error) {
        toast({ title: "Erro ao criar", variant: "destructive" });
      } else {
        toast({ title: "Categoria global criada!" });
        setDialogOpen(false);
        fetchCategorias();
      }
    }
  };

  const handleToggleAtivo = async (categoria: Categoria) => {
    const { error } = await supabase
      .from("categorias")
      .update({ ativo: !categoria.ativo })
      .eq("id", categoria.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: categoria.ativo ? "Categoria desativada" : "Categoria ativada" });
      fetchCategorias();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria global? Isso afetará todas as prefeituras.")) return;

    const { error } = await supabase
      .from("categorias")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao excluir", description: "Pode haver reclamações vinculadas", variant: "destructive" });
    } else {
      toast({ title: "Categoria excluída!" });
      fetchCategorias();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Categorias Globais</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie categorias disponíveis para todas as prefeituras
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      <div className="space-y-2">
        {categorias.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
            Nenhuma categoria global cadastrada
          </div>
        ) : (
          categorias.map((categoria) => (
            <div
              key={categoria.id}
              draggable
              onDragStart={(e) => handleDragStart(e, categoria.id)}
              onDragOver={(e) => handleDragOver(e, categoria.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, categoria.id)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-4 p-4 bg-card border rounded-lg transition-all cursor-move ${
                draggedId === categoria.id ? "opacity-50 border-primary" : "border-border"
              } ${dragOverId === categoria.id ? "border-primary border-2 bg-primary/5" : ""}`}
            >
              <div className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
                <GripVertical className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{categoria.nome}</p>
                {categoria.descricao && (
                  <p className="text-sm text-muted-foreground truncate">{categoria.descricao}</p>
                )}
              </div>

              <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-purple-100 text-purple-700">
                Global
              </span>

              <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                categoria.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
              }`}>
                {categoria.ativo ? "Ativo" : "Inativo"}
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleAtivo(categoria)}
                  title="Ativar/desativar"
                >
                  {categoria.ativo ? (
                    <ToggleRight className="w-5 h-5 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenDialog(categoria)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(categoria.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategoria ? "Editar Categoria Global" : "Nova Categoria Global"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome da Categoria</label>
              <Input
                placeholder="Ex: Buraco na rua"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Descrição (opcional)</label>
              <Textarea
                placeholder="Descreva esta categoria..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingCategoria ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCategorias;
