import { useEffect, useState } from "react";
import { Plus, Trash2, Users, Building2, Eye, EyeOff, Loader2, Edit2, Shield, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
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

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  prefeitura_id: string | null;
  created_at: string;
  prefeitura?: {
    nome: string;
    cidade: string;
  };
  profile?: {
    nome: string | null;
    email: string | null;
  };
}

interface Prefeitura {
  id: string;
  nome: string;
  cidade: string;
}

const AdminUsuarios = () => {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nome: "",
    prefeitura_id: "",
    role: "admin_prefeitura" as "super_admin" | "admin_prefeitura"
  });

  const fetchData = async () => {
    // Fetch all users (super_admin and admin_prefeitura)
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select(`
        *,
        prefeitura:prefeituras(nome, cidade)
      `)
      .in("role", ["super_admin", "admin_prefeitura"])
      .order("created_at", { ascending: false });

    if (!rolesError && rolesData) {
      // Fetch profiles for these users
      const userIds = rolesData.map(r => r.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      const usersWithProfiles = rolesData.map(role => ({
        ...role,
        profile: profilesData?.find(p => p.id === role.user_id)
      }));

      // Ordenar: super_admin primeiro, depois por data de criação
      const sortedUsers = usersWithProfiles.sort((a, b) => {
        if (a.role === "super_admin" && b.role !== "super_admin") return -1;
        if (a.role !== "super_admin" && b.role === "super_admin") return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setUsers(sortedUsers);
    }

    // Fetch prefeituras
    const { data: prefData } = await supabase
      .from("prefeituras")
      .select("id, nome, cidade")
      .eq("ativo", true)
      .order("cidade");

    if (prefData) {
      setPrefeituras(prefData);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDialog = (user?: UserRole) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.profile?.email || "",
        password: "",
        nome: user.profile?.nome || "",
        prefeitura_id: user.prefeitura_id || "",
        role: user.role as "super_admin" | "admin_prefeitura"
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: "",
        password: "",
        nome: "",
        prefeitura_id: "",
        role: "admin_prefeitura"
      });
    }
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingUser) {
      // Creating new user
      if (!formData.email || !formData.password) {
        toast({ title: "E-mail e senha são obrigatórios", variant: "destructive" });
        return;
      }

      if (formData.role === "admin_prefeitura" && !formData.prefeitura_id) {
        toast({ title: "Selecione uma prefeitura para admin de prefeitura", variant: "destructive" });
        return;
      }

      if (formData.password.length < 6) {
        toast({ title: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
        return;
      }

      setSaving(true);

      try {
        const response = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            nome: formData.nome,
            prefeitura_id: formData.role === "admin_prefeitura" ? formData.prefeitura_id : null,
            role: formData.role
          }
        });

        if (response.error) {
          throw new Error(response.error.message || 'Erro ao criar usuário');
        }

        if (response.data?.error) {
          throw new Error(response.data.error);
        }

        toast({ title: "Usuário criado com sucesso!" });
        setDialogOpen(false);
        fetchData();
      } catch (error: any) {
        console.error('Error creating user:', error);
        toast({ 
          title: "Erro ao criar usuário", 
          description: error.message,
          variant: "destructive" 
        });
      } finally {
        setSaving(false);
      }
    } else {
      // Updating existing user
      if (!formData.email) {
        toast({ title: "E-mail é obrigatório", variant: "destructive" });
        return;
      }

      if (formData.role === "admin_prefeitura" && !formData.prefeitura_id) {
        toast({ title: "Selecione uma prefeitura para admin de prefeitura", variant: "destructive" });
        return;
      }

      if (formData.password && formData.password.length < 6) {
        toast({ title: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
        return;
      }

      setSaving(true);

      try {
        const updateData: any = {
          user_id: editingUser.user_id,
          email: formData.email,
          nome: formData.nome,
          prefeitura_id: formData.role === "admin_prefeitura" ? formData.prefeitura_id : null,
          role: formData.role,
          old_role: editingUser.role
        };

        if (formData.password) {
          updateData.password = formData.password;
        }

        const response = await supabase.functions.invoke('update-user', {
          body: updateData
        });

        if (response.error) {
          throw new Error(response.error.message || 'Erro ao atualizar usuário');
        }

        if (response.data?.error) {
          throw new Error(response.data.error);
        }

        toast({ title: "Usuário atualizado com sucesso!" });
        setDialogOpen(false);
        fetchData();
      } catch (error: any) {
        console.error('Error updating user:', error);
        toast({ 
          title: "Erro ao atualizar usuário", 
          description: error.message,
          variant: "destructive" 
        });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${email}?`)) return;

    try {
      const response = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao excluir usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({ title: "Usuário excluído!" });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({ 
        title: "Erro ao excluir", 
        description: error.message,
        variant: "destructive" 
      });
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground mt-1">Gerencie os administradores do sistema</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prefeitura</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  Nenhum usuário cadastrado
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.profile?.nome || "-"}
                  </TableCell>
                  <TableCell>{user.profile?.email || "-"}</TableCell>
                  <TableCell>
                    {user.role === "super_admin" ? (
                      <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                        <Shield className="w-3 h-3 mr-1" />
                        Super Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <UserCog className="w-3 h-3 mr-1" />
                        Admin Prefeitura
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.role === "super_admin" ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {user.prefeitura?.cidade || "-"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(user)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user.user_id, user.profile?.email || "")}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Usuário *</label>
              <Select
                value={formData.role}
                onValueChange={(value: "super_admin" | "admin_prefeitura") => 
                  setFormData({ ...formData, role: value, prefeitura_id: value === "super_admin" ? "" : formData.prefeitura_id })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-500" />
                      Super Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="admin_prefeitura">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4" />
                      Admin de Prefeitura
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === "admin_prefeitura" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Prefeitura *</label>
                <Select
                  value={formData.prefeitura_id}
                  onValueChange={(value) => setFormData({ ...formData, prefeitura_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a prefeitura" />
                  </SelectTrigger>
                  <SelectContent>
                    {prefeituras.map((pref) => (
                      <SelectItem key={pref.id} value={pref.id}>
                        {pref.cidade} - {pref.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Nome do usuário</label>
              <Input
                placeholder="Nome completo"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">E-mail *</label>
              <Input
                type="email"
                placeholder="usuario@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                {editingUser ? "Nova Senha (deixe em branco para manter)" : "Senha *"}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={editingUser ? "••••••••" : "Mínimo 6 caracteres"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {editingUser ? "Salvando..." : "Criando..."}
                  </>
                ) : (
                  editingUser ? "Salvar" : "Criar Usuário"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsuarios;
