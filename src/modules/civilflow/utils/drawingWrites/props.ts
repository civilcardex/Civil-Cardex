import { writeHydroDrawingSync, writeSanDrawingSync } from '../dibujoSync.ts';
import {
  loadFromStorage,
  saveToStorage,
  saveTrazosToDB,
} from '../../services/almacenamientoServicio.ts';
import {
  TRAZOS_PREFIX,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
} from '../../constants/almacenamientoClaves.ts';
import type { SyncPlanInput, RawElement } from '../dibujoSync.ts';
import { diamPulgFromLabel } from '../diamPulgFromEtiqueta.ts';
import { punterosBajante, validarDiametroEntrePisos, parseBajanteKey } from './diametros';
import { avisarDiametroInvalido } from '../diametroValidacion.ts';

/** Diámetro a varios ramales con un solo load+save por plano (ruta batch del D vent propuesto). */
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

/** Escribe prop del bajante al doc + BD y espeja dNominal al asociado del otro piso (false si bloqueó). */
export function writeBajantePropToDrawing(
  bajanteKey: string,
  net: string,
  prop: string,
  val: unknown,
  plans: SyncPlanInput[],
): boolean {
  if (!bajanteKey || !net || !plans) return false;
  const isHydro = HYDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  const [bajanteId, planId] = parseBajanteKey(bajanteKey);

  // Regla entre pisos: el inferior no puede quedar con menor diámetro que el superior.
  // Se valida ANTES de escribir (alerta modal + no se permite); el espejo (igual) pasa.
  if (prop === 'dNominal' && typeof val === 'string' && val && planId && !espejoEnCurso) {
    const v = validarDiametroEntrePisos(String(planId), bajanteId, val);
    if (!v.ok) {
      avisarDiametroInvalido(v.mensaje, v.titulo);
      return false;
    }
  }

  let escrito = false;
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
      escrito = true;
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
  return escrito;
}

/** Escribe material del ramal al doc + BD (K y diámetro interior se derivan en la tabla). */
export function writeMaterialToDrawing(
  ramalKey: string,
  net: string,
  newMat: string,
  plans: SyncPlanInput[],
): void {
  if (!ramalKey || !net || !plans) return;
  const [ramalId, planId] = parseBajanteKey(ramalKey);
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

/** Limpia el diámetro del ramal (fuerza re-selección cuando el dn no existe en el material nuevo). */
export function clearDiametroToDrawing(
  ramalKey: string,
  net: string,
  plans: SyncPlanInput[],
): void {
  if (!ramalKey || !net || !plans) return;
  const [ramalId, planId] = parseBajanteKey(ramalKey);
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
