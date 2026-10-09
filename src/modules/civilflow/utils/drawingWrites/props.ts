import { writeHydroDrawingSync, writeSanDrawingSync } from '../drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService';
import { TRAZOS_PREFIX, HYDRO_FAMILIES, SAN_FAMILIES } from '../../constants/storage-keys';
import type { SyncPlanInput, RawElement } from '../drawingSync';
import { diamPulgFromLabel } from '../diamPulgFromLabel';
import { punterosBajante } from './diametros';

/** Mismo write de diámetro para VARIOS ramales con UN solo load+save del doc por plano
 *  afectado + UN RPC por plano: el select "D ventilación propuesto" llamaba
 *  writeDiametroToDrawing por cada ramal conectado (N parses del doc completo + N RPCs por
 *  UNA interacción de la tabla). Sin espejo ni validación de accesorios — los ramales vent
 *  conectados heredan el diámetro del bajante y su validación vive en el caller. */
// Reentrancia del espejo de diámetros: el write de la pareja no vuelve a espejar.
let espejoEnCurso = false;

interface LocalDrawingData {
  ts?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

export function writeDiametroToDrawingBatch(
  ramalKeys: string[],
  net: string,
  newDiamLabel: string,
  plans: SyncPlanInput[],
): void {
  if (!ramalKeys.length || !net || !plans) return;
  const isVent = net === 'vent';
  const porPlan = new Map<string, string[]>();
  for (const key of ramalKeys) {
    const sep = key.lastIndexOf('-');
    const rid = sep > 0 ? key.slice(0, sep) : key;
    const pid = sep > 0 ? key.slice(sep + 1) : '';
    if (!rid || !pid) continue;
    const lista = porPlan.get(pid) ?? [];
    lista.push(rid);
    porPlan.set(pid, lista);
  }
  for (const [pid, ids] of porPlan) {
    const raw = loadFromStorage<Record<string, unknown> | null>(TRAZOS_PREFIX + pid, null);
    if (!raw) continue;
    const doc = raw as Record<string, unknown> & { ramales?: Array<Record<string, unknown>> };
    let dirty = false;
    for (const r of doc.ramales || []) {
      if (!ids.includes(String(r.id))) continue;
      r.diametro = newDiamLabel;
      if (isVent) r.diamPulg = diamPulgFromLabel(newDiamLabel);
      dirty = true;
    }
    if (!dirty) continue;
    (doc as { ts?: number }).ts = Date.now();
    saveToStorage(TRAZOS_PREFIX + pid, doc);
    void saveTrazosToDB(pid, doc as never);
  }
  try {
    writeSanDrawingSync(plans);
  } catch {
    /* sync best-effort (vent ∈ SAN_FAMILIES) */
  }
}

/** Escribe una propiedad de bajante (Llenado, D propuesto…) al doc de trazos del piso + BD,
 *  y ESPEJA dNominal al bajante asociado del otro piso. LÍMITE (documentado): NO toca un
 *  engine vivo de OTRA ventana — si el visor tiene el piso abierto en otra pestaña, su
 *  autosave (saveWork completo, sin comparación de ts) puede pisar esta escritura; en una
 *  sola ventana lo salva el desmonte mutuo visor↔tablas. */
export function writeBajantePropToDrawing(
  bajanteKey: string,
  net: string,
  prop: string,
  val: unknown,
  plans: SyncPlanInput[],
) {
  if (!bajanteKey || !net || !plans) return;
  const isHydro = HYDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  const parts = bajanteKey.split('-');
  const bajanteId = parts[0];
  const planId = parts[1];

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    let changed = false;

    for (const b of data.bajantes || []) {
      if (b.id === bajanteId && b.net === net) {
        b[prop] = val;
        changed = true;
      }
    }

    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }

  if (isHydro) writeHydroDrawingSync(plans);
  if (isSan) writeSanDrawingSync(plans);

  // Espejo de diámetros entre pisos (orig. usuario): al cambiar dNominal de un bajante
  // asociado entre pisos, su pareja (descargaEnId/origenId → "planId|id") copia el mismo
  // diámetro en SU piso. Guard de valor ya igual corta el bucle bidireccional.
  // También al LIMPIAR ('' = sin diámetro): si solo se espeja al asignar, la pareja del
  // otro piso conserva el valor viejo y las tablas de ambos pisos divergen.
  if (prop === 'dNominal' && !espejoEnCurso && val !== undefined && val !== null && planId) {
    const punteros = punterosBajante(String(planId), bajanteId);
    const partner = punteros.descargaEnId || punteros.origenId;
    const pipe = partner ? partner.indexOf('|') : -1;
    if (partner && pipe > 0) {
      const pPlan = partner.slice(0, pipe);
      const pId = partner.slice(pipe + 1);
      if (pId && !(String(pPlan) === String(planId) && pId === bajanteId)) {
        const rawP = loadFromStorage<{
          bajantes?: { id: string; dNominal?: unknown; net?: string; recibeDeIds?: string[] }[];
          ramales?: { id?: string; net?: string; diametro?: string }[];
        } | null>(TRAZOS_PREFIX + pPlan, null);
        const pareja = rawP?.bajantes?.find((x) => x.id === pId);
        if (pareja && pareja.net === net && pareja.dNominal !== val) {
          // Doctrina ll "auto-sube" en el piso DESTINO también: si el valor espejado deja a
          // la pareja por debajo del máximo de SUS ramales conectados, se sube al máximo en
          // vez de espejar el menor (el guard del menú ya impide el gesto en origen; aquí es
          // red de seguridad para valores que llegan por tabla/otra ventana).
          let valPareja: unknown = val;
          if (net === 'll' && val) {
            const valIn = diamPulgFromLabel(String(val).replace(/-/g, ' '));
            let maxRamIn = 0;
            for (const rid of pareja.recibeDeIds ?? []) {
              const ram = rawP?.ramales?.find((r) => r.id === rid);
              if (!ram?.diametro) continue;
              const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
              if (ramIn > maxRamIn) maxRamIn = ramIn;
            }
            if (valIn > 0 && maxRamIn > valIn) valPareja = pareja.dNominal ?? val;
          }
          espejoEnCurso = true;
          try {
            writeBajantePropToDrawing(`${pId}-${pPlan}`, net, 'dNominal', valPareja, plans);
          } finally {
            espejoEnCurso = false;
          }
        }
      }
    }
  }
}

/** Escribe el MATERIAL de un ramal en los trazos (caché + BD). Sin validaciones ni
 *  propagaciones: el material no afecta a otros tramos; K y diámetro interior se derivan
 *  en la tabla vía lookupDn. Los diámetros de subida/bajada de material los maneja la tabla. */
export function writeMaterialToDrawing(
  ramalKey: string,
  net: string,
  newMat: string,
  plans: SyncPlanInput[],
): void {
  if (!ramalKey || !net || !plans) return;
  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + String(plan.id);
    const data = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!data) continue;
    let changed = false;
    for (const r of data.ramales || []) {
      if (r.id !== ramalId || r.net !== net) continue;
      if ((r.material || '') !== newMat) {
        r.material = newMat;
        changed = true;
      }
      break;
    }
    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }
}

/** Limpia el diámetro del ramal en los trazos (caché + BD). Espejo de
 *  writeMaterialToDrawing: se usa cuando el dn actual no existe en el material
 *  nuevo y la tabla espera re-selección — el trazo no debe quedar con el dn viejo. */
export function clearDiametroToDrawing(
  ramalKey: string,
  net: string,
  plans: SyncPlanInput[],
): void {
  if (!ramalKey || !net || !plans) return;
  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + String(plan.id);
    const data = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!data) continue;
    let changed = false;
    for (const r of data.ramales || []) {
      if (r.id !== ramalId || r.net !== net) continue;
      if (r.diametro) {
        r.diametro = '';
        changed = true;
      }
      break;
    }
    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }
}
