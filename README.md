# Git-Backed Local-First Goal Manager

> **Academic Note:** This project was designed and built to test and validate the **Prompt Engineering & Spec-Driven Software Engineering** methodologies taught at the university. Using a strict architectural specification (`docs/SPEC.md`) and a sequential execution plan (`docs/TASKS.md`), the entire full-stack desktop application was generated, verified, and tested through structured prompt engineering.

---

## Overview

**Git-Backed Local-First Goal Manager** is a cross-platform desktop application (Linux, macOS, Windows) for hierarchical goal and task management. It follows a strict **100% offline, local-first** philosophy where every root goal ("Superobjetivo") lives on disk as a plain Markdown (`.md`) file with validated YAML frontmatter, synchronized asynchronously through the system's native `git` binary.

---

## Key Features

- **Local-First & Plain-Text Ownership:** Every goal is stored as a standard `.md` file (`~/Documentos/objetivos` by default, or configurable via `GOAL_MANAGER_DATA_DIR`).
- **Hierarchical Task Trees & Dynamic Bottom-Up Progress:**
  - Tasks can be nested infinitely via Markdown indentation (`- [ ]` / `- [x]`).
  - Parent task and overall goal completion percentages are computed dynamically *bottom-up* in memory at render time and are never hardcoded into the `.md` files.
- **Full CRUD for Goals & Tasks:**
  - Create new root goals with validated YAML frontmatter (`id`, `created_at`, `title`).
  - Add root tasks, nested subtasks, toggle completion states (with automatic subtree/ancestor propagation), and delete individual tasks or entire goals.
- **"Dumb Pipe" (Rust) / "Smart Client" (TypeScript) Architecture:**
  - **Rust Backend (Tauri v2):** Strictly handles raw filesystem I/O (`read_all_files`, `write_file`, `delete_file`) and spawns native `std::process::Command` calls to `git` (`git_pull`, `git_commit_and_push`, `get_conflict_status`) with locale-independent execution (`LC_ALL=C`).
  - **TypeScript Frontend:** Extracts frontmatter with `gray-matter`, enforces strict schema validation via `Zod`, parses and serializes indentation-based Markdown ASTs, and manages optimistic UI mutations with `Zustand` + `Immer`.
- **Silent 60-Second Git Auto-Sync & Conflict Safety:**
  - After 60 seconds of user inactivity, changes are automatically staged, committed, and pushed to the configured remote repository.
  - Network failures during `git push` are silently ignored so offline work is never interrupted.
  - Corrupted frontmatter or unresolved Git merge conflicts trigger a protective error boundary overlay without crashing the application.
- **Navy Blue & Matrix Green Theme:** Styled with Tailwind CSS and `shadcn/ui` primitives (`Checkbox`, `Progress`, `Dialog`) using a deep navy/royal blue palette with vibrant Matrix green highlights.

---

## Tech Stack

- **Desktop Core:** [Tauri v2](https://v2.tauri.app/) + Rust
- **Frontend:** React 19 + TypeScript + Vite
- **UI & Styling:** Tailwind CSS v4 + `shadcn/ui` (Radix UI primitives + Lucide icons)
- **State & Domain Logic:** Zustand + Immer + Zod + `gray-matter`
- **Testing:** Vitest

---

## Getting Started

### Prerequisites

- **Node.js** (v20+) & **npm**
- **Rust & Cargo** (stable toolchain)
- **Git** CLI installed on your system
- Tauri v2 system dependencies for your OS (e.g. `webkit2gtk-4.1` on Linux)

### Installation

```bash
npm install
```

### Running in Development Mode

By default, if `~/Documentos` exists on your system, the app stores and reads your `.md` goal files in `~/Documentos/objetivos`. You can also override the storage directory with `GOAL_MANAGER_DATA_DIR`:

```bash
npm run tauri dev
```

Or specifying a custom directory:

```bash
GOAL_MANAGER_DATA_DIR="/path/to/your/goals-repo" npm run tauri dev
```

### Running Unit Tests & Production Build

```bash
# Run Vitest unit test suite (Parser, Serializer, Bottom-Up Calculator & Store)
npm test

# Verify frontend TypeScript & Vite production bundle
npm run build

# Build native desktop bundle (.deb / .rpm / .AppImage / .dmg / .msi)
npm run tauri build
```

---

## Markdown File Format Contract

Each `.md` file in your goals directory must begin with a strict YAML frontmatter containing `id`, `created_at` (ISO-8601 date), and `title`, followed by indented Markdown task items:

```markdown
---
id: launch-mvp
created_at: 2026-11-15T17:00:00.000Z
title: Launch MVP v1.0
---

- [ ] Core Architecture
  - [x] Rust Dumb Pipe Backend
  - [x] TypeScript Smart Client AST Parser
- [x] Silent Git Synchronization
```
