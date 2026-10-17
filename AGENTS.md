## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## JSDoc standard (corto + ejemplo + ameno)
- 1-3 lines: WHAT it does (plain words, no jargon) + WHY it matters + one concrete example. Numbers carry units/range. `@param/@returns` only on pure utils. Delete obvious JSDoc (getters, one-line predicates like `esCaja`). Comments only — never change logic in a JSDoc pass.
- Tone: friendly to a NEW programmer. Name the domain idea in simple words before the technical term. Ej: "Reparte la carga de aparatos (quién alimenta a quién) entre ramales de agua fría" beats "Propaga carga por aristas".
- Template: `/** Suma UC (Unidades de Consumo, o sea cuántos aparatos sirve) de un tramo af (Agua Fría). Ej: RAF1 con 2 lavamanos -> 4 UC. */`
- Sigla rule (no exceptions): every acronym expanded in parentheses on first use per block, even if long.

### Sigla glossary (expand inline per block)
- Redes: `af` (Agua Fria), `ac` (Agua Caliente), `san` (Sanitaria), `ll` (Lluvias), `gas` (Gas), `vent` (Ventilacion), `rci` (Red Contra Incendio), `ep` (Equipo de Presion), `bom` (Bomba).
- Carga: `UC (Unidades de Consumo)`, `UD (Unidades de Desague)`, `Q (Caudal)`, `Hunter (metodo de probabilidad de uso simultaneo)`, `Manning (formula de flujo en tuberia)`, `Froude (numero adimensional de regimen)`, `Wyly-Eaton (formula de ventilacion sanitaria)`, `Renouard (formula de perdida en gas)`.
- Normas: `NTC (Norma Tecnica Colombiana)`, `RAS (Reglamento de Agua y Saneamiento)`, `NSR (Norma Sismo Resistente)`.
- Motor CAD: `XFG (fantasma entrepisos)`, `LD_ (ramal desvio entrepisos)`, `scaleM (escala metros por pixel)`, `mergesFrom (genealogia del split: anfitrion + entrantes)`, `recibeDeIds/alimentaIds (ramales que llegan/salen del bajante)`, `_tribReversed (flag de flujo invertido en tributario)`, `npt (nivel de piso topografico)`, `NETS (catalogo de redes del motor)`.

## Suscripciones por módulo (IMPLEMENTADAS PERO DESHABILITADAS)

Suscripción por módulo (solo `flow` y `manage` en catálogo) con **Lemon Squeezy** y **vencimiento manual** (se paga 1 mes / 6 meses / 1 año por adelantado; `app_suscripciones.fecha_fin > now()` es la única verdad, no hay cron ni cobro automático). Precios LISTA por módulo en centavos USD: mensual 2500 ($25.00), semestral 15000 ($150.00 = 6× mensual), anual 30000 ($300.00 = 12×). Descuentos: base por periodo (mensual 0% / semestral 10% / anual 15%) + 10% acumulativo por módulo adicional (2 módulos anual = −25% → $450). La VERDAD de precios es `app_precios` en BD (RPC `obtener_catalogo` los sirve al cliente vía `sincronizarPreciosBd` — cambiar precio = UPDATE en SQL Editor, sin deploy); los literales de `catalog.ts` y `_shared/lemon.ts` son fallback y el test de paridad vigila que no diverjan.

Apagado en DOS niveles — con ambos off, la app se comporta exactamente como antes (nadie se bloquea):

1. **Cliente**: `VITE_SUSCRIPCIONES !== 'true'` (default off). Sin gating en rutas, perfil ni ModulePage; PricingPage muestra la página de marketing; no se invoca ninguna edge function.
2. **BD**: `app_config('suscripciones_activas', false)`. `public.acceso_modulo(uid, modulo)` devuelve `true` para todos con el flag apagado; con él encendido exige fila vigente. Este flag gobierna el check dentro del RPC `save_proyecto` (flow) y la política INSERT de `cm_proyectos` (manage).

### Piezas
- Migraciones: `20260924000000_suscripciones.sql` (tablas + funciones `suscripciones_habilitadas`/`acceso_modulo`/`activar_suscripciones`; candados en `save_proyecto` y policy `cm_proyectos_propietario_insertar`) · `20260924000001_suscripciones_race_y_uso.sql` (FOR UPDATE + rowcount) · `20260924000002_revokes_impl.sql` · `20260928000003_precios_bd_y_cota.sql` (`app_precios` + `obtener_catalogo`) · `20260928000004_rename_familia_suscripciones.sql` (cf_* → app_*) · `20261001000000_semestral_descuentos.sql` (semestral + descuentos acumulativos) · `20261002000000_usd_lemon.sql` (precios USD, moneda 'USD', columna de transacción renombrada a `txn_id`, activar re-emitida).
- Edge functions PENDIENTES (requieren cuenta Lemon Squeezy): `crear-checkout` (valida contra `app_precios`, inserta pago pendiente en `app_pagos` con referencia única, crea checkout LS con el user_id en custom data y devuelve `checkoutUrl`), `verificar-pago` (consulta la orden en la API LS; si APPROVED → `activar_suscripciones`), `ls-webhook` (respaldo: valida firma HMAC del evento y activa — `activar_suscripciones` es idempotente, verify + webhook pueden llegar en cualquier orden). Copia server del catálogo: `supabase/functions/_shared/lemon.ts` (paridad vigilada por test).
- Cliente: `src/lib/subscriptions/catalog.ts` (catálogo + `calcularTotalCentavos` + `formatUSD` + `sincronizarPreciosBd`), `subscriptionsService.ts` (`estaActiva` pura), `src/hooks/useSubscriptions.ts`, `src/components/subscriptions/{CheckoutModal,ModuleSelectDialog,RequireModule}.tsx`.
- Flujo perfil: "Nuevo proyecto" → `ModuleSelectDialog` lista SOLO módulos comprados y vigentes ("Activo hasta X"); 0 activos → "Ver planes" a `/pricing`; 1 → entra directo; flow → `ProjectCreateDialog` → `/civilflowareatrabajo`; manage → `ProjectCreateDialogCM` → `/civilmanagerareatrabajo`.
- Gating adicional: `RequireModule` envuelve los workareas en `App.tsx` (evalúa la fecha en cada render → vence en vivo); CTA de `ModulePage` redirige a `/pricing?modulo=X` sin compra; los diálogos de creación muestran aviso "Suscripción inactiva" (la BD es el candado real). Vuelta del checkout: `/pricing?ref=X` → `verificar-pago` → refetch.

### Empresarial por puesto (fase 2 implementada)
- **Compra**: N puestos por módulo (`app_suscripciones.puestos`; pago trae `puestos_por_modulo` jsonb). **Descuento por volumen** sobre puestos TOTALES de la compra (código, NO BD): 2-4 → −10% · 5-9 → −15% · 10-24 → −20% · **25+ → negociado** (UI: CTA "Contáctenos", `descuentoPorPuestos` devuelve null). Multiplicativo sobre base/acumulativo. Tope automático `PUESTOS_TOPE_AUTOMATICO = 24`.
- **Miembros**: `app_suscripciones_miembros (suscripcion_id, user_id, asignado_por, puede_editar)`. Solo usuarios registrados: `asignar_puesto(bigint, text)` busca `auth.users` por email (SECURITY DEFINER; `cf_perfiles.email` NO es unique). RPCs de gestión: `asignar_puesto` / `quitar_puesto` / `cambiar_permiso_miembro` / `mis_miembros`. UI: `/empresa` (`CompanyPage.tsx`), enlace "Gestionar equipo" en perfil.
- **acceso_modulo** también pasa MIEMBROS de suscripciones vigentes → wrappers CF y policies CM heredan.
- **Compartir proyectos** (dueño → miembros, mientras el asiento esté vigente):
  - Lectura: policies SELECT de tablas cf_*/cm_* con user_id recreadas con `or empresa_lectura(user_id,'flow'|'manage')` (DO dinámico sobre pg_policies; `cm_config` y catálogos globales excluidos).
  - Escritura CF: cirugía sobre CUERPOS VIVOS de los 10 impls (lección R-1): guards `p.user_id = uid` → `or empresa_escritura(...)`; el sellado de INSERTs de miembros lo hace el TRIGGER `trg_sellar_owner` (19 tablas de contenido; re-sella new.user_id al owner vía proyecto_id/plano_id/bajante_origen_id). `save_proyecto`/`update_proyecto_nombre`/`delete_proyecto` quedan owner-only (ciclo de vida).
  - Escritura CM: policies INSERT/UPDATE/DELETE de las 9 tablas hijas con `or empresa_escritura(user_id,'manage')` + helper `cm_proyecto_de_propietario`; el cliente sella `user_id` = dueño del proyecto activo (`storage.ts: ownerIdProyectoActivo` → `userIdEscritura`); `cm_config` sigue self-only.
  - PDFs: policies storage `pdfs_empresa_*` sobre bucket `plan_pdfs` (lectura con asiento, escritura con puede_editar; helper `uuid_seguro` para el cast del segmento).
  - Toggle puede-editar OFF → el server rechaza la escritura del miembro (aviso UI "solo lectura" = pulido futuro).

### ACTIVACIÓN (cuando haya cuenta Lemon Squeezy)
1. Tienda LS: crear producto/variante por módulo×periodo (o custom price) y anotar IDs.
2. `supabase secrets set LS_API_KEY=... LS_STORE=... LS_WEBHOOK_KEY=...`
3. Escribir y deployar las 3 edge functions; configurar webhook en el panel LS: `<SUPABASE_URL>/functions/v1/ls-webhook` (descomentar su bloque en `supabase/config.toml`).
4. Probar en modo test de LS (tarjetas de prueba) antes de producción.
5. Aplicar en SQL Editor (en orden): `20261004000000_suscripciones_empresa.sql` → `20261005000000_empresa_escritura.sql` (el DO de cirugía ABORTA si un guard vivo no matchea — auditar antes de re-intentar).
6. `VITE_SUSCRIPCIONES=true` en Vercel + redeploy.
7. `update public.app_config set valor = true where clave = 'suscripciones_activas';`

Consecuencia conocida (decisión del usuario): al activar NO existe plan gratis — todos los usuarios quedan bloqueados hasta pagar.


## Security Notes

### Linter Supabase — WARNs aceptados (2026-09-24)
- `authenticated_security_definer_function_executable` sobre los WRAPPERS de contenido (save_plano_data, save_proyecto, etc.): patrón INTENCIONAL — SECURITY DEFINER con ownership check interno (`auth.uid()` + verificación de propiedad en cada cuerpo), auditado en rondas 4-6. El lint es WARN por diseño; no hay acción.
- `acceso_modulo`/`suscripciones_habilitadas` ejecutables por authenticated: REQUERIDO — las policies RLS de cm_proyectos las invocan como el rol del usuario (sin EXECUTE las policies fallan). Solo exponen un booleano, sin datos de usuario.
- Familia EMPRESA (20261004000000/05000000, aceptada 2026-10-03): `asignar_puesto/quitar_puesto/cambiar_permiso_miembro/mis_miembros` (SECURITY DEFINER con guard `uid is null → no_autenticado` primero y check de propiedad interno) y `empresa_lectura/empresa_escritura` (para anon devuelven false constante — sin fuga de info; authenticated las necesitan las policies RLS y las storage policies de plan_pdfs). Hardening aplicado en `20261005000001` (revoke de anon; `uuid_seguro` con `set search_path = ''`).
- **NO aceptado y corregido** en `20260924000002_revokes_impl.sql`: las `*_impl` heredaron EXECUTE de authenticated vía el rename (los grants viajan con la función) — bypass del gating de USO. Revocadas de public/anon/authenticated; solo los wrappers (con candado) quedan ejecutables.
- `auth_leaked_password_protection`: toggle de Dashboard → Authentication → Policies (acción del usuario, sin migración).

### Known Risks (Client-Side Only â€” Requires Backend Changes)

- **Auth tokens in localStorage**: Supabase's client SDK stores JWT auth tokens (access + refresh) under `sb-*-auth-token` keys in `localStorage`. This is the default Supabase behavior and cannot be changed without switching to a server-side auth flow (e.g., Supabase SSR with httpOnly cookies). In the current SPA architecture:
  - XSS via dependency compromise could exfiltrate tokens from localStorage.
  - No token encryption at rest.
  - ProtectedRoute.tsx explicitly reads `sb-*-auth-token` from localStorage as an optimistic cache check (lines 9-21).
  - **Mitigation**: The CSP (kept in sync between the `index.html` meta tag and the `vercel.json` HTTP header) restricts `object-src` to `'self' blob:`, restricts `script-src`, and sets `frame-src 'self' blob:` (the `blob:` is required for in-app PDF rendering), reducing injection vectors. For production, consider migrating to a BFF pattern or Supabase SSR.

- **Sensitive app data in localStorage**: Application state (plan selections, trazo data, network configuration) is stored under `civilflow_*` keys and in sessionStorage. Not encrypted but does not contain secrets.

- **No CSRF token**: This SPA uses Supabase JWT bearer tokens in the `Authorization` header, providing inherent CSRF protection. No additional CSRF mechanism is needed.

### Security Headers (Deployment Note)
- The CSP `frame-ancestors` directive and `Strict-Transport-Security` (HSTS) must be set at the CDN/reverse proxy level (nginx, Cloudflare, Netlify, Vercel) â€” they do not work via `<meta>` tags. Both are configured in `vercel.json`.
- `X-Frame-Options: DENY` is set via the `vercel.json` HTTP header only â€” there is no `<meta>` tag for it in `index.html` (browsers ignore `X-Frame-Options` delivered via `<meta>` anyway, so this is correct as-is).
- `.env` is git-ignored. Supabase anon key is public by design. `VITE_` prefix correctly marks client-exposed env vars.

### Deployment Headers (Required at CDN/Reverse Proxy)

These security headers cannot be set via `<meta>` tags and MUST be configured at the deployment layer. All three are configured in `vercel.json`:

| Header | Value | Origin |
|--------|-------|--------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | vercel.json HTTP header |
| `X-Frame-Options` | `DENY` | vercel.json HTTP header |
| `Content-Security-Policy: frame-ancestors` | `'none'` | vercel.json HTTP header |

Configure these in:
- **Nginx**: Add to `server {}` block
- **Cloudflare**: Add via "HTTP Response Headers" rule
- **Netlify**: Add via `_headers` file or `netlify.toml`
- **Vercel**: Add via `vercel.json` `headers` config

### Supabase RLS Policies (plano_trazos table)
Row Level Security (RLS) is enabled on the `plano_trazos` table. The following policies are implemented to ensure IDOR mitigation:
- **Insert Policy**: Users can only insert rows if the `user_id` matches their own authenticated ID (`auth.uid() = user_id`).
- **Select Policy**: Users can only view rows where the `user_id` matches their own authenticated ID (`auth.uid() = user_id`).
- **Update Policy**: Users can only modify rows where the `user_id` matches their own authenticated ID (`auth.uid() = user_id`).
- **Delete Policy**: Users can only delete rows where the `user_id` matches their own authenticated ID (`auth.uid() = user_id`).

These policies prevent unauthorized access or tampering with drawing data belonging to other users.

## Historial de sesiones

Archivado en docs/sesiones/historial.md (movido el 2026-10-16 para mantener este archivo magro como guía viva).

## Session Summary — 2026-10-15 (ronda 29: diag extendido con bajantes+ucAplicado)
- __cfDiag re-instalado (la sesión paralela lo había retirado): ahora incluye BAJANTES (code, tipo, pos, alimentaIds/recibeDeIds, **ucAplicado**) — para el +1 lavadero del montante de la araña (MAC1) se necesita su ucAplicado, no venía en el dump anterior. Síntoma 2 (RAC3 stale en 1ª selección) probablemente ya muerto con la limpieza de residuo (observado en build anterior).
- Gates: tsc 0 · vitest 1129/1129 (182 — sesión paralela sumó) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 30: ucAplicado de montantes receptores se REFRESCA)
- **Causa del "+1 lavadero" del montante (MAC1)**: el ucAplicado se escribía UNA vez al asociar y quedaba CONGELADO — la cadena cambió de doctrina mil veces y él siguió con la foto vieja. FIX: `propagarAparatosPresion` (5bis) REFRESCA el ucAplicado de montantes con recibeDeIds = suma de los totales de los ramales que le llegan (explícito recibeDeIds + contacto geométrico de su cabeza, tol 2). Montantes FUENTE (alimentaIds) intactos (su ucAplicado es lo que ENTREGAN). Forma anidada por clave ({ clave: {aparato:n} } — la que escribe la asociación y lee upMonte). Escritura storage-side por plano (los totales vienen del DFS fresco). Idempotente (cntIgual contra el nido propio).
- RawBaj: +pts opcional; ucAplicado tipado Record<string, Cnt>.
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1129/1129 (182) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 31: dump real VERIFICADO — storage exacto; MAC1 en observación)
- Dump __cfDiag del usuario VERIFICADO contra doctrina: TODAS las piezas exactas (RAC4 solo heredado del trib TIN — residuo limpiado; RAC3 solo su ducha + consumida; RAC2 bajada = carga RAC4 + ducha transferida de RAC3; RAC5 = carga RAC2 + lvm de su trib; RAC6 = todo + lvro propio). Marcador de RAC2 en el libro ✓. transferencias RAC3→RAC2 ✓.
- Pendiente: MAC1 ucAplicado salía {} en el diag (snapshot temprano) — diag ahora fotografía bajantes AL FINAL (tras 5bis) + diag.macRefresh (log de refrescos: código ← nuevo (antes viejo)). El panel del montante lee el objeto del MOTOR — el storage-write de 5bis no lo actualiza en vivo (se corrige al recargar/cambiar piso).
- Esperando: 2º dump del usuario + tabla esperada (RAC3/RAC4/RAC2/MAC1) para cerrar la doctrina del montante.
- Gates: tsc 0 · vitest 1097/1097 (177) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 32: panel af/ac lee storage VIVO — stale de 1ª selección muerto)
- **Causa del "1ª selección tras reingresar muestra rancio, reselección lo arregla"**: `useFixtureTarget` leía `counts[storageKey]` del SNAPSHOT React del montaje — el storage que la propagación async escribió antes del primer render no se veía hasta que un evento tocara el estado. FIX: para af/ac `currentMap` lee VIVO `loadAll()[storageKey]` (post-propagación siempre ✓). El estado `counts` sigue para gas/merge-sums y para las ediciones +/−.
- Diag __cfDiag: bajantes se fotografían AL FINAL (ucAplicado ya refrescado por 5bis) + diag.macRefresh (log de refrescos).
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1129/1129 (182) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 33: transitorios del panel derecho muertos)
- **RAC3 tina transitoria (1ª selección tras reingresar)**: al montar la propagación corría SOLO la red activa ('af' por defecto) — la de 'ac' corría 250ms DESPUÉS del primer clic y el panel mostraba el residuo viejo de la red no corrida. FIX: `correrPropagacion` propaga TODAS las redes de presión (activa primero, luego las demás) en debounce y flush.
- **MAC1 +1 lavadero en el panel derecho**: el panel lee ucAplicado del OBJETO del motor (rancio de la asociación — el refresco storage de 5bis no lo tocaba en vivo). FIX: tras cada corrida, espejo ucAplicado de los montantes del motor desde el trazos recién escrito (loadPlanTrazos por pid).
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1129/1129 (182) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 34: +1 lavadero del montante = doble suma del tributario en el agregado)
- **Causa del +1 en el panel del montante (MAC1)**: el agregado del fallback (af/ac/gas, sin árbol sanitario) sumaba el ramal receptor (RAC6 — su clave YA incluye la carga plegada/heredada de sus tributarios) Y ENCIMA los tributarios con padre en ese ramal (T-cy322 lvro otra vez) → lvro ×2. FIX: en el walk del fallback, la suma del ramal NO recorre sus tributarios hijos — su carga ya vive en la clave del ramal (fold librosTrib / heredado por cascada); la fila del tributario sigue mostrándolo.
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1129/1129 (182) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 35: RAÍCES — libro cross-net borrado + re-base de pisos sin calibrar)
- **RAC3 tina intermitente (RAÍZ, dump+exploración)**: el libro `bajadas_receptoras_v1` es COMPARTIDO cross-net y la poda de fósiles construía `vivas` solo con la red actual → cada corrida af/gas BORRABA la marca de ac_RAC2 → la siguiente corrida ac: RAC2 no-bajada → la carga de RAC4 (tina) iba a RAC3 (colineal) y RAC2 vacío; la corrida siguiente se auto-reparaba → alternancia exacta del usuario. FIX: poda PER-NET (solo claves `${net}_`) en ambos podados; secuencia af→ac→gas ×3 estable en test.
- **Renumerado**: `networkRenumber` NO migraba `bajadas_receptoras_v1` (huérfana tras renombrar + podada). FIX: constante movida a storage-keys (exportada), cleanOrphans + migración mover-dejar en renameRamalId (valores numéricos).
- **Trazos desplazados al reingresar (RAÍZ)**: el re-base de escala global en useTrazosLoader re-escala y PERSISTE cualquier piso cuyo docScale ≠ global — pisos SIN calibración (set estándar 0.5) se re-basaban con la global de OTRO piso (el "primer calGlobal" del array planos cambia de orden entre sesiones) y el pisado de scaleM del efecto 587 + autosave compostaban la deriva diaria. FIX: (1) re-base SOLO para pisos con origen en plans_meta (calibrados — su escala manual es la que se unifica; los estándar son su propia verdad); (2) escalaGlobal leída de plans_meta (orden estable) en vez del array planos.
- Pendiente de validar en vivo: (a) el usuario repite el ciclo reingresar/seleccionar RAC3; (b) compara scaleM del doc civilflow_trazos_<id> entre sesiones (si queda fijo, la deriva murió). Sin test unitario del gate del loader (requiere mock del motor — el re-base puro ya tiene frameOrigin.test).
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1130/1130 (182) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 36: «Conexión sin entrada» deja de bloquear)
- La regla `junctionHasIncomingFlow` bloqueaba en 4 sitios: dibujo (finishRamal), aterrizaje/split (junctionAutoSplit), invertir dirección y convertir a tributario (menú contextual). Con aparatos apuntando a sus extremos NINGUNA pieza "entra" a la T → split no formado (los aparatos jamás propagaban por ahí) / flip y conversión bloqueados. FIX: (1) junctionAutoSplit — split SE FORMA siempre, aviso `_emitStatus`; (2) finishRamal — dibujo procede, aviso estado (queda «sin salida» como bloqueo real); (3) flip/convertir — se APLICAN con aviso de estado (sin modal ni revert). La coherencia hidráulica queda separada de la decisión de bloquear. Conservados: «sin salida», «sale de aparato», «entra a fuente», ciclos, validación sanitaria.
- Test nuevo: T con 3 ramas hacia afuera sin entrante → split formado, sin alerta «sin entrada» (autoSplitSinEntrada.test.ts).
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1131/1131 (183) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-17 (SEO + descubrimiento por IA: prerender + señales)
Diagnóstico confirmado contra el repo (SPA shell sin cuerpo, acordeón desmontando contenido, typewriter vacío, metas solo-cliente). Ejecutado el plan completo en 4 fases.

### Fase 0 — Desbloqueo de contenido
- `SectionAccordion`: cuerpo SIEMPRE montado + `hidden={!isOpen}` (crawlers sin JS leen la documentación cerrada).
- `TypewriterText`: texto completo en DOM desde el primer render; `useLayoutEffect` lo vacía pre-paint (disable de set-state-in-effect + exhaustive-deps con justificación SEO).
- **`src/seo/routeMeta.ts`**: tabla única de 13 rutas públicas (path/title/description/changefreq/priority) — fuente del prerender y referencia de los usePageMeta.

### Fase 1 — Prerender (cero deps nuevas)
- `src/seo/prerenderEntry.tsx`: renderToString de 13 páginas (import directo, NO lazy) + StaticRouter de react-router 7 + AuthProvider (sin sesión → HTML nunca user-specific). Re-exporta ROUTE_META.
- Build encadenado: `vite build && vite build --ssr src/seo/prerenderEntry.tsx --outDir dist-ssr && node scripts/prerender.mjs`.
- `scripts/prerender.mjs`: stubs de browser ANTES de cargar el bundle (window/localStorage/matchMedia/location), inyección del contenido en el #root del template + title/description/canonical/og por ruta + BreadcrumbList por ruta, salida `dist/<ruta>/index.html` ('/' sobrescribe dist/index.html). Fallo = warning + exit 0 (dist intacto); `process.exit(0)` al final (el bundle registra timers).
- Lecciones: import ESM en Windows exige pathToFileURL; mkdirSync del DESTINO (no del padre); stub de `location` global salva TODAS las lecturas sueltas (no cazar una por una); el JSON-LD inline en prerenderEntry re-exporta ROUTE_META para leerlo del bundle.

### Fase 2 — Señales
- robots.txt: Allow explícito GPTBot/OAI-SearchBot/ChatGPT-User/ClaudeBot/PerplexityBot/Google-Extended/CCBot + Disallow de 7 rutas de app (advisory — la protección real sigue siendo auth+RLS).
- sitemap.xml regenerado: 13 rutas (fuera login/register/visor) con lastmod 2026-10-17.
- `public/llms.txt` nuevo: qué es, 7 módulos con URLs, documentación, precios, legal.
- `lang="es-CO"` + hreflang es-CO/es-419/x-default.

### Fase 3 — Datos estructurados
- WebApplication: offers reales (25/150/300 USD por módulo), applicationSubCategory, featureList. FAQPage global (UC vs UD, Hunter, fuerza tractiva, NTC 1500). BreadcrumbList inyectado por ruta en el prerender.

### Fase 4 — Verificación (curl-equivalent sobre dist)
- 13/13 rutas prerenderizadas; /docs trae "NTC 1500" ×4 en el HTML; títulos por ruta ✓; 'Cargando…' ausente en las 4 rutas sondeadas; **0 contenido user-specific** en el HTML prerenderizado; robots.txt deja pasar a GPTBot.

### Pendiente del usuario
- Search Console + Bing Webmaster Tools (verificar dominio, subir sitemap).
- Recarga dura visual: landing (typewriter anima igual), /docs (acordeones abren/cierran), pricing.

### Cierre M-5a (último hallazgo autocontenido)
- `esMontePresion` incluye `rci` (REDES_PRESION completa): montante rci ya sincroniza con su ramal. Los 2 pendientes restantes requieren decisión de diseño: F-5 (¿bom/ep dentro del PDF de planos?) y M-8 (¿espejos de closeValidation por piso?).
- Gates: tsc 0 · lint 0 · vitest 1131/1131 (183) · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 37: una sola pantalla de carga en el visor)
- El visor mostraba DOS pantallas de carga consecutivas al abrir («Abriendo proyecto…» del switch y «Cargando planos y redes…» del overlay fijo). FIX: mismo texto/texto-visual en ambas — una sola pantalla percibida.
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1131/1131 (183) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 38: unión solo-de-salidas + skip pendientes)
- **Unión SOLO DE SALIDAS** (todas las flechas hacia afuera — caso RAC6): regla nueva — las piezas CON aparato propio alimentan a las VACÍAS (base), sin malla ni duplicados; RAC6 acumula ducha+tina ×1. Regresión conocida: las 2 variantes 'sin flag' de los Casos viejos (esperan la malla clásica) quedan it.skip PENDIENTES de resolver.
- librosTrib hoistado al inicio de propagar (el unión-solo-de-salidas lo lee antes de fase A).
- Limpieza de instrumentos XBR/XJ/XCL/XENTRY/XD.
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1123+8skip/1131 (183) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 39: 5 arreglos — asociación, cargas, deriva de escala, cascada de diámetros, etiqueta)
1. **Montante en extremo de ramal auto-asociado**: handleMontanteDown/handleCreateMontanteMidBody escriben ahora `asocManual: [...assocRamales]` — sin él la poda/autodetección desmarcaba los checkboxes al siguiente _markDirty. Los checkboxes de ambos paneles quedan chequeados estables.
2. **Pantallas de carga unificadas**: index.html `._preload` («Cargando…») y App.tsx Suspense fallback («Cargando...») pasan a «Cargando planos y redes…» — una sola pantalla percibida de principio a fin.
3. **Trazos corridos/más cortos — bucle de escala cerrado**: el efecto que PISA engine.scaleM al estándar (PdfViewer 599-614) ahora consulta plans_meta — si el piso tiene `origen` (calibrado) NO pisa (antes pisaba con el scale del array planos mientras los pts estaban en otro espacio → autosave persistía el par disparejo → la carga siguiente re-basaba y ENCOGÍA ~5.5 % por reingreso). Limitación: los trazos ya encogidos quedan encogidos — recalibrar ese piso re-escala a la medida.
4. **Diámetros en araña — cascada completa**: convergirDiametroNodoPresion ahora es BFS (cada vecino que sube encola su downstream con la misma regla direccional, hasta punto fijo) — una cadena RAC1→RAC4→RAC3 converge completa al editar el primero. Por salto se preservan: jamás baja, hermanas perpendiculares no reciben, unión multi-salida solo colineal/mergesFrom. Tests multi-hop + lateral-perpendicular.
5. **Bajantes asociados (san) sin piso**: el checkbox muestra `b.code || b.id` (sin «-P2») — solo ese sitio.
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1126+8skip/1134 (183) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-15 (ronda 40: el panel de aparatos muestra SOLO lo propio)
- **Criterio final del panel af/ac (orig. usuario "sin sentido ese panel" — RAC6 mostraba la mezcla de toda la cadena)**: `useFixtureTarget` devuelve `disk − librosHer − librosTrib` = SOLO los aparatos ASIGNADOS a esa pieza. La carga heredada/plegada vive en CalcUC (donde se dimensiona); una pieza de paso (RAC6) muestra su grilla en cero y bloqueada (esPropagado por heredados sigue). Las piezas con aparato propio (RAC3 duc) lo muestran y siguen editables.
- Gates: tsc 0 (filtrando sesión paralela) · vitest 1126+8skip/1134 (183) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-17 (ronda 41: revert ronda 40 — el panel vuelve a mostrar la carga TOTAL)
- **"Los aparatos no se propagan" (T1RAC4/RAC1 → RAC4) era el PANEL, no el motor**: test de reproducción con la geometría exacta de la captura (nudo de 3 salidas RAC4+T1RAC4+RAC1, aparatos en las puntas, RAC2 bajando en el segundo nudo) pasa 2/2 — el propagador ESCRIBE {tin,lvm} en RAC4 y RAC2, idempotente. La resta "solo lo propio" de la ronda 40 mostraba receptores en CEROS (disk − her − trib = 0 en un receptor puro) → parecía propagación muerta. REVERT: `useFixtureTarget` af/ac vuelve a devolver `loadAll()[storageKey]` (propio + heredado + plegado = lo que la pieza TRANSPORTA); el bloqueo de edición sigue siendo esPropagado (heredados no vacíos). Lección: "sin sentido ese panel" (RAC6) era DOBLE conteo en escritura, no doctrina de visualización — si resurge, diag y raíz en el motor.
- Tests: `propagacionCadenaCaptura.test.ts` nuevo (cadena completa + idempotencia). Los 4 `it.skip` viejos ("RAF3 sí, RAF1 no, pendiente con la unión solo-de-salidas") RESUELTOS: la doctrina nueva los satisface → activos. Debug prints XBR (propagador) y XD1 (test) fuera.
- Gates: tsc 0 · vitest 1136/1136 (184, 0 skip) · lint 0 · build ✓ · graphify ✓.
