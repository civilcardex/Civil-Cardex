/**
 * Núcleo de E/S del almacenamiento de trazos entre pisos: tipos compartidos, lectura/escritura
 * cruda del JSON por piso y helpers de ghosts/Ldesvio. Punto del grafo SIN dependencias hacia
 * los consumidores (associateBajanteAcrossFloors y assocLayoutMigration importan solo desde
 * aquí) — existe para que no haya ciclos de importación entre módulos hermanos.
 */
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX, TRAZOS_PLAN_PREFIX } from '../constants/storage-keys';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes';
import { devError } from '../../../utils/devError';

export type { CrossFloorGhost };

/** ¿Existe la caché local del piso? Los escritores de este módulo hacen load→mutar→save SIN
 *  merge: si la caché no existe, guardar fabricaría un documento casi vacío que el RPC
 *  destructivo (save_plano_data borra y re-inserta TODAS las colecciones) persistiría en BD —
 *  borrado del piso (orig. usuario: "todo se borró excepto un piso"). Sin caché no se escribe:
 *  el prefetch/visor descarga el piso de BD primero y el flujo se reintenta con datos reales. */
export function hasCachedPlan(planId: string | number): boolean {
  try {
    return localStorage.getItem(TRAZOS_PLAN_PREFIX + String(planId)) != null;
  } catch {
    return true; // sin localStorage accesible: no bloquear (comportamiento previo)
  }
}

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

/** Lee el JSON crudo de trazos de un piso (vacío si no existe) — uso interno y de la migración. */
export function loadData(planId: string | number): LocalGhostDrawingData {
  const raw = loadFromStorage<LocalGhostDrawingData | null>(TRAZOS_PREFIX + planId, null);
  return raw || {};
}

/** Escribe el JSON crudo de trazos de un piso (localStorage + BD) — uso interno y de la migración. */
export function saveData(planId: string | number, data: LocalGhostDrawingData): void {
  data.ts = Date.now();
  saveToStorage(TRAZOS_PREFIX + planId, data);
  saveTrazosToDB(String(planId), data);
}

// Escribe (o reemplaza, si ya existe uno del mismo origen) un fantasma entre pisos en el
// almacenamiento crudo del piso DESTINO — el piso destino no necesita estar cargado/activo.
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
export function ldesvioIdFor(sourceBajanteId: string): string {
  return `LD_${sourceBajanteId}`;
}

// Predicado compartido — un ramal conector Ldesvio es una ayuda de dibujo propiedad de su
// bajante origen (id `LD_<bajanteId>`), no una tubería hidráulica. Todo constructor de tablas,
// escáner de conectividad y pase de renumeración debe excluirlo, o se filtra a las tablas de
// diseño como un tramo falso (y el pase de renumeración incluso lo renombra a un `RS\d+` con
// apariencia real).
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
      let dirty = false;
      for (let j = 0; j < data.crossFloorGhosts.length; j++) {
        const g = data.crossFloorGhosts[j];
        if (
          g.sourcePlanId === sp &&
          g.sourceBajanteId === sourceBajanteId &&
          (g.x !== x || g.y !== y)
        ) {
          data.crossFloorGhosts[j] = { ...g, x, y };
          dirty = true;
        }
      }
      if (dirty) saveData(targetPlanId, data);
    } catch {
      continue;
    }
  }
}
