# ARCHITECTURE — Cómo funciona

> Estructura y flujos del sistema. Reglas de trabajo: [AGENTS.md](AGENTS.md) · Dónde vive cada cosa: [PROJECT_MAP.md](PROJECT_MAP.md)
> Los detalles operativos de suscripciones/empresa/migraciones viven en AGENTS.md — aquí solo la arquitectura.

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19.3 + TypeScript 5.9 strict, Tailwind 4 (CSS-first en `styles/tokens.css`) |
| Build | Vite 8 + prerender SSR propio (`scripts/prerender.mjs`, 14 rutas públicas) |
| Test | Vitest 4 (node/jsdom) + axe-core en 7 superficies · Playwright e2e |
| BD | Supabase Postgres: RLS (42 tablas, 222 policies) + RPCs SECURITY DEFINER + Edge Functions |
| Cliente BD | supabase-js con espejo IndexedDB (offline-first por proyecto) |
| 3D / docs | three (lazy) con parser GLB propio · pdfjs · jsPDF · docx — todos `await import` bajo demanda |
| Deploy | Vercel (integración git apagada; CI sube por CLI) |

## Capas y regla de dependencia

```
pages/components  ──▶  context (módulo)  ──▶  services  ──▶  Supabase (RPC) ──▶ Postgres + RLS
      │                                             │
      ├──▶ lib/ (PlanoEngine, rci) ── PURO, 0 imports de React ──┘
      └──▶ utils/ (cálculo por disciplina: rain/san/gas/water + reportes)
```

- `lib/` es **puro** (motor y cálculo sin React): testeable sin render, consumido por componentes y contextos.
- Los componentes **no** importan `lib/supabase` directo: la capa `services/` (y los contextos) son el único canal. Excepciones legacy contadas (5 archivos) — no crecer.
- `utils/` hospeda el cálculo por disciplina y las memorias exportables; entra por props/context, no toca red.

## Motor CAD (PlanoEngine)

Fachada única + módulos delegados por fase (`renderers/`, `drags/`, `creations/`, `deleteSelected/`, `events/`). `PlanoState` inmutable con historia; el estado de dibujo por piso vive en `TramosContext`/`PlansContext` y se sincroniza al dibujo vía `utils/drawingSync*`.

Conceptos del motor (glosario completo en AGENTS.md): `scaleM` (m/píxel), `XFG` (fantasmas entrepisos), `mergesFrom` (genealogía de splits), `recibeDeIds/alimentaIds` (grafo bajante↔montante).

## Persistencia y concurrencia

**civilflow — trazos por plano:**
```
edición ─ autosave (debounce) ─▶ cola POR PLANO (trazosSaveQueue, planos distintos en paralelo)
   ─▶ tumba anti-vacío (push sin contenido sobre caché con contenido = bloqueado)
   ─▶ RPC save_plano_data (delete-then-insert por colección; caps por colección)
```
- Carga: árbitro por `ts` con reglas anti-vacío (`trazosLocalGanaABdVacia` / `trazosBdGanaALocalVacia`) — un doc vacío nunca borra el piso.
- **Concurrencia optimistic por plano**: el cliente manda el `updated_at` leído al cargar; el wrapper de `save_plano_data` compara (con lock `for update`) y lanza `conflicto_concurrencia` → aviso "recargue" en el canal global. Firma degradada a 2 args si la migración no está aplicada (retry único).
- Persistencia física: IDB espejo primero, Supabase como verdad; journal local para auditar bloqueos.

**civilmanager — estado completo del proyecto:**
- RPC atómica `cm_save_state` (UNA transacción para 9 tablas hijas + config): lock pesimista `for update` del proyecto + **optimistic** con `p_updated_at` (conflicto → mensaje accionable); fallback al camino legacy de olas paralelas si la función no está desplegada.
- Guardado autosave debounce 300 ms serializado en cadena; safeguard anti-guardado-vacío.
- **Presupuesto cerrado = congelado**: al pasar a `cerrado` se refrescan las snaps (catálogos/factores/APUs/perfil país) y `calcMapParaPres` calcula con la foto; borrador/en revisión calculan con catálogos vivos.

## Doctrina de cálculo (fuente única: `civilflow/constants/`)

- **Agua**: Hunter simplificado — curva pura f(UC) con quiebre en 240 UC, sin factor K ni n.º de descargas (`waterNetworkDesign/rowPhysics.hunterQ`).
- **Sanitaria**: Manning + chequeo en DOS niveles por país — `ftMin` (normativo = NO CUMPLE) y `ftRec` (recomendado = aviso ámbar) + pendiente mínima por diámetro (`sanPendMin`).
- **Matriz por país** (`countryStandards.ts`, 6 países CO/PE/EC/CL/AR/BO): velocidades, y/D, FT, pendientes, IVA (CM), salarios con `vigencia`. Valores verificados contra fuente oficial; lo no verificado queda `ref: true` con fallback CO documentado.
- **Gas**: Renouard con fs tabulada NTC 3728 §5.3 y GN/GLP por proyecto (`Proyecto.tipoGas`).
- **RCI**: motor puro en `lib/rci/` (NFPA 13-2022).
- **CivilManager**: APU de 5 componentes (MO+equipo+insumos+transporte+herr. menor) + AIU estilo colombiano (IVA solo sobre utilidad, tasa por país); FP (factores prestacionales) semilla por país.

## Visores 3D

4 visores GLB (`rci3d`, `epc3d`, `aparatos3d`, `rciNetwork3d`) sobre **staging común** (`components/shared/threeStage.ts`): `montarEscena(opts)` construye renderer/escena/cámaras/rig de luces ×π verbatim por visor, `disposeEscena()` fuerza la pérdida de contexto WebGL. Lo que NO se comparte: loops (RCI render bajo demanda con `framesPendientes`), cargas de modelos y framing calibrado. Parser GLB propio + caché de buffers (`glbCache`).

## Suscripciones y empresa (resumen)

Doble kill-switch (cliente `VITE_SUSCRIPCIONES` + BD `app_config('suscripciones_activas')`) — con ambos apagados la app se comporta como sin gating. Compra por módulo/puestos vía Lemon Squeezy (3 Edge Functions fail-closed); asientos de empresa con `empresa_lectura/escritura` que extiende las policies RLS; compartir proyectos dueño→miembros. **Detalle operativo y de activación: AGENTS.md §Suscripciones.**

## Seguridad

- RLS como primera línea: policies por `user_id` recreadas con `or empresa_*` (DO dinámico); INSERTs de miembros sellados por trigger `trg_sellar_owner`.
- RPCs de escritura: wrappers con candado de uso (`acceso_modulo`) + `_impl` con revoke, guards de propiedad internos.
- CSP estricta sin `unsafe-inline`/`unsafe-eval` (`wasm-unsafe-eval` solo por pdfjs), sincronizada entre `index.html` y `vercel.json`; `frame-ancestors`/HSTS/XFO por header.
- Riesgos conocidos y aceptados (JWT en localStorage, xlsx-republish): documentados en AGENTS.md §Security.

## CI/CD y calidad

```
push a main ─▶ ci: typecheck → lint (0 warnings) → tests SUITE COMPLETA + coverage (ratchet 42/35/33)
                 → build + prerender → bundle:budget → npm audit → sizeReport
             ─▶ e2e (Playwright)  ─▶ deploy Vercel (needs ci + e2e)
PR          ─▶ ídem, pero solo vitest related de los archivos tocados (rápido para iterar)
```
Gates locales por cambio: `tsc` + `eslint` + vitest de los archivos tocados (regla AGENTS §Tests). Suite completa reservada para pre-release/auditorías — en la práctica la corre el CI en main.

## SEO / render público

Prerender SSR de 14 rutas con fallo ruidoso si el template no matchea. `seo/routeMeta.ts` es la fuente única (sitemap, canonical, hreflang, OG/Twitter). JSON-LD verificado en build (Organization, WebApplication, FAQPage, Article, Breadcrumb). CSS crítico externo; fuentes self-hosted con `unicode-range`.
