## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Session Summary — 2026-06-22

### Done
- **PlanoEngine.ts:594** — Bajante context menu hit test radius: uses `b._circ?.r || Math.max(6, 6 * this.zoom) + 10` instead of fixed 16px.
- **PlanoEngineNetwork.ts:405-414** — Added `codo90rmSube`/`codo90rmBaja` auto-count from bajante `recibeDeIds` + `direccion`.
- **InfoTab.tsx:118** — Edit button styling: standard "EDITAR/LISTO" style (`marginLeft: 'auto'`, `background: editing ? 'var(--acc)' : 'transparent'`, `padding: '2px 6px'`, `fontSize: 10`). Also wired editing state to disable/enable ep/bom buttons.
- **renderRamales.ts** — Line widths reduced: `2.5→2`, `(sel ? 3.5 : 2.5)→(sel ? 3 : 2)`, white masks `4→3`, `6→4`.
- **renderRamales.ts:607-623** — Selection arrow: when bajante connects at one endpoint, arrow appears at opposite endpoint.
- **renderBajantes.ts:316** — Item 4 arrow now only draws for ghost selection or multi-select. Normal bajante selection arrow (Item 3, line 140) handles non-ghost cases. Connected ramal arrow removed to avoid double arrows.
- **PlanoEngineNetwork.ts:255-350** — Fixed yee junction detection: rewritten to check points on segments (projection onto segment) + `Math.abs(cosVal)`.
- **SanAccesoriosPage.tsx** — Added "Nivel" column (sticky, left=64px) showing `t._nivelLabel` (direct level label) with fallback to `pisoLbl(t.piso)`.
- **drawingSync.ts:48,83** — Store `nivel` and `npt` in plane object for both prefix and non-prefix sync paths.
- **useTramosSync.ts:33** — Use `plane.npt` for level index; store `_nivelLabel` on tramo for display.
- **PdfViewer.tsx:263-280** — Fixed delete cleanup: `onDeleteHandler` now cleans `APARATOS_BY_TRAMO_KEY` and `HYDRO_DATA_STORAGE_KEY`. Fixed key matching from exact (`idSet.has(k)`) to partial (`k.includes(id)`) to handle compound keys like `san_RS1_123`.
- **renderBajantes.ts:21** — Hitbox increased: `Math.max(16, r + 6)` → `Math.max(24, r + 10)` for better clickability.
- Build verified: `npx vite build` passes clean.

### Relevant Files
- `src/lib/PlanoEngine/PlanoEngine.ts:594` — Bajante hit test.
- `src/lib/PlanoEngine/PlanoEngineNetwork.ts:405-414` — Codo sube/baja auto-detection.
- `src/lib/PlanoEngine/PlanoEngineNetwork.ts:255-350` — Fixed yee detection (segment projection + Math.abs cosVal).
- `src/lib/PlanoEngine/renderers/renderRamales.ts` — Line widths, selection arrow for bajante endpoints.
- `src/lib/PlanoEngine/renderers/renderBajantes.ts:316` — Ghost-only selection arrow.
- `src/lib/PlanoEngine/renderers/renderBajantes.ts:21` — Hitbox 16→24.
- `src/components/workarea/InfoTab.tsx:118` — Standard edit button + editing state wired.
- `src/components/SanAccesoriosPage.tsx` — Nivel column with `_nivelLabel`.
- `src/utils/drawingSync.ts:48,83` — Store nivel/npt in plane.
- `src/hooks/useTramosSync.ts:33` — Use plane.npt + _nivelLabel.
- `src/components/PdfViewer.tsx:263-280` — Delete cleanup fixed.

### Fixed — 2026-06-23 session (v2)
- **Direct lblDrag in `_onDownHandler`**: `PlanoEngine.ts:681` — Before calling `handleSelectDown`, checks if click hits the SELECTED bajante's `_labelBox` and starts `lblDrag` immediately, bypassing all conflicting logic.
- **Context-menu bajante `direccion`**: `PdfViewer.tsx:1148` — Added `direccion: 'baja'/'sube'` so symbol renders with correct direction from the start.
- **Context-menu `nptBase`/`pisoBase`**: `PdfViewer.tsx:1151` — Now uses `engine.nivelActual.npt` and `engine.nivelActual.label` instead of hardcoded 0/''. Prevents ghost bajante on current level.
- **`_markDirty` calcSanitaryAccessories guard**: `PlanoEngine.ts:358` — Removed `activeNet === 'san'` condition so accessories always recalculate when `_markDirty` called.
- **handleDragUp lblDrag persistence**: `PlanoEngineSelection.ts:1160` — Added `engine._markDirty()` when clearing `lblDrag`.
- Build verified: `npx vite build` passes clean.

### Fixed — 2026-06-22 session
- **Label gap**: `renderRamales.ts:434` — gap increased from 7mm → 12mm so labels stay further from ramal after drag.
- **Piso/Nivel**: `SanAccesoriosPage.tsx:36` — `useMemo` was dropping `_nivelLabel` and `piso` (only kept `{id, accesorios}`). Now includes `piso` and `_nivelLabel`.
- **Bajante hitbox**: `renderBajantes.ts:14,21` — visual radius `7→10`, hitbox `max(24,r+10)→max(30,r+14)`.
- **Bajante label drag**: `PlanoEngineSelection.ts:422-436` — now checks `_labelBox` BEFORE `_circ` for currently selected bajante. Clicking label starts `lblDrag` instead of `bajDrag` (was impossible to move label when it's within `_circ.r` of center).
- **Leader line circle edge**: `renderBajantes.ts:175-181,366-377` — normal and ghost leader lines now start at the visual circle edge (closest point to label) instead of the bajante center.
- **Ramal endpoint steal**: `PlanoEngineSelection.ts:310-327` — ramal endpoint drag (15px threshold) was stealing clicks from bajantes at the same position. Added preliminary bajante hit check (lines 312-317) before any endpoint logic to prevent steals at low zoom. Also added a fallback at lines 624-636 that checks proximity to label center (8px) if `_labelBox` detection fails.
- **Nivel format**: `useTramosSync.ts:34-39` — `_nivelLabel` now formatted as `P1/S1/C` instead of raw number. `SanAccesoriosPage.tsx:69` — fallback also uses same format.

### Known Issues
- **RS1 cached**: stale ramal appears in tables. Clear localStorage keys: `dibujo_sanitario_v1`, `tramo_hidro_data_v3`, or delete RS1 from plan trace data and resave.
- **Nivel column**: stores npt in sync data, need to verify plan.npt is saved with plans. User may need to save plans to rebuild sync with `r.piso` field.

### Known Issues (may need browser verification)
- Bajante context menu: hit test fix applied, need to verify in browser.
- Yee auto-sum: logic rewritten, need to verify in browser.
- Nivel column: stores npt in sync data, need to verify plan.npt is saved with plans.
- RS1 cached: user mentioned this, may need to clear localStorage/sync cache.

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
