import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Upload, FileIcon, Image, Code, File, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface ProjectFile {
  name: string;
  path: string;
  type: "image" | "code" | "config" | "other";
  size?: string;
}

const initialFiles: ProjectFile[] = [
  { name: "hero-beauty.jpg", path: "src/assets/hero-beauty.jpg", type: "image" },
  { name: "service-hair.jpg", path: "src/assets/service-hair.jpg", type: "image" },
  { name: "service-makeup.jpg", path: "src/assets/service-makeup.jpg", type: "image" },
  { name: "service-nails.jpg", path: "src/assets/service-nails.jpg", type: "image" },
  { name: "service-skincare.jpg", path: "src/assets/service-skincare.jpg", type: "image" },
  { name: "favicon.ico", path: "public/favicon.ico", type: "image" },
  { name: "placeholder.svg", path: "public/placeholder.svg", type: "image" },
];

const getFileIcon = (type: string) => {
  switch (type) {
    case "image": return <Image className="h-5 w-5 text-primary" />;
    case "code": return <Code className="h-5 w-5 text-blue-500" />;
    default: return <File className="h-5 w-5 text-muted-foreground" />;
  }
};

const FileManager = () => {
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const toggleSelect = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === files.length + uploadedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      const all = new Set([
        ...files.map((f) => f.path),
        ...uploadedFiles.map((f) => f.name),
      ]);
      setSelectedFiles(all);
    }
  };

  const deleteSelected = () => {
    setFiles((prev) => prev.filter((f) => !selectedFiles.has(f.path)));
    setUploadedFiles((prev) => prev.filter((f) => !selectedFiles.has(f.name)));
    toast({
      title: "Arquivos removidos",
      description: `${selectedFiles.size} arquivo(s) removido(s) com sucesso.`,
    });
    setSelectedFiles(new Set());
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const newFiles = Array.from(fileList).map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    toast({
      title: "Upload realizado",
      description: `${newFiles.length} arquivo(s) enviado(s) com sucesso.`,
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const totalFiles = files.length + uploadedFiles.length;

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
            <CardTitle className="font-display text-2xl">
              Gerenciador de Arquivos
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                {selectedFiles.size === totalFiles && totalFiles > 0
                  ? "Desmarcar todos"
                  : "Selecionar todos"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                disabled={selectedFiles.size === 0}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Excluir ({selectedFiles.size})
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/50 p-8 transition-colors hover:border-primary hover:bg-muted"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Clique para fazer upload de novos arquivos
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
                Arquivos do projeto ({totalFiles})
              </p>

              {totalFiles === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhum arquivo encontrado. Faça upload para começar.
                </p>
              )}

              {files.map((file) => (
                <div
                  key={file.path}
                  onClick={() => toggleSelect(file.path)}
                  className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                    selectedFiles.has(file.path)
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.path)}
                    onChange={() => toggleSelect(file.path)}
                    className="h-4 w-4 accent-primary"
                  />
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {file.path}
                    </p>
                  </div>
                </div>
              ))}

              {uploadedFiles.map((file) => (
                <div
                  key={file.name}
                  onClick={() => toggleSelect(file.name)}
                  className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                    selectedFiles.has(file.name)
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.name)}
                    onChange={() => toggleSelect(file.name)}
                    className="h-4 w-4 accent-primary"
                  />
                  <FileIcon className="h-5 w-5 text-green-500" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Novo upload
                    </p>
                  </div>
                  {file.type.startsWith("image/") && (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FileManager;
