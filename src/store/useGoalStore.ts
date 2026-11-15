import { create } from "zustand";
import { produce } from "immer";
import { GoalDocument, GoalNode } from "../domain/schema";
import { parseGoalDocument } from "../domain/parser";
import {
  calculateNodeProgress,
  calculateTreeProgress,
} from "../domain/progress";

export interface RawFilePayload {
  filename: string;
  content: string;
}

function findNodeRecursive(nodes: GoalNode[], nodeId: string): GoalNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    const found = findNodeRecursive(node.children, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

function setSubtreeCompleted(node: GoalNode, completed: boolean): void {
  node.completed = completed;
  for (const child of node.children) {
    setSubtreeCompleted(child, completed);
  }
}

function syncParentCompletionBottomUp(nodes: GoalNode[]): void {
  for (const node of nodes) {
    if (node.children.length > 0) {
      syncParentCompletionBottomUp(node.children);
      node.completed = node.children.every((child) => child.completed);
    }
  }
}

function removeNodeRecursive(nodes: GoalNode[], nodeId: string): boolean {
  const index = nodes.findIndex((n) => n.id === nodeId);
  if (index !== -1) {
    nodes.splice(index, 1);
    return true;
  }
  for (const node of nodes) {
    if (removeNodeRecursive(node.children, nodeId)) {
      return true;
    }
  }
  return false;
}

export interface GoalStoreState {
  documents: Record<string, GoalDocument>;
  corruptedFiles: Record<string, string>;
  activeFilename: string | null;
  gitConflict: boolean;
  isLoading: boolean;

  setActiveFilename: (filename: string | null) => void;
  setGitConflict: (hasConflict: boolean) => void;
  setLoading: (loading: boolean) => void;
  ingestRawFiles: (files: RawFilePayload[]) => void;
  upsertDocumentNodes: (filename: string, nodes: GoalNode[]) => void;

  // Immer-powered deep mutations
  toggleTask: (filename: string, nodeId: string) => void;
  addNode: (filename: string, parentId: string | null, title: string) => void;
  deleteNode: (filename: string, nodeId: string) => void;
  createDocument: (filename: string, title: string) => GoalDocument;
  deleteDocument: (filename: string) => void;

  // Dynamic bottom-up progress calculators (not persisted to disk)
  getDocumentProgress: (filename: string) => number;
  getNodeProgress: (node: GoalNode) => number;
}

export const useGoalStore = create<GoalStoreState>()((set, get) => ({
  documents: {},
  corruptedFiles: {},
  activeFilename: null,
  gitConflict: false,
  isLoading: false,

  setActiveFilename: (filename) => set({ activeFilename: filename }),

  setGitConflict: (hasConflict) => set({ gitConflict: hasConflict }),

  setLoading: (loading) => set({ isLoading: loading }),

  ingestRawFiles: (files) =>
    set(
      produce((draft: GoalStoreState) => {
        const nextDocuments: Record<string, GoalDocument> = {};
        const nextCorrupted: Record<string, string> = {};

        for (const file of files) {
          try {
            const doc = parseGoalDocument(file.filename, file.content);
            nextDocuments[file.filename] = doc;
          } catch (err) {
            nextCorrupted[file.filename] =
              err instanceof Error ? err.message : "Corrupted Markdown file";
          }
        }

        const allNames = files.map((f) => f.filename);
        const validNames = Object.keys(nextDocuments);
        draft.documents = nextDocuments;
        draft.corruptedFiles = nextCorrupted;
        draft.activeFilename =
          draft.activeFilename && allNames.includes(draft.activeFilename)
            ? draft.activeFilename
            : validNames[0] ?? allNames[0] ?? null;
      })
    ),

  upsertDocumentNodes: (filename, nodes) =>
    set(
      produce((draft: GoalStoreState) => {
        const doc = draft.documents[filename];
        if (!doc) return;
        doc.nodes = nodes;
      })
    ),

  toggleTask: (filename, nodeId) =>
    set(
      produce((draft: GoalStoreState) => {
        const doc = draft.documents[filename];
        if (!doc) return;

        const target = findNodeRecursive(doc.nodes, nodeId);
        if (!target) return;

        const nextStatus = !target.completed;
        setSubtreeCompleted(target, nextStatus);
        syncParentCompletionBottomUp(doc.nodes);
      })
    ),

  addNode: (filename, parentId, title) =>
    set(
      produce((draft: GoalStoreState) => {
        const doc = draft.documents[filename];
        if (!doc) return;

        const trimmed = title.trim();
        if (!trimmed) return;

        const newNode: GoalNode = {
          id: `${doc.frontmatter.id}-node-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          title: trimmed,
          completed: false,
          children: [],
        };

        if (parentId === null) {
          doc.nodes.push(newNode);
        } else {
          const parent = findNodeRecursive(doc.nodes, parentId);
          if (parent) {
            parent.children.push(newNode);
          }
        }

        syncParentCompletionBottomUp(doc.nodes);
      })
    ),

  deleteNode: (filename, nodeId) =>
    set(
      produce((draft: GoalStoreState) => {
        const doc = draft.documents[filename];
        if (!doc) return;

        removeNodeRecursive(doc.nodes, nodeId);
        syncParentCompletionBottomUp(doc.nodes);
      })
    ),

  createDocument: (filename, title) => {
    const normalizedFilename = filename.endsWith(".md")
      ? filename
      : `${filename}.md`;
    const slugId = normalizedFilename.replace(/\.md$/, "");
    const newDoc: GoalDocument = {
      filename: normalizedFilename,
      frontmatter: {
        id: slugId,
        created_at: new Date().toISOString(),
        title: title.trim() || slugId,
      },
      nodes: [],
    };

    set(
      produce((draft: GoalStoreState) => {
        draft.documents[normalizedFilename] = newDoc;
        delete draft.corruptedFiles[normalizedFilename];
        draft.activeFilename = normalizedFilename;
      })
    );

    return get().documents[normalizedFilename];
  },

  deleteDocument: (filename) =>
    set(
      produce((draft: GoalStoreState) => {
        delete draft.documents[filename];
        delete draft.corruptedFiles[filename];

        if (draft.activeFilename === filename) {
          const validNames = Object.keys(draft.documents).sort();
          const allRemaining = Array.from(
            new Set([...validNames, ...Object.keys(draft.corruptedFiles)])
          ).sort();
          draft.activeFilename = validNames[0] ?? allRemaining[0] ?? null;
        }
      })
    ),

  getDocumentProgress: (filename) => {
    const doc = get().documents[filename];
    if (!doc) return 0;
    return calculateTreeProgress(doc.nodes);
  },

  getNodeProgress: (node) => calculateNodeProgress(node),
}));
