import { writeHydroDrawingSync, writeSanDrawingSync } from '../drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService';
import {
  TRAZOS_PREFIX,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
  APARATOS_BY_TRAMO_KEY,
  CHEQUEOS_PRESION_KEY,
} from '../../constants/storage-keys';
import type { SyncPlanInput, RawElement } from '../drawingSync';
import { diamPulgFromLabel } from '../diamPulgFromLabel';
import { pisoLbl } from '../../constants/helpers';

/** Parte una clave "id-planId" por el ÚLTIMO guion (los ids pueden traer guiones,
 *  ej. stubs `AC-01-X-P1` — `split('-')` los truncaba en silencio).
 *  @param key - clave compuesta.
 *  @returns par [id, planId] (planId '' si no hay guion). */
export function parseBajanteKey(key: string): [string, string] {
  const sep = key.lastIndexOf('-');
  if (sep <= 0) return [key, ''];
  return [key.slice(0, sep), key.slice(sep + 1)];
}
import { inchPartOfDiametro as inchPartOf } from '../../lib/PlanoEngine/drawingUtils';
import { INODORO_APP_ID, sanDiamAllowedForApparatus } from '../sanitaryDiamCompat';
import { bumpConnectedBajantes } from '../../lib/PlanoEngine/PlanoEngineSelectionEdit';
import { recomputeDownstreamDiameters } from '../../lib/PlanoEngine/drawingUtils';
import {
  convergirDiametroNodoPresion,
  propagarSanDiametroAguasAbajo,
} from '../../lib/PlanoEngine/drawingFlow';

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
  objetivo?: { planId: string | number; id: string },
): { planId: string | number; bajante: RawElement } | null {
  // Objetivo explícito: resolver SOLO esa fila (planId+id) — sin él, el primer contador del
  // proyecto ganaba y con ≥2 contadores el diámetro se escribía en el piso equivocado.
  if (objetivo) {
    for (const plan of plans) {
      if (!plan || plan.status !== 'confirmed') continue;
      if (String(plan.id) !== String(objetivo.planId)) continue;
      const raw = loadFromStorage<LocalDrawingData | null>(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      const bajante = (raw.bajantes || []).find(
        (b) => b.tipo === 'contador' && b.net === net && b.id === objetivo.id,
      );
      if (bajante) return { planId: plan.id, bajante };
    }
    return null;
  }
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
// viola una restricción. La única vigente: accesorio más ancho que el tubo (el bloqueo
// salida/entrada de redes de presión se retiró — los vecinos convergen al mayor).
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

  const [ramalId, planId] = parseBajanteKey(ramalKey);

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
          // Ítem 6/7/8: regla central (inodoro → 4" mínimo)
          if (net === 'san' && newIn > 0 && !sanDiamAllowedForApparatus(newIn, INODORO_APP_ID)) {
            const apKeySan = `${net}_${r.id}_${plan.id}`;
            const aparatosSan = loadFromStorage<Record<string, Record<string, number>>>(
              APARATOS_BY_TRAMO_KEY,
              {},
            );
            const countsSan = aparatosSan[apKeySan] || {};
            if ((countsSan['san'] || 0) > 0) {
              blockedReason = {
                ok: false,
                reason: 'accessory-larger',
                accessoryDiam: '4" — 100 mm',
                accessoryEnd: 'INICIO',
                attemptedDiam: newDiamLabel,
              };
              continue;
            }
          }
          const accMax = maxAccessoryDiam(r);
          if (newIn > 0 && accMax > 0 && newIn < accMax) {
            // Informar CUÁL extremo bloquea: el accesorio máximo puede ser el de FIN aunque el
            // de INICIO sea menor, y mostrarlo era el origen de las alertas "imposibles" — el
            // usuario veía el diámetro del extremo equivocado en el mensaje.
            const dI = r.diametroInicio || '';
            const dF = r.diametroFin || '';
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
            continue;
          }
        }
        const oldDiamLabel = r.diametro || '';
        r.diametro = newDiamLabel;
        changed = true;
        // Ítems 5+6: re-resolver receptores aguas abajo desde la topología actual. San/ll
        // (trib→ramal/trib y troncos partidos): propagarSanDiametroAguasAbajo — receptor =
        // mayor de SUS llegadores cuando todos tienen diámetro (la tabla escribe DIRECTO al
        // storage sin pasar por updateElementById, así que sin esta llamada la propagación
        // nunca corría desde la tabla — orig. usuario: RS3 vacío no heredaba de RS1/RS2).
        // Resto de redes: recomputeDownstreamDiameters (mergesFrom).
        if (data.ramales) {
          const before = (data.ramales || []).map((x) => `${x.id}=${x.diametro || ''}`).join('|');
          if (net === 'san' || net === 'll') {
            propagarSanDiametroAguasAbajo(
              data.ramales as unknown as Parameters<typeof propagarSanDiametroAguasAbajo>[0],
              r.id,
              (data.bajantes || []) as Array<{ recibeDeIds?: string[]; alimentaIds?: string[] }>,
            );
          } else {
            // Presión: los vecinos de la conexión suben al mayor (sin bloqueo — orig.
            // usuario, espejo del motor).
            convergirDiametroNodoPresion(
              data.ramales as unknown as Parameters<typeof convergirDiametroNodoPresion>[0],
              r.id,
            );
            recomputeDownstreamDiameters(data.ramales, r.id);
          }
          const after = (data.ramales || []).map((x) => `${x.id}=${x.diametro || ''}`).join('|');
          if (after !== before) changed = true;
          // Chequeos persistidos (Informes): diámetro de presión cambiado → presionOk/vel
          // stale en ESTA red y en sus vecinos (la convergencia arrastra) → invalidar todo
          // el mapa de la red; Informes muestra "(sin verificar)" hasta re-visitar Diseño.
          if (after !== before && (net === 'af' || net === 'ac')) {
            const prevCheq = loadFromStorage<Record<string, unknown>>(CHEQUEOS_PRESION_KEY, {});
            if (prevCheq[net]) {
              delete prevCheq[net];
              saveToStorage(CHEQUEOS_PRESION_KEY, prevCheq);
            }
          }
        }
        // El bajante/montante sigue al mayor diámetro de sus ramales en ambas direcciones.
        // MISMA regla que el motor (bumpConnectedBajantes compartido): asociación explícita
        // recibeDeIds + alimentaIds o geométrica. Antes esta ruta solo miraba recibeDeIds y
        // el montante no seguía al ramal al editar el diámetro desde la tabla (orig. usuario:
        // debe ser en tiempo real). El label de nivel resuelve desplazamientos[lvl] — sin él
        // la geométrica compara contra la posición cruda y falla con anillos entrepisos.
        const bajBefore = (data.bajantes || []).map((b) => `${b.id}=${b.dNominal || ''}`).join('|');
        bumpConnectedBajantes(
          data.ramales || [],
          data.bajantes || [],
          plan.nivel != null ? pisoLbl(Number(plan.nivel)) : '',
          r.id,
          oldDiamLabel,
          newDiamLabel,
        );
        const bajAfter = (data.bajantes || []).map((b) => `${b.id}=${b.dNominal || ''}`).join('|');
        if (bajAfter !== bajBefore) changed = true;
        // VENT (orig. usuario): el diámetro del ramal de ventilación es BIDIRECCIONAL con la
        // tabla "Bajantes de aguas negras y ventilación" — espejar al BREV conectado
        // (dNominal + diamPulg; la tabla lee diamPulg como "D vent propuesto").
        if (net === 'vent' && newDiamLabel) {
          const newPulg = diamPulgFromLabel(newDiamLabel.replace(/-/g, ' '));
          for (const b of data.bajantes || []) {
            if (b.net !== 'vent') continue;
            const conectado =
              b.id === r.ini ||
              b.id === r.fin ||
              r.ini === b.code ||
              r.fin === b.code ||
              (b.recibeDeIds || []).includes(r.id);
            if (!conectado) continue;
            if (b.dNominal !== newDiamLabel) {
              b.dNominal = newDiamLabel;
              changed = true;
            }
            if (newPulg > 0 && b.diamPulg !== newPulg) {
              b.diamPulg = newPulg;
              changed = true;
            }
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

/** Fila editada explícita (planId+bajanteId): sin ella caía al primer contador (mal piso con 2+). */
export function writeContadorDiamToDrawing(
  val: string,
  plans: SyncPlanInput[],
  net: string,
  objetivo?: { planId: string | number; id: string },
): void {
  if (!plans) return;
  const found = findContadorBajante(plans, net, objetivo);
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

/** Lee los punteros de asociación (descargaEnId/origenId) de un bajante desde SU doc de
 *  trazos, sin depender del engine. Formato de puntero: "planId|id". */
export function punterosBajante(
  planId: string,
  bajanteId: string,
): {
  descargaEnId?: string | null;
  origenId?: string | null;
} {
  const raw = loadFromStorage<{
    bajantes?: { id: string; descargaEnId?: string | null; origenId?: string | null }[];
  } | null>(TRAZOS_PREFIX + planId, null);
  const b = raw?.bajantes?.find((x) => x.id === bajanteId);
  return { descargaEnId: b?.descargaEnId, origenId: b?.origenId };
}

/** Valida dNominal nuevo entre pisos (el inferior nunca menor que el superior; espejo siempre pasa). */
export function validarDiametroEntrePisos(
  planId: string,
  bajanteId: string,
  nuevoDiamLabel: string,
  punterosVivos?: { descargaEnId?: string | null; origenId?: string | null },
): { ok: true } | { ok: false; titulo: string; mensaje: string } {
  const nuevo = diamPulgFromLabel(nuevoDiamLabel.replace(/-/g, ' '));
  if (!(nuevo > 0)) return { ok: true };
  const guardados = punterosBajante(planId, bajanteId);
  const descargaEnId = punterosVivos?.descargaEnId ?? guardados.descargaEnId;
  const origenId = punterosVivos?.origenId ?? guardados.origenId;
  const roles: Array<{ ptr: string; soyInferior: boolean }> = [];
  if (origenId && origenId.includes('|')) roles.push({ ptr: origenId, soyInferior: true });
  if (descargaEnId && descargaEnId.includes('|'))
    roles.push({ ptr: descargaEnId, soyInferior: false });
  for (const { ptr, soyInferior } of roles) {
    const pipe = ptr.indexOf('|');
    const pPlan = ptr.slice(0, pipe);
    const pId = ptr.slice(pipe + 1);
    if (!pId) continue;
    const rawP = loadFromStorage<{
      bajantes?: { id: string; dNominal?: unknown }[];
    } | null>(TRAZOS_PREFIX + pPlan, null);
    const pareja = rawP?.bajantes?.find((x) => x.id === pId);
    const parLabel = typeof pareja?.dNominal === 'string' ? pareja.dNominal : '';
    const par = parLabel ? diamPulgFromLabel(parLabel.replace(/-/g, ' ')) : 0;
    if (!(par > 0)) continue;
    if (soyInferior && nuevo < par) {
      return {
        ok: false,
        titulo: 'Diámetro menor que el superior',
        mensaje: `El bajante ${bajanteId} (piso inferior) quedaría en ${nuevoDiamLabel} menor que el superior ${pId} (${parLabel}). El inferior no puede tener menor diámetro.`,
      };
    }
    if (!soyInferior && nuevo > par) {
      return {
        ok: false,
        titulo: 'Diámetro mayor que el inferior',
        mensaje: `El bajante ${bajanteId} (piso superior) quedaría en ${nuevoDiamLabel} mayor que el inferior ${pId} (${parLabel}). El inferior no puede tener menor diámetro.`,
      };
    }
  }
  return { ok: true };
}
