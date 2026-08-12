import { writeHydroDrawingSync, writeSanDrawingSync } from './drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX, HYDRO_FAMILIES, SAN_FAMILIES } from '../constants/storage-keys';
import type { SyncPlanInput, RawElement } from './drawingSync';
import { diamPulgFromLabel } from './diamPulgFromLabel';
import { maxDiametroLabel } from '../lib/PlanoEngine/PlanoEngineDrawing';

interface LocalDrawingData {
  ts?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

// diametroInicio/diametroFin se guardan como el VALOR COMPLETO de la opción del dropdown de
// diámetro, p. ej. `1-1/2" — 42.7 mm` — todo lo demás que los lee (ExtremeAccessoryEditor.tsx,
// DrawingElementContextMenu.tsx) recorta primero hasta la parte en pulgadas antes del `"`. Sin
// eso, el manejo propio de guion-em de diamPulgFromLabel entra en acción y lee la cifra en *mm*
// después del guion como si fueran pulgadas (42.7 en vez de 1.5) — un número salvajemente
// inflado que hacía que cada chequeo real contra él fuera o imposiblemente estricto o un falso
// negativo dependiendo del lado de la comparación donde cayera. Esto era por qué la validación
// nunca se disparaba visiblemente: `newIn` (un valor real en pulgadas) se comparaba contra
// `accMax` calculado de milímetros.
const inchPartOf = (d: string): string => {
  const q = d.indexOf('"');
  return q > 0 ? d.slice(0, q) : d;
};

// Mayor diámetro equivalente en pulgadas de cualquier accesorio extremo en este ramal
// (accesorioInicio / accesorioFin). Los marcadores accMed* de mitad de ramal no llevan su propio
// diámetro, así que no pueden restringir el ramal. Devuelve 0 si no hay accesorio con diámetro
// adjunto.
function maxAccessoryDiam(ramal: {
  accesorioInicio?: string;
  accesorioFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
}): number {
  let max = 0;
  if (ramal.accesorioInicio && ramal.diametroInicio) {
    max = Math.max(max, diamPulgFromLabel(inchPartOf(ramal.diametroInicio)));
  }
  if (ramal.accesorioFin && ramal.diametroFin) {
    max = Math.max(max, diamPulgFromLabel(inchPartOf(ramal.diametroFin)));
  }
  return max;
}

export function findContadorBajante(
  plans: SyncPlanInput[],
  net: string,
): { planId: string | number; bajante: RawElement } | null {
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    const bajante = (data.bajantes || []).find((b) => b.tipo === 'contador' && b.net === net);
    if (bajante) return { planId: plan.id, bajante };
  }
  return null;
}

// Tipo de resultado para que el caller de la tabla de diseño (GasDesign, WaterNetworkDesign,
// etc.) pueda mostrar el AlertDialog de la app en vez de un rechazo silencioso cuando el cambio
// viola una restricción.
export interface WriteDiametroResult {
  ok: boolean;
  reason?: 'accessory-larger';
  accessoryDiam?: string;
  accessoryEnd?: 'INICIO' | 'FIN';
  attemptedDiam?: string;
}

export function writeDiametroToDrawing(
  ramalKey: string,
  net: string,
  newDiamLabel: string,
  plans: SyncPlanInput[],
): WriteDiametroResult {
  if (!ramalKey || !net || !plans) return { ok: false };
  const isHydro = HYDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];

  // Validación: el diámetro de un ramal no puede bajar del diámetro mayor de cualquier accesorio
  // adjunto a él. Espejo del chequeo inverso en ExtremeAccessoryEditor.tsx:110-117 — sin esto,
  // las páginas de tabla de diseño pueden encoger una tubería bajo un accesorio más ancho sin
  // que nadie lo note hasta la rareza en tiempo de render (el accesorio de ajuste más ancho
  // termina dibujado alrededor de una tubería más delgada).
  let blockedReason: WriteDiametroResult | null = null;

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    let changed = false;

    for (const r of data.ramales || []) {
      if (r.id === ramalId && r.net === net) {
        if (newDiamLabel) {
          const newIn = diamPulgFromLabel(newDiamLabel.replace(/-/g, ' '));
          const accMax = maxAccessoryDiam(r as unknown as Parameters<typeof maxAccessoryDiam>[0]);
          if (newIn > 0 && accMax > 0 && newIn < accMax) {
            // Informar CUÁL extremo bloquea: el accesorio máximo puede ser el de FIN aunque el
            // de INICIO sea menor, y mostrarlo era el origen de las alertas "imposibles" — el
            // usuario veía el diámetro del extremo equivocado en el mensaje.
            const dI = (r as unknown as { diametroInicio?: string }).diametroInicio || '';
            const dF = (r as unknown as { diametroFin?: string }).diametroFin || '';
            const inpI = dI ? diamPulgFromLabel(inchPartOf(dI)) : 0;
            const inpF = dF ? diamPulgFromLabel(inchPartOf(dF)) : 0;
            const extremo = inpI >= inpF ? 'INICIO' : 'FIN';
            const accDiam = inpI >= inpF ? dI : dF;
            blockedReason = {
              ok: false,
              reason: 'accessory-larger',
              accessoryDiam: accDiam,
              accessoryEnd: extremo,
              attemptedDiam: newDiamLabel,
            };
            // eslint-disable-next-line no-console
            console.warn('[writeDiametroToDrawing] bloqueo', { extremo, accDiam });
            continue;
          }
        }
        r.diametro = newDiamLabel;
        changed = true;
        // Propagar a cualquier ramal aguas abajo auto-creado por un merge de tee-split DESDE este —
        // espejo del paseo en canvas de DrawingElementContextMenu.tsx:1949-1969. El diametro del
        // hijo solo se calcula en tiempo de creación, así que editar un padre desde una página de
        // tabla de diseño debe re-resolverlo o el ramal fusionado conserva su diámetro obsoleto
        // en storage.
        for (const child of data.ramales || []) {
          if (!child.mergesFrom || !child.mergesFrom.includes(r.id)) continue;
          const [pid1, pid2] = child.mergesFrom;
          const d1 =
            pid1 === r.id
              ? newDiamLabel
              : (data.ramales || []).find((p) => p.id === pid1)?.diametro || '';
          const d2 =
            pid2 === r.id
              ? newDiamLabel
              : (data.ramales || []).find((p) => p.id === pid2)?.diametro || '';
          const newChildDiam = maxDiametroLabel(d1, d2);
          if (newChildDiam && newChildDiam !== child.diametro) {
            child.diametro = newChildDiam;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }

  if (blockedReason) return blockedReason;

  if (isHydro) writeHydroDrawingSync(plans);
  if (isSan) writeSanDrawingSync(plans);
  return { ok: true };
}

export function writeContadorDiamToDrawing(val: string, plans: SyncPlanInput[], net: string): void {
  if (!plans) return;
  const found = findContadorBajante(plans, net);
  if (!found) return;
  const key = TRAZOS_PREFIX + found.planId;
  const raw = loadFromStorage<LocalDrawingData | null>(key, null);
  if (!raw) return;
  const data = raw;

  const baj = (data.bajantes || []).find((b) => b.id === found.bajante.id);
  if (baj) {
    baj.dNominal = val;
  }

  data.ts = Date.now();
  saveToStorage(key, data);
  saveTrazosToDB(String(found.planId), data);
  if (HYDRO_FAMILIES.has(net)) writeHydroDrawingSync(plans);
  if (SAN_FAMILIES.has(net)) writeSanDrawingSync(plans);
}

export function writeAcoDiamToDrawing(val: string, plans: SyncPlanInput[], net: string): void {
  if (!plans) return;
  const found = findContadorBajante(plans, net);
  if (!found) return;
  const key = TRAZOS_PREFIX + found.planId;
  const raw = loadFromStorage<LocalDrawingData | null>(key, null);
  if (!raw) return;
  const data = raw;
  const baj = (data.bajantes || []).find((b) => b.id === found.bajante.id);
  if (baj) {
    baj.acoDiam = val;
    data.ts = Date.now();
    saveToStorage(key, data);
    saveTrazosToDB(String(found.planId), data);
    if (HYDRO_FAMILIES.has(net)) writeHydroDrawingSync(plans);
    if (SAN_FAMILIES.has(net)) writeSanDrawingSync(plans);
  }
}

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
}
