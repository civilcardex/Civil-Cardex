# PROJECT_MAP — Mapa del repo (Índice general)

> Qué vive dónde. Granularidad por **carpeta**, no por archivo — se actualiza solo cuando nace o muere una carpeta (regla en [AGENTS.md](AGENTS.md)).
> Cómo funciona: [ARCHITECTURE.md](ARCHITECTURE.md) · Reglas de trabajo: [AGENTS.md](AGENTS.md) · Historial de sesiones: [docs/sesiones/historial.md](docs/sesiones/historial.md)

## Panorama

SPA React 19 + Vite con **dos productos** en un solo repo:

| Módulo | Qué es | Tamaño |
|---|---|---:|
| `src/modules/civilflow` | Diseño hidrosanitario tipo CAD sobre planos (agua, sanitaria, lluvias, gas, RCI, EP) + cálculo normativo + visores 3D | 1042 archivos |
| `src/modules/civilmanager` | Presupuestos y APU (Análisis de Precios Unitarios) de obra civil | 66 archivos |

Persistencia: **Supabase** (Postgres con RLS + RPCs SECURITY DEFINER + Edge Functions) con espejo **IndexedDB**. Deploy: **Vercel** con prerender SSR de 14 rutas públicas. Total: 1213 archivos `.ts/.tsx` (306 son tests).

## Raíz — configuración

| Archivo | Propósito |
|---|---|
| `package.json` | scripts: dev / build (cliente + prerender SSR en postbuild) / test / lint / typecheck / bundle:budget + simple-git-hooks (pre-commit lint-staged) |
| `vite.config.js` | Vite + React; relaja la CSP solo para el dev server (HMR) |
| `vitest.config.ts` | Vitest node-env; coverage v8 con ratchet (42/35/33); excluye civilmanager y pages del conteo |
| `vitest.setup.ts` | Setup global de tests |
| `eslint.config.js` | ESLint 9 flat: typescript-eslint + jsx-a11y en `error` + react-hooks + prettier; `--max-warnings 0` |
| `playwright.config.ts` | e2e en puerto 5200, Chromium, 90 s/test |
| `vercel.json` | CSP estricta de producción + cache inmutable de assets (header, no meta) |
| `tsconfig.json` | strict, bundler mode, noEmit |
| `postcss.config.js` | Tailwind 4 vía `@tailwindcss/postcss` |
| `index.html` | Entrada con CSP de producción inline |
| `.github/workflows/ci.yml` | CI: typecheck → lint → tests → build → budget → axe → sizeReport → e2e → deploy Vercel |
| `.nvmrc` | Node 22 pineado |

## `src/` — primer nivel

```
src/
├─ App.tsx / main.tsx / index.css     # arranque: rutas, providers, CSP
├─ components/        39              # UI global: Navbar, ProtectedRoute, ErrorBoundary,
│  ├─ help/           15              #   HelpPanel + guías contextuales por área (viewer,
│  │                                  #   isometry, networks, reports, manager, crop, flow, project)
│  ├─ tour/            3              #   TourOverlay (excepción G9/G10), tourSteps, useTour
│  ├─ subscriptions/   3              #   CheckoutModal, ModuleSelectDialog, RequireModule
│  ├─ shared/          4              #   ModalShell (dialog nativo, doctrina G9/G10), ConfirmModal
│  ├─ landing/         8              #   hero/efectos de la landing pública
│  └─ modulePage/      1              #   ManageHero
├─ context/            1              # AuthContext (único context global fuera de los módulos)
├─ hooks/              6              # genéricos: usePageMeta, usePersistedState, useSubscriptions…
├─ layouts/            1              # Layout del shell autenticado
├─ lib/                6              # supabase.ts (cliente), idb.ts, subscriptions/ (catálogo Lemon Squeezy)
├─ pages/             29              # públicas (Landing, Pricing, Company, legal, ModulePage)
│  ├─ auth/           10              #   login, register, reset, perfil, proyectos
│  ├─ learn/           4              #   "Aprende": artículos Hunter/NTC 1500 y fuerza tractiva
│  └─ pricing/         3
├─ seo/                3              # prerenderEntry.tsx (SSR), routeMeta.ts (fuente única de rutas)
├─ styles/            18              # CSS por dominio (tokens, tables, landing, dialogs…)
├─ test/              12              # infra de test: renderEnJsdom, axe, domStubs, fixtures
└─ utils/              6              # saveToCloud, devError, exportLoaders, authMessage…
```

## `src/modules/civilflow` — diseño hidrosanitario (1042 archivos)

```
civilflow/
├─ components/        401
│  ├─ WorkAreaCivilFlow* (raíz 33)    # shell del área de trabajo + tablas de cálculo
│  │                                  #   (Rain*, Sanitary*, Gas*, CalcUC, PumpAR…)
│  ├─ pdfViewer/     103              # visor de planos + editor de dibujo sobre canvas
│  │  ├─ drawingElementContextMenu/ 35  # menú contextual de elementos dibujados
│  │  ├─ tramoEditor/     16          # editor de tramos (bajante/ramal/meter/heater)
│  │  └─ engineInit/       3          # inicialización del motor
│  ├─ rci/            59              # diseño Red Contra Incendio (NTC 1500): tablas floors/
│  │                                  #   rooms/ramales/hidráulica/bomba/sísmico + guía (SVG)
│  ├─ workarea/       48              # panel de planos: carga, calibración, isometría/ 15
│  ├─ fixtures/       31              # aparatos sanitarios: herencia montantes↔bajantes entre pisos
│  ├─ workareaContent/18              # tabs de contenido (networksTab, reportTab, use*Tables)
│  ├─ shared/         20              # UI común (Tbl, Card, glbCache, threeStage.ts staging 3D)
│  ├─ rci3d/ epc3d/ aparatos3d/ rciNetwork3d/ 30  # visores 3D GLB (staging común en shared/)
│  ├─ Regulations/    10              # normativa visible al usuario
│  ├─ ep/ waterNetworkDesign/ supplyConnection/ rejillasVentilation/ gas/ sanitary/ …
│  └─ __tests__/       5
├─ lib/               296             # PURO: sin imports de React
│  ├─ PlanoEngine/   267              # motor CAD: fachada + delegados (renderers/ 30, drags/ 11,
│  │                                  #   creations/ 6, deleteSelected/ 6, events/ 6), PlanoState/
│  │                                  #   History/Persistence, HitTester, RCIAutoDraw — 130 tests
│  ├─ rci/            14              # motor de cálculo hidráulico RCI (network, pump, checks)
│  └─ shared/          4              # projectTypes, geometry, connectionGraph
├─ services/          18              # projectsService, projectDataService, storageService
│  └─ storage/         5              # strokesDb (trazos→BD), localStorage, strokesJournal
├─ utils/             262             # cálculos y filas por disciplina (rain*, san*, gas*, water*),
│                                     #   reportes PDF/DOCX/Excel, drawingSync*, asociaciones
├─ constants/         26              # engineeringData* (aparatos/materiales/gas), countryStandards
│                                     #   (matriz doctrina 6 países), storage-keys, rejillas/
├─ context/           11              # ProjectContext, TramosContext, PlansContext,
│                                     #   ApparatusContext, RainwaterContext
├─ pages/             26              # WorkAreaCivilFlowPage, ViewerPage, AcometidaPage,
│                                     #   CatalogMasterPage, DocsPage (+docs/data/ 14)
└─ styles/             1              # sharedTableStyles (SI/TH/TD de las tablas de diseño)
```

## `src/modules/civilmanager` — presupuestos y APU (66 archivos)

```
civilmanager/
├─ raíz (11): WorkAreaCivilManager, context, storage, types, dto, calc (motor APU/AIU),
│             codeGen, seedData (6 perfiles país + FP por país), excelImport, excelSafe
├─ budgets/    7      # presupuestos: árbol de proyectos, ítems, resumen AIU, entregables, import
├─ apu/        8      # catálogo + editor + export de APU
├─ catalogs/   5      # colaboradores, cuadrillas, equipos, insumos, proveedores
├─ config/    11      # parámetros APU, factor prestacional, perfil de país, listas
├─ shared/    12      # CrudTable, XlTable (estilo Excel), EditLock, NumInput, Toast
├─ storage/    5      # rpc (cm_get_data/cm_save_state), legacy (olas paralelas), serialize, idb
├─ services/   1 · components/ 1 · __tests__/ 6
```

## `supabase/`

| Carpeta | Contenido |
|---|---|
| `migrations/` | 113 SQL: esquemas `cf_*` (civilflow), `cm_*` (civilmanager), `app_*` (suscripciones), RPCs de guardado (save_plano_data, cm_save_state), RLS + policies de empresa, concurrencia optimistic |
| `functions/` | 3 Edge Functions de pagos: `crear-checkout`, `verificar-pago`, `ls-webhook` (+ `_shared/`: lemon.ts, payment_utils.ts) |

## Otros

| Carpeta | Contenido |
|---|---|
| `scripts/` | prerender.mjs (SSR post-build), bundleBudget.mjs (presupuesto de bundle), sizeReport.mjs |
| `e2e/` | 4 specs Playwright: public, auth, checkout-mock, csp |
| `docs/` | sesiones/historial.md (archivado de sesiones) |
| `graphify-out/` | grafo de conocimiento: consultar con `graphify query/explain/path` (ver regla graphify en AGENTS.md); GRAPH_REPORT.md solo para review de arquitectura |
| `.agents/skills/` | skills de dominio (ing. civil, seo, supabase…) — conocimiento del agente, no código de la app |
