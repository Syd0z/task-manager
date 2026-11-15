import { useCallback, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import {
  CorruptedFileOverlay,
  ViewErrorBoundary,
} from "@/components/CorruptedFileOverlay";
import { GoalTree } from "@/components/GoalTree";
import { Progress } from "@/components/ui/progress";
import { serializeGoalDocument } from "@/domain/serializer";
import { ipcGitPull, ipcReadAllFiles, ipcWriteFile } from "@/services/ipc";
import { useGoalStore } from "@/store/useGoalStore";
import "./App.css";

function App() {
  const activeFilename = useGoalStore((s) => s.activeFilename);
  const documents = useGoalStore((s) => s.documents);
  const corruptedFiles = useGoalStore((s) => s.corruptedFiles);
  const gitConflict = useGoalStore((s) => s.gitConflict);
  const ingestRawFiles = useGoalStore((s) => s.ingestRawFiles);
  const setGitConflict = useGoalStore((s) => s.setGitConflict);
  const setLoading = useGoalStore((s) => s.setLoading);
  const toggleTask = useGoalStore((s) => s.toggleTask);
  const addNode = useGoalStore((s) => s.addNode);
  const deleteNode = useGoalStore((s) => s.deleteNode);
  const createDocument = useGoalStore((s) => s.createDocument);
  const getDocumentProgress = useGoalStore((s) => s.getDocumentProgress);

  const persistDocumentToRust = useCallback(
    async (filename: string) => {
      const latestDoc = useGoalStore.getState().documents[filename];
      if (!latestDoc) return;
      try {
        const markdown = serializeGoalDocument(latestDoc);
        await ipcWriteFile(filename, markdown);
      } catch (err) {
        if (String(err).includes("GIT_CONFLICT_LOCKED")) {
          setGitConflict(true);
        }
      }
    },
    [setGitConflict]
  );

  const loadWorkspaceFiles = useCallback(async () => {
    setLoading(true);
    try {
      const pullRes = await ipcGitPull();
      if (pullRes.has_conflict) {
        setGitConflict(true);
      } else {
        setGitConflict(false);
      }
      const rawFiles = await ipcReadAllFiles();
      ingestRawFiles(rawFiles);
    } catch {
      // Fallback when running outside Tauri desktop runtime
    } finally {
      setLoading(false);
    }
  }, [ingestRawFiles, setGitConflict, setLoading]);

  useEffect(() => {
    void loadWorkspaceFiles();
  }, [loadWorkspaceFiles]);

  const activeCorruptionError = activeFilename
    ? corruptedFiles[activeFilename]
    : null;
  const isBlockedByError = Boolean(gitConflict || activeCorruptionError);

  const handleToggleTask = (nodeId: string) => {
    if (!activeFilename || isBlockedByError) return;
    toggleTask(activeFilename, nodeId);
    void persistDocumentToRust(activeFilename);
  };

  const handleAddNode = (parentId: string | null, title: string) => {
    if (!activeFilename || isBlockedByError) return;
    addNode(activeFilename, parentId, title);
    void persistDocumentToRust(activeFilename);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeFilename || isBlockedByError) return;
    deleteNode(activeFilename, nodeId);
    void persistDocumentToRust(activeFilename);
  };

  const handleCreateFile = (filename: string, title: string) => {
    if (gitConflict) return;
    const doc = createDocument(filename, title);
    void persistDocumentToRust(doc.filename);
  };

  const activeDoc = activeFilename ? documents[activeFilename] : null;
  const activeProgress = activeFilename
    ? getDocumentProgress(activeFilename)
    : 0;

  return (
    <AppShell
      onCreateFile={handleCreateFile}
      onRefreshFiles={() => void loadWorkspaceFiles()}
    >
      <ViewErrorBoundary
        filename={activeFilename}
        onRetry={() => void loadWorkspaceFiles()}
      >
        {isBlockedByError && (
          <CorruptedFileOverlay
            filename={
              gitConflict ? "Conflicto Git en repositorio" : activeFilename
            }
            detail={
              gitConflict
                ? "Conflicto detectado durante git pull en el repositorio local."
                : activeCorruptionError
            }
            onRetry={() => void loadWorkspaceFiles()}
          />
        )}

        <div className="flex-1 overflow-y-auto p-8">
          {activeDoc ? (
            <div className="max-w-3xl mx-auto space-y-6">
              <header className="space-y-3 border-b border-border pb-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      {activeDoc.frontmatter.title}
                    </h1>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      ID: {activeDoc.frontmatter.id} · Creado:{" "}
                      {activeDoc.frontmatter.created_at}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold font-mono">
                      {activeProgress}%
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Progreso global
                    </p>
                  </div>
                </div>
                <Progress value={activeProgress} className="h-2" />
              </header>

              <GoalTree
                nodes={activeDoc.nodes}
                onToggle={handleToggleTask}
                onAddNode={handleAddNode}
                onDeleteNode={handleDeleteNode}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Selecciona o crea un Superobjetivo en la barra lateral.
            </div>
          )}
        </div>
      </ViewErrorBoundary>
    </AppShell>
  );
}

export default App;
