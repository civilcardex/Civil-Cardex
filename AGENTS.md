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

## Session Summary — 2026-10-19 (ronda 42: enlaces entre pisos — borrado desasocia y montantes heredan aparatos)
- **Tarea 1 (desplegable de origen stale)**: las rutas INDIVIDUALES (selId) de `deleteSelected` no limpiaban punteros — el lote sí. Fix: borrar el LDesvio individual ahora llama `limpiarPunterosDeEnlace` + `clearBajanteAssociation` (espejo del lote), y borrar el anillo fantasma individual llama `desasociarPorBajante` antes del return. `cascadeMontanteAssociation` escribía el piso vecino con `saveToStorage` solamente → al recargar desde BD resucitaba el puntero; ahora también `saveTrazosToDB`.
- **Tarea 2 (montantes asociados no tomaban los aparatos del superior)**: el apply escribe el libro `ucAplicado` del destino con el GRUPO, pero el refresco 5bis lo REEMPLAZABA por totales locales en la MISMA corrida que el apply encadena (y en cada selección). Fix: 5bis SALTAR montantes con `origenId` (su libro lo gobiernan apply/espejos/clear; el caso MAC1 no asociado intacto). Complementos: `RawBaj.origenId` tipado; `correrEspejos` ya no escribe el delta en las claves de ramales destino en redes de presión (misma regla del apply — el grupo viaja SOLO por libro→upMonte; duplicaba) y RE-ESTAMPA el fantasma (XFG) cuando cambian los aparatos del superior (`estamparCargaEnFantasma` exportada). La sesión paralela ya había puesto cargaBaj con MÁXIMO por aparato y la protección del LD vía `heredadoAsocDe` — no duplicados.
- Tests: `assocMontanteAparatos` +1 (la corrida posterior conserva el libro y el LD); `assocMontanteBorrado` +2 (LDesvio individual y anillo individual dejan el original sin origen, storage y motor vivo).
- Gates: tsc 0 · vitest 1153/1153 (189) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 43: panel del asociado = SOLO el grupo; wipe de checkboxes)
- **Checkboxes de asociación se borraban (regresión mía)**: la re-estampada del fantasma desde los espejos usaba `estamparCargaEnFantasma` → `saveData` reescribe el doc COMPLETO del piso cargado (localStorage + BD) y estampa `ts` — pisaba el autosave de 1.5 s donde acaban de aterrizar los checkboxes y dejaba el doc viejo con ts nuevo. FIX: los espejos mutan SOLO el fantasma vivo del motor (`eng.crossFloorGhosts`) y el autosave persiste; `estamparCargaEnFantasma` vuelve a ser module-private (solo apply, que corre en acción explícita del usuario).
- **Panel del montante asociado mostraba propio + heredado (16.5 en vez de 4.5)**: las entradas del libro de los ramales ALIMENTA llevaban `{grupo, ...own}` (own = aparatos propios del montante destino, que NO son herencia — bajan a sus ramales por upMonte). El panel (libroHeredado = máx por aparato) mostraba la unión. FIX: en apply y espejos, para redes de presión las entradas del libro son SOLO el grupo (san igual, como estaba). El libro ya contaminado se autocura con la siguiente reescritura (re-asociar o abrir el piso superior).
- Doctrina confirmada por el usuario: montante superior muestra lo propio (4.5 ✓); montante inferior ASOCIADO muestra SOLO lo heredado (4.5 del superior); lo propio del inferior se ve en sus ramales. Tablas/dimensionamiento siguen con la columna completa (cargaBaj = propio + libro).
- Tests: `assocMontanteAparatos` +1 (libro del asociado = grupo puro, seed ahora con alimentas y aparatos propios del destino).
- Gates: tsc 0 · vitest 1154/1154 (189) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 44: paridad montantes desde el piso inferior · __cfScale · click derecho)
- **Montantes entre pisos — el hueco de paridad REAL**: los espejos del enlace SOLO re-computaban el libro ucAplicado con el piso SUPERIOR cargado (guard descargaEnId + loadedNpt > nq). El usuario trabaja en el piso INFERIOR: un libro rancio (doctrina vieja / asociación pre-fix) JAMÁS se refrescaba y el panel seguía mostrándolo. FIX: rama nueva en `correrEspejos` — montante de presión con origenId en el piso cargado (siendo el inferior) re-computa el grupo con `collectSourceAgg` leyendo el STORAGE del piso de arriba, actualiza la clave del LD (syncMirrorKey) y el montante del MOTOR (libro grupo-puro + ucAcum) — el autosave lo persiste (reescribir el doc del piso cargado aquí era el wipe de checkboxes). Sin escrituras hacia arriba (trinquete). San intacto (bajantes ya finos según usuario).
- **Drift de escala/origen**: revisados los 3 puntos del bucle (re-base del loader con gate plans_meta, pisado del PdfViewer con el mismo gate, autosave con flush en beforeunload/pagehide + flush en switch de piso) — no hay lazo vivo; lo que se ve al recargar es geometría YA encogida de la deriva histórica (limitación documentada: recalibrar ese piso la re-escala a la medida). Añadido `__cfScale()` (consola): vuelca por piso origen/calibración/scaleM/ts/primerPt + escalaGlobal — comparar DOS dumps entre sesiones delata si algún piso se mueve solo.
- **Click derecho "a veces"**: pipeline revisado (hit-test completo: fantasmas con desplazamiento > contador > bajantes > cuerpo de ramal > ramales > canales; redes ocultas filtradas a propósito). Gap conocido: los marcadores XFG entre pisos NO tienen menú contextual (se seleccionan con clic izquierdo y se borran con Supr) — clic derecho sobre ellos no hace nada. Sin repro concreto no se toca más.
- Gates: tsc 0 · vitest 1154/1154 (189) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 45: anillo muere al desasociar · XFG sin UC · libro viejo se cura desde abajo)
- **Desasociar borraba el Ldesvio y el XFG pero dejaba el ANILLO** (desplazamientos/ghostData del montante inferior — el montante fantasma dibujado). FIX: `clearBajanteAssociation` (rama con roles) ahora elimina los niveles del anillo cuyo Ldesvio === el LD del enlace — en el storage del piso inferior (+DB) y en el motor vivo.
- **XFG sin conteo UC (orig. usuario)**: `bajanteGhosts.ts` ya no añade "N UC" al label del marcador entre pisos — la carga heredada se lee en el montante de destino y el Ldesvio.
- **MAC2-P1 = 15.5 (propio mezclado)**: repro EXACTO en test (aparatos en la CLAVE PROPIA de ambos montantes, como las capturas) pasa — panel del asociado = grupo puro. Y test de curación: libro VIEJO contaminado en storage + correrEspejos desde el piso inferior → el libro del motor se reescribe con el grupo puro y el panel muestra 4.5. Si el usuario aún ve mezcla: o su sesión es anterior al fix (recargar), o la asociación quedó suelta tras su prueba de desasociar (verificar desplegable origen; re-asociar una vez). Si con desplegable poblado y recarga sigue: __cfDiag('af').
- Tests: `assocMontanteClavePropia.test.ts` nuevo (2: grupo puro + curación del libro viejo) · `assocMontanteBorrado` +1 (anillo muere al desasociar).
- Gates: tsc 0 · vitest 1157/1157 (190) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 46: bloqueo receptor en TODAS las redes · renumeración de montantes completa)
- **esPropagado por red (orig. usuario: en san no se bloqueaban los receptores)**: el criterio solo cubría af/ac (libro heredados). Ahora: gas entra por el mismo libro (el propagador es común) y san/ll leen el libro ucAplicado de los bajantes del piso — si la clave del ramal aparece como DESTINO con conteo > 0, es receptor → grid disabled + opacidad 0.55 en el contenedor (antes solo el estado sin selección atenuaba).
- **_renumberMontantes solo renombraba id/code** — cero reparación de referencias: ini/fin de ramales (que guardan el CÓDIGO), punteros `plan|id` de asociación, LDesvio (LD_<id>), anillos, fantasmas XFG, storage de pisos vecinos y claves de UDs del montante renombrado. FIX: espejo de _renumberBajantes — reparación completa en motor + renameBajanteAcrossFloorReferences + movimiento de claves aparatos/hidro (montante y su LD) en el piso cargado. Test nuevo `renumberMontantes.test.ts` (compacta MAC1/2/3 → tras eliminar el 1: renombres, ini, LD y claves movidas).
- Gates: tsc 0 · vitest 1158/1158 (191) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 47: renumeración en borrado individual · receptores san/ll por salida)
- **Borrado INDIVIDUAL no renumeraba** (orig. usuario: "no se dispara tan pronto borro"): el camino selId de `deleteSelected` no tocaba `_renumberBajantes`/`_renumberMontantes` (solo el conjunto). FIX: bajante → `_renumberBajantes(net)`; montante → `_renumberMontantes()` (junto al cleanupTeeMarkers existente).
- **Receptores san/ll faltantes**: el criterio por libro ucAplicado no cubría los RAMALES DE SALIDA de un bajante — `syncMirrorKey(..., false)` los reescribe completos en cada pase SIN libro. FIX: el memo `esPropagado` (movido después de `exitsDeBajante`) añade la rama (b): ramal salida de algún bajante de la red = receptor → bloqueado + opaco.
- `__cfDiag` imprime la línea `[CF-DIAG] {...}` en consola (seleccionar+copiar) — el JSON por clipboard no llegaba.
- Gates: tsc 0 · vitest 1158/1158 (191) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 48: receptor por TRIBUTARIOS conectados)
- **Criterio receptor completo (orig. usuario: "no solo bajantes y ramales, sino entre ramales y tributarios conectados")**: presión (af/ac/gas) ahora lee AMBOS libros del propagador — heredados + plegado de tributarios (`leerFoldTribPresion`: el padre es receptor de lo que sus tributarios traen); san/ll añaden la rama (c): DFS por `padre` — cualquier descendiente con aparatos propios bloquea el ramal (el plegado sanitario sube al ramal). Memo movido después de `exitsDeBajante` (deps: storageKey/netId/planId/librosTick/targetId/engineRef/exitsDeBajante/counts).
- Botón "⧉ diag" en el header del panel (junto a "Asignado a X"): copia el volcado `__cfDiag` de la red activa al portapapeles con un clic — sin consola.
- Gates: tsc 0 · vitest 1158/1158 (191) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 49: RAÍZ del 15.5 — libro huérfano del montante FUENTE)
- **El dump del usuario lo cerró**: MAC1 del piso superior es FUENTE PURA (recibeDeIds vacío) y arrastraba un ucAplicado de una era anterior con el grupo VIEJO ({lvm:5,tin:5,duc:3,lvro:3,lvp:2}). Dos caminos lo perpetuaban: (a) collectSourceAgg mezcla el libro PROPIO del bajante con MÁXIMO al computar el grupo → el rancio le ganaba al árbol fresco (4.5); (b) 5bis lo salta (sin recibeDeIds) → jamás se refrescaba. El 15.5 del panel = esa foto vieja, no aparatos del piso 1.
- FIX doble: (1) `collectSourceAgg` solo mezcla el libro propio si el bajante es RECEPTOR (recibeDeIds/origenId/bombaEnId presentes — piso intermedio de cadena ✓, asociado ✓, bomba ✓; fuente pura ✗); (2) 5bis PURGA libros huérfanos (montante sin origenId/bomba/recibe con ucAplicado no vacío) y persiste la limpieza. `RawBaj.bombaEnId` + `InheritPoolBajante.origenId/bombaEnId` tipados.
- Test nuevo: libro huérfano del fuente no envenena el grupo que baja (repro del dump: libro rancio sembrado → apply+corrida → libro del asociado FRESCO y huérfano purgado). `propagarAparatosPresion.test.ts` convertido: la carga del montante fuente vive en su CLAVE DE DISCO (no en ucAplicado legado).
- Gates: tsc 0 · vitest 1159/1159 (191) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 50: la herencia de montantes bajaba VACÍA con la carga en los ramales)
- **"No está funcionando así" (asociar montantes → los aparatos no llegan al piso inferior)**: `collectSourceAgg` excluía como "espejo de salida" todo ramal con la COLA sobre el elemento (doctrina de bajantes sanitarios) — para montantes de presión cuyos ramales nacen EN él (dibujados montante→aparato, sin listas), eso vaciaba el grupo y el apply omitía la herencia EN SILENCIO (con srcRaw presente no hay alerta). El panel sí los suma (`agregadoBajante`: "se suman, jamás se excluyen") → arriba 4.5, abajo 0.
- FIX: `collectSourceAgg` suma ahora los ramales SERVIDOS del montante (alimentaIds + cola geométrica tol 2) restando a cada uno su libro `aparatos_heredados_v1` (la carga del propio montante que upMonte le entrega — sin la resta se contaría dos veces junto a su clave propia). Si un ramal servido no tiene libro → mezcla con MÁXIMO por aparato (conservador, nunca infla). Un solo fix: apply + espejos (piso superior e inferior) + `aggBajanteAsociado` heredan; las asociaciones VIEJAS se autocuran en el próximo pase de espejos (recargar basta, no re-asociar).
- Tests: `assocMontanteAparatos` +2 (ramal servido sin listas hereda en las 3 piezas — LD, fantasma, libro; lo propio del ramal se descuenta del heredado de upMonte — ni doble ni falta).
- Gates: tsc 0 · vitest 1161/1161 (191) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 50bis: LDesvio af/ac lee el grupo VIVO, no la clave espejo)
- **"literal es copiar la lógica de bajantes a montantes"**: divergencia de VISTA restante — el LDesvio san/ll resolvía el grupo en vivo (`aggBajanteAsociado` por el `origenId` del bajante local) mientras el LDesvio af/ac dependía de su clave espejo (`af_LD_X_plan`), que puede estar rancia o vacía → panel del LD en 0 con el montante lleno. FIX: la rama `LD_` de `currentMapDe` ya no filtra por red — mismo resolutor único para todas; la clave espejo queda como fallback (si no hay bajante local con `origenId`). La selección del XFG usa `selectedGhostId` y no llega al panel (igual que en bajantes — no es divergencia).
- Test nuevo: `components/fixtures/__tests__/useFixtureTarget.test.ts` (LD af devuelve el grupo del libro con la clave espejo vacía; montante destino af igual). Primer test directo de `currentMapDe`.
- Gates: tsc 0 · vitest 1163/1163 · lint 0 · build ✓ · graphify ✓. Pendiente: dump `__cfDiag` del usuario para cerrar (si persiste, el eslabón muerto está en su sesión, no en los caminos cubiertos por tests).

## Session Summary — 2026-10-19 (ronda 51: junk de la era vieja fuera de la herencia · visor en su escala · tsbuildinfo)
- **REPRO capturas cerrado (MAC1-P1 = 15.5 en vez de 4.5)**: el 15.5 = 4.5 real + ~11 UC rancias (`{duc:2,lvro:2,lvm:4,lvp:1,tin:4}`) que viven en los ramales listados en `alimentaIds` del MAC1-P2 (era en que los aparatos se asignaban a ramales; conservan `aparatoInicio/Fin` + conteo — el propagador JAMÁS limpia el campo, verificado). El panel del superior los excluye (`agregadoBajante`), pero el servi de la ronda 50 los sumaba al grupo → la herencia bajó con junk. FIX: `servi` = SOLO ramales con cola geométrica sobre el montante NO listados en `alimentaIds` (los listados son entregas espejadas) + la resta de lo propio completa con AMBOS libros (`aparatos_heredados_v1` + `aparatos_heredados_trib_v1` — propio = disco − her − herTrib). Grupo = exactamente el panel del superior. Test REPRO en `assocMontanteAparatos` (LD/fantasma/libro = 4.5 sin junk). La cura del libro rancio de abajo ya existe (ClavePropia 3er test).
- **Visor: fondo y dibujo en escalas distintas (34%) — F1+F2 (elegido por el usuario)**: el primer render rasterizaba la lámina con el default 0.5 mientras el loader (DENTRO del mismo renderPage) pone `engine.scaleM = docScale (0.669)`; el re-raster que disparaba el cambio de escala lo descartaba el guard `renderingRef` → lámina a 0.5 toda la sesión. F1: `utils/planScale.ts` `escalaDeDoc(planId)` — el primer render rasteriza con la escala del doc (`PdfViewerEngineInit`, reader.onload). F2: `filaRender` + `renderPendingRef` — el re-raster pedido en vuelo se ENCOLA (última gana) y corre al cerrar el actual vía `renderPageRef` (sin autorreferencia: el react-compiler no preserva la memoización de un useCallback que se llama a sí mismo). F3: `__cfCam()` en consola — escalaDoc vs escalaRender, pageW base/esperado/dibujado, zoom/offX/offY. Tests: `utils/__tests__/planScale.test.ts` (4). No se toca: re-base del loader (correcto), plans_meta/orígenes (limpios), fitPage, datos guardados.
- **`.gitignore` + `*.tsbuildinfo`** y archivo borrado (caché incremental del TS server/tsc -b, 45 KB, se regenera sola; Vite no la lee).
- Gates: tsc 0 · vitest 1168/1168 (193) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 52: el rancio viajaba por el LIBRO del superior · visor sin salto)
- **"siguen triplicándose" + dato clave del usuario: al montante inferior NO entra ninguna ramal — el junk viaja puro por el libro.** Mecanismo cerrado: la cura (block-2/apply) reescribe el libro del piso de ABAJO, pero el libro rancio del STORAGE del piso SUPERIOR nadie lo re-escribe nunca (5bis salta a los asociados por diseño) y `collectSourceAgg` lo mezclaba con máximo en cada pase → el grupo re-inyectaba el junk (panel superior 4.5 ✓, abajo 15.5 ✗). FIX: `collectSourceAgg` — la entrada anidada de 5bis (`ucAplicado[clavePropia]`) se mezcla siempre; el libro ramal-claveado SOLO cuando el árbol está VACÍO (passthrough sin ramales — la cadena 3→2→1 depende de él, test `assocMontanteCadena` verde). Con árbol presente, el libro rancio queda silenciado para siempre. Test REPRO: libro rancio en storage+motor del superior → LD/libro/ucAcum = 4.5.
- **Visor UX (salto al acomodarse)**: el motor arrancaba con `scaleM` default y los elementos se pintaban en el espacio equivocado hasta que el loader del PDF ponía la del doc. FIX: el load local sincrónico del init fija `eng.scaleM = escalaDeDoc(id)` ANTES del primer `render()` — los elementos nacen en su espacio real (el loader confirma la misma escala al terminar).
- Gates: tsc 0 · vitest 1169/1169 (193) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 53: el panel leía el libro de la PROYECCIÓN, no del real — dump del usuario)
- **Dump `__cfDiag('ac')` decisivo**: `engine.bajantes` del piso abierto contenía DOS montantes con el MISMO id `MAC1_ac` — el real (pisoBase 'Piso 1', libro CORRECTO 4.5 con `recibeDeIds: ["RAC6"]`) y la proyección del piso de arriba que atraviesa la altura (`getBajantesFantasma` es un FILTRO sobre el mismo array, no copias; el libro rancio {lvp:2,lvm:5,tin:5,duc:3,lvro:3} vivía ahí). `currentMapDe` hacía `bajantes.find(id)` plano → devolvía la PROYECCIÓN → el panel mostraba el libro rancio aunque el grupo ya estuviera curado en el motor real (por eso las 3 rondas de fixes del grupo no se veían). FIX: la resolución de `liveBaj` (y los `find` de `applyBajanteAssociation`: liveBaj/liveTgtBaj/liveLower/lowBaj vía `bajanteLocalDe`) prefiere el bajante cuyo `pisoBase` === nivelActual.label; fallback al primero (datos viejos sin pisoBase). Test REPRO en `useFixtureTarget.test.ts` (proyección primero con libro rancio → panel = grupo del real).
- Datos del dump: el storage del inferior seguía con el libro rancio (`libroStorage` LD-keyed 15.5) — block-2 lo reescribe con el grupo fresco en su próximo pase; `grupoDelSuperior` = 15.5 confirmaba que el cálculo aún tomaba el rancio (ronda 52 tree-wins + este fix lo cierran; si el superior resulta ser passthrough con árbol vacío, abrir el piso 2 y re-dump para ver sus ramales/claves).
- Gates: tsc 0 · vitest 1170/1170 (193) · lint 0 · build ✓ · graphify ✓.

## Session Summary - 2026-10-19 (ronda 54: la carga que el montante ENTREGA se contaba DOS veces + el salto del lienzo)
- **"se triplican" - raiz: el cierre de `recibeDeIds` sumaba la clave COMPLETA del ramal servido.** El ramal que el montante ALIMENTA ya lleva la carga del montante en su disco (upMonte la entrega, fase 3b) y en el libro `aparatos_heredados_v1`; al sumar esa clave entera, la carga del montante se contaba otra vez (3 UC propias + 3 UC del ramal = 6, con 3 ramales = 12). FIX (regla hidraulica, dos sitios): lo que el montante ALIMENTA no le trae nada -> esos ramales salen del CIERRE y aportan solo lo PROPIO (rama `servi`, que ya resta her+herTrib). Criterio de "servido" = el de la entrega 3b (mismos criterios): cola sobre el (+2 px) y cabeza fuera, `ini` = su codigo, o asociacion manual (`asocManual`, el checkbox escribe `recibeDeIds` sin direccion). Helper nuevo `idsServidosPorBajante` (`bajanteAssocShared.ts`): lo usan `upstreamRamalIdsForBajante` (excluye del cierre), la rama `servi` (los suma por lo propio) y el panel `agregadoBajante` (`FixturesPanel.tsx` - el panel y la herencia muestran la misma verdad). Solo presion (af/ac/gas): en san/ll la clave del ramal ES la carga que drena y no se resta nada. NO se resta el heredado del cierre (un ramal de aguas arriba con union conserva su heredado - test nuevo). Tests REPRO en `assocMontanteAparatos.test.ts` (4): grupo = 3 (no 6), lo propio del ramal suma una vez (4), idempotente x2, union conserva su her.
- **Visor: el "salto" era el LIENZO, no la escala.** El load local sincronico pinta el dibujo en un lienzo de 300x150 (default del canvas) dentro de un contenedor `inline-block` centrado: al llegar el PDF, el contenedor crecia a la medida de la lamina y se re-centraba -> el dibujo se movia de sitio (el "acomodarse"). FIX: se persiste el tamano de la lamina por plano (`planScale.ts` `guardarPaginaDeDoc`/`paginaDeDoc`, clave `civilflow_pagina_<id>`; la escribe el render del PDF cuando la escala ES la del doc) y el load sincronico dimensiona lienzo + contenedor con esa medida antes del primer paint (`PdfViewerEngineInit.ts`). Ademas el estado React se sincroniza con la escala del doc (`setScaleM`) para que `syncEngine` no pise el motor con el default '0.5'.
- **Escala: el piso SIN calibrar ya no se pisa con el set estandar.** El efecto de `PdfViewer.tsx` que forceaba `plano.scale/100` corria DESPUES del primer paint (y el autosave persistia esa escala con los pts de otro espacio -> "corridos"). Ahora solo pisa si el plano NO tiene doc en cache: con doc, la escala del doc manda.
- Gates: tsc 0 (los errores de `src/architecture/` son de la sesion paralela) - vitest 1202/1203 (el unico fallo es de la sesion paralela: `sanAccesoriosTable/*` aun sin crear) - lint 0 - build V - graphify V.

## Session Summary - 2026-10-19 (ronda 55: PF sin recorte ni salto + direccion unica de la entrega + "Ramal asociado" real)
- **PF (recorte) - CAUSA: el lienzo de DIBUJO media la HOJA y el trazo se dibujaba ZOOMADO dentro.** Con zoom > 1 el fondo se sale de la hoja (lo recorta el contenedor) pero el lienzo cortaba el trazo en el borde de la hoja -> un "recuadro" que partia la geometria (laterales y superiores recortados). FIX: `PlanoEngine.ensureCanvasSize()` + helper puro `planoCamera.tamanoLienzoDibujo()` - el lienzo cubre el AREA VISIBLE y la hoja x zoom: el trazo se recorta JUSTO donde se recorta el fondo.
- **PF (salto) - CAUSA: el primer paint occurria con el lienzo provisional (300x150) y el contenedor re-centraba al llegar el PDF.** FIX: (a) se persiste el tamano de la LAMINA a escala 1 por plano (`planScale.guardarPaginaDeDoc`/`paginaDeDoc(planId, escala)`) y el load sincronico dimensiona lienzo + contenedor con la medida final ANTES de pintar; (b) si la lamina no se conoce, NO se pinta nada (el motor no dibuja sin `pageW/pageH`): nada provisional, el doc aparece con el PDF en su sitio; (c) el estado React se sincroniza con la escala del doc (`setScaleM`) y el efecto que forceaba `plano.scale/100` ya solo pisa planos SIN doc en cache.
- **Direccion de la entrega (causa raiz del "triplicado" y de los aparatos mal recogidos):** la entrega (fase 3b) y el cierre de la herencia usaban criterios DISTINTOS, y la asociacion manual (checkbox) saltaba el veto de direccion: un ramal que ENTRA al montante (aguas arriba) recibia la carga del montante -> ciclo (el montante se alimentaba de si mismo) y los conteos se multiplicaban en cada corrida. FIX: una sola fuente `bajanteEntregaSuCargaAlRamal` (`aparatosPresion/conteo.ts`) - entra por la cabeza (o `fin` = su codigo) NUNCA recibe; sale por la cola (o `ini` = su codigo, o `alimentaIds`) si; `asocManual` solo si no entra por la cabeza. La usan la entrega (`upMonte.ts`), el cierre (`upstreamRamalIdsForBajante`), la rama `servi` (los servidos aportan solo lo PROPIO) y el panel (`agregadoBajante`): lo que el montante alimenta no le trae nada -> su carga ya va en su disco y sumarla la contaba dos veces (3 + 3 = 6). san/ll intactos (alli la clave del ramal ES la carga que drena).
- **"Ramal asociado" del desvio en L (LD) - CAUSA: el LD se creaba sin registrar la asociacion.** El estado no existia (no era visual, era AUSENTE) -> el checkbox salia desmarcado en el panel y en el menu. FIX: `registrarLdesvioComoAsociado` (bajanteAssocShared) - el LD llega al elemento destino: se anade a su `recibeDeIds` + `asocManual` (no se poda por geometria) y su `fin` = el codigo del elemento; se llama en el apply entre pisos, en las dos pasadas de la migracion de layout y en el desvio de bomba. Al desasociar, `desasociarLdesvioDeBajante` lo saca de las listas (si no, los espejos le escribian la carga y quedaba una clave fantasma de UDs). Panel: "Ramales asociados" ahora tambien en presion (af/ac/gas) y nueva seccion "Montantes asociados" en el ramal - ambos leen el motor VIVO y escriben con `camposAsocManual` (mismo estado que el menu contextual).
- **Tests:** `planoCamera.test.ts` (4 - el lienzo cubre la vista), `ldesvioAsociado.test.ts` (3 - el LD queda asociado en bajante y montante, y muere con el enlace), `assocMontanteAparatos.test.ts` (+3 - montante creado en el extremo de un ramal: nace enlazado, el aparato NO se multiplica y el grupo lo recoge una vez). Suite completa: 1222/1222.
- Gates: tsc 0 (los errores de `workareaContent/use*Tables.ts` son de la sesion paralela) - vitest 1222/1222 (200 archivos) - lint 0 - build V - graphify V.

## Session Summary — 2026-10-19 (ronda 54: informe visor+propagación · re-fit de cámara · E2E integral)
- **Sesión paralela activa** trabajando visor: añadió `paginaDeDoc`/`guardarPaginaDeDoc` (tamaño de lámina persistido en `pagina_<id>`) + pre-dimensionamiento del canvas en el init local. Yo revertí mi variante (pageW/pageH en PlanoWorkData — duplicaba la verdad) y añadí lo que faltaba: **RE-FIT de cámara pre-paint** cuando `escalaDoc !== scaleRef.current` (la cámara guardada fue calibrada bajo la rasterización vieja a 0.5; con la lámina real más grande los bordes caían fuera del viewport y el overflow del contenedor RECORTABA laterales/superior — el "recuadro"). Mismo cálculo que "Ajustar" (solo zoom/offX/offY), síncrono antes del primer render → sin salto. Cerré también un tsc roto de la paralela (prop `f2` sin consumidor en useInfTables — hooks usan su propia f2 de tablasHelpers).
- **Causas raíz del visor (ambas)**: (1) SALTO = primer paint local sobre drawCanvas sin dimensionar (default 300×150) → elementos desplazados hasta que renderPage dimensionaba; (2) RECUADRO = lámina rasterizada ahora a su escala real (34% mayor) + cámara guardada calibrada para la lámina chica → clip por overflow. Fixes: tamaño persistido dimensiona canvas antes del paint + re-fit una sola vez al detectar cambio de escala de rasterización.
- **E2E integral de propagación** (`assocMontanteE2E.test.ts`): seed con TODO el rancio real (clave propia 4.5 arriba, ramales con junk + alimentaIds, libros rancios en storage de AMBOS pisos, proyección fantasma del superior con mismo id y libro rancio en el motor del inferior) → correrEspejos + propagación ×2 → panel del asociado, clave del LD y libro del motor = GRUPO REAL exacto. Verde al primer intento — valida los criterios 1-3 de la spec de propagación.
- Gates: tsc 0 · vitest 1223/1223 (201) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 55: dump v54 — el rancio vive en los DISCOS de los ramales del superior)
- **grupoDetalle cerró el caso**: `ownValor: null` (clave propia del montante superior VACÍA) + `cierreRamales: [RAC6..RAC1]` con `agg` = rancio y `libro: null` — el grupo suma hoy las claves de disco de los RAMALES del piso superior (mismos ids RAC1-RAC6 que abajo), y esas claves arrastran los totales inflados de eras viejas COMO ASIGNACIONES con campo aparato. La propagación es fiel: lleva abajo exactamente lo que los paneles de arriba suman.
- Se intentó restar libros (heredados+trib) en el cierre — REVERTIDO: el test de la sesión paralela ("un ramal de aguas arriba conserva su heredado (unión)") probó que el libro de un ramal ENTRANTE es carga de uniones legítima. La resta de entrega del montante queda SOLO en la rama servi.
- **Cierre del caso (gesto del usuario, 1 vez)**: abrir Piso 2 → paneles de RAC1-RAC6 de ese piso → muestran los conteos inflados → bajarlos a 0 (el campo se limpia solo en 0). Desde entonces: agregado arriba = 4.5 → grupo = 4.5 → block-2 reescribe el libro de abajo → panel 4.5 → LD resincronizado. La cadena queda limpia y auto-mantenida (los arreglos de las rondas 50-53 impiden que el rancio vuelva a inyectarse).
- Gates: tsc 0 · vitest 1225/1225 (202) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 56: el spinner cubre hasta el primer paint completo)
- **"se sigue viendo un tirón y desplazados los elementos y después se acomodan"** — el usuario autorizó pantalla de carga ("poner un tiempo más de carga"). Tres fugas del estado provisional a la vista: (1) el overlay tardaba en aparecer (se levantaba en reader.onload, async — el pre-paint local del motor alcanzaba a verse un instante); (2) el overlay era 80% transparente (los elementos desplazados se adivinaban detrás); (3) se ocultaba ANTES del primer render completo (setLoading(false) antes de renderPage — durante la rasterización se veía el lienzo provisional).
- FIX: setLoading(true) en el cuerpo del efecto currentFile (mismo ciclo de montaje → el overlay gana el primer paint del navegador); overlay OPACO (#111317); setLoading(false) DESPUÉS del primer renderPage completo (lámina a escala del doc + trazos + cámara ya en sitio). Cero retrasos artificiales: solo se oculta lo provisional bajo el spinner hasta que la primera representación es la definitiva.
- Gates: tsc 0 · vitest 1225/1225 · lint 0 · build ✓.

## Session Summary — 2026-10-19 (ronda 56bis: la pantalla de carga era una cajita — capa propia a área completa)
- **"quitaste la pantalla de carga del visor"**: el overlay S1 vivía DENTRO de containerRef (inline-block del tamaño del canvas) — en un piso sin `pagina_<id>` guardado el lienzo entra en 300×150 y el overlay era una caja chica centrada: el estado provisional se veía ALREDEDOR y la "pantalla de carga" no existía visualmente. FIX: el overlay pasa a capa PROPIA del área completa del visor (hijo directo del contenedor raíz, opaca, z-30 sobre los canvas), con la condición ampliada (!error). El spinner cubre ahora todo mientras dura el primer paint completo.
- Gates: tsc 0 · vitest 1225/1225 · lint 0 · build ✓.

## Session Summary — 2026-10-19 (ronda 57: dos sistemas de carga desconectados — overlay de página + primer paint del visor)
- **"se ve muy poco la pantalla de carga... se ve como cargan los elementos (pdf, redes)"**: DOS sistemas sin conectar — el overlay de página completa de ViewerPage ("Cargando planos y redes…", gate `isDrawingLoading = !listo || pdfPendiente || switchPendiente || switching`) moría antes del primer paint del visor, y el `loading` interno del visor (mi overlay de canvas) era otro estado paralelo. FIX: PdfViewer expone `onLoadingChange(loading)` (efecto sobre su estado, ref para identidad estable) y ViewerPage lo suma al gate (`|| visorLoading`) — el overlay de página vive hasta que lámina+trazos+cámara están en sitio. De paso: re-parada de mojibake en ViewerPage (perl en Windows corrompió UTF-8 — reparado con node, 0 U+FFFD; lección: editar comentarios con acentos vía perl/sed en este repo = usar node).
- Gates: tsc 0 · vitest 1225/1225 · lint 0 · build ✓.

## Session Summary — 2026-10-19 (ronda 58: el grupo del montante = LITERALMENTE el walk de su panel)
- **"arriba 4.5, abajo 14.5"** (post-limpieza parcial del usuario): el cierre geométrico seguía recogiendo ramales del superior con discos inflados que el PANEL no suma (el panel hace walk PLANO sobre recibeDeIds, sin cierre ni geometría — verificado en agregadoBajante). FIX definitivo: `collectSourceAgg` para montante de presión = RÉPLICA EXACTA del walk del panel — clave propia + recibeDeIds en plano (sin cierre geométrico) + servi con resta de entrega (disco − heredados − trib) + entrada 5bis propia + passthrough por libro solo si todo lo demás está vacío (cadenas — test assocMontanteCadena verde). El montante creado en extremo de ramal nace con recibeDeIds poblado (handleMontanteDown) → el walk plano lo ve sin geometría (tests de la sesión paralela verdes).
- Con la limpieza del usuario (ramales del piso 2 a 0 + aparatos en el montante superior): grupo = clave propia = 4.5 exacto — nada geométrico que re-inyecte el junk.
- Gates: tsc 0 (mis archivos; Acometida.tsx en vuelo de la sesión paralela) · vitest 1225/1225 · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-19 (ronda 59: el reacomodo era el CENTRADO flex del contenedor)
- **"se sigue viendo el reacomodamiento — otro enfoque"**: el vector que ningún overlay tapa era GEOMÉTRICO: `cw` centraba el contenedor con flex (`justifyContent: center`) → cada cambio de tamaño del canvas (default 300×150 → tamaño real → re-rasters) RE-CENTRABA la caja y el plano entero se desplazaba en pantalla con la cámara quieta. FIX: anclado arriba-izquierda (justifyContent/alignItems: flex-start) — el origen del canvas es estable, cualquier cambio de tamaño crece hacia abajo-derecha sin mover un solo elemento; el encuadre lo maneja solo la cámara (offX/offY en espacio canvas). Asentamiento bajo el overlay 350 → 600 ms.
- Gates: tsc 0 (propios) · vitest 1230/1230 · build ✓.

## Session Summary — 2026-10-19 (ronda 60: el passthrough mezclaba el libro de una FUENTE no-eslabón)
- **15.5 de nuevo (oscilaba con las acciones del usuario)**: el último agujero era la rama passthrough de `collectSourceAgg` — con árbol vacío mezclaba el libro del superior AUNQUE el superior no fuera eslabón. El dump v54 lo dejado visto: el superior es FUENTE (sin origenId/bomba, listas y clave propia vacías) con un libro ramal-claveado RESIDUAL de una asociación antigua con roles invertidos (entrada con la clave del LD del piso de abajo).
- FIX doble: (1) `collectSourceAgg` — el passthrough por libro exige ESLABÓN (origenId/bombaEnId); una fuente con árbol vacío NO aporta libro (grupo vacío = no hay carga). (2) 5bis (ahora `aparatosPresion/montantes.ts` tras el split de la sesión paralela) purga el libro ramal-claveado de cualquier montante sin origenId/bomba — conservando la entrada anidada de su clave propia — en memoria + storage (persistencia fina, no borra la entrada legítima).
- (3) block-2 (espejos desde abajo): grupo vacío CON storage del superior presente = verdad → limpia el libro del asociado (el guard antiguo solo protegía "storage ausente"; un libro rancio en el piso de abajo sobrevivía para siempre).
- Tests: `assocMontanteFuenteRancio.test.ts` (3: sin mezcla para fuente; asociado sin rancio tras espejos; purga en memoria — la persistencia storage va por autosave, fuera de alcance del harness). Suites de montantes 34/34 + full 1225+. NOTA: el marcador del diag subió a v58.
- Gates: tsc 0 (propios) · lint 0 · build ✓ · graphify ✓.

## Session Summary — 2026-10-20 (ronda 61: bloque 1 + bloque 2 de la desmonotilización)
- **FixturesPanel (bloque 1) cerrado**: extraídos `itemsDelPanel.ts` (lista de aparatos con Map por id) y `mergeKeys.ts` (143 líneas puras: Maps porId/codigosDeBajante/idsDeBajante) → panel 1054 → 905 líneas. Test nuevo `components/fixtures/__tests__/panelCalculos.test.ts` (6). OJO: el campo del override de red en el catálogo es `ucaf` (no `uc_af`) — el override se aplica con la clave del APS_FIELD.
- **PdfViewer (bloque 2) cerrado**: extraídos `pdfViewer/usePlanoLoadSwitch.ts` (127), `pdfViewer/ViewerMobileChrome.tsx` (113) y `pdfViewer/useViewerResponsive.ts` (22) → PdfViewer 1744 → 1493 líneas. Test `pdfViewer/__tests__/viewerChrome.test.tsx` (4, jsdom + harness propio).
- **Incidente recuperó el PdfViewer**: un script de extracción por número de línea (y luego por emparejamiento de llaves) dejó el archivo mutilado — se perdió el bloque del hook y 4 edits de las rondas 51-57. RECUPERACIÓN: `git checkout HEAD -- PdfViewer.tsx` + re-aplicar los edits a mano (escalaGlobalRef con `leerPlansMeta()`, calibrado con `planCalibrado()`, handleFit con `encuadrarDibujo`+bboxDelDibujo, prop `onLoadingChange` + su efecto). LECCIÓN: partir un monolito con scripts de slicing es una trampa — usar el Edit tool con lectura previa, bloque a bloque, con `tsc` entre pasos.
- **Gates**: tsc 0 · lint 0 · vitest 1274/1274 (216 archivos) · build ✓ · graphify ✓. Techos G1 actualizados: PdfViewer 1493, FixturesPanel 905.
- **Pendiente**: `GasDesign` (comparar `checkRows` vs `utils/gasRows.ts::computeGasRows` con fixture antes de unificar), `DownpipesTable`, `PlanosTab`, `PlanoConfigurator`, C2 (motor), C3 (tablas/memoria), G8 (guard de complejidad con los 52 focos).

## Session Summary — 2026-10-20 (ronda 62: bloques 3 y 4 — GasDesign y DownpipesTable)
- **GasDesign (bloque 3) cerrado**: 1159 → 377 líneas. Extraídos `gas/GasDatosGenerales.tsx` (página 1), `gas/GasTablaRed.tsx` (tabla de la red) y `gas/GasContadores.tsx` (contadores/calentadores). Núcleo de cálculo compartido en `utils/gasCalcRows.ts` (`calculaFilasGas`) — la cuenta estaba DUPLICADA entre `checkRows` (pantalla, con datos vivos) y `computeGasRows` (gasRows.ts, con storage): ahora es una sola, con las entradas por parámetro. Test `utils/__tests__/gasCalcRows.test.ts` (8). Además `patmDeAltitud` a `utils/gasUtils.ts` (+4 tests en gasUtils.test.ts). El render dejó de hacer `.find` por fila (→ Índice Map por clave).
- **DownpipesTable (bloque 4)**: 1144 → 1001 líneas. La fila entera se calculaba DENTRO del JSX (200 líneas con `tramosSan.find` por fila = O(n²)): extraída a `utils/bajanteRowModel.ts` (`calculaFilaBajante`, pura, con índices Map). Test `utils/__tests__/bajanteRowModel.test.ts` (7).
- **Gates**: tsc 0 · lint 0 · vitest 1292/1292 (217 archivos) · build ✓ · graphify ✓. Techos G1: GasDesign 380, DownpipesTable 1001.
- **Pendiente**: `PlanosTab` (1208), `PlanoConfigurator` (1081), C2 (motor), C3 (tablas/memoria), G8 (guard de complejidad con los 52 focos), WorkAreaCivilManagerPage (loader propio), SEO completo.

## Session Summary — 2026-10-20 (ronda 64: la asociación montante↔ramal y los elementos por piso NO se guardaban)
- **Causa raíz 1 (asociación)**: el enlace manual entre un montante/bajante y sus RAMALES vivía en `asocManual` + en los ids de RAMAL dentro de `recibeDeIds`/`alimentaIds`. El RPC `save_plano_data` sólo reconstruye `cf_bajante_conexiones` (BAJANTE→BAJANTE, resuelto con `join _baj_map m2 on m2.client_id = x.destino`) y NO tenía columna para `asocManual` → el id de ramal no matchea el mapa y el enlace se descartaba en silencio; `asocManual` no existía en la tabla. Al recargar, el montante volvía sin ramales → agregado 0 → "no aparecen los aparatos" y había que re-asociar a mano (también pasaba con el Ldesvio entre pisos: su id es de ramal).
- **Causa raíz 2 (elementos perdidos)**: (a) el cambio de piso guardaba SÓLO en la caché local (`saveToStorage`) y cancelaba el autosave pendiente (el único que subía a BD) → lo último dibujado en ese piso nunca llegaba a la BD; (b) los escritores que modificaban un doc SIN estampar ts fresco (writePlanDoc rama "plano abierto", bajanteAssociationApply/Clear, bombaDesvio/Herencia, fixtureMirrors) dejaban la caché local PARECIDA más vieja que la BD → el árbitro (mayor ts gana) dejaba ganar a la BD y pisaba la caché local → los elementos que sólo existían en local se perdían; (c) `mergeBajanteDedup` no incluía `asocManual` (un bajante duplicado perdía la asociación al guardar); (d) el cambio de piso usaba `saveToStorage` → se perdía la marca `assocLayout` → la migración de asociaciones volvía a correr en la siguiente carga.
- **Fix**: migración `20261020000000_cf_planos_bajantes_asoc_links.sql` (columna jsonb `asoc_links` = {recibe,alimenta,manual} en `cf_planos_bajantes` + parche quirúrgico del cuerpo VIVO del RPC) + `planoRowMappers` (manda/lee `asoc_links`) + `trazosDb` (restaura los enlaces al cargar, unión sin repetir con `bajante_conexiones`) + `mergeBajanteDedup` incluye `asocManual` + ts fresco en los escritores + el cambio de piso usa `persistTrazosSnapshot` (caché + BD, conserva `assocLayout` y el blindaje anti-borrado de LD_/anillo).
- **Tests**: `services/__tests__/persistenciaPlanos.test.ts` (8) — A) asociar montante↔ramal, cerrar y reabrir: la asociación vuelve; B) dos pisos: cada uno recupera lo suyo; C) modificar un piso no toca el vecino; D) el cambio de piso deja ts fresco y sube a BD; E) el guardado se completa antes de darlo por persistido. El simulador de BD replica la semántica real del RPC (conexiones sólo bajante→bajante).
- **Gates**: tsc con 1 error AJENO (sesión paralela): `src/pages/LandingPage.tsx(173,65) TS7017` — no tocado · lint 0 · vitest 1306/1306 + 1 skip (220 archivos) · build ✓ (prerender 13/13) · graphify ✓ (8569 nodos).
- **PENDIENTE (usuario)**: aplicar `supabase/migrations/20261020000000_cf_planos_bajantes_asoc_links.sql` en el SQL Editor — sin la columna, la asociación sigue sin persistir (el cliente no rompe: la clave se ignora). NOTA: la 1ª versión del parcheaba el RPC con LITERALES fijos y abortó (`save_plano_body_divergio`: el cuerpo vivo ya traía `angulo, canal_flow_dir`); la versión final parchea POSICIONALMENTE (strpos/substr sobre el cuerpo vivo) → immune a las columnas que agregue cada migración, y valida el cuerpo compilando una copia `__check` antes de tocar la real (si el cuerpo quedara mal, aborta sin dejar el RPC roto).

## Session Summary — 2026-10-20 (ronda 63: nombres de archivo en inglés + ronda JSDoc)
- **Renombres (21)**: solo el NOMBRE del archivo; identificadores, componentes, comentarios y textos de UI siguen en español. Glosario de exención respetado (ramal, bajante, montante, aparato, piso, npt, af/ac/san/ll/gas, ldesvio, plano…): `agregadoBajante`→`bajanteAggregate`, `itemsDelPanel`→`panelItems`, `montanteAgregado`→`montanteAggregate`, `panelCalculos`→`panelCalculations`, `GasContadores`→`GasMeters`, `GasDatosGenerales`→`GasGeneralData`, `GasTablaRed`→`GasNetworkTable`, `PanelCalibracion`→`CalibrationPanel`, `calibracionOverlay`→`calibrationOverlay`, `ListaCargados`→`LoadedPlansList`, `ListaPendientes`→`PendingPlansList`, `ModalesPlanos`→`PlanModals`, `tablasPorRed`→`tablesByNetwork`, `bboxDelDibujo`→`drawingBBox`, `etiquetaFantasma`→`ghostLabel`, `planoCameraEncuadre`→`planoCameraFraming`, `escribirDocDePlan`→`writePlanDoc`, `ldesvioAsociado`→`ldesvioAssociated`, `upMonte`→`upMontante`. Imports actualizados en 14 archivos; grep de rutas viejas limpio (solo queda el `describe('itemsDelPanel')`, que es contenido).
- **Ronda JSDoc (13 de producción + 8 tests)**: cabeceras a 1-3 líneas con QUÉ + POR QUÉ + ejemplo; siglas expandidas (UD, UC, Renouard, Ldesvio, Le/ΔP); JSDoc obvio borrado (flags del overlay, `saved`/`hasSaved`, `selectedPlanId`); `@param/@returns` solo en utils puras (`drawingBBox`, `panelItems`); acentos `\u00XX` normalizados a UTF-8. CERO cambios de lógica.
- **Gates**: tsc con 1 error AJENO (sesión paralela): `src/pages/LandingPage.tsx(173,65) TS7017` (`globalThis.__CIVILCARDEX_PRERENDER__` sin index signature) — no tocado · lint 0 · vitest 1298/1298 + 1 skip (219 archivos) · build ✓ (prerender 13/13) · graphify ✓ (8557 nodos). Dev server (vite :5173) detenido.
- **Pendiente**: `PlanosTab` (1208), `PlanoConfigurator` (1081), C2 (motor), C3 (tablas/memoria), G8 (guard de complejidad con los 52 focos), WorkAreaCivilManagerPage (loader propio), SEO completo.

## Session Summary — 2026-10-20 (auditoría árbol completo: 5 exploradores, 3 críticos arreglados)
Auditoría del árbol COMPLETO (140 archivos sin commitear — incluida la ola paralela: split `propagation/`, splits PdfCanvas/planoCamera/PlanosTab, `architecture.test.ts` guardias G1-G5, harness `src/test/`). Verificado limpio: extracciones fieles (propagation edges/dfs/books/tributaries, accessoriesTable 1219L, bajanteRowModel, gasCalcRows, rainChannelCalc), sin imports muertos, sin props huérfanas, guardias 7/7.

### CRÍTICOS arreglados
- **C-1 Visor bloqueado sin planos**: `visorLoading` no bajaba sin `currentFile` → overlay z-9999 permanente en proyectos vacíos. Fix: `PdfViewerEngineInit` hace `setLoading(false)` cuando no hay archivo.
- **C-2 `_renumberMontantes` cross-floor**: migración de claves UD sin `isPlanKeyFor` movía claves de TODOS los pisos (robo/corrupción entre pisos). Fix: filtro `isPlanKeyFor(k, thisPlanId)` — mismo patrón de `_renumberRamales`.
- **C-3 regla 3b rewroteada** (split propagation perdió 2 semánticas de F-1): sin `recibeDeIds` como señal de ENTRA y `asocManual` perdiendo contra el veto. Fix con PRECEDENCIA que concilia F-1 con la doctrina del apply paralelo: (1) `fin` = código del montante (lo escribe el apply: sus UDs llegan por libro) → NUNCA recibe; (2) `asocManual` (checkbox, no escribe fin) → hereda siempre; (3) veto direccional con `recibeDeIds` contando como entra. 3 tests paralelos que pinneaban la doctrina nueva + los de F-1: todos verdes.

### ALTAS arregladas
- **A-1/A-2 prerender**: exit code honesto (fallos → build rojo, ya no exit(0) ciego); los 8 swaps de head asertados (template cambiado = fallo RUIDOSO, no 13 rutas con metas de home) + twitter:title/description por ruta (faltaban). Canonical regex tolera `id="canonical-link"` del template real (vivía en el <noscript> del head — por eso solo fallaban las 2 últimas rutas tras sobreescritura de la home).
- **A-3 robots.txt roto**: las 7 Disallow estaban huérfanas (sin grupo User-agent) → ningún crawler las aplicaba. Fix: dentro del grupo `*` + `/restablecer` agregado.
- **A-5 SecMontantes**: checkbox Ldesvio marcado → primer clic ASOCIABA (ya solo miraba listas). Fix: `ya` incluye `esLdesvioDeEsteMontante`. (La paralela aplicó el mismo fix en vivo — churn concurrente detectado y esquivado con rep tolerante.)
- **A-6 a11y**: reduced-motion vuelve a apagar `.civsilver`.
- **A-7 facades**: docstrings corregidos (propagation/ y accessoriesTable/); aparatosPresion.ts queda como fachada documental sin consumidores (0 importers verificados).

### Estado post-fix
- Verificación dist: 13/13 prerenderizadas ✓, canonical por ruta con `id="canonical-link"`, twitter por ruta, breadcrumb ×12, Cargando ausente, cero user-specific.
- `npm run check` ahora corre `npm run build` (con postbuild) — `vite build` suelto NO vuelve a dejar dist sin prerender.
- FixturesPanel: 1069 → 904L (mergeKeys directo, headerLbl plano).
- **Pendiente decisión de diseño**: S-5 /docs expone solo la categoría activa (1/13) — requiere reestructurar el layout una-categoría-activa. Pendientes usuario: S-4 closeValidation espejos por piso, commit/push (23+ archivos), Search Console.

### Nota de proceso (churn concurrente)
La sesión paralela siguió commiteando DURANTE esta auditoría (A-5 ya aplicado, mergeKeys ya rewirado a `calcularMergeKeys`, imports rewirados). Los scripts de fix usaron rep tolerante: skip si ya aplicado, error si CONFLICTO real. Un splice mío rompió FixturesPanel (mergeKeys/useFixtureTarget) — reparado leyendo el estado actual, no el esperado.
- Gates: tsc 0 · lint 0 · vitest **1306/1307** (220, 1 skip) · build + prerender 13/13 ✓ · graphify ✓.

## Session Summary — 2026-10-20 (fix: pérdida de trazos por write-back cross-floor stale)
- **Reporte usuario**: elementos dibujados (trazos, bajantes, montantes asociados) desaparecen al cerrar y reabrir el proyecto en otra pestaña; afecta sobre todo al piso inferior asociado a un montante superior; no en todos los pisos.
- **Mecanismo confirmado**: `correrEspejos` (ramal cross-floor) leía el doc COMPLETO del piso de abajo al inicio del pase, mutaba `ucAplicado/ucAcum`, y reescribía el doc COMPLETO + `saveTrazosToDB` con `ts=Date.now()`. Con el proyecto abierto en DOS pestañas (flujo reportado), el write-back del piso superior pisaba los ramales recién dibujados en el piso inferior cuyo autosave (1.5 s) aún no había corrido, y el ts fresco hacía GANAR el snapshot viejo en el árbitro de recarga. El propio código ya documentaba la mitad del bug ("reescribir el doc completo pisaba el autosave y borraba checkboxes") — el fix anterior solo movió el fantasma al motor; el write-back del doc quedaba.
- **Fix (quirúrgico)**: en `fixtureMirrors.ts`, el write-back re-lee el doc FRESCO del storage y aplica SOLO los campos del enlace (`ucAplicado/ucAplicadoHidro/ucAcum` del bajante destino). RAMALES y resto del doc SIEMPRE vienen del disco al momento de guardar — imposible pisar trazos con el snapshot. `bajanteAssociationApply.ts:541-555` ya usaba este patrón (verificado, sin cambio).
- **Nota para el usuario**: los elementos YA perdidos no se recuperan del storage (el upsert de BD pisa la versión previa) — re-dibujarlos. Si hay export/backup previo, restaurar de ahí.
- **Relacionado ya cubierto**: C-2 (`_renumberMontantes` sin filtro de piso movía claves UD cross-floor) arreglado antes en esta sesión — el combo C-2 + write-back stale explica la severidad reportada en montantes asociados.
- Gates: tsc 0 · lint 0 · vitest 1306/1307 (220) · build + prerender 13/13 ✓ · graphify ✓.

## Session Summary — 2026-10-20 (ponytail #15 aplicado: dedups del split propagation)
- **Borrados**: facades muertos `aparatosPresion.ts` (0 importers) y `sanAccesoriosTable.ts` (0 importers) — **RESTAURADOS después** como fachadas de una línea: los guardias G1/G2 de `architecture.test.ts` (sesión paralela) pinnean su existencia como puertas estables. Lección: leer los guardias de arquitectura ANTES de borrar puertas.
- **Dedups aplicados**: `distSeg/distAPadre` (tributaries importa de counting; ~17L), `libroHeredadoDe` (bajanteAssocShared importa de counting; ~6L), `despacharStorage` (una copia en books.ts, con guard `typeof window` para tests node; ~5L).
- **Quedó pendiente (deuda, no bug)**: adoptar `leerDocDePlan` en los 7 sitios crudos restantes (RainChannelsCheck, RainDownpipesCheck ×2, rainwaterRows ×2, waterRowsCore, sanConnectivity, useWaterNetworkGraph) — variantes de genérico/fallback por sitio, ~30-45 min.
- Gates: tsc 0 · lint 0 · vitest 1306/1307 (220) · build + prerender 13/13 ✓ · graphify ✓.

## Session Summary — 2026-10-20 (rondas 62-65: G8 + C3 + C2 + SEO)
- **G8 (guard de complejidad) NUEVO**: `src/architecture/complejidad.ts` cuenta "focos" = búsquedas
  lineales (find/findIndex/some/filter/indexOf/includes) DENTRO de bucles, parseando con el AST de
  TypeScript (no regex). Reglas del guard: (A) ningún archivo nuevo con ≥5 focos, (B) ninguno CRECE,
  (C) el total no sube, (D) si el código tiene menos que el baseline → hay que bajarlo (anti-congelación).
  Baseline congelado: 596 focos en 48 archivos. Regenerar con `npm run baseline:complejidad`.
  Excluye del conteo lo que NO escala: catálogos fijos (NETS, TEE_TYPES), los puntos de un trazo y las
  listas correlativas cortas (recibeDeIds).
- **C3 (tablas/memoria)**: `sanConnectivity` 21→6 · `buildBajanteGraph` 16→5 · `waterRowsCore` 39→5 ·
  `useWaterNetworkGraph` 45→6 · `rainwaterRows` 26→13 · `bajanteVentRows` 27→9 ·
  `buildTramos` 19→10 · `assocLayoutMigration` (I/O por elemento: `loadData` DENTRO del bucle → cache por plano)
  · `copyDrawingFromPlan` · `directionSelector` · `editorSections` · `fixtureMirrors`.
  Helpers nuevos: `utils/indices.ts` (indicePorId/indicePorClave/conjuntoDe) + `utils/indices.test.ts`.
- **C2 (motor)**: `lib/PlanoEngine/indicesMotor.ts` (indicesDeMotor: id→pieza de los 6 tipos; se construye
  POR OPERACIÓN, nunca cacheado — el motor reasigna sus arrays en ~20 sitios y un índice cacheado se pudre).
  `mouseDownHits` 18→3 · `handleDragMove` 10→2 · `ventDiameters` 10→2 · `renderBajantes` 15→10 ·
  `deleteSelected` (el .some por tribario era O(n²) por pasada del while) · `propagation/edges` 19→13.
- **SEO cerrado (2 huecos)**: (1) las 6 rutas de módulo NO tenían H1 (`<h2>` en los heroes) → ñ h1
  (13/13 rutas prerenderizadas con H1); (2) `usePageMeta` reescribía título/descripción a mano mientras
  ROUTE_META se declaraba "fuente única" sin que nadie la consumiera → `metaDeRuta(path)` + `ModuleConfig.ruta`.
  Test `seo/__tests__/routeMeta.test.ts` (7) + verificación de que las 13 rutas coinciden con ROUTE_META.
- **Cerrado sin tocar**: el loader del manager YA usaba `<CargandoProyecto />` (el "Abriendo proyecto…" que
  quedaba es etiqueta de tarjeta en `ProyectoCard.tsx`, no un loader).
- **Gates**: tsc 0 · lint 0 · vitest 1338/1338 (224 archivos) · build + prerender 13/13 · graphify ✓.
- **Pendiente**: focos que siguen en el baseline (los ≥5 restantes por archivo, sobre todo render y
  borrado del motor), WorkAreaCivilManagerPage (cerrado), y las acciones de usuario de SEO
  (Search Console + Bing Webmaster Tools).

## Session Summary — 2026-10-20 (rondas 61-66: recuperación + renombre a español)
- **INCIDENTE cerrado**: un `git checkout -- src/` (para deshacer un renombrado parcial) revirtió TODOS los
  cambios de las rondas 61-65 en archivos versionados. **Recuperados** desde la copia de rescate
  `C:\Users\ASUS\AppData\Local\Temp\opencode\prueba-rename` (tenía el estado completo con nombres ya
  traducidos). Verificado: 0 archivos de HEAD perdieron su API pública (comparación de símbolos
  exportados). LECCIÓN: commitear ANTES de los experimentos de renombrado.
- **Renombrado a español APLICADO y commiteado** (35861b6): 641 archivos renombrados (git los detecta
  como R) + 171 modificados + 10 nuevos. **Solo ARCHIVOS; las CARPETAS quedaron en inglés** (el usuario
  pidió archivos). Excepciones: glosario de siglas de AGENTS.md + convenciones de framework.
  Herramientas (temporales, borradas al final): `arreglarImports.mjs` (resuelve imports por índice de
  nombres, con casing real — en Windows `existsSync` es case-insensitive y miente), `repararCss.mjs`
  (el renombrador perdía la extensión: `tarjetas.css` → `tarjetasCss`), `actualizarRutasGuard.mjs`
  (tablas del guard de arquitectura), `recalcularMarcadoresTest.mjs` (campo `test:` de MODULOS_NUEVOS).
- **G8 (guard de complejidad)**: `src/architecture/complejidad.ts` (detector AST con el parser de
  TypeScript, NO regex) + `__tests__/complejidad.test.ts` (11) + guard con baseline congelado
  (`FOCOS_CONOCIDOS` + `TOTAL_FOCOS_BASE` = 596 focos / 48 archivos) + `scripts/generarBaselineComplejidad.mjs`
  (npm `baseline:complejidad`). Reglas: (A) sin archivo nuevo ≥5 focos, (B) ninguno CRECE,
  (C) el total no sube, (D) si el código quedó por debajo del baseline hay que bajarlo.
  Excluye del conteo: catálogos fijos, props por trazo (pts), listas correlativas cortas, filtros
  que reasignan.
- **C2 (motor)**: `lib/PlanoEngine/indicesMotor.ts` — índices por OPERACIÓN (nunca cacheados: el motor
  reasigna sus arrays en ~20 sitios y un índice cacheado se pudre). mouseDownHits 18→3,
  handleDragMove 10→2, ventDiameters 10→2, renderBajantes 15→10, deleteSelected (el .some por
  tributario era O(n²) por pasada del while), propagation/edges 19→13.
- **C3 (tablas/memoria)**: `utils/indices.ts` (indicePorId/indicePorClave/conjuntoDe). sanConnectivity
  21→6, waterRowsCore 39→5, useWaterNetworkGraph 45→6, rainwaterRows 26→13, bajanteVentRows 27→9,
  buildBajanteGraph 16→5, buildTramos 19→10, assocLayoutMigration (I/O por elemento → cache por plano),
  copyDrawingFromPlan, directionSelector, editorSections, fixtureMirrors.
- **Extracciones (bloques 1-6)**: `components/fixtures/{panelElementos,fusionClaves}` (FixturesPanel
  1054→905), `components/pdfViewer/{usePlanoCargaInterruptor,useViewerResponsivo,ViewerMovilCromo}`
  (PdfViewer 1744→1493), `components/gas/{GasGeneralDatos,GasRedTabla,GasContadores}` + `utils/gasCalculoFilas.ts`
  (GasDesign 1159→377; la cuenta duplicada checkRows/computeGasRows ahora es UNA con entradas por
  parámetro), `utils/bajanteFilaModelo.ts` (DownpipesTable 1144→1001; la fila ya no se calcula en el JSX),
  `workarea/planosTab/*` (PlanosTab 1208→710), `workarea/PlanoConfigurador.tsx` (1081→605).
  OJO: el campo del override de red en el catálogo es `ucaf` (NO `uc_af`).
- **SEO cerrado**: `seo/rutaMeta.ts` con `metaDeRuta(path)` como fuente única + `ModuleConfig.ruta`
  (`pages/moduloDatos.ts`) + los 6 heroes de módulo con `<h1>` (antes `<h2>`): **13/13 rutas
  prerenderizadas con H1**. Test `seo/__tests__/rutaMeta.test.ts` (7). El prerender se renombró a
  `seo/prerenderEntrada.tsx` (package.json `build` y `scripts/prerender.mjs` actualizados).
- **Fix del recorte del visor**: la lámina de fondo se re-rasterizaba al cambiar la escala pero el
  LIENZO de dibujo no se re-medía → el trazo se cortaba antes que la lámina. `PlanoEngine.watchContainerSize()`
  (ResizeObserver sobre el contenedor) + `PdfViewerMotorInicial.ts` lo arranca.
- **JSDoc**: cabecera de módulo en los 13 módulos nuevos (QUÉ + POR QUÉ + ejemplo, siglas expandidas).
  El estándar de AGENTS.md manda: 1-3 líneas, sin jerga, un ejemplo concreto.
- **Gates**: tsc 0 · lint 0 · vitest 1338/1338 (224 archivos, 1 skip) · build + prerender 13/13 ·
  graphify (7970 nodos, 18240 aristas) · commit 35861b6, working tree limpio.
- **Pendiente del usuario**: push del commit 35861b6 (641 renombres — revisar en el PR que no se
  rompió nada), + las acciones de SEO (Search Console + Bing Webmaster Tools).

## Session Summary — 2026-10-21 (auditoría de codebase completo + ejecución del plan)

Code review del codebase entero (44 hallazgos, 9 categorías) y ejecución de los bloques A-I. 9 commits: `74c48a8`..`36e46aa`. Informe completo en `C:\Users\ASUS\Downloads\code-review-civilcardex-2026-10-21.md`.

### Lo que estaba roto (3 CRÍTICO, la misma familia)
**Los ids de bajante/montante SOLO son únicos por piso** (`pisoBase`). El motor guarda el bajante real del piso abierto y la PROYECCIÓN del piso vecino con el MISMO id, y cuatro sitios trataban el id como global:
- `dedupPorId` (guardado) conservaba la ÚLTIMA copia → el autosave escribía la geometría del fantasma y `saveTrazosToDB` subía ese error a Supabase. Ahora `dedupPorClave` con clave `id|pisoBase`.
- `find` plano en `updateElementById`, `pushBajanteDiameterToRamales`, el panel (`bajanteAgregado`, `useAparatoObjetivo`) y `eliminaSelected` mutaban/leian/borraban la proyección. Ahora el resolvedor compartido `bajanteLocalDe` (utils/bajanteLocal.ts) que prefiere el piso abierto.
- `_renumberMontantes` no fusionaba la clave de UD si el destino ya existía (el montante nuevo conservaba su clave vieja y la del borrado quedaba huérfana).
- Dos criterios de numeración ('BAN9-P1' → 9 vs → 1) creaban ids duplicados. Ahora `numDeBajante` canónico.
- El sanador de herencia invertida borraba el libro PROPIO de un receptor legítimo (restaba el conteo del usuario y lo subía a la BD sin reversa). Ahora preserva la clave propia, deja copia de seguridad (`..._bak`) y usa `saveTrazosLocales` (conserva `assocLayout`).

### La cadena de pérdida silenciosa
- `devError` es no-op en PRODUCCIÓN → todo catch que solo lo llama traga el fallo. Ahora los servicios que guardan LANZAN y un helper (`guardaConReintento`) reintenta con backoff y avisa por un canal global (el proveedor de alertas de la raíz ya lo escucha; antes solo lo oía el visor, así que en el workarea un guardado fallido se perdía en silencio).
- `initAuth` sin try/finally: un fallo de `getUser()` dejaba `loading=true` para siempre → pantalla en BLANCO en toda ruta protegida. Ahora try/catch/finally + ErrorBoundary RAÍZ.
- Apertura de proyecto: se borraba el workspace ANTES de cargar. Si la carga fallaba, el workarea abría VACÍO y el usuario redibujaba encima. Ahora carga primero (`loadProyectoDataConError` distingue "no hay datos" de "falló") y no navega si falló.

### Seguridad
- CSP: `script-src` pasó de `'unsafe-inline' 'unsafe-eval'` a `'wasm-unsafe-eval'` (los scripts de arranque se movieron a `public/scripts/*.js`; el dev server relaja la CSP vía `vite.config.js`).
- `xlsx-js-style` (SheetJS 0.18.5, CVE-2023-30533 + CVE-2024-22363) → SheetJS OFICIAL 0.20.3 como alias npm (`npm:xlsx-republish@0.20.3`: la URL de cdn.sheetjs.com rompía `npm install` con npm 10).
- `pdfjs-dist` 5.4.296 → 6.4.299: la línea 5.6.83..6.2.107 tenía un advisory HIGH de ejecución arbitraria de JS al abrir un PDF malicioso.
- Logout: `clearLocalWorkspace()` (el dibujo completo quedaba legible en el navegador del equipo compartido).
- Ganchos de diagnóstico (`__cfDiag`, `__cfScale`, `__cfEngine`, `__cfCam`): solo en DEV.
- Migración `20261021000000`: candado `acceso_modulo` en `save_proyecto_general_campo` y en las 9 tablas hijas de CM (APLICAR EN SQL EDITOR antes de encender `suscripciones_activas`).

### Rendimiento y guard
- `dibujaRamales`: los filtros de red estaban DENTRO del bucle de ramales (O(n²) por frame) y la comprobación del codo reventilado recorría todos los puntos (O(ramales·puntos)). Ahora: índice por celda + índices por frame.
- `redRenumera`: 5 blobs × N ramales = 200 `JSON.parse` del blob completo por clic. Ahora se leen una vez.
- 20 servicios: `auth.getUser()` (ida a la red) antes de cada RPC → `getSession()` (0 round-trips).
- G8: las exclusiones documentadas NUNCA se aplicaban (el regex exigía un punto inicial contra `name.text`). Con Set por nombre: **596 → 542 focos**, 48 → 43 archivos (baseline regenerado).
- `CICLOS_CONOCIDOS` del guard G3 tenía 18 nombres que ya no existían (letra muerta) → lista vacía y documentada.

### Higiene
- Carpeta `components/fixtures/` → `components/aparatos/` (en inglés "fixture" = dato de prueba; aquí es producción). Símbolo `useInfTables` → `useInfTablas`.
- Barrido de 184 referencias a nombres de archivo viejos en comentarios (mapa sacado del commit de renombre; 0 imports tocados).
- `.eslintrc.cjs`: 4 rutas renombradas inexistentes + `AparatosPanel.tsx` (905 L) fuera de la zona de exención.
- 273 exports públicos sin JSDoc quedan pendientes (empezar por `PlanoEstado.ts` 39, `bajanteAsocCompartido.ts` 22, `crossPisoAlmacenamiento.ts` 21).

### LECCIÓN (encarnada otra vez)
Editar archivos de este repo con **node**, nunca con `perl`/`sed`/`Set-Content` de PowerShell 5.1: escribe en la codepage local y rompe el UTF-8 (el build falla con "stream did not contain valid UTF-8") y deja caracteres U+FFFD silenciosos. Detector: `new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(f))` en node.

### Pendiente del usuario
1. **Aplicar `supabase/migrations/20261021000000_candado_suscripcion_campos_y_cm.sql`** en el SQL Editor (antes de encender `suscripciones_activas`).
2. Migración a Tailwind 4 (fix del advisory high restante) — PR aparte con verificación visual.
3. Despinear `vitest` a 4.1.11+ cuando se actualice npm a 11 (npm 10.9.2 no puede resolver ese peer-set).
4. Monolitos: `PdfViewer.tsx` (1428 L), `PlanoMotor.ts` (1397 L), `dibujaRamales.ts` (1154 L, función de 1040 L), `BajantesTabla.tsx` (1001 L) — divisiones propuestas en el informe.
5. JSDoc: 273 exports públicos.

Gates: tsc 0 · vitest 1369/1369 (226 archivos) · lint 0 · build + prerender 13/13 · npm audit 17 → 9 (los 9 son DoS de herramientas de build, sin ruta en el bundle).
