## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Session Summary — 2026-06-11

### Done
- **PlanoRenderer.tsx:331** — Changed ini/fin label background from `rgba(17,19,23,0.85)` to `#ffffff` for readability.
- **PdfViewer.tsx:715** — Fixed SVG property warnings: `stroke-width` → `strokeWidth`, `stroke-linecap` → `strokeLinecap`.
- **WorkAreaContent.tsx:617** — Fixed "Carga de planos" tab empty (typo: `'plans'` → `'planos'`).
- **PdfViewer.tsx:233** — Fixed network bar not showing (added `activeNetworks.size > 0` guard).
- **WorkAreaContent.tsx** — Swapped pages 2↔3 for AF/AC (Accesorios ↔ Diseño de red).
- **PressureEquipmentDesign.tsx + EPContext.tsx** — Created EP (Equipo de Presión) section:
  - Dedicated `EPContext` with localStorage persistence, wired via `EPProvider` in `AppProviders.tsx`.
  - 2-page layout (Datos de entrada + Diámetros y velocidades).
  - Page 1: 2×2 grid (Caudales de diseño, Pérdidas de carga, Presiones y cotas, Configuración de bombas).
  - Configuración de bombas: Nt/Nr side-by-side cards + green total summary bar.
  - Parámetros del equipo table hidden (commented out).
  - Mode toggle: Succión directa (Red) vs Succión desde cisterna.
  - Page 2: PVC Sch 40 diameter verification table + specification summary.
  - LazyInp component (local state + onBlur sync) replaces controlled inputs to fix cursor jump while typing decimals.
  - All `<Inp v={ep.x} set={...} />` and raw `<input>` replaced with `<LazyInp field="x" />`.
- Build verified: `npx vite build` passes clean.
