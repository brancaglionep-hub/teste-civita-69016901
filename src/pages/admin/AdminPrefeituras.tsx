import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
  slug: string;
  ativo: boolean;
  plano: "starter" | "pro";
  email_contato: string | null;
  telefone_contato: string | null;
}

const AdminPrefeituras = () => {
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrefeitura, setEditingPrefeitura] = useState<Prefeitura | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    cidade: "",
    slug: "",
    plano: "starter" as "starter" | "pro",
    email_contato: "",
    telefone_contato: ""
  });

  const fetchPrefeituras = async () => {
    const { data, error } = await supabase
      .from("prefeituras")
      .select("*")
      .order("cidade");

    if (!error && data) {
      setPrefeituras(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPrefeituras();
  }, []);

  const generateSlug = (cidade: string) => {
    return cidade
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleOpenDialog = (prefeitura?: Prefeitura) => {
    if (prefeitura) {
      setEditingPrefeitura(prefeitura);
      setFormData({
        nome: prefeitura.nome,
        cidade: prefeitura.cidade,
        slug: prefeitura.slug,
        plano: prefeitura.plano || "starter",
        email_contato: prefeitura.email_contato || "",
        telefone_contato: prefeitura.telefone_contato || ""
      });
    } else {
      setEditingPrefeitura(null);
      setFormData({
        nome: "",
        cidade: "",
        slug: "",
        plano: "starter",
        email_contato: "",
        telefone_contato: ""
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.cidade || !formData.slug) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    if (editingPrefeitura) {
      const { error } = await supabase
        .from("prefeituras")
        .update({
          nome: formData.nome,
          cidade: formData.cidade,
          slug: formData.slug,
          plano: formData.plano,
          email_contato: formData.email_contato || null,
          telefone_contato: formData.telefone_contato || null
        })
        .eq("id", editingPrefeitura.id);

      if (error) {
        toast({ title: "Erro ao atualizar", variant: "destructive" });
      } else {
        toast({ title: "Prefeitura atualizada!" });
        setDialogOpen(false);
        fetchPrefeituras();
      }
    } else {
      const { error } = await supabase
        .from("prefeituras")
        .insert({
          nome: formData.nome,
          cidade: formData.cidade,
          slug: formData.slug,
          plano: formData.plano,
          email_contato: formData.email_contato || null,
          telefone_contato: formData.telefone_contato || null
        });

      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Prefeitura criada!" });
        setDialogOpen(false);
        fetchPrefeituras();
      }
    }
  };

  const handleToggleAtivo = async (prefeitura: Prefeitura) => {
    const { error } = await supabase
      .from("prefeituras")
      .update({ ativo: !prefeitura.ativo })
      .eq("id", prefeitura.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: prefeitura.ativo ? "Prefeitura desativada" : "Prefeitura ativada" });
      fetchPrefeituras();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta prefeitura? Todos os dados relacionados serão excluídos permanentemente.")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('delete-prefeitura', {
        body: { prefeitura_id: id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao excluir');
      }

      toast({ title: "Prefeitura excluída!" });
      fetchPrefeituras();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast({ title: "Erro ao excluir prefeitura", variant: "destructive" });
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Prefeituras</h1>
          <p className="text-muted-foreground mt-1">Gerencie as prefeituras do sistema</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Prefeitura
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cidade</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prefeituras.map((prefeitura) => (
              <TableRow key={prefeitura.id}>
                <TableCell className="font-medium">{prefeitura.cidade}</TableCell>
                <TableCell>{prefeitura.nome}</TableCell>
                <TableCell className="text-muted-foreground">/{prefeitura.slug}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    prefeitura.plano === "pro" 
                      ? "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700" 
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {prefeitura.plano === "pro" ? (
                      <>
                        <Crown className="w-3 h-3" />
                        PRO
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        STARTER
                      </>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    prefeitura.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {prefeitura.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleAtivo(prefeitura)}
                      title={prefeitura.ativo ? "Desativar" : "Ativar"}
                    >
                      {prefeitura.ativo ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(prefeitura)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(prefeitura.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrefeitura ? "Editar Prefeitura" : "Nova Prefeitura"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome da Prefeitura *</label>
              <Input
                placeholder="Ex: Prefeitura Municipal de Biguaçu"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Cidade *</label>
              <Input
                placeholder="Ex: Biguaçu"
                value={formData.cidade}
                onChange={(e) => {
                  const cidade = e.target.value;
                  setFormData({ 
                    ...formData, 
                    cidade,
                    slug: editingPrefeitura ? formData.slug : generateSlug(cidade)
                  });
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Slug (URL) *</label>
              <Input
                placeholder="Ex: biguacu"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Plano *</label>
              <Select
                value={formData.plano}
                onValueChange={(value: "starter" | "pro") => setFormData({ ...formData, plano: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-slate-500" />
                      <span>Starter</span>
                      <span className="text-xs text-muted-foreground">- Básico</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pro">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-500" />
                      <span>Pro</span>
                      <span className="text-xs text-muted-foreground">- WhatsApp + Integrações</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">E-mail de contato</label>
              <Input
                type="email"
                placeholder="contato@prefeitura.gov.br"
                value={formData.email_contato}
                onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Telefone de contato</label>
              <Input
                placeholder="(48) 3333-3333"
                value={formData.telefone_contato}
                onChange={(e) => setFormData({ ...formData, telefone_contato: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingPrefeitura ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPrefeituras;
