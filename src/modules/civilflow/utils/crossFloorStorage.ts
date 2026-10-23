/** E/S de trazos entrepisos por piso (XFG (fantasma entrepisos)/LD_ (ramal desvio entrepisos) sin ciclos de import). */
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService.ts';
import { devError } from '../../../utils/devError.ts';
import { PLANS_META_KEY, TRAZOS_PREFIX, TRAZOS_PLAN_PREFIX } from '../constants/storage-keys.ts';
import { NETS } from '../lib/PlanoEngine/PlanoState.ts';
import type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes.ts';

export type { CrossFloorGhost };

/** ¿Hay copia guardada de este piso en el navegador? Si NO la hay no se escribe nada: el guardado es destructivo y borraría el piso entero. */
export function hasCachedPlan(planId: string | number): boolean {
  try {
    return localStorage.getItem(TRAZOS_PLAN_PREFIX + String(planId)) != null;
  } catch {
    return true; // sin localStorage accesible: no bloquear (comportamiento previo)
  }
}

/** Origen de calibración guardado DENTRO del dibujo del piso (vía vieja; hoy se prefiere origenDePlan, que mira primero los metadatos). */
export function origenDeTrazos(planId: string): { x_px: number; y_px: number } | null {
  try {
    const raw = loadFromStorage<{ origen?: { x_px?: number; y_px?: number } | null } | null>(
      TRAZOS_PREFIX + planId,
      null,
    );
    const o = raw?.origen;
    return o && typeof o.x_px === 'number' && typeof o.y_px === 'number'
      ? { x_px: o.x_px, y_px: o.y_px }
      : null;
  } catch {
    return null;
  }
}

/** Punto físico que se marcó como origen al calibrar la lámina de este piso: gracias a él se compara el mismo punto del edificio entre pisos aunque las láminas estén corridas. */
export function origenDePlan(planId: string): { x_px: number; y_px: number } | null {
  try {
    const meta = loadFromStorage<
      Array<{ id: number | string; origen?: { x_px?: number; y_px?: number } | null }>
    >(PLANS_META_KEY, []);
    const om = meta.find((p) => String(p.id) === String(planId))?.origen;
    if (om && typeof om.x_px === 'number' && typeof om.y_px === 'number')
      return { x_px: om.x_px, y_px: om.y_px };
  } catch {
    // meta corrupto: caer al doc
  }
  return origenDeTrazos(planId);
}

/** Convierte un punto del "mundo" de un piso al de otro (restando el origen de cada uno); si algún piso no tiene origen marcado, lo devuelve igual. */
export function aFrameDe(
  pt: { x: number; y: number },
  fromPlanId: string,
  toPlanId: string,
): { x: number; y: number } {
  const oF = origenDePlan(fromPlanId);
  const oT = origenDePlan(toPlanId);
  if (!oF || !oT) return pt;
  return { x: pt.x - oF.x_px + oT.x_px, y: pt.y - oF.y_px + oT.y_px };
}

/** Ramal LD_ (ramal desvio entrepisos) tal como se guarda en el doc del piso: geometría de
 *  2 puntos, etiqueta visible, diámetro y bandera `bloqueado` (no se arrastra ni renumera como
 *  una tubería real). Ej: { id:'LD_BAN1', label:'RAF4', bloqueado:true }. */
export interface LocalLdesvioRamal {
  id: string;
  net: string;
  tipo: 'ramal';
  padre: null;
  pts: number[][];
  totalL: number;
  label: string;
  ini: string;
  fin: string;
  piso: string;
  dz: string;
  uc: number;
  labelX: number;
  labelY: number;
  labelAngle: number;
  material: string;
  diametro: string;
  pendiente: number;
  bloqueado: boolean;
}

// Bajante tal como viaja en el JSON de trazos — solo los campos que este módulo lee/escribe;
// el resto de propiedades del elemento viajan junto al objeto sin declararse aquí.
/** Bajante del doc guardado, recortado a lo que este módulo toca: posición, código visible,
 *  punteros entre pisos (descargaEnId/origenId), anillo de desplazamientos y datos de etiqueta
 *  del fantasma. Ej: BAN1 con origenId 'BAN2' apuntando al piso de arriba. */
export interface StoredBajante {
  id: string;
  x?: number;
  y?: number;
  code?: string;
  nptBase?: number;
  pisoBase?: string;
  descargaEnId?: string | null;
  origenId?: string | null;
  desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
  ghostData?: Record<string, { direccion?: string; labelX?: number; labelY?: number }>;
}

/** Doc de dibujo COMPLETO de un piso (la clave `civilflow_trazos_<id>`): timestamp del último
 *  guardado, layout de asociación, scaleM (escala metros por pixel) y las colecciones —
 *  fantasmas XFG (fantasma entrepisos), ramales (incluidos los LD_) y bajantes. Se lee y se
 *  guarda entero. */
export interface LocalGhostDrawingData {
  ts?: number;
  // Marca de versión del layout de asociación (2 = layout nuevo: fantasma+Ldesvio en el
  // piso inferior). La migración la escribe y la usa como guard de idempotencia.
  assocLayout?: number;
  scaleM?: number;
  crossFloorGhosts?: CrossFloorGhost[];
  ramales?: LocalLdesvioRamal[];
  bajantes?: StoredBajante[];
}

/** Lee el dibujo guardado de un piso (lo que se ve en el canvas: ramales, bajantes, fantasmas…). Devuelve vacío si el piso no tiene nada guardado. */
export function loadData(planId: string | number): LocalGhostDrawingData {
  const raw = loadFromStorage<LocalGhostDrawingData | null>(TRAZOS_PREFIX + planId, null);
  return raw || {};
}
/** Guarda el dibujo de un piso en el navegador Y en la base de datos. */
export function saveData(planId: string | number, data: LocalGhostDrawingData): void {
  data.ts = Date.now();
  saveToStorage(TRAZOS_PREFIX + planId, data);
  saveTrazosToDB(String(planId), data);
}

/** Si la copia de la nube llegó sin las piezas de asociación, las recupera de la copia local (los XFG (fantasma entrepisos), LD_ (ramal desvio entrepisos) y anillos que sí están guardados). */
export function restaurarAsociacionesDesdeLocal<T extends object>(local: unknown, db: T): boolean {
  if (typeof local === 'string') {
    try {
      local = JSON.parse(local);
    } catch {
      return false;
    }
  }
  if (!local || typeof local !== 'object') return false;
  const l = local as LocalGhostDrawingData & { ts?: number };
  const d = db as {
    /** Fecha en que se desasoció (corta la recuperación desde copias viejas). */
    asocsClearedTs?: number;
    crossFloorGhosts?: Array<{ id: string }>;
    ramales?: Array<{ id: string }>;
    bajantes?: Array<{
      id?: string;
      desplazamientos?: Record<string, unknown>;
      ghostData?: Record<string, unknown>;
    }>;
  };
  // GATE por marca: si la BD registra una desasociación POSTERIOR a la caché local
  // (local.ts < asocsClearedTs), esas piezas fueron borradas legítimamente DESPUÉS de que
  // la caché se copiara — no resucitar. Sin marca, o caché más nueva que la marca
  // (edición posterior a la desasociación), restaurar: blind-spot layout-2 sigue cubierto.
  if (typeof d.asocsClearedTs === 'number') {
    const lts = typeof l.ts === 'number' ? l.ts : 0;
    if (lts < d.asocsClearedTs) return false;
  }
  let changed = false;
  // Fantasmas XFG que faltan en BD.
  const lGhosts = l.crossFloorGhosts || [];
  if (lGhosts.length) {
    const dbIds = new Set((d.crossFloorGhosts || []).map((g) => g.id));
    const faltan = lGhosts.filter((g) => !dbIds.has(g.id));
    if (faltan.length) {
      d.crossFloorGhosts = [...(d.crossFloorGhosts || []), ...faltan];
      changed = true;
    }
  }
  // Ramales Ldesvio que faltan en BD.
  const lLds = (l.ramales || []).filter((r) => isLdesvioRamalId(r.id));
  if (lLds.length) {
    const dbRamIds = new Set((d.ramales || []).map((r) => r.id));
    const faltan = lLds.filter((r) => !dbRamIds.has(r.id));
    if (faltan.length) {
      d.ramales = [...(d.ramales || []), ...faltan];
      changed = true;
    }
  }
  // Anillo (desplazamientos) + ghostData por bajante.
  for (const lb of l.bajantes || []) {
    if (!lb.desplazamientos || Object.keys(lb.desplazamientos).length === 0) continue;
    const dbB = (d.bajantes || []).find((x) => x.id === lb.id);
    if (!dbB) {
      // Chain 2: la BD ni siquiera tiene el bajante (renumerado/escrito desde otro
      // dispositivo) — copiarlo COMPLETO desde la caché local, anillo incluido; sin esto
      // el anillo se perdía y el sweep borraba el LD_ huérfano.
      d.bajantes = [...(d.bajantes || []), { ...lb }];
      changed = true;
      continue;
    }
    const dbKeys = Object.keys(dbB.desplazamientos || {});
    const lKeys = Object.keys(lb.desplazamientos);
    if (lKeys.some((k) => !dbKeys.includes(k))) {
      dbB.desplazamientos = { ...lb.desplazamientos, ...(dbB.desplazamientos || {}) };
      if (lb.ghostData) dbB.ghostData = { ...lb.ghostData, ...(dbB.ghostData || {}) };
      changed = true;
    }
  }
  return changed;
}

// Escribe (o reemplaza, si ya existe uno del mismo origen) un fantasma entre pisos en el
// almacenamiento crudo del piso DESTINO — el piso destino no necesita estar cargado/activo.
/** Deja el marcador XFG (fantasma entrepisos) del bajante origen en el piso DESTINO, escribiendo
 *  directo a su storage (ese piso no necesita estar abierto). Reemplaza uno previo del mismo
 *  origen. Ej: asociar BAN1-P1 → P2 deja en el piso 2 el marcador que muestra 'BAN1 · 4 UC'. */
export function writeCrossFloorGhost(targetPlanId: string | number, ghost: CrossFloorGhost): void {
  if (!hasCachedPlan(targetPlanId)) {
    devError(
      `[ASSOC] ghost a piso ${targetPlanId} sin caché local: no se escribe (evita fabricar doc vacío sobre BD)`,
    );
    return;
  }
  const data = loadData(targetPlanId);
  const list = (data.crossFloorGhosts || []).filter(
    (g) => !(g.sourcePlanId === ghost.sourcePlanId && g.sourceBajanteId === ghost.sourceBajanteId),
  );
  list.push(ghost);
  data.crossFloorGhosts = list;
  saveData(targetPlanId, data);
}

// Quita cualquier fantasma que este bajante origen específico haya puesto en `targetPlanId` — se
// usa al re-asociar a otro piso (o limpiar la asociación) para que un fantasma viejo no se quede
// en el piso que ya no es el destino.
/** Quita del piso destino el XFG (fantasma entrepisos) puesto por ese bajante origen — al
 *  re-asociar o desasociar, el marcador no debe quedarse en un piso que ya no es el destino. */
export function removeCrossFloorGhost(
  targetPlanId: string | number,
  sourcePlanId: string | number,
  sourceBajanteId: string,
): void {
  const data = loadData(targetPlanId);
  const list = (data.crossFloorGhosts || []).filter(
    (g) => !(g.sourcePlanId === String(sourcePlanId) && g.sourceBajanteId === sourceBajanteId),
  );
  if (list.length === (data.crossFloorGhosts || []).length) return;
  data.crossFloorGhosts = list;
  saveData(targetPlanId, data);
}

// Recorre el localStorage de TODOS los pisos y quita cualquier fantasma entre pisos que
// referencie al bajante origen dado. Se llama cuando se borra un bajante — los fantasmas viejos
// en otros pisos deben limpiarse.
/** Barrido por TODOS los pisos guardados que quita los XFG (fantasma entrepisos) de un bajante
 *  borrado — sin esto, el marcador huérfano quedaba dibujado en cada piso que lo espejaba. */
export function removeCrossFloorGhostsBySource(
  sourcePlanId: string | number | null,
  sourceBajanteId: string,
): void {
  if (sourcePlanId == null) return;
  const sp = String(sourcePlanId);
  // saveToStorage prefija las claves de localStorage con 'civilflow_', así que TRAZOS_PREFIX
  // ('trazos_') se vuelve 'civilflow_trazos_' (== TRAZOS_PLAN_PREFIX) en el almacenamiento real.
  // Se itera por clave completa prefijada para ubicar los datos de trazado de cada piso y
  // despojarlos de los fantasmas que coincidan.
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const targetPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (targetPlanId === sp) continue; // same floor, skip
    try {
      const data: LocalGhostDrawingData = JSON.parse(localStorage.getItem(k) || '{}');
      if (!data.crossFloorGhosts?.length) continue;
      const before = data.crossFloorGhosts.length;
      data.crossFloorGhosts = data.crossFloorGhosts.filter(
        (g) => !(g.sourcePlanId === sp && g.sourceBajanteId === sourceBajanteId),
      );
      if (data.crossFloorGhosts.length === before) continue;
      saveData(targetPlanId, data);
    } catch {
      continue;
    }
  }
}

// Id determinista para el conector Ldesvio de un bajante origen — uno por origen, siempre
// sobrescribible al re-ejecutar create con el mismo sourceBajanteId, y removible directo por id
// sin tener que buscar/adivinar qué número secuencial de ramal le tocó. Deliberadamente NO tiene
// la forma `${netPrefix}\d+` (ver la regex de conteo de PlanoPersistence.ts al cargar), así
// nunca consume un número de ramal real.
/** Id determinista del conector LD_ (ramal desvio entrepisos) de un bajante origen:
 *  `LD_<bajanteId>` — siempre el mismo, así se reemplaza o borra directo sin adivinar qué
 *  número de ramal le tocó. Ej: el LD_ de BAN1 siempre es 'LD_BAN1'. */
export function ldesvioIdFor(sourceBajanteId: string): string {
  return `LD_${sourceBajanteId}`;
}

// Predicado compartido — un ramal conector Ldesvio es una ayuda de dibujo propiedad de su
// bajante origen (id `LD_<bajanteId>`), no una tubería hidráulica. Todo constructor de tablas,
// escáner de conectividad y pase de renumeración debe excluirlo, o se filtra a las tablas de
// diseño como un tramo falso (y el pase de renumeración incluso lo renombra a un `RS\d+` con
// apariencia real).
/** ¿Es un conector LD_ (ramal desvio entrepisos) y no una tubería real? Tablas, conteo de
 *  aparatos y renumeración lo excluyen. Ej: 'LD_BAN1' → true, 'RS12' → false. */
export function isLdesvioRamalId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('LD_');
}

// El `id` del Ldesvio es una clave estable y determinista (para buscar/limpiar) — su `label` (lo
// que realmente se imprime en el dibujo) debe leerse como el de cualquier otro ramal, p. ej.
// "R12", o imprime el id interno crudo ("LD_BAN1...") en el plano. Espeja el mismo escaneo que
// hace `PlanoPersistence.ts` al cargar: máximo `${prefix}N` existente para esta red, +1 — pero
// solo entre ramales REALES (nunca otro Ldesvio, que de entrada nunca coincide con ese patrón,
// así que no hace falta exclusión especial).
// IMPORTANTE: se escanean id Y label — el id del LD (`LD_BAN1`) nunca coincide con el patrón,
// así que mirar solo el id dejaba sus labels fuera del conteo y cada LD nuevo repetía el
// número (varios LD con "RS1"). Los allocators de ramales reales ya miran ambos.
/** Siguiente etiqueta libre para un ramal de la red (máximo existente + 1, mirando id Y label)
 *  — el LD_ (ramal desvio entrepisos) imprime esta etiqueta, no su id interno.
 *  @param net - id de la red (su definición trae el prefijo: af → 'RAF', san → 'RS'…).
 *  @param existingRamales - ramales ya existentes en el piso.
 *  @returns la etiqueta; p. ej. en af existiendo RAF1 y RAF3 → 'RAF4'. */
export function nextRamalLabel(
  net: string,
  existingRamales: Array<{ id?: string; label?: string }>,
): string {
  const netDef = NETS.find((n) => n.id === net);
  const prefix = netDef?.lbl || 'R';
  const re = new RegExp('^' + prefix + '(\\d+)$');
  let maxN = 0;
  for (const r of existingRamales) {
    for (const cand of [r.id, r.label]) {
      const m = (cand || '')?.match(re);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
  }
  return `${prefix}${maxN + 1}`;
}

/** Construye el objeto del ramal LD_ (ramal desvio entrepisos) listo para guardar: 2 puntos,
 *  largo real calculado con scaleM (escala metros por pixel), etiqueta perpendicular al tramo y
 *  pendiente estándar 2%. Puro — no toca storage ni engine; el caller decide dónde guardarlo. */
export function buildLdesvioRamal(
  id: string,
  label: string,
  net: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  diametro: string,
  pisoNivel: number,
  scaleM: number,
  bloqueado: boolean = true,
): LocalLdesvioRamal {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distPx = Math.hypot(dx, dy);
  let lblAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (lblAngle > 90) lblAngle -= 180;
  if (lblAngle < -90) lblAngle += 180;
  const perpX = -dy / (distPx || 1);
  const perpY = dx / (distPx || 1);
  return {
    id,
    net,
    tipo: 'ramal',
    padre: null,
    pts: [
      [x1, y1],
      [x2, y2],
    ],
    totalL: +((distPx / 96) * 2.54 * scaleM).toFixed(3),
    label,
    ini: '',
    fin: '',
    piso: String(pisoNivel),
    dz: '',
    uc: 0,
    labelX: (x1 + x2) / 2 + perpX * 25,
    labelY: (y1 + y2) / 2 + perpY * 25,
    labelAngle: Math.round(lblAngle),
    material: '',
    diametro: diametro || '',
    pendiente: 2,
    bloqueado,
  };
}

// Crea (o reemplaza, si ya existe uno del mismo origen) el ramal conector "Ldesvio" en el piso
// PROPIO del bajante ORIGEN — la contraparte visual del fantasma escrito en el piso destino: el
// fantasma muestra dónde llega la tubería, este ramal muestra el desvío (posiblemente diagonal)
// que recorre antes de llegar, en el piso al que el desvío pertenece. Escribe directo al
// almacenamiento de ese piso — apropiado cuando ese piso NO es el cargado actualmente (el caller
// debe empujar al engine.ramales vivo en su lugar, cuando lo es, para que el autosave no pise
// esto).
/** Crea (o reemplaza) el ramal LD_ (ramal desvio entrepisos) del bajante origen en su propio
 *  piso: el desvío —a veces diagonal— que la tubería recorre antes de llegar al fantasma del
 *  otro piso. Ej: BAN1 baja en diagonal hacia el XFG del piso 2 → queda 'LD_BAN1' con su label. */
export function createCrossFloorLdesvioRamal(
  planId: string | number,
  sourceBajanteId: string,
  net: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  diametro: string,
  pisoNivel: number,
): void {
  if (!hasCachedPlan(planId)) {
    devError(
      `[ASSOC] Ldesvio a piso ${planId} sin caché local: no se escribe (evita fabricar doc vacío sobre BD)`,
    );
    return;
  }
  const data = loadData(planId);
  const id = ldesvioIdFor(sourceBajanteId);
  const existing = (data.ramales || []).find((r) => r.id === id);
  const label = existing?.label || nextRamalLabel(net, data.ramales || []);
  const ramal = buildLdesvioRamal(
    id,
    label,
    net,
    x1,
    y1,
    x2,
    y2,
    diametro,
    pisoNivel,
    data.scaleM || 0.5,
    existing ? existing.bloqueado : true,
  );
  data.ramales = [...(data.ramales || []).filter((r) => r.id !== id), ramal];
  saveData(planId, data);
}

// Quita el conector Ldesvio determinista del bajante origen dado del almacenamiento propio de
// `planId` — se usa al limpiar/re-apuntar una asociación para que el ramal de desvío viejo no
// quede rondando.
/** Borra el ramal LD_ (ramal desvio entrepisos) de ese bajante origen del piso dado — al limpiar
 *  o re-apuntar una asociación, el desvío viejo no debe quedar rondando el dibujo. */
export function removeCrossFloorLdesvioRamal(
  planId: string | number,
  sourceBajanteId: string,
): void {
  const data = loadData(planId);
  const id = ldesvioIdFor(sourceBajanteId);
  const before = (data.ramales || []).length;
  data.ramales = (data.ramales || []).filter((r) => r.id !== id);
  if (data.ramales.length === before) return;
  saveData(planId, data);
}

// Barre el localStorage de TODOS los pisos por fantasmas entre pisos cuyo `sourceBajanteId`
// coincida con el padre dado y actualiza un solo campo en cada uno. Se llama cuando cambia el
// diámetro o la dirección del bajante padre — sin esto el fantasma espejo en el piso destino
// sigue leyendo el valor viejo.
/** Propaga un cambio del bajante origen (diámetro o dirección) a TODOS los XFG (fantasma
 *  entrepisos) que lo espejan en otros pisos. Ej: BAN1 pasa a dNominal '4"' → cada marcador
 *  espejo se actualiza (si no, seguiría mostrando el diámetro viejo en el otro piso). */
export function updateCrossFloorGhostFieldBySource(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  field: 'dNominal' | 'parentDireccion',
  value: string,
): void {
  const sp = String(sourcePlanId);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const targetPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (targetPlanId === sp) continue; // mismo piso, salta — el bajante padre se actualiza ahí directo
    try {
      const data: LocalGhostDrawingData = JSON.parse(localStorage.getItem(k) || '{}');
      if (!data.crossFloorGhosts?.length) continue;
      let dirty = false;
      for (let j = 0; j < data.crossFloorGhosts.length; j++) {
        const g = data.crossFloorGhosts[j];
        if (g.sourcePlanId === sp && g.sourceBajanteId === sourceBajanteId) {
          const current = (g as unknown as Record<string, unknown>)[field];
          if (current !== value) {
            data.crossFloorGhosts[j] = { ...g, [field]: value };
            dirty = true;
          }
        }
      }
      if (dirty) saveData(targetPlanId, data);
    } catch {
      continue;
    }
  }
}

// Barre el localStorage de TODOS los pisos por un fantasma entre pisos cuyo `sourceBajanteId`
// coincida con el bajante ORIGEN dado y actualiza su x/y — se llama después de que ese bajante
// termina de arrastrarse en su propio piso, para que un fantasma que lo espeja en otro piso
// (creado vía el selector "Destino" o "Origen" — ambos dependen de descargaEnId/sourceBajanteId
// igual) no se quede pegado en su posición de creación.
/** Tras arrastrar el bajante origen, mueve sus XFG (fantasma entrepisos) espejos en los demás
 *  pisos. Los (x, y) llegan en el frame del piso origen y se traducen al de cada destino
 *  (aFrameDe) — sin traducirlos, el marcador quedaba corrido entre hojas desalineadas. */
export function updateCrossFloorGhostPositionBySource(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  x: number,
  y: number,
): void {
  const sp = String(sourcePlanId);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const targetPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (targetPlanId === sp) continue;
    try {
      const data: LocalGhostDrawingData = JSON.parse(localStorage.getItem(k) || '{}');
      if (!data.crossFloorGhosts?.length) continue;
      // (x,y) llegan en el frame del piso origen: traducirlos al frame de CADA piso destino
      // — los ghosts viven en el frame de su anfitrión (misma regla que bajanteAssociation
      // al crearlos; sin esto, arrastrar el bajante origen desplazaba el ghost espejo).
      const xy = aFrameDe({ x, y }, sp, targetPlanId);
      let dirty = false;
      for (let j = 0; j < data.crossFloorGhosts.length; j++) {
        const g = data.crossFloorGhosts[j];
        if (
          g.sourcePlanId === sp &&
          g.sourceBajanteId === sourceBajanteId &&
          (g.x !== xy.x || g.y !== xy.y)
        ) {
          data.crossFloorGhosts[j] = { ...g, x: xy.x, y: xy.y };
          dirty = true;
        }
      }
      if (dirty) saveData(targetPlanId, data);
    } catch {
      continue;
    }
  }
}
