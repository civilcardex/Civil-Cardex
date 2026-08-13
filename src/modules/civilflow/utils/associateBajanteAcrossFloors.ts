import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX, TRAZOS_PLAN_PREFIX } from '../constants/storage-keys';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes';
export type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes';
export { enrichCrossFloorGhosts } from './crossFloorGhosts';

interface LocalLdesvioRamal {
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

interface LocalGhostDrawingData {
  ts?: number;
  crossFloorGhosts?: CrossFloorGhost[];
  [key: string]: unknown;
}

function loadData(planId: string | number): LocalGhostDrawingData {
  const raw = loadFromStorage<LocalGhostDrawingData | null>(TRAZOS_PREFIX + planId, null);
  return raw || {};
}

function saveData(planId: string | number, data: LocalGhostDrawingData): void {
  data.ts = Date.now();
  saveToStorage(TRAZOS_PREFIX + planId, data);
  saveTrazosToDB(String(planId), data);
}

// Escribe (o reemplaza, si ya existe uno del mismo origen) un fantasma entre pisos en el
// almacenamiento crudo del piso DESTINO — el piso destino no necesita estar cargado/activo.
export function writeCrossFloorGhost(targetPlanId: string | number, ghost: CrossFloorGhost): void {
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
  sourcePlanId: string | number,
  sourceBajanteId: string,
): void {
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

// Quita un bajante/montante por completo del almacenamiento propio de un piso (posiblemente no
// cargado) — se usa para borrar en cascada el OTRO extremo de una asociación entre pisos cuando
// se borra un lado.
export function deleteBajanteFromStorage(planId: string | number, bajanteId: string): void {
  const data = loadData(planId) as LocalGhostDrawingData & { bajantes?: { id: string }[] };
  if (!data.bajantes?.length) return;
  const before = data.bajantes.length;
  data.bajantes = data.bajantes.filter((b) => b.id !== bajanteId);
  if (data.bajantes.length === before) return;
  saveData(planId, data);
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
export function nextRamalLabel(
  net: string,
  existingRamales: Array<{ id?: string; label?: string }>,
): string {
  const netDef = NETS.find((n) => n.id === net);
  const prefix = netDef?.lbl || 'R';
  const re = new RegExp('^' + prefix + '(\\d+)$');
  let maxN = 0;
  for (const r of existingRamales) {
    const m = (r.id || r.label)?.match(re);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
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
  const data = loadData(planId) as LocalGhostDrawingData & {
    ramales?: LocalLdesvioRamal[];
    scaleM?: number;
  };
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
  const data = loadData(planId) as LocalGhostDrawingData & { ramales?: LocalLdesvioRamal[] };
  const id = ldesvioIdFor(sourceBajanteId);
  const before = (data.ramales || []).length;
  data.ramales = (data.ramales || []).filter((r) => r.id !== id);
  if (data.ramales.length === before) return;
  saveData(planId, data);
}

// Actualiza el punto final LEJANO (pts[1], la posición del destino) del conector Ldesvio de un
// bajante origen, dondequiera que esté el piso propio del conector — se llama después de que se
// mueve el bajante DESTINO (no el origen), porque el conector vive en el piso del origen y no se
// puede alcanzar por el engine vivo cuando es un plano distinto y no cargado.
export function updateCrossFloorLdesvioFarEndpoint(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  x: number,
  y: number,
): void {
  const data = loadData(sourcePlanId) as LocalGhostDrawingData & {
    ramales?: LocalLdesvioRamal[];
    scaleM?: number;
  };
  const id = ldesvioIdFor(sourceBajanteId);
  const idx = (data.ramales || []).findIndex((r) => r.id === id);
  if (idx === -1) return;
  const r = data.ramales![idx];
  const [x1, y1] = r.pts[0];
  if (Math.abs(r.pts[1][0] - x) < 0.01 && Math.abs(r.pts[1][1] - y) < 0.01) return;
  data.ramales![idx] = buildLdesvioRamal(
    id,
    r.label || id,
    r.net,
    x1,
    y1,
    x,
    y,
    r.diametro,
    Number(r.piso) || 0,
    data.scaleM || 0.5,
    r.bloqueado,
  );
  saveData(sourcePlanId, data);
}

interface StoredDesplazamientoBajante {
  id: string;
  x?: number;
  y?: number;
  desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
}

// Re-ancla el marcador de "círculo desplazado" (desplazamientos) en el bajante del piso ORIGEN
// después de que se mueve el bajante DESTINO (en otro piso, posiblemente no cargado): el marcador
// debe quedar en la posición proyectada del destino, así que dx/dy cambian exactamente en el
// delta del movimiento del destino. Barre la entrada de desplazamiento por el id de su conector
// Ldesvio (único por bajante origen), misma estrategia de búsqueda por clave que
// removeBajanteDesplazamientoFromStorage — sin esto, el anillo punteado en el piso origen se
// quedaba pegado en la posición que tenía al crear la asociación y visualmente "perdía" la
// conexión una vez que se arrastraba el destino a otro lado.
export function updateCrossFloorDesplazamientoBySource(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  targetX: number,
  targetY: number,
): void {
  const data = loadData(sourcePlanId) as LocalGhostDrawingData & {
    bajantes?: StoredDesplazamientoBajante[];
  };
  if (!data.bajantes?.length) return;
  const b = data.bajantes.find((x) => x.id === sourceBajanteId);
  if (!b?.desplazamientos) return;
  const ldId = ldesvioIdFor(sourceBajanteId);
  let changed = false;
  const desp = { ...b.desplazamientos };
  for (const lvlKey of Object.keys(desp)) {
    if (desp[lvlKey]?.Ldesvio === ldId) {
      desp[lvlKey] = {
        ...desp[lvlKey],
        dx: targetX - (b.x ?? 0),
        dy: targetY - (b.y ?? 0),
      };
      changed = true;
    }
  }
  if (!changed) return;
  b.desplazamientos = desp;
  saveData(sourcePlanId, data);
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

// El id/código de un bajante se reescribe cuandoquiera que corre _renumberBajantes
// (networkRenumber.ts) — p. ej. después de borrar CUALQUIER bajante de la misma red/piso, cerrando
// el hueco de numeración. Toda referencia cruzada entre pisos se ancla en ese id (el id del ramal
// Ldesvio es `LD_<id>`, el `sourceBajanteId`/`targetBajanteId` del fantasma espejo, y el puntero
// `descargaEnId`/`origenId` del otro lado, formato `${planId}|${id}`) — nada de eso se actualiza
// con el rename simple, así que un bajante renumerado que tenía una asociación entre pisos
// activa deja huérfano su propio Ldesvio/fantasma para siempre: toda búsqueda posterior
// (incluida la desasociación) calcula la clave con el id ACTUAL del bajante y simplemente nunca
// encuentra el viejo, así que nunca se limpia.
// Se llama una vez por id cambiado, justo después del rename, desde _renumberBajantes.
export function renameBajanteAcrossFloorReferences(
  thisPlanId: string,
  oldId: string,
  newId: string,
): void {
  if (oldId === newId) return;
  const oldLd = ldesvioIdFor(oldId);
  const newLd = ldesvioIdFor(newId);
  const oldPointer = `${thisPlanId}|${oldId}`;
  const newPointer = `${thisPlanId}|${newId}`;

  // Almacenamiento del piso propio: el ramal Ldesvio (si este bajante es origen entre pisos), la
  // auto-referencia de desplazamientos que lo acompaña, y cualquier extremo de ramal (ini/fin)
  // que todavía tenga el código viejo.
  const own = loadData(thisPlanId) as LocalGhostDrawingData & {
    ramales?: (LocalLdesvioRamal & { ini?: string; fin?: string })[];
    bajantes?: StoredDesplazamientoBajante[];
  };
  let ownDirty = false;
  for (const r of own.ramales || []) {
    if (r.id === oldLd) {
      r.id = newLd;
      ownDirty = true;
    }
    if (r.ini === oldId) {
      r.ini = newId;
      ownDirty = true;
    }
    if (r.fin === oldId) {
      r.fin = newId;
      ownDirty = true;
    }
  }
  for (const b of own.bajantes || []) {
    if (!b.desplazamientos) continue;
    for (const lvlKey of Object.keys(b.desplazamientos)) {
      if (b.desplazamientos[lvlKey]?.Ldesvio === oldLd) {
        b.desplazamientos[lvlKey] = { ...b.desplazamientos[lvlKey], Ldesvio: newLd };
        ownDirty = true;
      }
    }
  }
  if (ownDirty) saveData(thisPlanId, own);

  // Almacenamiento de cualquier otro piso: el fantasma espejo que este bajante escribió (como
  // origen) — id y sourceBajanteId — y cualquier puntero descargaEnId/origenId apuntando a
  // `${thisPlanId}|${oldId}` (cubre a este bajante como destino de descarga del origen de otro
  // piso, o como origen al que el destino de otro piso apunta de vuelta).
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const otherPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (otherPlanId === thisPlanId) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const data = JSON.parse(raw) as LocalGhostDrawingData & {
        bajantes?: { descargaEnId?: string | null; origenId?: string | null }[];
      };
      let dirty = false;
      for (const g of data.crossFloorGhosts || []) {
        if (g.sourcePlanId === thisPlanId && g.sourceBajanteId === oldId) {
          g.sourceBajanteId = newId;
          g.id = `XFG_${newId}_${thisPlanId}`;
          dirty = true;
        }
        if (g.targetBajanteId === oldId) {
          g.targetBajanteId = newId;
          dirty = true;
        }
      }
      for (const b of data.bajantes || []) {
        if (b.descargaEnId === oldPointer) {
          b.descargaEnId = newPointer;
          dirty = true;
        }
        if (b.origenId === oldPointer) {
          b.origenId = newPointer;
          dirty = true;
        }
      }
      if (dirty) saveData(otherPlanId, data);
    } catch {
      continue;
    }
  }
}
