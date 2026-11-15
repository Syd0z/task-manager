# SPEC: Git-Backed Local-First Goal Manager

## 1. Visión General y Alcance
Sistema de escritorio (Windows/Mac/Linux) para la gestión jerárquica de objetivos y tareas. 
- **Enfoque:** Local-first puro. Cero latencia en cliente, funcionamiento 100% offline.
- **Sincronización:** Basada en Git (Git-Backed) usando un repositorio remoto como puente.
- **Fuera de alcance (v1.0):** Móvil nativo, notificaciones push, edición colaborativa en tiempo real.

## 2. Stack Tecnológico Estricto
- **Core / Backend Local:** Tauri + Rust.
- **Frontend / UI:** React 18+ + TypeScript + Vite.
- **Estilos y Componentes:** Tailwind CSS + shadcn/ui.
- **Estado UI:** Zustand (Árbol anidado) + Immer (Mutaciones).
- **Validación:** Zod.
- **Almacenamiento:** Archivos `.md` locales gestionados vía binario del sistema `git`.

## 3. Arquitectura y Límites de Frontera
### 3.1. Patrón "Dumb Pipe" (Rust) / "Smart Client" (TypeScript)
- **Rust (Dumb Pipe):** Se limita exclusivamente a leer/escribir archivos en disco y ejecutar comandos de terminal (`std::process::Command`). No parsea datos.
- **TypeScript (Smart Client):** Recibe el string crudo del archivo `.md`, extrae el frontmatter con `gray-matter`, valida con `Zod`, y construye el árbol (AST) en memoria usando un parser propio basado en expresiones regulares (Regex) e indentación.

### 3.2. Estrategia de Autenticación Git
- Se utilizará HTTPS junto con un Personal Access Token (PAT) guardado en el cliente, evitando la complejidad de compilar dependencias SSH en Rust. Se usará el CLI de Git del sistema (no `git2-rs`).

## 4. Contrato de Datos y Estado Global
Cada archivo representa la raíz de un Superobjetivo. La jerarquía recursiva se dicta por la indentación.
- **Validación Frontmatter:** Estricta vía Zod. Si el formato es inválido, el archivo se rechaza.
- **Estado (Zustand):** Los datos se guardan anidados. El % de progreso se calcula dinámicamente *bottom-up* al renderizar y no se persiste en el Markdown.
- **Mutaciones:** Optimistas en la UI. Al instante de hacer clic, se actualiza el store y se emite evento IPC de escritura a Rust.

## 5. Resiliencia y Edge Cases
- **Fallo de Red en Push (Silencioso):** Tras 60s de inactividad, se hace commit y push. Si el push falla por falta de internet, se ignora silenciosamente. Los datos están seguros en local.
- **Conflicto en Pull:** Si el `git pull` detecta conflicto, Rust bloquea la actualización y el Frontend muestra una pantalla roja pidiendo resolución manual en un editor externo.
- **Edición Concurrente Externa (Blind Trust):** No hay File Watchers. Si el usuario edita el `.md` en Obsidian mientras la app está abierta, la app sobrescribirá los cambios al próximo guardado.