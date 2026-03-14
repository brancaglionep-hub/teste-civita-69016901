import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Upload, FolderOpen, FileIcon, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size: number; mimetype: string } | null;
}

const BUCKET = "project-files";

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileManager = () => {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const fetchFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setFiles((data as StorageFile[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.name)));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const filesToDelete = Array.from(selected);
    const { error } = await supabase.storage.from(BUCKET).remove(filesToDelete);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído", description: `${filesToDelete.length} arquivo(s) removido(s).` });
      setSelected(new Set());
      fetchFiles();
    }
    setDeleting(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    let successCount = 0;
    for (const file of Array.from(fileList)) {
      const { error } = await supabase.storage.from(BUCKET).upload(file.name, file, {
        upsert: true,
      });
      if (error) {
        toast({ title: `Erro: ${file.name}`, description: error.message, variant: "destructive" });
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast({ title: "Upload concluído", description: `${successCount} arquivo(s) enviado(s).` });
      fetchFiles();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getPublicUrl = (name: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return data.publicUrl;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <Card className="border-border">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-2xl">Gerenciador de Arquivos</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selected.size === files.length && files.length > 0 ? "Desmarcar" : "Selecionar todos"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                disabled={selected.size === 0 || deleting}
                className="gap-1"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir ({selected.size})
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Upload */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/50 p-8 transition-colors hover:border-primary hover:bg-muted"
            >
              {uploading ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {uploading ? "Enviando..." : "Clique para fazer upload de arquivos"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            {/* File list */}
            <div className="space-y-1">
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                Arquivos no storage ({files.length})
              </p>

              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {!loading && files.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <FolderOpen className="h-12 w-12" />
                  <p>Nenhum arquivo. Faça upload para começar.</p>
                </div>
              )}

              {!loading &&
                files.map((file) => {
                  const isImage = file.metadata?.mimetype?.startsWith("image/");
                  return (
                    <div
                      key={file.name}
                      onClick={() => toggleSelect(file.name)}
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                        selected.has(file.name)
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(file.name)}
                        onChange={() => toggleSelect(file.name)}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      {isImage ? (
                        <img
                          src={getPublicUrl(file.name)}
                          alt={file.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.metadata?.size ? formatSize(file.metadata.size) : "—"}{" "}
                          · {new Date(file.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FileManager;
