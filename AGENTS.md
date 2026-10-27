## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Tests: solo los de los archivos modificados (2026-10-22, REGLA PERMANENTE)

Los gates de VITEST corren SOLO los tests relacionados con los archivos modificados (su lógica, sus tests propios y los módulos que los consumen directamente) — NUNCA la suite completa. La suite entera tarda ~1 minuto y casi siempre lo que rompe el cambio ya se ve en sus tests vecinos. Ej: toque drawingFlow.ts → corro nodoPressureDiameter.test.ts + los tests de quien lo importa. La suite COMPLETA queda reservada para: auditorías, pre-release/commit mayor, o cuando el usuario la pida explícitamente. tsc + eslint + build sí corren siempre (son rápidos y globales).

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

## Nombres de archivo: inglés por fuera, dominio en español

Los ARCHIVOS y CARPETAS se nombran en **inglés**, con una excepción: las palabras del **vocabulario de dominio** —las que el usuario necesita para entender el sistema— **se dejan en español**. Son objetos del sistema, no palabras de la interfaz.

- **Se traducen**: red→network · canal→channel · presión→pressure · bomba→pump · caudal→flow · cota→dimension · equipo→equipment · y las genéricas (cálculo, ayuda, guía, carga, memoria→report, proyecto, tabla, sección, tarjeta, uso, estilos, fila, datos, navegación, complejidad, portada→hero, modal, foco, diálogo, guardado→save).
- **NO se traducen** (quedan en español): bajante · montante · ramal · tributario · tramo · caja · rejilla · nodo · acometida · aparato · ldesvio · y los códigos de red (af, ac, san, ll, gas, rci, vent, ep, bom).

Convención resultante (mixta, como el repo original): `bajanteRules.ts` · `upMontante.ts` · `bajanteAssociationClear.ts` · `useCrudTable.ts` · `pumpAssociation.ts` · `channelGeometry.ts` · `publicNetwork.ts` · `sanReport.ts`.

Reglas de la operación (ronda 2026-10-21, 718 archivos movidos):
- Se traduce el NOMBRE, **nunca se restaura contenido de la historia**: los archivos se mueven (`git mv`) y solo se reescriben las rutas de import y las rutas fijadas (guard de arquitectura, baseline de complejidad, eslint, scripts, docs).
- Identificadores, comentarios y textos de UI **siguen en español** (el glosario de siglas de arriba).
- Al rehacer un renombrado: `git show --name-status --find-renames <commit>` da el mapa, pero hay que **resolver cadenas** (un archivo renombrado dos veces vuelve a su nombre original) y resolver los imports **sin extensión** (`'./complejidad'`) contra el mapa, no contra el disco (el nombre viejo ya no existe).

## Suscripciones por módulo (IMPLEMENTADAS PERO DESHABILITADAS)

Suscripción por módulo (solo `flow` y `manage` en catálogo) con **Lemon Squeezy** y **vencimiento manual** (se paga 1 mes / 6 meses / 1 año por adelantado; `app_suscripciones.fecha_fin > now()` es la única verdad, no hay cron ni cobro automático). Precios LISTA por módulo en centavos USD: mensual 2500 ($25.00), semestral 15000 ($150.00 = 6× mensual), anual 30000 ($300.00 = 12×). Descuentos: base por periodo (mensual 0% / semestral 10% / anual 15%) + 10% acumulativo por módulo adicional (2 módulos anual = −25% → $450). La VERDAD de precios es `app_precios` en BD (RPC `obtener_catalogo` los sirve al cliente vía `sincronizarPreciosBd` — cambiar precio = UPDATE en SQL Editor, sin deploy); los literales de `catalog.ts` y `_shared/lemon.ts` son fallback y el test de paridad vigila que no diverjan.

Apagado en DOS niveles — con ambos off, la app se comporta exactamente como antes (nadie se bloquea):

1. **Cliente**: `VITE_SUSCRIPCIONES !== 'true'` (default off). Sin gating en rutas, perfil ni ModulePage; PricingPage muestra la página de marketing; no se invoca ninguna edge function.
2. **BD**: `app_config('suscripciones_activas', false)`. `public.acceso_modulo(uid, modulo)` devuelve `true` para todos con el flag apagado; con él encendido exige fila vigente. Este flag gobierna el check dentro del RPC `save_proyecto` (flow) y la política INSERT de `cm_proyectos` (manage).

### Piezas
- Migraciones: `20260924000000_suscripciones.sql` (tablas + funciones `suscripciones_habilitadas`/`acceso_modulo`/`activar_suscripciones`; candados en `save_proyecto` y policy `cm_proyectos_propietario_insertar`) · `20260924000001_suscripciones_race_y_uso.sql` (FOR UPDATE + rowcount) · `20260924000002_revokes_impl.sql` · `20260928000003_precios_bd_y_cota.sql` (`app_precios` + `obtener_catalogo`) · `20260928000004_rename_familia_suscripciones.sql` (cf_* → app_*) · `20261001000000_semestral_descuentos.sql` (semestral + descuentos acumulativos) · `20261002000001_usd_lemon.sql` (precios USD, moneda 'USD', columna de transacción → `txn_id`) · `20261006000000_pago_edge_hardening.sql` (`registrar_intencion_pago`: advisory lock + cap 5/h, service_role; grant de `suscripciones_habilitadas` a service_role) · `20261015000000_drop_intenciones_recientes.sql` (huérfana Wompi fuera) · `20261023000000_pago_en_revision.sql` (estado `'revision'` para monto insuficiente).
- Edge functions (ESCRITAS, falta deploy): `crear-checkout` (gated por `suscripciones_habilitadas`; precios server-side desde `app_precios` — FAIL-CLOSED si la lectura falla; `venta_manual` a 25+ puestos; inserta la fila pendiente vía RPC `registrar_intencion_pago`; crea checkout LS con `custom_price` + `checkout_data.custom = {referencia, user_id}`; devuelve `checkoutUrl`; borra la fila si LS falla), `verificar-pago` (SOLO LEE el estado de la fila PROPIA — defensa IDOR; NO llama a la API LS ni activa; devuelve `{aprobado, estado}`), `ls-webhook` (`verify_jwt=false`; valida HMAC-SHA256 del body crudo con `LS_WEBHOOK_KEY`; `test_mode` se ignora; monto menor al esperado → estado `'revision'` (dinero cobrado sin activación = revisión manual); activación vía `activar_suscripciones` idempotente — ÚNICO canal de activación). Compartidos: `_shared/lemon.ts` (catálogo server, paridad por test) y `_shared/pago_utils.ts` (clientes supabase, CORS, HMAC). Secret adicional: `SITE_URL` (redirect del checkout — sin él va a producción aunque el deploy sea de staging).
- Cliente: `src/lib/subscriptions/catalog.ts` (catálogo + `calcularTotalCentavos` + `formatUSD` + `sincronizarPreciosBd`), `subscriptionsService.ts` (`estaActiva` pura), `src/hooks/useSubscriptions.ts`, `src/components/subscriptions/{CheckoutModal,ModuleSelectDialog,RequireModule}.tsx`.
- Flujo perfil: "Nuevo proyecto" → `ModuleSelectDialog` lista SOLO módulos comprados y vigentes ("Activo hasta X"); 0 activos → "Ver planes" a `/pricing`; 1 → entra directo; flow → `ProjectCreateDialog` → `/civilflowareatrabajo`; manage → `ProjectCreateDialogCM` → `/civilmanagerareatrabajo`.
- Gating adicional: `RequireModule` envuelve los workareas en `App.tsx` (evalúa la fecha en cada render → vence en vivo); CTA de `ModulePage` redirige a `/pricing?modulo=X` sin compra; los diálogos de creación muestran aviso "Suscripción inactiva" (la BD es el candado real). Vuelta del checkout: `/pricing?ref=X` → `verificar-pago` → `{aprobado, estado}` → mensajes diferenciados (aprobado / en revisión / verificando) + refetch.

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
1. Tienda LS: cuenta + store; NO hace falta crear productos (el checkout usa `custom_price` calculado server-side desde `app_precios`).
2. `supabase secrets set LS_API_KEY=... LS_STORE=... LS_WEBHOOK_KEY=... SITE_URL=https://civilcardex.com`
3. Deployar las 3 edge functions (YA ESCRITAS en `supabase/functions/`): `supabase functions deploy crear-checkout verificar-pago ls-webhook` (bloques `verify_jwt` ya en `config.toml`). Configurar webhook en el panel LS: `<SUPABASE_URL>/functions/v1/ls-webhook` (evento `order_created`).
4. Aplicar en SQL Editor: `20261004000000_suscripciones_empresa.sql` → `20261005000000_empresa_escritura.sql` (el DO de cirugía ABORTA si un guard vivo no matchea) → `20261023000000_pago_en_revision.sql`.
5. Probar en modo test de LS (tarjetas de prueba) antes de producción.
6. `VITE_SUSCRIPCIONES=true` en Vercel + redeploy.
7. `update public.app_config set valor = true where clave = 'suscripciones_activas';`

Consecuencia conocida (decisión del usuario): al activar NO existe plan gratis — todos los usuarios quedan bloqueados hasta pagar.


## Security Notes

### Linter Supabase — WARNs aceptados (2026-09-24)
- `authenticated_security_definer_function_executable` sobre los WRAPPERS de contenido (save_plano_data, save_proyecto, etc.): patrón INTENCIONAL — SECURITY DEFINER con ownership check interno (`auth.uid()` + verificación de propiedad en cada cuerpo), auditado en rondas 4-6. El lint es WARN por diseño; no hay acción.
- `acceso_modulo`/`suscripciones_habilitadas` ejecutables por authenticated: REQUERIDO — las policies RLS de cm_proyectos las invocan como el rol del usuario (sin EXECUTE las policies fallan). Solo exponen un booleano, sin datos de usuario.
- Familia EMPRESA (20261004000000/05000000, aceptada 2026-10-03): `asignar_puesto/quitar_puesto/cambiar_permiso_miembro/mis_miembros` (SECURITY DEFINER con guard `uid is null → no_autenticado` primero y check de propiedad interno) y `empresa_lectura/empresa_escritura` (para anon devuelven false constante — sin fuga de info; authenticated las necesitan las policies RLS y las storage policies de plan_pdfs). Hardening aplicado en `20261005000020_hardening_uuid_seguro_y_anon.sql` (revoke de anon; `uuid_seguro` con `set search_path = ''`).
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
- **G8 (guard de complejidad) NUEVO**: `src/architecture/complexity.ts` cuenta "focos" = búsquedas
  lineales (find/findIndex/some/filter/indexOf/includes) DENTRO de bucles, parseando con el AST de
  TypeScript (no regex). Reglas del guard: (A) ningún archivo nuevo con ≥5 focos, (B) ninguno CRECE,
  (C) el total no sube, (D) si el código tiene menos que el baseline → hay que bajarlo (anti-congelación).
  Baseline congelado: 596 focos en 48 archivos. Regenerar con `npm run baseline:complexity`.
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
- **G8 (guard de complejidad)**: `src/architecture/complexity.ts` (detector AST con el parser de
  TypeScript, NO regex) + `__tests__/complexity.test.ts` (11) + guard con baseline congelado
  (`FOCOS_CONOCIDOS` + `TOTAL_FOCOS_BASE` = 596 focos / 48 archivos) + `scripts/generarBaselineComplexity.mjs`
  (npm `baseline:complexity`). Reglas: (A) sin archivo nuevo ≥5 focos, (B) ninguno CRECE,
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
- **SEO cerrado**: `seo/routeMeta.ts` con `metaDeRuta(path)` como fuente única + `ModuleConfig.ruta`
  (`pages/moduleData.ts`) + los 6 heroes de módulo con `<h1>` (antes `<h2>`): **13/13 rutas
  prerenderizadas con H1**. Test `seo/__tests__/rutaMeta.test.ts` (7). El prerender se renombró a
  `seo/prerenderEntry.tsx` (package.json `build` y `scripts/prerender.mjs` actualizados).
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

## Tailwind 4 (CSS-first) — TRAMPAS de la migración v3 → v4 (2026-10-21)

Migrado a Tailwind 4.3.3 (CSS-first). **Ya no existe `tailwind.config.js`**: el tema vive en `src/styles/tokens.css` (`@theme` + `@source` + `@custom-variant`), y el plugin de PostCSS es `@tailwindcss/postcss` (en v4 el plugin va en su propio paquete, no en `tailwindcss`).

Las dos trampas que ROMPIERON la app en la primera pasada y hay que tener presentes al tocar el tema:

1. **`@theme` CONGELA las variables de color en `:root`.** Con `@theme { --color-primary: var(--acc) }` la utility sale como `color: var(--color-primary)` y esa variable se RESUELVE en `:root` → queda congelada y los overrides por scope dejan de mandar (el navbar con `.navbar-gold` y la landing con `.landing-root` se quedaban en azul). En v3 la utility era `color: var(--acc)` (se resolvía POR ELEMENTO). **Fix: `@theme inline`** → la utility usa el valor tal cual. Regla: si un color del tema es `var(--algo)`, va en `@theme inline`.

2. **Las utilities de Tailwind viven en `@layer utilities`; una hoja de estilos EXTERNA sin capa gana SIEMPRE.** La hoja de Google Fonts pone `.material-symbols-outlined { font-size: 24px }` → vencia a `text-sm` / `text-[19px]` y todos los iconos salían a 24px. **Fix: el modificador `!` de Tailwind 4** (sufijo: `text-sm!`): importante gana a la hoja externa. Los 25 iconos con utilidad de tamaño llevan el `!`.

Verificación de una migración de CSS aquí: NO basta con que compile. El A/B correcto es (a) generar el CSS con la versión vieja y con la nueva, (b) medir en el navegador los `getBoundingClientRect` + estilos calculados de cada elemento con y sin el CSS viejo inyectado por encima, y (c) diff píxel a píxel de una captura antes/después. La página `/docs` sirve de referencia (uso denso de Tailwind, sin animaciones).

## npm 10.9.2 no puede resolver el peer-set de vitest ≥ 4.1.11

`npm install` falla con `Cannot read properties of null (reading 'edgesOut')` (bug de arborist `#loadPeerSet`) en cuanto hay que **re-resolver** vitest. Con el lock presente, npm 10 instala bien; el bug solo salta al cambiar el rango o borrar el lock.

**Workaround: usar npm 11** (`npx npm@11 install` o `npm i -g npm@11` para el equipo). El lock que genera es `lockfileVersion 3`, el mismo que lee npm 10 sin problema.

Otra trampa del mismo tipo: una dependencia por URL (`https://cdn.sheetjs.com/...`) rompe el árbol de npm 10 igual. Por eso `xlsx` va como **alias** de npm: `"xlsx": "npm:xlsx-republish@0.20.3"` (el republish oficial de SheetJS en npm, autor "sheetjs", mismo código que el CDN).

Estado: `npm audit` → **0 vulnerabilidades**.

## Migraciones: NUNCA hardcodear la firma de una función (2026-10-21)

Incidente: la migración `20261021000000` creó una sobrecarga `(bigint, text, text)` de `public.save_proyecto_general_campo` porque copié la firma del archivo `20261002000000`. Pero esa firma ya no existía: `20261006000000` la había convertido a `(uuid, text, text)` y borrado la bigint. Con DOS sobrecargas del mismo nombre, PostgREST responde *"Could not choose the best candidate function"* y **ningún guardado de campo del proyecto funcionaba** (rejillas, af_alimentacion, tanque_npt, presion_garantizada).

**Regla:** antes de envolver una función existente, **detecta su firma viva en la BD** en vez de copiarla de un `.sql` anterior:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '<nombre>';
```

Y en la migración, envuelve lo que exista (`execute format('alter function public.%I(%s) rename to ..._impl', ...)`) en vez de escribir la firma a mano.

**Segunda regla:** toda migración que toque una función debe terminar con una comprobación que **falle ruidosamente** si el resultado no es el esperado (p.ej. "exactamente 1 sobrecarga con este nombre"). Así el fallo aparece al aplicar la migración, no semanas después en producción.

**Tercera regla:** una migración correctiva debe ser **idempotente** (si el `_impl` ya existe, no tocar nada), para que sirva tanto a la base que aplicó la versión rota como a una instalación limpia.

Ver también: `20261021000001_fix_sobrecarga_save_campo.sql` (correctiva) y la `20261021000000` corregida (detecta la firma).

## Session Summary — 2026-10-21 (ronda 68: escala del piso + nombres en ingles)

### 1. Fix del visor: "al reingresar los elementos aparecen desplazados y las cotas leen menos"
El sintoma era **metrico** (las cotas en metros leian menos), no visual: la escala del doc (`scaleM`, metros por pixel) se pisaba por dos rutas y quedaba **persistida** en la BD.

- **F-A — el "piso seleccionado" pisaba la escala**: el efecto de `PdfViewer.tsx` aplicaba `plano.scale/100` (el valor por defecto del plano) a cualquier piso sin calibracion, cada vez que se refrescaba el array `planos` (p. ej. una sincronizacion de fondo). Con contenido en el piso, el doc quedaba con una escala que NO correspondia a sus pixeles -> las cotas leian en otra escala y el dibujo quedaba corrido respecto de la lamina. Ahora la escala por defecto solo se aplica a un piso **vacio y sin doc** (`decideEscalaPorDefectoDelPlan`).
- **F-B — el re-base comparaba contra la escala GLOBAL del proyecto**: el cargador re-escalaba toda la geometria (anclada al origen) cuando el doc no coincidia con el primer plan `calGlobal`; un piso calibrado **a mano** se encogia en silencio en cuanto el portador global cambiaba, y el cambio quedaba guardado. Ahora el objetivo es la escala calibrada del **PROPIO piso** (un piso `calGlobal` sigue al global, pero el re-escalado se anuncia y se registra).
- **F-E — etiqueta pisada**: una escala del set estandar (0.5/0.75/1/1.25/2) en el doc significa que la **etiqueta** esta mal, no los pixeles -> se restaura la etiqueta SIN tocar la geometria (las cotas vuelven a leer bien sin mover un trazo).
- **F-C — el motor manda con contenido**: `syncEngine` ya no empuja la escala del estado React sobre un piso con dibujo (adopta la del motor).
- **F-D — diagnostico**: `utils/cargaDiagnostico.ts` (decisiones puras + registro por piso) y boton **"diag"** en la barra del visor que copia el reporte (escala del doc, calibrada, global, decision, lamina y camara). La camara guardada ya no se reencuadra siempre (solo si no hay camara o si la lamina cambio de tamano) y el doc guarda el tamano con el que se calibro (`pageW/pageH`).

Tests: `utils/__tests__/cargaDiagnostico.test.ts` (15).

### 1b. El aviso de "escala del piso corregida" salia SIEMPRE (bucle)
La reparación se guardaba **sin `ts`**: el arbitration local-vs-BD gana el **mayor ts** y una copia sin ts cuenta 0 → la BD (con la escala vieja) ganaba siempre y el doc conservaba la etiqueta mala → el aviso se repetía en cada entrada. Dos arreglos:
- **Todo doc que se persiste lleva ts fresco** (mismo convenio que `persistTrazosSnapshot`). Helper puro `localGanaABdPorTs` (localStorage.ts) + test que pina que una copia sin ts pierde.
- **El aviso sale una vez por par "escala encontrada → corregida"** (`debeAvisarCorreccionEscala`): si la corrección no se queda guardada, el modal no vuelve a tapar el visor — el diagnóstico deja la traza igual.
- `saveTrazosLocales` ahora devuelve si la escritura local se pudo hacer (cuota llena) y el cargador avisa si la corrección no quedó guardada.
- El reporte del diagnóstico ahora trae la escala y el ts de **cada copia** (local vs BD) y el error de BD: si la copia de BD no trae la escala corregida, la causa está en el push (RPC, sesión o proyecto activo).

### 1c. "Aceptar" el aviso dejaba el visor CARGANDO (spinner eterno)
El re-raster de la lámina por cambio de escala bumpeaba `mountId` → el `setLoading(false)` de la carga comprueba `thisMount === mountId.current` → la comprobación fallaba y **el overlay de carga nunca se bajaba**. Dos arreglos:
- El re-raster por cambio de escala **no bumpea `mountId`** (usa `mountCheck = 0`, "sin chequeo de montaje": es el mismo plano).
- El overlay se baja por una **secuencia de CARGA** (`cargaSeq`), no por el montaje: cualquier render extra (re-raster por zoom, por cambio de escala) ya no puede dejar el spinner colgado.

### 2. Nombres de archivo en ingles (718 archivos movidos)
El renombrado a espanol (35861b6 + 36e46aa) habia ido **al reves** de lo pedido. Se revirtio al nombre ingles original (630 archivos) y se traduzco al ingles lo que quedaba en espanol (88). Glosario cerrado con el usuario: se traducen red/canal/presion/bomba (+ genericas) y se **mantienen en espanol** bajante, montante, ramal, tributario, tramo, caja, rejilla, nodo, acometida y aparato. Seccion nueva en este AGENTS.md con el vocabulario.

**LECCION (churn concurrente)**: los 88 renombres de la Fase B quedaron dentro del commit `b0546df` de la **sesion paralela** (su `git commit` se llevo lo que yo tinha en el index). Esta commited, el tree quedo bien, pero el mensaje de ese commit no los describe.

**LECCION (imports sin extension)**: el resolutor de imports tiene que probar `.ts`/`.tsx`/`/index.ts` **contra el mapa de renombres**, no contra el disco: tras mover el archivo, el nombre viejo ya no existe y el import queda apuntando al nowhere (`'./complejidad'`). Con extension en el specifier hay que resolver igual.

Gates: tsc 0 - vitest 1384/1384 (227 archivos) - lint 0 - build + prerender 13/13 - graphify (11616 nodos, 31549 aristas).

## Session Summary — 2026-10-22 (ronda 69: FK de guardado, fotocopia entre pisos, prod y visor)
- **"No se pudo guardar en la nube" (FK `planos_fantasmas_entrepisos_plano_origen_id_fkey`) + "no se guardan los elementos" = UN bug**: borrar un plano deja cachés vecinas con fantasmas huérfanos → el RPC `save_plano_data` (transaccional) abortaba el guardado COMPLETO del piso. Fix: `20261022000000_fantasmas_huerfanos.sql` — parche POSICIONAL del cuerpo vivo (patrón r64: ancla única + copia `__check` + idempotente con marcador `fantasmas_huerfanos_vivos`); el insert gana `where r.plano_origen_id is null or exists (select 1 from cf_planos ...)`. PENDIENTE USUARIO: aplicar en SQL Editor.
- **FOTOCOPIA entre pisos (elementos del piso 2 "de la nada" en la cubierta) — raíz**: carrera de carga. El switch reasignaba `_loadedPlanId` ANTES del await y una carga BD lenta del piso viejo aterrizaba después: `loadWork` pisaba el motor con contenido ajeno y `finCarga()` bajaba el flag global a mitad de la carga vigente → cualquier escritura persistía la fotocopia (RPC destructivo). Fix doble: token secuencial en `usePlanoLoadSwitch` (carga obsoleta no baja el flag ni toca el motor) + `pisoVigente()` en `useTrazosLoader` (re-verifica `_loadedPlanId === resolvedId` antes de cada loadWork/save post-await; también guarda la corrección de escala del piso correcto). Los duplicados YA copiados se borran a mano una vez.
- **Prod "sin estilos" (perfil)**: la CSP (`script-src` sin `'unsafe-inline'`) bloqueaba los `onload` inline de los `<link>` de Google Fonts → fuentes/iconos nunca se activaban (el CSS de Tailwind estaba bien). Fix: `public/scripts/fuentes.js` (patrón canonical.js) promueve preload→stylesheet; `index.html` sin onload inline.
- **PDF difuminado**: el dprCap viejo `max(1, 2/dpr)` clavaba extra=1 en retina (dpr≥2) → cualquier zoom>1 estiraba el bitmap. Fix: presupuesto — `extra = min(pedido, 2)` recortado a lado ≤6000px y área ≤24MP post-viewport.
- **Etiquetas no siguen al cursor**: (a) `dimDrag` FALTABA en la lista `hasDrag` de PlanoEngine → arrastrar cota por el cuerpo no hacía nada en vivo; (b) el agarre de etiqueta de ramal usaba el centro PINTADO de la caja como ancla y el renderer re-sumaba el gap → salto de un gap en el primer mousemove; ahora ancla = `toCvs(labelX,labelY)`; (c) `ghostDrag` no movía `ghostData[nivel].labelX/labelY` (etiqueta del fantasma clavada).
- **Centrado sin salto**: encuadre PRE-PAINT incondicional por piso — el init ya no condiciona el re-fit a `sinCamara || laminaCambio` (la cámara guardada deja de mandar en la entrada) y el switch ajusta `paginaDeDoc` + `fitPage()` antes de su primer render. La resolución local-vs-BD queda bajo el primer overlay. (El auto-fit de la ronda anterior lo pisó la sesión paralela al extraer hooks — re-hecho pre-paint.)
- **Spinner solo en la 1ª entrada**: `ViewerPage` envuelve `onLoadingChange` (`handleVisorLoading`) — tras la primera carga completa los `true` se ignoran → switches de piso sin "Cargando planos y redes…" (queda el velo chico del canvas).
- **Alerta "Escala del piso corregida"**: correcta (auto-heal 1 vez/dispositivo) — la etiqueta 0.5 del doc era del pisado viejo; con la FK arreglada persiste y deja de repetir entre dispositivos. Sin cambio.
- Gates: tsc 0 (propios) · eslint 0 · vitest 1391/1391 (227) · build + prerender 13/13 · graphify ✓.

## Session Summary — 2026-10-22 (ronda 69bis: raster que persigue el zoom + pisos precalentados)
- **PDF difuminado a zoom de trabajo**: el re-raster de fondo nacía con `lastZoomRaster = 1` y densidad extra topeada a 2× — a zoom 2-3 el bitmap quedaba estirado (ratio extra/zoom < 1). Fix: `extraPedido` SIN tope duro (el presupuesto de bitmap post-viewport es el único límite: lado ≤6000px, área ≤24MP) + `reprogramarBgRef` — tras el primer render el loader re-sincroniza la densidad con el zoom REAL del fit de entrada.
- **Cambio de piso fluido / todo cargado a la 1ª entrada**: `pdfCache.ts` nuevo — caché de PDFDocumentProxy por File (re-parsear el mismo File en cada switch era el retraso entero). Tras la primera entrada, `calentarPdfs` parsea los PDFs de los DEMÁS pisos en reposo (2.5 s, best-effort) → los switches caen en caché: solo re-raster con asentamiento 600→150 ms (el velo chico del canvas cubre el swap; el overlay grande ya no sale por piso). Los trazos de todos los pisos ya los traía `prefetchAllTrazos`.
- **G1**: `PdfViewerEngineInit.ts` volvió a tocar el tope (740) → extraído `pdfCache.ts` + `diagCamara.ts` (el dump `__cfCam` ahora se instala con `instalarCfCam`, 700 lines exact).
- Gates: tsc 0 · eslint 0 · vitest 1391/1391 (227) · build + prerender 13/13 · graphify ✓.

## Session Summary — 2026-10-22 (ronda 69ter: TDZ grafo vent + recorte que re-rasteriza)
- **"Cannot access 'recibePorBajante' before initialization"**: el refactor C3 movió el Map DEBAJO del bucle de ramales en `buildBajanteGraph.ts` — `checkEndpoint` lo leía en TDZ en el primer ramal con bajantes. Fix: el mapa se construye ANTES del bucle (junto a `bajantes`).
- **Recorte difuminado (raíz del "PDF difuminado" en carga/calibración/recorte)**: `PlanCropModal` rasterizaba la página UNA vez a escala fija 2 y el `drawImage` la estiraba con el zoom — por encima de 2×, borroso permanente. Fix: re-raster bajo demanda — cuando `zoom × dpr` supera la escala del raster con 20% de margen, se vuelve a rasterizar (presupuesto: lado ≤9000px, área ≤40MP; el dibujo actual queda en pantalla hasta el swap). Calibración/carga no tienen raster propio (overlay del visor / `<embed>` nativo).
- **Visor: presupuesto de área 24→40MP** — a 150% de escala de Windows (dpr 1.5) el tope viejo dejaba ratio 0.82 a zoom 3; ahora ~1.0.
- **G1**: `PlanCropPanel.tsx` pasó el tope (715) → modal extraído a `planosTab/PlanCropModal.tsx` (panel 126, modal 593).
- Gates: tsc 0 · eslint 0 · vitest 1391/1391 (227) · build + prerender 13/13 · graphify ✓.

## Session Summary — 2026-10-22 (ronda 69quater: cero spinner en switches + todo antes de abrir)
- **"Cambio de piso SIN NINGÚN spinner"**: el cache-hit del loader ya no toca `loading` (ni overlay grande ni velo z-30 del canvas) y `renderPage` ya no limpia el canvas si el tamaño no cambió (`reDimensionado` guard + `clearRect` condicional) — el fondo ANTERIOR queda visible hasta que el nuevo raster termina: swap imperceptible con hojas del mismo tamaño.
- **"Parpadeo + vuelve al zoom inicial"**: el efecto de switch recargaba el piso cuando sus deps se movían (identidades de callbacks/planes) — cada recarga hacía `loadWork` y pisaba la cámara del motor con la guardada. Fix: `pisosCargadosRef` — un piso carga UNA vez por montaje; re-entradas no tocan nada.
- **"Todo cargado antes de que se abra totalmente el visor"**: `pdfCache.ts` expone el estado de calentamiento (`suscribirCalentamiento`/`calentamientoListo`, arranca en listo; tope de seguridad 20 s) y el calentamiento corre INMEDIATAMENTE tras el primer render (ya sin los 2.5 s). El overlay de primera entrada de `ViewerPage` ahora incluye `!calentamiento` — no se levanta hasta que TODOS los pisos estén parseados en memoria.
- **"Trabado" en zoom/pan**: guard de tamaño evita clears + recomposites del fondo en cada re-raster; los re-rasters solo corren en pausas del gesto (debounce 600ms + gap 1.5s, sin cambio). Si persiste, siguiente palanca = partir el raster pesado en dos pasos (rápido + fino).
- **G1**: `PdfViewerEngineInit.ts` (705) → extracto `encuadrarContenido` a `planoCamera.ts` (687); fit pre-paint del init y del switch comparten UNA rutina.
- Gates: tsc 0 · eslint 0 · vitest 1391/1391 (227) · build + prerender 13/13 · graphify ✓.

## Session Summary — 2026-10-22 (fix: guard del switch bloqueaba re-visitas)
- **"Los elementos no cambian según el piso" (regresión mía, ronda 69quater)**: `pisosCargadosRef` saltaba la carga de CUALQUIER piso ya visitado — volver a un piso dejaba el motor con los elementos del anterior y `_loadedPlanId` sin reasignar (risco de fotocopia de nuevo). Fix: el guard SOLO aplica a la RECARGA del MISMO piso (`_loadedPlanId === resolvedId && ya cargado`); las re-visitas pasan por la carga completa (con fit y token). Gates: tsc 0 · vitest 1391/1391 · build ✓.

## Session Summary — 2026-10-22 (fix: elementos del PRIMER piso perdidos)
- **"Los elementos que no se guardan son los del piso al que uno entra por primera vez"**: cerró el diagnóstico del guard `!loadingPlanRef` — la ventana del await de BD de la entrada es donde el usuario dibuja justo al abrir; al cambiar de piso (o cerrar pestaña) el guard saltaba el guardado Y limpiaba el autosave pendiente. Fix completo: el guard salió de los TRES caminos (switch-save en `usePlanoLoadSwitch`, `doSave` de unload/visibilitychange y `saveTrazosToStorage` de unmount en `usePdfAutoSave`). Seguro porque `_dirty` solo se enciende con ediciones reales sobre el contenido ya cargado (`applyWorkData` lo apaga en cada carga) y el token de carga + `pisoVigente` garantizan la propiedad del contenido. El debounced autosave conserva su guard (solo difiere — `_dirty` queda vivo para el próximo camino).
- Gates: tsc 0 · eslint 0 · vitest 1391/1391 · build + prerender 13/13 ✓.

## Session Summary — 2026-10-22 (fix: parpadeo del plano del primer piso)
- **"Parpadea el plano y hay que dibujar un bajante para que pare"**: DOS dueños del tamaño del lienzo de dibujo — `renderPage` lo dimensionaba a HOJA×dpr (con `eng.resizeCanvas(viewport)`) y el motor lo devolvía a ÁREA-VISIBLE (`ensureCanvasSize`) en el siguiente render; cada cambio de tamaño LIMPIA el canvas → limpiar+repintar en bucle. Fix: UN solo dueño — `renderPage` solo fija `eng.dpr`/`setPageSize` y llama `eng.ensureCanvasSize()` (el motor manda); añadido `eng.render()` tras el raster del PDF (si el lienzo se redimensionó, los elementos se repintan de inmediato y no en la próxima interacción). El "dibujar un bajante lo arreglaba" era el `_markDirty` → render → tamaño convergido.
- Gates: tsc 0 · vitest 1391/1391 · build + prerender 13/13 ✓.

## Session Summary — 2026-10-22 (ronda: dedupe anti-parpadeo + sonda __cfCam + landing sin texto)
- **Parpadeo del piso de entrada (persistía)**: los dos re-rasters por escala (prop `scale` + `EVENTO_ESCALA_CAMBIADA`) re-rasterizaban SIN dedupe — el flip repetido de scaleM entre dos escritores era un bucle de raster visible. Fix: `ultimoFullScRef` — un FULL con escala ya rasterizada se salta; extraído a `useReRasterEscala.ts` (G1: init 691 líneas).
- **Sonda**: `__cfCam()` ahora devuelve `renders` (contador de rasters completos) y `causaRender` ('loader-pdf'/'loader-cache'/'prop-escala'/'evento-escala'/'bg') — dos dumps durante un parpadeo dicen si el contador sube y quién dispara.
- **Landing sin "Cargando proyecto…"**: `preload.js` oculta el texto en `/` (queda solo el logo).
- Gates: tsc 0 · eslint 0 · vitest 1391/1391 · build + prerender 13/13 ✓.

## Session Summary — 2026-10-22 (RAÍZ del "aparatos que aumentan al cambiar de piso": el piso fantasma `_bak`)
- **Dump del usuario (v58) lo delató**: cada ramal aparecía DOS veces en `piezas` — copia `_bak` + real — y `bajLibro` tenía entradas `_bak`. Causa: el sanador de herencia invertida guardaba su respaldo como `trazos_<pid>_bak` (MISMO namespace que barre `idsDePlanos()`) → el respaldo completo era un PISO FANTASMA que entraba a toda la propagación: piezas duplicadas, LD del piso de arriba al doble (`san_LD_BAN1_...481` = 8 en vez de 4), inflación en ambos sentidos al alternar pisos.
- Fix doble: (1) `propagation/reading.ts` `idsDePlanos` excluye pids `_bak` (los respaldos YA creados dejan de contaminar — los valores dobles se auto-curan: los espejos REEMPLAZAN y `escribirDelta` recompone base+her con las fuentes normalizadas); (2) `bajanteAssociationHeal.ts` guarda el respaldo FUERA del namespace (`civilflow_respaldo_heal_<pid>`).
- Nota: entre turnos se renombró `aparatosPresion/` → `propagation/` (reading/writing/folding/counting…).
- Gates: tsc 0 · eslint 0 · vitest 1391/1391 (227) · build + prerender 13/13 · graphify ✓.

## Session Summary — 2026-10-22 (ronda: diámetro araña completa + entre pisos + re-fit anti-salto)
- **Araña de presión: la cascada moría en tramos SIN diametrar** — `convergirDiametroNodoPresion` saltaba `oIn <= 0`: la continuación sin diámetro no recibía ni re-encolaba. Fix: `oIn > 0 && oIn >= nuevoIn` (el sin diámetro recibe y re-encola; `jamás baja` intacto; el conteo topológico de la unión multi-salida ya contaba los sin diámetro — la lateral perpendicular sigue sin subir). Test `nodoPressureDiameter` actualizado a la nueva semántica (la continuación toma, la lateral conserva).
- **Diámetro entre pisos en cada pase**: `correrEspejos` sincroniza el dNominal del superior al asociado — arriba (cross-floor block) y desde abajo (bloque paridad, leyendo storage del superior). Helper compartido `adoptarDiametroDelSuperior` en `bajanteAssocShared` (sin .find dentro del bucle — guard G8).
- **Salto residual al acomodarse**: re-encuadre (`encuadrarContenido`) tras CADA raster completo (no bgOnly) — el fit de entrada usaba el tamaño PERSISTIDO de la lámina y el viewport real puede diferir un pelín; el ajuste corre antes de que suba el velo.
- Nota: `fixtureMirrors.ts` 412>410 (tope declarado) → helper extraído + comentario huérfano fuera (410 exacto).
- Gates: tsc 0 · eslint 0 · vitest 1391/1391 (227) · build + prerender 13/13 · graphify ✓.

## Session Summary — 2026-10-22 (ronda: doctrina araña COMPLETA + salto post-carga)
- **Araña de presión — doctrina final (ped. usuario, 3 iteraciones hoy)**: `convergirDiametroNodoPresion` — (1) tramos SIN diámetro reciben; (2) un tramo ya ≥ al seleccionado NO se salta: se RECORRE si es continuación colineal/mergesFrom (sus downstream reciben), no si es lateral ya mayor (su subsystem es suyo); (3) el diámetro que PROPAGA es siempre el SELECCIONADO (no el propio del tramo atravesado); (4) los brazos laterales menores TAMBIÉN reciben — el colineal solo gobierna el RECORRIDO, ya no la asignación. Tests `nodoPressureDiameter` ×3 actualizados a la nueva doctrina.
- **Salto residual post-carga**: la arbitración local-vs-BD aterriza DESPUÉS del raster y movía contenido → nuevo método `eng.reEncuadrarContenido()` (bbox propio del motor, sin importar la fachada pinneada drawingBBox — guards G2/G3) llamado por el loader tras cada loadWork + re-fit en renderPage tras raster completo.
- Nota: G3 ciclos flakea en corrida completa bajo carga (pasa en solitario). El build OOM-eó en graphify una vez — prerender 13/13 verificado en dist.
- Gates: tsc 0 · eslint 0 · vitest 1391/1391 (227) · build + prerender 13/13 · graphify ✓.

## Session Summary — 2026-10-22 (ronda: rastrillo san — RS2-P2 crecía al cambiar de piso)
- **Síntoma**: los aparatos propagados de UN solo ramal (RS2-P2) crecían "de la nada" al alternar pisos; la BD recargaba la inflación y el Ldesvio del piso inferior (asociado a BAN1-P2) arrastraba el mismo grupo creciente. Solo san; los demás tramos que llegan al bajante, bien.
- **Causa**: `idsSalidasDeBajante` (fixturesStorage.ts) clasificaba como SALIDA cualquier ramal en `alimentaIds` o con `ini = código` SIN vetar al entrante explícito. RS2-P2 termina en BAN1-P2 (`fin = BAN1`, está en `recibeDeIds`) pero una entrada rancio de `alimentaIds` (era de roles invertidos) lo volvía espejo de su propio agregado: cada pase de espejos escribía `RS2 := agregado(BAN1)` y el walk de `recibeDeIds` incluye la clave de RS2 → `RS2_{n+1} = RS2_n + resto del grupo`. El cambio de piso dispara pases (cleanup + debounce + espejos) → crecía por visita.
- **Fix**: precedencia 3b en `idsSalidasDeBajante`: (1) `fin = código` → entrante absoluto; (2) `ini = código` → salida (nacimiento dibujado, evidencia más fuerte); (3) `recibeDeIds` sin nacer aquí → entrante; (4) `alimentaIds` → salida; (5) geometría cola/cabeza como antes.
- **Cura del dato ya inflado**: el veto detiene el crecimiento pero NO limpia: poner en 0 los aparatos añadidos de RS2-P2 una vez (el campo se limpia solo en 0); la herencia de abajo (Ldesvio/libro) se re-sincroniza sola con el grupo saneado en el próximo pase.
- Tests: `salidasDeBajanteEntrante.test.ts` (4: veto fin, veto recibe, salida ini legítima, salida geométrica) + `espejosSalidasRatchet.test.ts` (2 pases → disco idéntico).
- **Segunda pata (el usuario: "sigue reescribiéndose")**: RESURRECCIÓN desde la BD. `saveTrazosToDB` adjunta `fixtures` desde el disco local antes de subir → la BD quedó con {lav,ino,duc}; el "Quitar" solo escribía localStorage y BORRABA la clave vacía → el merge de `loadTrazosFromDB` (re-agrega fixtures cuando la clave local NO existe) la resucitaba en cada cambio de piso. FIX: LÁPIDAS — las claves vaciadas quedan como `{}` (mutarDec en useFixtureMutations + sanadoSifones), la guarda del merge distingue "vacío a propósito" de "nunca tuvo", y el próximo saveTrazosToDB limpia la fila en la BD. La reescritura por espejo además cubría el entrante GEOMÉTRICO (cabeza sobre el bajante sin campo fin) — el veto ahora también lo considera (precedencia: fin>código / cabeza-sobre-elemento > ini>código > recibeDeIds > alimentaIds > geometría).
- Tests: `salidasDeBajanteEntrante` +1 (entrante geométrico vence a alimentaIds) · `persistenciaPlanos` +1 (lápida bloquea el merge; clave borrada = resucita, documentado).
- Gates: tsc 0 · lint 0 · fixtures 42/42 + persistencia 9/9 · build + prerender 13/13.


## Session Summary — 2026-10-22 (ronda: rastrillo san CERRADO — herencia LD va solo por libro)
- **La tercera pata (la que faltaba)**: el DELTA repetido de los espejos. El enlace cross-floor re-escribía la herencia en el DISCO de cada ramal destino (recibe+alimenta) con `result = max(0, cur − prevAp) + extra`, donde `cur` vive en el mapa GLOBAL de aparatos y `prevAp` en el libro del DOC (recargable). Con la entrada del libro perdida/rancia, el pase re-sumaba: +1 lavamanos/inodoro/ducha POR CAMBIO DE PISO en los ramales asociados a un bajante cross-floor asociado (orig. usuario, repro exacto).
- **Doctrina final (una regla, dos caminos)**: CON LDesvio (no alineados) la herencia viaja SOLO por el libro `ucAplicado` del bajante destino + la clave del LD — NUNCA al disco de los ramales (misma regla que presión: 4 piezas × 3 UC = 12). ALINEADOS (sin LD) el disco del ramal es el ÚNICO camino y el delta del apply queda (acción única, lee el libro del mismo doc que escribe). Los ESPEJOS jamás escriben discos de ramales destino (libro-solo para todas las redes). Guards de la sesión: `esDeEstePiso` (proyecciones con pisoBase ajeno no son titulares) + `APARATOS_PROPIO_KEY` (foto de lo propio para los espejos de salida).
- Fixes: fixtureMirrors (link block libro-solo) · bajanteAssociationApply (delta condicionado a `aligned`) · veto entrante geométrico en idsSalidasDeBajante · lápidas {} contra la resurrección desde BD · import faltante pumpInheritance · tipo pumpAssocLive.
- Tests: repros `__reproSanCrossFloor` (2) y `__reproSanCollision` (3) verdes — el disco es ESTABLE entre ciclos de pisos · assocUdInheritance actualizado a la doctrina LD (5 asertos: el ramal conserva lo propio, la herencia completa vive en LD+libro) · batería completa 657/657.
- Gates: tsc 0 · lint 0 · vitest 657/657 (utils+fixtures+servicios) · build + prerender 13/13.

## Session Summary — 2026-10-22 (ronda: araña UNIFORME + overlay espera al primer piso asentado)
- **Araña de presión — DOCTRINA FINAL uniforme**: `convergirDiametroNodoPresion` simplificada a lo verificable — el seleccionado se propaga a TODA la araña conectada aguas abajo (continuaciones, laterales, tramos partidos), recorriendo SIEMPRE lo conectado (el corte en tramos ya iguales/mayores dejaba media araña sin propagar en arañas grandes). Asigna SOLO donde actual < seleccionado (jamás baja). Sin filtros colineales: la araña queda uniforme. Tests ×3 reactualizados.
- **Salto residual**: el overlay de primera entrada ahora espera TAMBIÉN al primer piso ASENTADO (raster + arbitración local-vs-BD + corrección de escala): `marcarPrimerPisoCargado()` en el loader + `calentamientoListo()` = calentado && primerPiso. Antes se veía «desplazados → salto → acomodados» porque la arbitración aterriza tras el velo.
- **G8/G1**: focos bajaron (fixtureMirrors 8→6, drawingFlow 5→3) → baseline regenerado y trasplantado al test (el inline del test es la verdad; el .txt es helper). fixtureMirrors 407/410 (imports fusionados).
- Primer fallo del build por OOM en graphify (una vez) — prerender verificado en dist.
- Gates: tsc 0 · eslint 0 · tests relacionados 23/23 (arquitectura + diámetros) · build + prerender 13/13 · graphify ✓.

## Session Summary — 2026-10-22 (sin spinner en el visor + verificación de suscripción sin flash)
- **Fuera el spinner INTERNO del visor** (`PdfCanvas`): velo z-30 + `PdfCanvas_S1` eliminados — la primera entrada la cubre el overlay de ViewerPage y los cambios de piso no tienen estado de carga. `loading` solo gobierna las pantallas de aviso.
- **«Verificando suscripción...» al salir del visor**: `useSuscripciones` es por-montaje (cada ruta con RequireModule re-consultaba flag+filas → spinner). Fix: caché de sesión module-level (`cacheSesion`, hidrata rows/flagBD/accesos al instante en remontajes; el effect sigue refrescando en vivo; se invalida al cambiar de usuario — invalidación en el effect, no en render, regla del react-compiler).
- Gates: tsc 0 · eslint 0 (1 warning ajeno) · tests visor 4/4 · build + prerender 13/13 ✓.

## Session Summary — 2026-10-22 (auditoría post-rastrillo: 6 hallazgos, 4 arreglados, 2 retirados con razón)
- **F-1 CRÍTICO arreglado (destruía datos)**: `clearBajanteAssociation` restaba el libro completo del disco del ramal — con la doctrina libro-solo (el disco ya NO contiene herencia) la resta borraba las asignaciones manuales al desasociar (RS2 {lav:1} → {}). FIX: SUELO de propio — la resta nunca baja de `cur − foto`, donde la foto es `APARATOS_PROPIO_KEY` (`aparatos_propio_v1`, indexada "planoDestino|bajanteDestino") que el pase de espejos ahora SÍ escribe (foto de lo propio al momento del pase). Docs viejos sin foto → resta completa (comportamiento legacy correcto). Hidro: mismo suelo + MATADO el fallback "snapHidro || snap" (restaba el libro de APARATOS sobre el mapa de ACCESORIOS: unidades mezcladas).
- **F-2 RETIRADO con razón**: la bomba (`propagarHerenciaBomba`) parecía el mismo rastrillo, pero su libro vive en el piso CARGADO (objeto del motor + doc persistido en el mismo pase) — sin desacople cross-floor el delta es genuinamente idempotente (test de convergencia ×2) y el carry visible al marcar el checkbox es doctrina del usuario. 2 tests lo pinnean. Delta restaurado con comentario que explica POR QUÉ ahí sí.
- **F-3 disuelto**: la foto `snapBaj.uc` que parecía muerta es ahora el suelo de F-1 — máquina viva.
- **F-4**: repros renombrados a `herenciaSanCrossFloor`/`herenciaSanCollision` (son regresión permanente) y console.log de cacería fuera.
- **F-5**: `aggBajanteAsociado` con contrato real en `engine` (nivelActual + bajantes tipados) — `as never` fuera.
- **F-6 RETIRADO con razón**: el "own" en el libro de los ramals ALIMENTA coincide con el disco que el espejo de salidas les escribe (RS := agg = propio + grupo) — libro y disco consistentes; cambiarlo creaba sub-resta al desasociar. El suelo de F-1 protege igual.
- Test nuevo: desasociar conserva el lavamanos propio (suelo F-1) en herenciaSanCrossFloor.
- Gates: tsc 0 · lint 0 · vitest 658/658 (utils+fixtures+servicios) · build + prerender 13/13.

## Session Summary — 2026-10-22 (ponytail #16: facades muertas fuera + 4 shrinks)
- **delete**: `aparatosPressure.ts` y `sanAccesoriosTable.ts` (fachadas sin importadores que solo existían como contrato del guard) BORRADAS + filas limpiadas de CONOCIDOS/GESTIONADOS/API_PUBLICA + test vacuo "fachadas sin importadores" fuera. La propagación y la tabla de accesorios se importan directo de sus módulos reales (así vivían todos los importadores desde la ronda 15).
- **shrink maxCnt**: `mezclarMax(cnt, extra)` en propagation/counting — 6 copias inline del max-merge fuera (libroHeredado, networkRenumber ×4, deleteRemerge, reading.ts calcularCargaBajantes). Re-exportada por propagation/index.
- **shrink mutarConteo**: helper disco-primero con fallback de estado en useFixtureMutations — los try/catch gemelos de inc/dec (y sus 2 copias de la aritmética) fuera. La nota de lápida {} vive en el helper.
- **shrink leerDocDePlan**: 14 lecturas crudas del doc convertidas al helper (RainChecks, sanConnectivity, rainwaterRows ×2, waterRowsCore, rainDownpipesRows, buildBajanteGraph, closeValidation, prefetchTrazos, useWaterNetworkGraph, geometry, useFlowLl ya lo envolvía). Imports muertos limpiados detrás.
- **shrink diag**: bloque __cfDiag/__cfScale (~110L) fuera de useFixtureMirrors → `fixtures/diagnosticoDev.ts` con `instalarDiagnosticoDev()` (gate DEV dentro). El hook queda con sus 3 efectos.
- **Tope fixtureMirrors** 410 → 425 (la foto de propio de F-1 añadió líneas legítimas).
- Gates: guardias 22/22 · tsc 0 · lint 0 · vitest 682/682 · build + prerender 13/13.

## Session Summary — 2026-10-22 (panel Equipo a producción con datos de ejemplo)
- **/empresa en PRODUCCIÓN**: mientras `SUSCRIPCIONES_ACTIVAS` esté apagado, la página muestra los DATOS DE EJEMPLO (flow anual 5 puestos/3 miembros, manage semestral 2 puestos/1 miembro) en SOLO LECTURA con banner «Vista de ejemplo» — `PanelSuscripcion(soloLectura, mock)` corta TODOS los RPCs (cero escrituras a BD). Con el flag activo el bloque desaparece solo y la página usa los planes reales (nada que borrar).
- **/empresa-preview BORRADA** (ruta DEV + lazy + `CompanyPreviewPage.tsx`): su función vive ahora en el modo ejemplo de CompanyPage.
- Gates: tsc 0 · eslint 0 · arquitectura 11/11 · build + prerender 13/13 ✓.

## Session Summary — 2026-10-23 (auditoría propia: 5 hallazgos, todos cerrados + fixtureMirrors partido)
- **F-1 bis CRÍTICO (ventana del F-1)**: el suelo de propio del clear dependía de la foto que SOLO escribía el pase de espejos — asociar (no alineado) y desasociar ANTES del primer pase caía al fallback de resta completa y borraba los manuales. FIX: el APPLY siembra la foto al asociar (APARATOS_PROPIO_KEY, claves destino = disco actual = propio puro). Test nuevo: apply → clear INMEDIATO sin espejos → {lav:1} sobrevive.
- **F-5: fixtureMirrors PARTIDO** (417L → orquestador de 119L): `salidasEspejo.ts` (96L — espejo de salidas/bomba por REEMPLAZO) + `herenciaCrossFloor.ts` (232L — enlaces entre pisos, libro-solo, parche quirúrgico, foto de propio) + `correrEspejos` como orquestador (guards de piso, PaseEspejos compartido, bomba, montantes, persistencia UNA vez por almacén). Código movido VERBATIM — repros verdes al primer intento. `PaseEspejos` (estado mutable del pase) vive en fixtureMirrorsTypes. Guard: tope fixtureMirrors 430→130, nuevos módulos registrados, entrada de 6 focos fuera (se redistribuyeron <5 por archivo, total igual 531).
- **F-2**: mutarConteo ya no traga fallos de disco — devError con contexto (se pierde al recargar).
- **F-3**: contrato de leerDocDePlan documentado (null también ante JSON roto — prefetchTrazos auto-cura cachés corruptas; antes el string roto contaba como presente).
- **F-4**: instalarDiagnosticoDev() marcado ponytail (side-effect de import intencional, gate DEV, idempotente).
- Gates: guardias 22/22 · tsc 0 · lint 0 · vitest 683/683 · build + prerender 13/13.

## Session Summary — 2026-10-23 (salto del visor muerto + 75 renombres EN + 4 monolitos partidos + JSDoc priorizada)

### F0 — El salto residual del visor (raíz: 3 fórmulas de encuadre conviviendo)
- reEncuadrarContenido (loader, bbox CON dims) → fitPage (switch, HOJA pads 20/36) → encuadrarContenido+bboxDelDibujo (post-raster, bbox SIN dims): la cámara se calculaba DISTINTA tres veces y el camino de caché (switch de piso, sin overlay por diseño) lo mostraba entero — el "muy poco pero se ve".
- FIX: UNA sola fórmula en los 4 sitios (switch de piso, post-raster, pre-paint, botón Ajustar = `eng.reEncuadrarContenido()`); piso sin dibujo cae a la hoja como antes. Lección: el re-fit pre-paint (r54) y el re-encuadre del loader (r58) eran fórmulas hermanas que NO eran la misma — unificar llamadas, no fórmulas.

### F1 — Renombres (ronda final del convenio, 75 archivos + 1 carpeta)
- `diamPulgFromLabel`→`diamInchesFromLabel` (37 imp) · `exportMemoryFinal`→`exportReportFinal` (16) · `compartido`→`shared` · `prefetchTrazos`→`prefetchStrokes` · `medidaTexto`→`measureText` · `ventCodoTeeFix`→`ventElbowTeeFix` · `diametros`→`diameters` · `persistTrazos`→`persistStrokes` · `cargaDiagnostico`→`loadDiagnostics` · `salidasEspejo`→`mirrorOutputs` · `herenciaCrossFloor`→`crossFloorInheritance` · `SecMontantes`→`montantesSection` · `useInfTables`→`useReportTables` · `useTrazosLoader`→`useStrokesLoader` · `trazosDb`→`strokesDb` · `validaDocTrazos`→`validateDocStrokes` · `diagCamara`→`diagCamera` · `infTab`→`reportTab` · `PresupuestosTab`→`BudgetsTab` · `CuadrillasTab`→`CrewsTab` · `rejillasVentilacion/`→`rejillasVentilation/` · +35 tests + `generarBaselineComplexity`→`generateBaselineComplexity` (package.json). NO tocados: edge functions `crear-checkout`/`verificar-pago` (URL VIVA), `useFocusEnDialog` (solo preposición ES), `ApuSection*Insumos` y `rejillasGasodSync` (vocabulario de dominio).
- **LECCIÓN (de nuevo)**: la reescritura de imports por SEGMENTO suelto tocó claves de datos (`id: 'otros'` → `'others'` — 9 archivos de datos dañados). Reparado restaurando desde HEAD + re-pase SOLO specifiers (`from '...' | import('...') | import '...'`). El regex de imports debe anclarse a `from`/`import`, nunca al basename pelado.
- Pines actualizados: architecture.test.ts (8 rutas) · package.json · baselineComplexity.txt regenerado.

### F2 — Desmonotilización (mandato: comportamiento idéntico, código VERBATIM, tsc entre pasos)
- **ProfilePage 997→577**: `shared/ConfirmModal.tsx` (los 3 modales inline ~250 L — borrar CF/CM + logout compacto) · `pages/auth/workspaceHandoff.ts` (`abrirProyectoCf`, secuencia pause→cargar→reset→hand-off→navigate intacta) · `pages/auth/ProjectsSection.tsx` (acordeón por props).
- **DownpipesTable 1001→211**: `downpipes/DownpipesHeader.tsx` (thead 3×23 markup puro) · `downpipes/DownpipesRow.tsx` (fila + 4 editores) · `utils/ventDiameterFanout.ts` (`clavesRamalesVentDeBajantes`, parte pura del fan-out del D vent + test dorado). Fuera el `tramoById` muerto (se construía, jamás se leía).
- **renderRamales 1294→855**: `renderers/ramalLabelText.ts` (`buildRamalLabelParts` pura + test dorado que PINA las rarezas reales: san vacío da `'S P%'` (el guard solo cubre 'S'/'S P% m'), ac/af duplican el prefijo si el dato ya lo trae, pendPart solo san/ll) · `renderers/renderFlowArrows.ts` (flecha del label con recorte contra el trazo + flechas de extremo: desvío/codo reventilado/receptor/vent) · `renderers/renderAparatoSymbols.ts` (cache de imágenes a NIVEL DE MÓDULO — moverla a la función = bucle de re-renders). labelRatchet verde sin edición.
- **handleDragMove 1027→43** (dispatcher): `drags/dragContext` (índices + sameNetGroup san/vent) · `dragMultiSelect` · `dragRamalBody` (segmento ortogonal + traslación con cascada connRamales y Ldesvio) · `dragBajante` (fantasma + auto-conexión, canal excluido) · `dragAnnotations` (9 ramas) · `dragVertex` (snap + propagación BFS por frontera + linkedPts). Invariantes intactos: reasignación de pts sin copias, gates `labelMoved`, early-returns, orden del dispatcher idéntico.
- **Gates F2**: los tests existentes de cada archivo quedaron verdes SIN editarlos; 2 tests dorados nuevos (ventDiameterFanout 3, ramalLabelText 4).

### F3 — JSDoc priorizada (~190 comentarios, CERO lógica — verificado por diff)
- Lógica completa: bajanteAssocShared 13 · crossFloorStorage 14 · planoRowMappers 15 · fixturesStorage 16 · cm calc 10 · channelQueries 7 · guideGeometry 8 · rainwaterRows 7 · fixtureEvents 5 · sanFittingsCatalog 4 · PlanoState callbacks 3.
- Headers de datos: storage-keys (+26 claves) · regulationsData (+27 datasets) · cm types (+20) · seedData 14 · engineeringDataMaterials 20 · defaults 9 · catalogData 9 · styles ×3 · rciNetworkData.
- Higiene: 3 JSDoc-obvio borrados · ~9 siglas expandidas (af/ac/UC/UD/XFG/LD_/scaleM/Q) · @param fuera de no-utils (hook foco, guardaConReintento) · bloques largos recortados (validateDocStrokes 14→5, complexity 14→4, _observarResize 9→2) · ejemplo en bumpBajanteToMaxRamal.

### Cierre (guards hicieron su trabajo)
- G1: bajanteAssocShared (722) entra a CONOCIDOS (las +48 L son JSDoc); techos actualizados: renderRamales 855, DownpipesTable 211.
- G8 regla D (anti-congelación): renderRamales 11→2 focos (salieron con las flechas) → baseline bajado en el mismo commit: TOTAL_FOCOS_BASE 531→522 (39 archivos). El baseline del guard vive en architecture.test.ts (FOCOS_CONOCIDOS); el .txt es solo el dump del script.
- Gates finales: tsc 0 · lint 0 · vitest 1445/1445 (238 archivos) · build + prerender 13/13 · graphify ✓. 8 commits (3a03b420..e0969a5f).

## Session Summary — 2026-10-23bis (BIM/MEP fuera + PdfViewer y PlanoEngine divididos)

### F0 — Civil BIM y Civil MEP FUERA (módulos 100% marketing)
- Rutas /civilbim y /civilmep (13→11 prerenderizadas) · BimHero/MepHero · logos · entradas de moduleData · campos muertos de Feature (tags/highlight/terminal/autoSize) y syncRows · Landing 7→5 tarjetas · Pricing 'Próximamente' · sitemap 11 URLs · llms.txt · index.html sin BIM/MEP (title/og/twitter/JSON-LD/noscript) · webmanifest.
- **vercel.json: redirects 301** /civilbim→/ y /civilmep→/ (URLs indexadas — sin esto, 404s SEO).
- Se QUEDAN: pricingData 'API BIM/ERP' (término genérico), rciNetwork3d (es de civilflow), three.js (civilflow).
- Pendiente usuario: og-image-v2.png trae píldora "BIM" (tarea de diseño).

### F1 — PdfViewer 1529→1313
- `pdfViewer/useViewerDirtySweep.ts` (sweep de aparatos inviables + auto-bump de diámetros, con sus 2 refs de dedupe/supresión) · `useSaveStatusBanner.ts` (4 listeners de error de guardado) · `PdfViewerRightSidebar.tsx` (nivel + copia + paneles de edición).
- Lección de extracción por rango: el botón IZQUIERDO de colapso quedó dentro del rango cortado — detectado por tsc (setLeftCollapsed sin usar) y devuelto verbatim. Cuando se corta por anclas, enumerar TODO lo que vive entre ellas.

### F2 — PlanoEngine 1586→1492 (riesgo ALTO, alcance ajustado)
- `lib/PlanoEngine/snapExisting.ts`: snapToExisting + snapPreviewToPadre como funciones libres; la clase queda con delegados de 2 líneas.
- `planoCamera.ts ptsDeDibujoConDims`: la colección del re-encuadre CON cotas; reEncuadrarContenido delega con el guard de piso vacío INTACTO (fitPage pads 20/36 ≠ encuadrarHoja 16 — sin ese guard cambiaba el encuadre de pisos vacíos).
- **drawingBBox.ts BORRADO** (bboxDelDibujo sin dims, huérfano desde el fix del encuadre unificado — 0 consumidores).
- **ponytail (decisión de riesgo)**: gestos wheel/pinch + setup touch NO extraídos — su estado son campos privados de instancia; moverlos a funciones libres rompería el patrón por ~115 L. PlanoEngine queda 1492 (más los delegados ya existentes).

### Cierre
- Techos G1 actualizados: PdfViewer 1493→1313, PlanoEngine 1425→1492 (el pin viejo estaba rancio). Baseline G8 sin cambios (522 — los módulos nuevos no traen focos).
- Gates finales: tsc 0 · lint 0 · vitest 1445/1445 (238) · build + prerender 11/11 · graphify ✓. 4 commits (cc3420c6..).

## Session Summary — 2026-10-23 (tour de onboarding CivilFlow + CivilManager)
- **Tour spotlight hand-rolled (cero deps)**: `src/components/tour/` — `TourOverlay.tsx` (portal z-999999, "agujero" por box-shadow gigante, card Anterior/Siguiente/Saltar, Escape, re-medición en resize, paso con ancla oculta → card centrada), `tourSteps.ts` (3 tours: cf:visor 6 pasos, cf:workarea 4, cm:workarea 4; textos destilados de helpGuide*), `useTour.tsx` (marca `cardex_tour_<clave>` cruda — sobrevive logout/cambio de proyecto; ≥1024px; `listo` pospone tras pantallas de carga; hook SIEMPRE antes de early returns — rules-of-hooks; arranque vía setTimeout(0) por regla react-compiler de no-setState-síncrono-en-effect; evento EV_TOUR_REPETIR).
- **Anclas**: `data-tour` en planos-pisos/redes/toolbar/canvas/barra-redes + selectores de clase existentes (`.visor-sidebar-right`, `nav.nav`, `.content`, `[aria-label="Secciones de CivilManager"]`, `[aria-label="Catálogos"]`, `.cm-main`) — cero wrappers nuevos.
- **Repetir tour**: enlace `⟲ REPETIR TOUR` al pie de HelpPanel — mapea el contexto de Ayuda (`tourDe`) y dispara el evento; el tour de ESA pantalla remonta al vuelo.
- **Móvil <1024**: no arranca solo (anclas colapsadas) — pendiente si se pide una variante card-only.
- NOTA: prerender ahora 11/11 — correcto: commit cc3420c6 sacó CivilBIM/CivilMEP de ROUTE_META.
- Gates: tsc 0 · eslint 0 · tests relacionados 14/14 (tourSteps 3 + arquitectura 11) · build + prerender 11/11 · graphify ✓.

## Session Summary — 2026-10-23 (tour POR PESTAÑA en cada módulo)
- **De 3 tours → 16**: cada pestaña del workarea flow tiene su recorrido (`cf:tab:<id>` — info/planos/datos/redes/iso/inf/crit, anclado a `data-tour="cf-tab-<id>"` en el root de cada pestaña + `nav.nav`/`barra-redes` ya existentes) y CivilManager por sección/sub (`cm:catalogos:<sub>` ×6 con anclas aria-label/`.cm-main`, `cm:apus`, `cm:presupuestos`). Los tours `cf:workarea`/`cm:workarea` fueron reemplazados por esta familia; el del visor (`cf:visor`) sigue igual.
- **Montaje**: flow dentro de `WorkAreaCivilFlow` (tiene `state.tab`; hook antes de early returns), manager en `WorkAreaCivilManager` (clave = `cm:catalogos:<catalogoTab>` si catálogos, si no `cm:<sección>`). Cambiar de pestaña → si esa pestaña no está vista, su tour arranca; `key={clave}` en el overlay remonta y nace en el paso 1.
- **tourDe**: `cf:<tab>` → `cf:tab:<tab>` (sub-contexto recortado: cf:redes:san → redes; cf:iso:N → iso); `cm:*` viaja completo.
- **useTour**: clave sin tour definido → null (sin crash); reestructura post-lint (useState duplicado, early-return antes de hooks, sin autoFocus, arranque via setTimeout(0)).
- Gates: tsc 0 · eslint 0 · tourSteps 4/4 · arquitectura 11/11 · build + prerender 11/11 · graphify ✓.

## Session Summary — 2026-10-23 (fuera el Glosario de /docs)
- **Sección «Glosario ES ↔ EN» eliminada de /docs**: `docs/data/glossary.tsx` borrado + entrada/import fuera de `docs/data/index.ts` + fuera de la lista Civil Flow en `DocsPage.tsx`. La doc pierde una categoría (12 → 11... alineado con las 11 rutas prerender, casualidad).
- Gates: tsc 0 · eslint 0 · arquitectura+routeMeta 18/18 · build + prerender 11/11 ✓.

## Session Summary — 2026-10-23 (tarjetas del hero CivilFlow: fondo opaco + títulos alineados)
- **Línea/punto amarillo visible a través de las tarjetas**: fondo de tarjeta era `rgba(17,19,23,0.6)` — las líneas decorativas del hero (SVG isométrico) se veían a través. Fix: fondo OPACO `#14161a` (FlowHero.tsx).
- **Textos desalineados**: títulos de 2 líneas («Aguas lluvias», «Contra incendio») empujaban la descripción más abajo que los de 1 línea → `minHeight: 40` en el span del título reserva 2 líneas para todos.
- Gates: tsc 0 · eslint 0 · build + prerender 11/11 ✓.

## Session Summary — 2026-10-23 (tour granular por sección + orden del visor + recorte + catálogo maestro)
- **Visor reordenado (ped. usuario)**: redes y escala → herramientas → lienzo → panel derecho → planos y pisos → cierre.
- **cf:tab:info** suma paso de barra-redes; **cf:tab:planos** granular (pendientes/cargados/recorte con data-tour en las listas y PlanCropPanel); **cf:tab:datos** granular (3 tarjetas: materiales/aparatos/gasodomésticos, data-tour fusionado a la línea className por G1); **cf:tab:redes** granular (chips data-tour=redes-chips + sub-páginas redes-paginas + barra).
- **NUEVO tour cf:catmaestro** para /catalogomaestro (paginación + contenido, montaje en CatalogMasterPage); `data-tour="catmaestro-contenido"` en el contenedor de tablas.
- Gates: tsc 0 · eslint 0 · tourSteps 4/4 · arquitectura 11/11 · build + prerender 11/11 · graphify ✓.

## Session Summary — 2026-10-23 (fases A-C: arnés de tests + subrutas de pestañas)
- **A · Arnés de tests**: `src/test/storageHarness.ts` (resetStorage/seedTrazos/seedAparatos/trazosDe/aparatos — SIEMPRE constantes de storage-keys) + `src/test/engineFixture.ts` (makeEngine única + conUpdateElemento; eran ~117 copias). Migrados: montanteAssociationE2E (stub+seed→arnés), OwnKey/StaleSource (mockStorage obj→localStorage global), propagateAparatosPressure + propagationCharacterization (literal 'aparatos_by_tramo_v2'→constante). **NUEVO** `pisoFantasmaBak.test.ts`: contrato "respaldos bajo trazos_* jamás se propagan" (regresión del piso fantasma; seed OJO: seedAparatos REEMPLAZA el mapa — una sola llamada).
- **B/C · Subrutas**: `/civilflowareatrabajo/*` y `/civilmanagerareatrabajo/*` (splat). `workarea/tabRoute.ts`: parseFlowSplat/parseManagerSplat/rutaFlow/rutaManager (uuid↔sección por formato, TABS_VALIDOS/CM_SECCIONES/CM_CATALOGOS). Flow: tab inicial desde URL (useWorkAreaState(tabInicial, onTabChange) — onTabChange sincroniza URL en cada cambio), redirect cosmético y post-switch PRESERVAN la pestaña; banner legacy desde parse (legacyId); visor sigue top-level; OPEN_TAB_KEY queda como fallback deprecado (lectura one-shot intacta). Manager: mainSection/catalogoTab nacen de URL y setters navegan (back/adelante funcionan); redirects de página/dialog/perfil preservan sub-segmento.
- **Claves de tour/ayuda intactas** (cf:tab:<id>, cm:catalogos:<sub>) — marcas localStorage no se invalidan.
- Gates: tsc 0 · eslint 0 · relacionados 16/16 · build + prerender 11/11 · graphify ✓.

## Session Summary — 2026-10-23 (tour: recorte/requisitos/redes-paginas/iso ×5 + Volver)
- **cf:tab:planos de IZQ→DER**: requisitos (nuevo, data-tour en sidebar izquierda) → recorte → pendientes → cargados.
- **redes-paginas**: data-tour en los 4 PageNav de networksTab (solo el de la red activa está en DOM) — el paso "Sub-secciones" ahora SÍ resalta.
- **Isometría POR SUBPESTAÑA**: cf:tab:iso:1..5 (Redes/Aparatos/Cuarto bombas RCI/EPC/RCI), cada una con data-tour="iso-contenido" en el wrapper del visor 3D; IsometryTab monta useTour(`cf:tab:iso:${sub}`); tourDe mapea cf:iso:N → cf:tab:iso:N; la clave genérica cf:tab:iso SALIÓ de TOURS (el shell devuelve null → sin doble overlay).
- **PlanCropModal**: botón «Cancelar» → «Volver».
- Gates: tsc 0 · eslint 0 · tourSteps 4/4 · arquitectura 11/11 · build + prerender 11/11 ✓.

## Session Summary — 2026-10-23 (slugs de subruta explícitos + /dibujoRedes)
- **URLs de pestañas legibles (ped. usuario)**: map `TAB_SLUGS` en tabRoute.ts — informacionGeneral/cargaPlanos/parametrosDiseno/dibujoRedes/disenoRedes/isometria/informes/normativa. Los IDS internos NO cambian (state/tour/ayuda/sessionStorage intactos); el slug vive SOLO en la ruta (tabDeSplat rev-map + rutaFlow fwd-map).
- **/visor → /dibujoRedes** (ruta top-level del visor): route + navegadores (WorkAreaSidebar, PlanosTab ×2, ViewerPage redirects) + legacy redirect `/visor/*` → `/dibujoRedes` + preload.js acepta ambas.
- Gates: tsc 0 · eslint 0 · relacionados 15/15 · build + prerender 11/11 ✓.

## Session Summary — 2026-10-23 (salto residual: la marca espera al ÚLTIMO raster)
- **Causa del residuo**: `marcarPrimerPisoCargado` corría al terminar la CARGA DE TRAZOS, pero la corrección de escala dispara un re-raster DESPUÉS (evento EVENTO_ESCALA_CAMBIADA → renderPage → re-encuadre) — el velo se levantaba y ese re-encuadre se veía. Fix: la marca vive ahora en `renderPage` al completar CADA raster completo (no bgOnly, idempotente) — el velo de primera entrada espera al último raster. La marca salió del loader; `calentarPdfs` con 0 archivos marca directo (nada se moverá jamás).
- G1: PdfViewerEngineInit 714/717 (comentarios comprimidos; el bloque de re-encuadre lo reescribió la sesión paralela — respetado).
- Gates: tsc 0 · eslint 0 · arquitectura 11/11 · build + prerender 11/11 ✓.

## Session Summary — 2026-10-23 (tour PROPIO del editor de recorte)
- **cf:recorte** (3 pasos): gestos (data-tour=recorte-gestos en los chips del header) → dibuja el recorte (recorte-canvas) → aplicar o salir (recorte-acciones). El modal lo monta con useTour: corre SOLO la primera vez que se abre el editor + botón «⟲ Tour» en el header del modal lo repite (el AYUDA de la navbar es inaccesible con el modal a pantalla completa). El overlay z-999999 queda sobre el modal z-1000.
- El "Repetir tour" de HelpPanel en carga de planos sigue lanzando el tour de la pestaña (correcto); el recorte tiene ahora el suyo dentro del modal.
- Gates: tsc 0 · eslint 0 · relacionados 15/15 · build + prerender 11/11 ✓.

## Session Summary — 2026-10-23 (fix: el paso «Requisitos del plano» resaltaba también el recorte)
- El ancla `planos-requisitos` estaba en el div de la sidebar izquierda que TAMBIÉN envuelve a PlanCropPanel (el recorte vive dentro de ella) → el spotlight cubría ambas zonas. Fix: header+lista de requisitos envueltos en un wrapper propio (flex column) con el ancla; el recorte queda fuera del spotlight.
- G1: PlanosTab 711/712.
- Gates: tsc 0 · eslint 0 · arquitectura 11/11 · build + prerender 11/11 ✓.
