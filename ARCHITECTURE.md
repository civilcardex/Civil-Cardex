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
- Los componentes y páginas **no** importan `lib/supabase` directo: la capa `services/` (projectDataService, apparatusService, profileService, strokesDb…) es el único canal a BD. Excepciones auth-only (solo `supabase.auth`, cero tablas/RPC): `AuthContext` (arranque de sesión) y `ProfilePage` (refreshSession/signOut).
- `utils/` hospeda el cálculo por disciplina y las memorias exportables; entra por props/context, no toca red.

## Motor CAD (PlanoEngine)

Fachada única + módulos delegados por fase (`renderers/`, `drags/`, `creations/`, `deleteSelected/`, `events/`). `PlanoState` inmutable con historia; el estado de dibujo por piso vive en `TramosContext`/`PlansContext` y se sincroniza al dibujo vía `utils/drawingSync*`.

Conceptos del motor (glosario completo en AGENTS.md): `scaleM` (m/píxel), `XFG` (fantasmas entrepisos), `mergesFrom` (genealogía de splits), `recibeDeIds/alimentaIds` (grafo bajante↔montante).

## Persistencia y concurrencia

**civilflow — trazos por plano:**
```
edición ─ autosave (debounce) ─▶ cola POR PLANO (trazosSaveQueue, planos distintos en paralelo)
   ─▶ tumba anti-vacío (push sin contenido sobre caché con contenido = bloqueado)
   ─▶ RPC save_plano_data (reemplazo atómico por colección)
```
- Carga: árbitro por `ts` con reglas anti-vacío (`trazosLocalGanaABdVacia` / `trazosBdGanaALocalVacia`) — un doc vacío nunca borra el piso.
- **Concurrencia LWW (ped. usuario 2026-11-24)**: el guardado local SIEMPRE pisa la nube — sin reloj de versión (`p_updated_at` null = sin check en el servidor); no hay conflicto ni aviso de recarga. Al abrir un piso manda el doc de ts mayor (anti-vacío primero); la próxima edición re-subel local.
- Persistencia física: IDB espejo primero, Supabase como verdad; journal local para auditar bloqueos.

**civilmanager — estado completo del proyecto:**
- `cm_save_state` reconcilia las colecciones dentro del proyecto; los campos omitidos conservan su valor. **LWW**: el cliente NO manda reloj (`p_updated_at` null = sin check) — el borrador local siempre pisa la nube.
- Respaldo IndexedDB por cuenta y proyecto antes del autosave de 300 ms. Si falta la conexión, se conserva el reloj base del borrador y no se mezcla con otro proyecto.
- Las migraciones `20261123000000`–`20261123000002` deben estar verificadas en el entorno destino antes de publicar el cliente. Los contratos locales viven en [saveContracts.mjs](supabase/tests/saveContracts.mjs).
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

Los pagos aprobados encolan una confirmación en la misma transacción que concede acceso. Supabase Cron invoca `subscription-emails`, que encola avisos al entrar en los últimos siete días de vigencia y comprueba la fecha antes de enviarlos. La cola privada desduplica por pago y por fecha de vencimiento de cada módulo. Resend entrega los mensajes al correo confirmado del titular. La función restringe Sandbox al usuario autorizado de Paddle.

Para habilitar el envío, desplegar `subscription-emails` y configurar `RESEND_API_KEY`, `SUBSCRIPTION_EMAIL_FROM` (remitente de dominio verificado) y un secreto dedicado `SUBSCRIPTION_EMAIL_CRON_SECRET`. Guardar la URL de la función y el mismo secreto en Supabase Vault con los nombres de `supabase/subscription-email-cron.sql`. Ese archivo crea el trabajo en pausa. Activarlo después de comprobar los secretos de correo. La renovación sigue siendo manual.

Doble kill-switch (cliente `VITE_SUSCRIPCIONES` + BD `app_config('suscripciones_activas')`) — con ambos apagados la app se comporta como sin gating. Compra por módulo/puestos vía Paddle Billing (3 Edge Functions fail-closed); asientos de empresa con `empresa_lectura/escritura` que extiende las policies RLS; compartir proyectos dueño→miembros. **Detalle operativo y de activación: AGENTS.md §Suscripciones.**

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
