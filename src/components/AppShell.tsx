import React, { useState } from "react";
import {
  FileText,
  AlertTriangle,
  Plus,
  RefreshCw,
  FolderGit2,
  Trash2,
} from "lucide-react";
import { useGoalStore } from "@/store/useGoalStore";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AppShellProps {
  onCreateFile?: (filename: string, title: string) => void;
  onDeleteFile?: (filename: string) => void;
  onRefreshFiles?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  onCreateFile,
  onDeleteFile,
  onRefreshFiles,
  children,
}: AppShellProps) {
  const documents = useGoalStore((s) => s.documents);
  const corruptedFiles = useGoalStore((s) => s.corruptedFiles);
  const activeFilename = useGoalStore((s) => s.activeFilename);
  const setActiveFilename = useGoalStore((s) => s.setActiveFilename);
  const getDocumentProgress = useGoalStore((s) => s.getDocumentProgress);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFilename, setNewFilename] = useState("");

  const allFilenames = Array.from(
    new Set([...Object.keys(documents), ...Object.keys(corruptedFiles)])
  ).sort();

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const rawSlug =
      newFilename.trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") ||
      `goal-${Date.now()}`;
    const filename = rawSlug.endsWith(".md") ? rawSlug : `${rawSlug}.md`;
    onCreateFile?.(filename, title);
    setNewTitle("");
    setNewFilename("");
    setDialogOpen(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar in Deep Navy Blue */}
      <aside className="w-72 shrink-0 border-r border-border bg-card/90 flex flex-col shadow-xl">
        <div className="p-4 border-b border-border bg-secondary/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary drop-shadow-[0_0_6px_rgba(0,255,65,0.45)]" />
            <span className="font-semibold text-sm tracking-tight text-foreground">
              Superobjetivos
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {onRefreshFiles && (
              <button
                type="button"
                onClick={onRefreshFiles}
                title="Sincronizar y recargar archivos"
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  title="Nuevo Superobjetivo"
                  className="p-1.5 rounded-md bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,255,65,0.3)] hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="border-border bg-card text-foreground">
                <DialogHeader>
                  <DialogTitle className="text-primary">
                    Nuevo Superobjetivo
                  </DialogTitle>
                  <DialogDescription>
                    Crea un nuevo archivo Markdown local con Frontmatter validado.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Título del Superobjetivo
                    </label>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.currentTarget.value)}
                      placeholder="Ej. Lanzamiento Producto Q4"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Nombre de archivo (opcional)
                    </label>
                    <input
                      value={newFilename}
                      onChange={(e) => setNewFilename(e.currentTarget.value)}
                      placeholder="Ej. lanzamiento-q4.md"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <DialogFooter>
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      Crear archivo
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <nav
          className="flex-1 overflow-y-auto p-2 space-y-1.5"
          aria-label="Lista de archivos"
        >
          {allFilenames.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No hay archivos `.md` en el directorio de objetivos.
            </div>
          ) : (
            allFilenames.map((filename) => {
              const isCorrupted = Boolean(corruptedFiles[filename]);
              const doc = documents[filename];
              const isActive = activeFilename === filename;
              const progress = doc ? getDocumentProgress(filename) : 0;

              return (
                <div
                  key={filename}
                  onClick={() => setActiveFilename(filename)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setActiveFilename(filename);
                    }
                  }}
                  className={cn(
                    "group w-full text-left rounded-md px-3 py-2.5 text-sm transition-all flex flex-col gap-1.5 cursor-pointer border",
                    isActive
                      ? "bg-accent/90 border-primary/50 text-foreground font-medium shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                      : "border-transparent hover:bg-secondary/70 hover:border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      {isCorrupted ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <FileText
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-primary" : "text-blue-400"
                          )}
                        />
                      )}
                      <span className="truncate">
                        {doc ? doc.frontmatter.title : filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isCorrupted && (
                        <span className="text-xs font-mono text-primary">
                          {progress}%
                        </span>
                      )}
                      {onDeleteFile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFile(filename);
                          }}
                          title={`Eliminar objetivo ${filename}`}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/80">
                    <span className="truncate font-mono">{filename}</span>
                  </div>
                  {!isCorrupted && <Progress value={progress} className="h-1" />}
                </div>
              );
            })
          )}
        </nav>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-gradient-to-br from-background via-card to-secondary/40">
        {children}
      </main>
    </div>
  );
}
