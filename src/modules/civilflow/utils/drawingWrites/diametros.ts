import { writeHydroDrawingSync, writeSanDrawingSync } from '../drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService';
import {
  TRAZOS_PREFIX,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
  APARATOS_BY_TRAMO_KEY,
} from '../../constants/storage-keys';
import type { SyncPlanInput, RawElement } from '../drawingSync';
import { diamPulgFromLabel } from '../diamPulgFromLabel';
import { INODORO_APP_ID, sanDiamAllowedForApparatus } from '../sanitaryDiamCompat';
import { followBajanteToMaxRamal } from '../../lib/PlanoEngine/PlanoEngineDrawing';
import { recomputeDownstreamDiameters } from '../../lib/PlanoEngine/drawingUtils';
import { propagarSanDiametroAguasAbajo } from '../../lib/PlanoEngine/drawingFlow';

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
// viola una restricción.
export interface WriteDiametroResult {
  ok: boolean;
  reason?: 'accessory-larger' | 'parent-smaller' | 'child-larger';
  accessoryDiam?: string;
  accessoryEnd?: 'INICIO' | 'FIN';
  attemptedDiam?: string;
  parentDiam?: string;
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
          // Validación diámetro de salida ≤ entrada (ítem 10): solo redes de presión af/ac/gas.
          // Los extremos de entrada/salida se resuelven según la DIRECCIÓN REAL DEL FLUJO del
          // ramal (_tribReversed): la entrada llega al ORIGEN de flujo y las salidas salen del
          // DESTINO. Con varias salidas simultáneas, cada una se valida de forma independiente
          // contra la misma entrada (se toma la más restrictiva).
          const myPts = r.pts;
          if (
            newIn > 0 &&
            (net === 'af' || net === 'ac' || net === 'gas') &&
            myPts &&
            myPts.length >= 2
          ) {
            const iAmRev = r._tribReversed;
            const myOrigin = iAmRev ? myPts[myPts.length - 1] : myPts[0];
            const myDest = iAmRev ? myPts[0] : myPts[myPts.length - 1];
            const TOL = 2.0;
            const touchesPt = (oPts: number[][], pt: number[]): 'endpoint' | 'body' | null => {
              const p0 = oPts[0];
              const p1 = oPts[oPts.length - 1];
              if (Math.hypot(p0[0] - pt[0], p0[1] - pt[1]) < TOL) return 'endpoint';
              if (Math.hypot(p1[0] - pt[0], p1[1] - pt[1]) < TOL) return 'endpoint';
              for (let si = 0; si < oPts.length - 1; si++) {
                const ax = oPts[si][0],
                  ay = oPts[si][1],
                  bx = oPts[si + 1][0],
                  by = oPts[si + 1][1];
                const dx = bx - ax,
                  dy = by - ay,
                  len2 = dx * dx + dy * dy;
                if (len2 < 1e-9) continue;
                const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / len2;
                if (t <= 0 || t >= 1) continue;
                const px = ax + t * dx,
                  py = ay + t * dy;
                if (Math.hypot(pt[0] - px, pt[1] - py) < TOL) return 'body';
              }
              return null;
            };
            // ENTRADA: el tramo aguas arriba cuyo destino de flujo cae en MI origen
            let maxParentIn = 0;
            let maxParentLabel = '';
            // SALIDAS: cada tramo aguas abajo cuyo origen cae en MI destino — se revisan TODOS
            let maxChildOut = 0;
            let maxChildLabel = '';
            for (const other of data.ramales || []) {
              if (other.id === r.id) continue;
              if (other.net !== net) continue;
              const oPts = other.pts;
              if (!oPts || oPts.length < 2) continue;
              const oRev = other._tribReversed || other.trib_reversed;
              const oOrigin = oRev ? oPts[oPts.length - 1] : oPts[0];
              const oDest = oRev ? oPts[0] : oPts[oPts.length - 1];
              const feedsMe =
                touchesPt(oPts, myOrigin) !== null &&
                Math.hypot(oDest[0] - myOrigin[0], oDest[1] - myOrigin[1]) < TOL;
              const bodyFeedsMe = touchesPt(oPts, myOrigin) === 'body';
              const iFeedIt = Math.hypot(oOrigin[0] - myDest[0], oOrigin[1] - myDest[1]) < TOL;
              const oDiamLabel = other.diametro || '';
              const oIn = oDiamLabel ? diamPulgFromLabel(inchPartOf(oDiamLabel)) : 0;
              if ((feedsMe || bodyFeedsMe) && oIn > maxParentIn) {
                maxParentIn = oIn;
                maxParentLabel = oDiamLabel;
              }
              // Salida: origen del hijo cae en mi destino o sobre mi cuerpo (T)
              let childOnMyBody = false;
              if (!iFeedIt) {
                for (let si = 0; si < myPts.length - 1; si++) {
                  const ax = myPts[si][0],
                    ay = myPts[si][1],
                    bx = myPts[si + 1][0],
                    by = myPts[si + 1][1];
                  const dx = bx - ax,
                    dy = by - ay,
                    len2 = dx * dx + dy * dy;
                  if (len2 < 1e-9) continue;
                  const t = ((oOrigin[0] - ax) * dx + (oOrigin[1] - ay) * dy) / len2;
                  if (t <= 0 || t >= 1) continue;
                  const px = ax + t * dx,
                    py = ay + t * dy;
                  if (Math.hypot(oOrigin[0] - px, oOrigin[1] - py) < TOL) {
                    childOnMyBody = true;
                    break;
                  }
                }
              }
              if ((iFeedIt || childOnMyBody) && oIn > maxChildOut) {
                maxChildOut = oIn;
                maxChildLabel = oDiamLabel;
              }
            }
            // Fallback sin dirección de flujo (por si _tribReversed no está seteado o la geometría es ambigua):
            // cualquier ramal que toque mi origen/destino cuenta, para no dejar escapar la validación.
            if (maxParentIn === 0) {
              for (const other of data.ramales || []) {
                if (other.id === r.id) continue;
                if (other.net !== net) continue;
                const oPts = other.pts;
                if (!oPts || oPts.length < 2) continue;
                if (touchesPt(oPts, myOrigin) === null) continue;
                const oDiamLabel = other.diametro || '';
                const oIn = oDiamLabel ? diamPulgFromLabel(inchPartOf(oDiamLabel)) : 0;
                if (oIn > maxParentIn) {
                  maxParentIn = oIn;
                  maxParentLabel = oDiamLabel;
                }
              }
            }
            if (maxChildOut === 0) {
              for (const other of data.ramales || []) {
                if (other.id === r.id) continue;
                if (other.net !== net) continue;
                const oPts = other.pts;
                if (!oPts || oPts.length < 2) continue;
                const oOrigin = (oPts as number[][])[0];
                let touches = Math.hypot(oOrigin[0] - myDest[0], oOrigin[1] - myDest[1]) < TOL;
                if (!touches) {
                  for (let si = 0; si < myPts.length - 1; si++) {
                    const ax = myPts[si][0],
                      ay = myPts[si][1],
                      bx = myPts[si + 1][0],
                      by = myPts[si + 1][1];
                    const dx = bx - ax,
                      dy = by - ay,
                      len2 = dx * dx + dy * dy;
                    if (len2 < 1e-9) continue;
                    const t = ((oOrigin[0] - ax) * dx + (oOrigin[1] - ay) * dy) / len2;
                    if (t <= 0 || t >= 1) continue;
                    const px = ax + t * dx,
                      py = ay + t * dy;
                    if (Math.hypot(oOrigin[0] - px, oOrigin[1] - py) < TOL) {
                      touches = true;
                      break;
                    }
                  }
                }
                if (!touches) continue;
                const oDiamLabel = other.diametro || '';
                const oIn = oDiamLabel ? diamPulgFromLabel(inchPartOf(oDiamLabel)) : 0;
                if (oIn > maxChildOut) {
                  maxChildOut = oIn;
                  maxChildLabel = oDiamLabel;
                }
              }
            }
            if (maxParentIn > 0 && newIn > maxParentIn) {
              blockedReason = {
                ok: false,
                reason: 'parent-smaller',
                parentDiam: maxParentLabel,
                attemptedDiam: newDiamLabel,
              };
              continue;
            }
            if (maxChildOut > 0 && newIn < maxChildOut) {
              blockedReason = {
                ok: false,
                reason: 'child-larger',
                parentDiam: maxChildLabel,
                attemptedDiam: newDiamLabel,
              };
              continue;
            }
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
            recomputeDownstreamDiameters(data.ramales, r.id);
          }
          const after = (data.ramales || []).map((x) => `${x.id}=${x.diametro || ''}`).join('|');
          if (after !== before) changed = true;
        }
        // El bajante sigue al mayor diámetro de sus ramales en ambas direcciones: si seguía
        // al máximo anterior adopta el nuevo (suba o baje); un oversize explícito mayor se
        // conserva salvo que el nuevo máximo lo supere. Misma regla que en canvas.
        for (const b of data.bajantes || []) {
          if (b.net !== net || !(b.recibeDeIds || []).includes(r.id)) continue;
          const followed = followBajanteToMaxRamal(
            data.ramales || [],
            b.recibeDeIds,
            b.dNominal || '',
            r.id,
            oldDiamLabel,
            newDiamLabel,
          );
          if (followed) {
            b.dNominal = followed;
            changed = true;
          }
        }
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

/** Objetivo explícito: fila (planId+bajanteId) que el usuario editó. Sin él se conserva el
 *  comportamiento legado (primer contador encontrado), que con ≥2 contadores escribía en el
 *  equivocado. */
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

/** Regla entre pisos (orig. usuario): el bajante del piso INFERIOR no puede tener menor
 *  diámetro que el del SUPERIOR. Valida un nuevo dNominal ANTES de escribirlo.
 *  Roles por puntero: con `origenId` el editado es el INFERIOR (recibe de arriba);
 *  con `descargaEnId` es el SUPERIOR (entrega abajo). Sin punteros, sin contraparte o
 *  sin diámetros comparables → ok. El espejo (valor igual en ambos) siempre pasa. */
export function validarDiametroEntrePisos(
  planId: string,
  bajanteId: string,
  nuevoDiamLabel: string,
): { ok: true } | { ok: false; titulo: string; mensaje: string } {
  const nuevo = diamPulgFromLabel(nuevoDiamLabel.replace(/-/g, ' '));
  if (!(nuevo > 0)) return { ok: true };
  const { descargaEnId, origenId } = punterosBajante(planId, bajanteId);
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
