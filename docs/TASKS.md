# TASKS: Plan de Ejecución para AI Agent (Antigravity)

*Instrucción para el Agente:* Ejecuta estas tareas de forma secuencial. No pases a la siguiente sin verificar que la actual funciona correctamente (compila, pasa linters y pruebas básicas). Cíñete estrictamente al stack y no instales dependencias de C/C++ ni librerías de UI ajenas a shadcn/ui.

## Fase 1: Setup y Configuración Base
- [x] **Task 1.1:** Inicializar proyecto Tauri estricto para Escritorio (Mac/Win/Linux) con React + TypeScript + Vite.
- [x] **Task 1.2:** Instalar Tailwind CSS y configurar `shadcn/ui`. Añadir componentes base (`checkbox`, `progress`, `dialog`).
- [x] **Task 1.3:** Instalar dependencias de lógica pura: `zustand`, `immer`, `zod`, `gray-matter`.
- [x] **Task 1.4:** Limpiar el boilerplate de Tauri y configurar un `Hello World` bidireccional (IPC).

## Fase 2: Backend Local en Rust (Dumb Pipe & Git)
- [x] **Task 2.1 (Filesystem):** Crear módulo en Rust para leer/escribir strings puros en un directorio local específico. Exponer comandos a Tauri: `read_all_files`, `write_file`.
- [x] **Task 2.2 (Git Wrapper):** Integrar comandos nativos usando `std::process::Command` (no usar `git2-rs`). Exponer `git_pull` y `git_commit_and_push`. 
- [x] **Task 2.3 (Sync Engine):** Implementar la lógica de guardado automático (commit + push) tras 60s de inactividad, silenciando/ignorando errores de red si el push falla.
- [x] **Task 2.4 (Conflict Handler):** Si `git pull` falla, exponer flag de error por IPC. No intentar auto-resolver o abrir interfaces de diff.

## Fase 3: Lógica de Dominio en Frontend (Parser & TypeScript)
- [x] **Task 3.1 (Schema Validation):** Crear esquemas Zod estrictos para el Frontmatter (`id`, `created_at`, `title`).
- [x] **Task 3.2 (Custom MD Parser):** Escribir función pura en TS que lea un string `.md`, separe el YAML con `gray-matter`, lo valide con Zod y use Regex para contar espacios de indentación y generar una estructura de árbol `GoalNode`.
- [x] **Task 3.3 (MD Serializer):** Crear la función inversa: transformar el árbol anidado `GoalNode` de vuelta a string de Markdown válido.
- [x] **Task 3.4 (Testing):** Escribir pruebas unitarias exclusivas en TS (Vitest) para el Parser, Serializador y la función de cálculo de progreso. *Nota: Son los únicos tests requeridos en v1.0.*

## Fase 4: Estado Global (Zustand + Immer)
- [x] **Task 4.1 (Store Anidado):** Implementar el store global en Zustand almacenando los nodos de forma anidada.
- [x] **Task 4.2 (Mutaciones Seguras):** Usar Immer en las acciones (`toggleTask`, `addNode`, `deleteNode`) para actualizar nodos profundos.
- [x] **Task 4.3 (Calculadora Bottom-Up):** Integrar el cálculo de progreso dinámico al vuelo (no guardado en disco).

## Fase 5: Interfaz de Usuario (React + shadcn/ui)
- [x] **Task 5.1 (Layout):** Crear shell con Sidebar (lista de archivos) y un panel principal.
- [x] **Task 5.2 (Árbol Recursivo):** Desarrollar componente de React que renderice la jerarquía de checkboxes e integre el componente `Progress` de shadcn en los nodos padre.
- [x] **Task 5.3 (UX & IPC):** Conectar el árbol al Zustand Store para actualizaciones optimistas instantáneas y emitir el evento `write_file` a Rust al mismo tiempo.
- [x] **Task 5.4 (Error Boundary):** Si el parser falla (Zod rechaza el esquema o hay un conflicto Git), mostrar un overlay inhabilitante en la vista del archivo: "Archivo corrupto o en conflicto. Resuélvelo en tu editor de texto."

## Fase 6: Criterios de Aceptación (MVP)
- [x] **Task 6.1 (Happy Path):** Validar que la app compila, lee archivos, permite marcar tareas, y sincroniza silenciosamente el repo remoto a los 60 segundos.
- [x] **Task 6.2 (Resilience Test):** Modificar un `.md` a mano introduciendo un frontmatter inválido y verificar que la app renderiza el bloqueo por corrupción sin cerrarse (crash silencioso).