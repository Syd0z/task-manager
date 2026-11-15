import React, { useState } from "react";
import { Plus, Trash2, CornerDownRight } from "lucide-react";
import { GoalNode } from "@/domain/schema";
import { calculateNodeProgress } from "@/domain/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface GoalNodeItemProps {
  node: GoalNode;
  depth?: number;
  onToggle: (nodeId: string) => void;
  onAddChild: (parentId: string, title: string) => void;
  onDelete: (nodeId: string) => void;
}

function GoalNodeItem({
  node,
  depth = 0,
  onToggle,
  onAddChild,
  onDelete,
}: GoalNodeItemProps) {
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const isParent = node.children.length > 0;
  const progress = calculateNodeProgress(node);

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = subtaskTitle.trim();
    if (!trimmed) return;
    onAddChild(node.id, trimmed);
    setSubtaskTitle("");
    setAddingSubtask(false);
  };

  return (
    <div
      className={cn(
        "space-y-1.5",
        depth > 0 && "ml-6 pl-3 border-l border-border/70"
      )}
    >
      <div className="group flex flex-col gap-1.5 rounded-md border border-transparent hover:border-border hover:bg-muted/30 px-2.5 py-2 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Checkbox
              id={`node-${node.id}`}
              checked={node.completed}
              onCheckedChange={() => onToggle(node.id)}
            />
            <label
              htmlFor={`node-${node.id}`}
              className={cn(
                "text-sm cursor-pointer select-none truncate",
                isParent && "font-medium",
                node.completed && "line-through text-muted-foreground"
              )}
            >
              {node.title}
            </label>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isParent && (
              <div className="flex items-center gap-2 w-28">
                <Progress value={progress} className="h-1.5" />
                <span className="text-xs font-mono text-muted-foreground w-9 text-right">
                  {progress}%
                </span>
              </div>
            )}

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setAddingSubtask((prev) => !prev)}
                title="Añadir subtarea"
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                title="Eliminar tarea"
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {addingSubtask && (
          <form
            onSubmit={handleAddSubtask}
            className="flex items-center gap-2 pl-6 pt-1"
          >
            <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.currentTarget.value)}
              placeholder="Nueva subtarea..."
              autoFocus
              className="flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Añadir
            </button>
          </form>
        )}
      </div>

      {node.children.length > 0 && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <GoalNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface GoalTreeProps {
  nodes: GoalNode[];
  onToggle: (nodeId: string) => void;
  onAddNode: (parentId: string | null, title: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

export function GoalTree({
  nodes,
  onToggle,
  onAddNode,
  onDeleteNode,
}: GoalTreeProps) {
  const [rootTaskTitle, setRootTaskTitle] = useState("");

  const handleAddRootTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rootTaskTitle.trim();
    if (!trimmed) return;
    onAddNode(null, trimmed);
    setRootTaskTitle("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {nodes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Este Superobjetivo aún no tiene tareas. Añade una tarea raíz abajo.
          </div>
        ) : (
          nodes.map((node) => (
            <GoalNodeItem
              key={node.id}
              node={node}
              depth={0}
              onToggle={onToggle}
              onAddChild={(parentId, title) => onAddNode(parentId, title)}
              onDelete={onDeleteNode}
            />
          ))
        )}
      </div>

      <form onSubmit={handleAddRootTask} className="flex items-center gap-2 pt-2">
        <input
          value={rootTaskTitle}
          onChange={(e) => setRootTaskTitle(e.currentTarget.value)}
          placeholder="Añadir nueva tarea raíz..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Añadir tarea
        </button>
      </form>
    </div>
  );
}
