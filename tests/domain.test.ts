import { describe, expect, it } from "vitest";
import { MarkdownParseError, parseGoalMarkdown } from "../src/domain/parser";
import { serializeGoalMarkdown } from "../src/domain/serializer";
import {
  calculateNodeProgress,
  calculateTreeProgress,
} from "../src/domain/progress";
import { GoalNode } from "../src/domain/schema";
import { useGoalStore } from "../src/store/useGoalStore";

describe("Custom MD Parser (parseGoalMarkdown)", () => {
  it("parses valid frontmatter and builds nested GoalNode tree from indentation", () => {
    const md = [
      "---",
      "id: goal-001",
      "created_at: 2026-11-15T10:00:00.000Z",
      "title: Lanzar MVP v1.0",
      "---",
      "",
      "- [ ] Configurar arquitectura base",
      "  - [x] Inicializar Tauri + React",
      "  - [ ] Configurar Tailwind y shadcn",
      "    - [x] Añadir Checkbox",
      "    - [ ] Añadir Progress",
      "- [x] Documentar especificación",
    ].join("\n");

    const result = parseGoalMarkdown(md);

    expect(result.frontmatter).toEqual({
      id: "goal-001",
      created_at: "2026-11-15T10:00:00.000Z",
      title: "Lanzar MVP v1.0",
    });

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].title).toBe("Configurar arquitectura base");
    expect(result.nodes[0].completed).toBe(false);
    expect(result.nodes[0].children).toHaveLength(2);

    expect(result.nodes[0].children[0].title).toBe("Inicializar Tauri + React");
    expect(result.nodes[0].children[0].completed).toBe(true);

    expect(result.nodes[0].children[1].title).toBe("Configurar Tailwind y shadcn");
    expect(result.nodes[0].children[1].children).toHaveLength(2);
    expect(result.nodes[0].children[1].children[0].completed).toBe(true);
    expect(result.nodes[0].children[1].children[1].completed).toBe(false);

    expect(result.nodes[1].title).toBe("Documentar especificación");
    expect(result.nodes[1].completed).toBe(true);
  });

  it("rejects markdown with missing required frontmatter fields", () => {
    const invalidMd = [
      "---",
      "id: goal-002",
      "title: Sin fecha de creación",
      "---",
      "- [ ] Tarea huérfana",
    ].join("\n");

    expect(() => parseGoalMarkdown(invalidMd)).toThrow(MarkdownParseError);
  });

  it("rejects markdown with unknown extra frontmatter properties (strict Zod schema)", () => {
    const extraFieldMd = [
      "---",
      "id: goal-003",
      "created_at: 2026-11-15T10:00:00.000Z",
      "title: Objetivo estricto",
      "author: unauthorized",
      "---",
      "- [ ] Tarea 1",
    ].join("\n");

    expect(() => parseGoalMarkdown(extraFieldMd)).toThrow(MarkdownParseError);
  });

  it("rejects markdown containing Git merge conflict markers", () => {
    const conflictMd = [
      "---",
      "id: goal-004",
      "created_at: 2026-11-15T10:00:00.000Z",
      "title: En conflicto",
      "---",
      "<<<<<<< HEAD",
      "- [x] Tarea local",
      "=======",
      "- [ ] Tarea remota",
      ">>>>>>> origin/main",
    ].join("\n");

    expect(() => parseGoalMarkdown(conflictMd)).toThrowError(
      /Git merge conflict/
    );
  });

  it("rejects non-task lines in body", () => {
    const badBodyMd = [
      "---",
      "id: goal-005",
      "created_at: 2026-11-15T10:00:00.000Z",
      "title: Cuerpo inválido",
      "---",
      "Texto libre no permitido fuera de lista de tareas",
    ].join("\n");

    expect(() => parseGoalMarkdown(badBodyMd)).toThrow(MarkdownParseError);
  });
});

describe("MD Serializer (serializeGoalMarkdown)", () => {
  it("serializes a nested GoalNode tree to valid Markdown and round-trips losslessly", () => {
    const frontmatter = {
      id: "goal-roundtrip",
      created_at: "2026-11-15T12:00:00.000Z",
      title: "Objetivo Roundtrip",
    };

    const nodes: GoalNode[] = [
      {
        id: "n1",
        title: "Fase 1",
        completed: false,
        children: [
          {
            id: "n1-1",
            title: "Subtarea 1.1",
            completed: true,
            children: [],
          },
          {
            id: "n1-2",
            title: "Subtarea 1.2",
            completed: false,
            children: [],
          },
        ],
      },
      {
        id: "n2",
        title: "Fase 2",
        completed: true,
        children: [],
      },
    ];

    const serialized = serializeGoalMarkdown(frontmatter, nodes);
    expect(serialized).not.toContain("%");

    const reparsed = parseGoalMarkdown(serialized);
    expect(reparsed.frontmatter).toEqual(frontmatter);
    expect(reparsed.nodes).toHaveLength(2);
    expect(reparsed.nodes[0].children).toHaveLength(2);
    expect(reparsed.nodes[0].children[0].completed).toBe(true);
    expect(reparsed.nodes[0].children[1].completed).toBe(false);
    expect(reparsed.nodes[1].completed).toBe(true);
  });
});

describe("Bottom-Up Progress Calculator", () => {
  it("calculates leaf and multi-level parent progress bottom-up", () => {
    const tree: GoalNode = {
      id: "root",
      title: "Superobjetivo",
      completed: false,
      children: [
        {
          id: "branch-1",
          title: "Rama 1 (50%)",
          completed: false,
          children: [
            { id: "leaf-1", title: "Hoja 1", completed: true, children: [] },
            { id: "leaf-2", title: "Hoja 2", completed: false, children: [] },
          ],
        },
        {
          id: "branch-2",
          title: "Rama 2 (100%)",
          completed: true,
          children: [],
        },
      ],
    };

    expect(calculateNodeProgress(tree.children[0])).toBe(50);
    expect(calculateNodeProgress(tree.children[1])).toBe(100);
    expect(calculateNodeProgress(tree)).toBe(75);
    expect(calculateTreeProgress([tree])).toBe(75);
  });

  it("returns 0 for an empty tree", () => {
    expect(calculateTreeProgress([])).toBe(0);
  });
});

describe("Resilience, Happy Path & Goal Deletion Store Integration", () => {
  it("ingests valid and corrupted .md files without crashing, updates progress optimistically, and supports goal deletion", () => {
    const validContent = [
      "---",
      "id: roadmap-v1",
      "created_at: 2026-11-15T17:00:00.000Z",
      "title: Lanzamiento Goal Manager v1.0",
      "---",
      "",
      "- [ ] Arquitectura Local-First",
      "  - [x] Backend Dumb Pipe en Rust",
      "  - [ ] Smart Client en TypeScript",
      "- [x] Sincronización Git Silenciosa",
    ].join("\n");

    const corruptedContent = [
      "---",
      "id: corrupted-goal",
      "invalid_field: true",
      "---",
      "",
      "- [ ] Este archivo tiene un frontmatter inválido",
    ].join("\n");

    const store = useGoalStore.getState();
    store.ingestRawFiles([
      { filename: "roadmap-v1.md", content: validContent },
      { filename: "corrupted-goal.md", content: corruptedContent },
    ]);

    const nextState = useGoalStore.getState();
    expect(nextState.documents["roadmap-v1.md"]).toBeDefined();
    expect(nextState.getDocumentProgress("roadmap-v1.md")).toBe(75);

    const subNodeId =
      nextState.documents["roadmap-v1.md"].nodes[0].children[1].id;
    nextState.toggleTask("roadmap-v1.md", subNodeId);
    expect(useGoalStore.getState().getDocumentProgress("roadmap-v1.md")).toBe(
      100
    );

    expect(nextState.documents["corrupted-goal.md"]).toBeUndefined();
    expect(nextState.corruptedFiles["corrupted-goal.md"]).toMatch(
      /Invalid frontmatter schema/
    );

    // Deleting a goal removes it from the store
    useGoalStore.getState().deleteDocument("roadmap-v1.md");
    expect(useGoalStore.getState().documents["roadmap-v1.md"]).toBeUndefined();
  });
});
