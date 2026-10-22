import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { SelectableTarget } from '../fixturesStorage.ts';
import type { CountsMap } from '../fixturesStorage.ts';
import { loadAll, saveAll } from '../fixturesStorage.ts';
import type { ProbedElement } from '../pdfViewer/tramoEditor/context.ts';
import { FUENTE_TIPOS } from '../../lib/PlanoEngine/nodos';
import { extremoEntrelazado, flowEndsAt } from '../../lib/PlanoEngine/PlanoEngineDrawing.ts';
import { flowTailEnd } from '../pdfViewer/drawingElementContextMenu/ramalMenuHelpers.ts';
import { matchDiamOption } from '../../utils/diamOptionMatch.ts';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel.ts';
import { sanDiamAllowedForApparatus } from '../../utils/sanitaryDiamCompat.ts';
import { DIAM_BY_MAT } from '../../constants';
import { bumpHidroAccesorio } from '../../utils/syncExtremeAccessory.ts';
import { esRedAparatosPresion, propagarAparatosPresion } from '../../utils/propagation';
import { emitAparatosClear } from '../../utils/fixtureEvents.ts';

/** Todo lo que inc/dec leen del panel — el ctx viaja como OBJETO (rediseño FixturesPanel). */
export interface FixtureMutationCtx {
  netId: string;
  storageKey: string | null;
  /** Target clasificado del panel (rama af (Agua Fria)-ac (Agua Caliente)/san (Sanitaria)/ll (Lluvias)/gas (Gas)/rejillas). */
  target: SelectableTarget | null;
  /** Unión de ramales o ramal con tributarios: sus UDs (Unidades de Desague) están
   *  combinadas y por eso el panel no deja asignar aparatos acá. */
  mergeKeys: unknown;
  esEspejoBajante: boolean;
  esPropagado: boolean;
  rejillasArea: boolean | undefined;
  ownTotal: number;
  counts: CountsMap;
  setCounts: Dispatch<SetStateAction<CountsMap>>;
  engineRef: MutableRefObject<PlanoEngine | null>;
  selElement: SelectableTarget | null;
  setSelElement?: Dispatch<SetStateAction<ProbedElement | null>>;
  esPropio: (apId: string) => boolean;
}

/** Suma un aparato al tramo elegido (el botón "+" del panel): respeta los candados
 *  (solo lectura, espejo, unión), permite un solo aparato y dibuja el glifo en el
 *  extremo libre. Escribe primero en disco para no perderlo si la página se recarga,
 *  y propaga el cambio por la red de af (Agua Fria)/ac (Agua Caliente). */
/** Aplica un ajuste de conteo a una clave: disco-primero (persistencia síncrona antes del
 *  snapshot — el useEffect que guarda es asíncrono y el redo restauraría geometría nueva con
 *  conteos viejos) con fallback al estado React cuando no hay storage (tests). Una clave que
 *  queda vacía se conserva como {} (lápida): el merge del loader la distingue de "nunca tuvo"
 *  y no resucita los aparatos desde la BD.
 *  Ej: mutarConteo(clave, setCounts, (cur) => ({ ...cur, lav: (cur.lav || 0) + 1 })). */
function mutarConteo(
  storageKey: string,
  setCounts: Dispatch<SetStateAction<CountsMap>>,
  ajusta: (cur: Record<string, number>) => Record<string, number>,
): void {
  try {
    const disk = loadAll();
    const nextDisk = { ...disk, [storageKey]: ajusta({ ...(disk[storageKey] || {}) }) };
    saveAll(nextDisk);
    setCounts(nextDisk);
  } catch {
    setCounts((prev) => ({ ...prev, [storageKey]: ajusta({ ...(prev[storageKey] || {}) }) }));
  }
}

export function mutarInc(ctx: FixtureMutationCtx, apId: string): void {
  const {
    storageKey,
    target,
    esEspejoBajante,
    rejillasArea,
    mergeKeys,
    netId,
    ownTotal,
    engineRef,
    counts,
    setCounts,
    selElement,
    setSelElement,
  } = ctx;
  const targetId = target?.id || null;
  if (!storageKey) return;
  if (
    target?.tipo === 'bajante' ||
    target?.tipo === 'caja_san' ||
    target?.tipo === 'caja_ll' ||
    target?.tipo === 'bomba'
  )
    return; // bajante/caja/bomba: panel de solo lectura
  if (esEspejoBajante) return; // espejo de bajante: UDs las manda el bajante
  if (rejillasArea) {
    // Área de sector (rejillas): conteos LIBRES por gasodoméstico — sin límite de 1 aparato
    // ni merge de uniones; el glifo del ramal no existe (live undefined) y no se toca.
  } else if (mergeKeys && netId !== 'af' && netId !== 'ac') {
    // Pata única de una unión (gas, orig. usuario) o ramal con tributarios (san/ll): sus
    // UDs son el total combinado — no asignables manualmente. af/ac usan esPropagado (la
    // clave ya trae la carga propagada; las patas fuente sí admiten asignación manual).
    const esAgua = netId === 'gas';
    engineRef.current?.triggerAlert(
      esAgua ? 'Unión de ramales' : 'Ramal con tributarios',
      esAgua
        ? 'Las unidades de este ramal son la SUMA de las patas de la unión: asigna aparatos en las otras dos patas, que sí admiten asignación manual.'
        : 'Las unidades de este ramal vienen de sus tributarios. Asigna aparatos en los ramales/tributarios que alimentan este punto.',
    );
    return;
  }
  // Ítem 6: máximo UN aparato por ramal-tributario (manual). Para cambiar el aparato:
  // Quitar (−) y asignar el nuevo — o usar el menú contextual, que hace el switch directo.
  if (ownTotal >= 1 && netId !== 'll' && !rejillasArea) {
    engineRef.current?.triggerAlert(
      'Máximo 1 aparato por ramal-tributario',
      'Un ramal/tributario admite máximo un aparato asignado manualmente. Si necesitas más unidades, crea otro ramal o tributario desde el cuerpo de este.',
    );
    return;
  }
  // Ítem 2/3 (rev 4): el aparato SOLO va en el extremo LIBRE hacia el que apunta el flujo del
  // ramal — el glifo del codo (af/ac) y el símbolo del aparato se derivan de
  // aparatoInicio/Fin, y no deben aparecer en conexiones de T/Y. Si el extremo de entrega
  // está ocupado o el flujo va en contra del libre, bloqueado con alerta. Solo la primera
  // unidad escribe el campo; si ya hay un aparato (del menú contextual), solo suma el conteo.
  const eng = engineRef.current;
  const live = eng?.ramales.find((r) => r.id === targetId);
  const firstUnit = !(counts[storageKey] || {})[apId];
  // Una asignación = UN snapshot: pausa durante TODAS las mutaciones + escritura a disco.
  // try/finally garantiza el resume aunque algo lance — una pausa huérfana dejaba el
  // historial mudo y el Ctrl+Z sin efecto sobre los aparatos recién asignados.
  if (eng) eng.pauseHistory();
  try {
    if (
      eng &&
      live &&
      live.pts &&
      live.pts.length >= 2 &&
      (live.net === 'af' || live.net === 'ac' || live.net === 'gas')
    ) {
      const head = live.pts[live.pts.length - 1];
      const tail = live.pts[0];
      // Item 1 (regla global): ocupado = entrelazado con la red. Los glifos de
      // codo/sifón no cuentan (el aparato los reemplaza). Ambos ocupados → sin
      // símbolo, CON alerta (el silencio se percibía como "clic que no hace nada" y
      // obligaba a asignar dos veces).
      // Una FUENTE en un extremo no lo bloquea (orig. usuario: montante/red/
      // contador/calentador/bomba es punto de suministro — un trazo SÍ puede llegar a
      // él y el panel queda habilitado; sus aparatos entran por propagación).
      const bajantesOcc = (eng.bajantes || []).filter((b) => !FUENTE_TIPOS.has(b.tipo || ''));
      const headOcc = extremoEntrelazado(eng.ramales, bajantesOcc, live, head);
      const tailOcc = extremoEntrelazado(eng.ramales, bajantesOcc, live, tail);
      // Misma regla del barrido (aparatoEnExtremoInvalido, orig. usuario): el extremo solo
      // vale si está LIBRE y el flujo termina en él — salvo FUENTE (punto de suministro).
      // Así una asignación nueva jamás nace inválida: sin símbolo ni conteo si ningún
      // extremo vale, y el sweep no tiene nada que flaguear después.
      const tocaFuente = (pt: number[]) =>
        (eng.bajantes || []).some(
          (b) =>
            FUENTE_TIPOS.has(b.tipo || '') &&
            b.net === live.net &&
            Math.hypot(b.x - pt[0], b.y - pt[1]) < 0.5,
        );
      const extremoValido = (pt: number[]) =>
        !extremoEntrelazado(eng.ramales, bajantesOcc, live, pt) &&
        (flowEndsAt(live, pt, 0.5) || tocaFuente(pt));
      const headVal = extremoValido(head);
      const tailVal = extremoValido(tail);
      if (headOcc && tailOcc) {
        eng.triggerAlert(
          'Extremos ocupados',
          'Ambos extremos del ramal están conectados a la red. Libera una punta o invierte la dirección del ramal antes de asignar el aparato.',
        );
        return;
      }
      if (!headVal && !tailVal) {
        eng.triggerAlert(
          'Aparato no permitido',
          `El ramal ${live.label || live.id} no tiene un extremo válido para el aparato: solo va en el extremo libre hacia el que apunta el flujo (o en una fuente). Invierte la dirección del ramal o reconéctalo para que el flujo apunte a su punta libre.`,
        );
        return;
      }
      const endPt =
        headVal && tailVal ? (flowEndsAt(live, head, 0.5) ? head : tail) : headVal ? head : tail;
      const field: 'aparatoInicio' | 'aparatoFin' = endPt === head ? 'aparatoFin' : 'aparatoInicio';
      const accField = field === 'aparatoInicio' ? 'accesorioInicio' : 'accesorioFin';
      const hasBajante = (eng.bajantes || []).some(
        (b) =>
          !FUENTE_TIPOS.has(b.tipo || '') &&
          Math.abs(b.x - endPt[0]) < 0.5 &&
          Math.abs(b.y - endPt[1]) < 0.5 &&
          b.net === live.net,
      );
      if (live[accField] || hasBajante) {
        eng.triggerAlert(
          'Extremo ocupado',
          'El extremo libre del ramal ya tiene accesorio o bajante. Elimínalo antes de asignar el aparato desde la sidebar.',
        );
        return;
      }
      if (firstUnit && !live.aparatoInicio && !live.aparatoFin) {
        eng.updateElementById(live.id, { [field]: apId });
        eng.render();
      }
    }
    if (eng && live && live.net === 'san' && firstUnit) {
      // Ítem 6/7/8: regla central (inodoro → 4" mínimo; otros → relleno 2" si vacío)
      const isInodoro = apId === 'san';
      const targetDiamForAcc = isInodoro ? '4"' : '2"';
      const curDiamPulg = live.diametro ? diamPulgFromLabel(live.diametro) : 0;
      // Detect previous aparato for switch diam perception
      let prevAparatoFix: string | null = null;
      try {
        const prevCountsFix = loadAll();
        const prevMapFix = prevCountsFix[storageKey] || {};
        const foundFix = Object.keys(prevMapFix).find(
          (k) => k !== apId && (prevMapFix[k] || 0) > 0,
        );
        if (foundFix) prevAparatoFix = foundFix;
      } catch (_e) {
        void _e;
      }
      const needsDiam =
        (isInodoro && (curDiamPulg < 4 || !sanDiamAllowedForApparatus(curDiamPulg, apId))) ||
        (!isInodoro && (!live.diametro || prevAparatoFix === 'san'));
      if (needsDiam) {
        eng.updateElementById(live.id, { diametro: targetDiamForAcc });
        // Sincronizar el snapshot de React para que el dropdown del panel derecho refleje el cambio.
        if (selElement?.id === live.id)
          setSelElement?.({
            ...selElement,
            diametro: targetDiamForAcc,
          } as unknown as ProbedElement);
      }
      const head = live.pts[live.pts.length - 1];
      const tail = live.pts[0];
      // Una FUENTE en un extremo no lo bloquea (orig. usuario: punto de suministro).
      const bajantesOcc = (eng.bajantes || []).filter((b) => !FUENTE_TIPOS.has(b.tipo || ''));
      const headOcc = extremoEntrelazado(eng.ramales, bajantesOcc, live, head);
      const tailOcc = extremoEntrelazado(eng.ramales, bajantesOcc, live, tail);
      // Item 1 (regla global): ambos extremos ocupados → no crear símbolo, sin
      // alerta. La selección de targetField abajo ya cubre accesorios y conexiones.
      let targetField: 'accesorioInicio' | 'accesorioFin' | null = null;
      let targetDiamField: 'diametroInicio' | 'diametroFin' | null = null;
      // Trazo aislado (orig. usuario): el codo sube va del lado de la COLA de la
      // flecha de flujo (el sube entrega). Cola en pts[0] = el flujo termina en head.
      const endHead = flowEndsAt(live, head, 0.5);
      const endTail = flowEndsAt(live, tail, 0.5);
      const tailEnd = flowTailEnd(endTail, endHead);
      if (!headOcc && !tailOcc && tailEnd === 0 && !live.accesorioInicio) {
        targetField = 'accesorioInicio';
        targetDiamField = 'diametroInicio';
      } else if (!headOcc && !live.accesorioFin) {
        targetField = 'accesorioFin';
        targetDiamField = 'diametroFin';
      } else if (!tailOcc && !live.accesorioInicio) {
        targetField = 'accesorioInicio';
        targetDiamField = 'diametroInicio';
      }
      if (targetField && targetDiamField) {
        // Sifón (aparato 'sif') dibuja el glifo de sifón (accesorio 'sifon'), no el codo 90°.
        // El conteo de accesorios sigue sumando un codo 90° por sifón (requisito orig. #3).
        const isSif = apId === 'sif';
        const accType = isSif ? 'sifon' : 'codo90rmSube';
        const updates: Record<string, unknown> = { [targetField]: accType };
        const diamListSan = DIAM_BY_MAT['PVC-S'] || [];
        // sifón siempre 2" (fix bug 3"), inodoro 4", resto hereda o 2"
        const diamValRaw = isSif
          ? '2"'
          : isInodoro
            ? '4"'
            : live.diametro
              ? matchDiamOption(diamListSan, live.diametro)
              : '2"';
        const diamVal = matchDiamOption(diamListSan, diamValRaw);
        if (diamVal) (updates as Record<string, unknown>)[targetDiamField] = diamVal;
        eng.updateElementById(live.id, updates);
        eng.render();
        const planId = eng._loadedPlanId ?? '';
        if (isSif) bumpHidroAccesorio('san', 'codo90rmSube', 1, live.id, planId);
        else bumpHidroAccesorio('san', 'codo90rmSube', 1, live.id, planId);
      }
    }
    // Ítem 1: persistencia síncrona a disco ANTES del snapshot final — el useEffect que
    // guarda es asíncrono y el snapshot debe incluir los conteos nuevos (si no, redo
    // restauraría geometría nueva con conteos viejos). Disco-primero evita stale closures.
    mutarConteo(storageKey, setCounts, (curD) => ({ ...curD, [apId]: (curD[apId] || 0) + 1 }));
  } finally {
    if (eng) eng.resumeHistory();
  }
  if (eng) {
    eng._markDirty();
  }
  if (esRedAparatosPresion(netId)) propagarAparatosPresion(netId);
  // Consistencia entre superficies (orig. usuario): el menú contextual re-deriva su tarjeta
  // de estos eventos (el panel derecho ya reacciona vía setCounts).
  try {
    emitAparatosClear();
  } catch {
    /* ignore */
  }
}

/** Quita un aparato del tramo (el botón "-" del panel): solo baja lo PROPIO, y al llegar
 *  a cero borra el glifo del dibujo y el accesorio sanitario. Escribe en disco primero,
 *  propaga por af (Agua Fria)/ac (Agua Caliente) y avisa a las demás pantallas. */
export function mutarDec(ctx: FixtureMutationCtx, apId: string): void {
  const {
    storageKey,
    target,
    esEspejoBajante,
    esPropagado,
    rejillasArea,
    mergeKeys,
    netId,
    counts,
    setCounts,
    engineRef,
    esPropio,
  } = ctx;
  const targetId = target?.id || null;
  if (!storageKey) return;
  if (
    target?.tipo === 'bajante' ||
    target?.tipo === 'caja_san' ||
    target?.tipo === 'caja_ll' ||
    target?.tipo === 'bomba'
  )
    return; // solo lectura
  if (esEspejoBajante) return; // espejo de bajante: UDs las manda el bajante
  // Con herencia propagada solo se puede quitar lo PROPIO (auditoría #4): si el
  // aparato vive únicamente como heredado, el "−" no toca nada (antes vaciaba la clave
  // o borraba el símbolo del dibujo).
  if (esPropagado && !esPropio(apId)) {
    engineRef.current?.triggerAlert(
      'Unidades propagadas',
      'Las unidades de este ramal vienen de la propagación aguas arriba (montante/ramales fuente). Edítalas en el tramo de origen: aquí son de solo lectura.',
    );
    return;
  }
  // AF/AC/gas: pata única de una unión (mergeKeys) — sus UDs son la suma combinada, no
  // asignables (mismo gate que inc; orig. usuario). Área de rejillas: conteos libres.
  if (!rejillasArea && mergeKeys && netId === 'gas') return;
  const curBefore = { ...(counts[storageKey] || {}) };
  const vBefore = (curBefore[apId] || 0) - 1;
  // El campo del ramal solo se limpia cuando el conteo PROPIO tenía el aparato (vBefore === 0,
  // decremento legítimo del último). Con conteo propio ya en 0 (el panel puede mostrar 1 por
  // UDs heredadas/combinadas de una asociación entre pisos), un clic en "-" no debe borrar el
  // símbolo del dibujo — solo vacía la clave, sin tocar aparatoInicio/Fin (orig. usuario:
  // inodoro de RS4 desaparecía al descontar UDs heredadas).
  const teniaPropio = (curBefore[apId] || 0) > 0;
  // Una desasignación = UN snapshot: pausa + try/finally (mismo razonamiento que inc).
  const engDec = engineRef.current;
  if (engDec) engDec.pauseHistory();
  try {
    if (vBefore <= 0 && teniaPropio && targetId) {
      const eng = engineRef.current;
      const live = eng?.ramales.find((r) => r.id === targetId);
      if (eng && live) {
        if (live.aparatoInicio === apId || live.aparatoFin === apId) {
          const updates: Record<string, unknown> = {};
          if (live.aparatoInicio === apId) updates.aparatoInicio = null;
          if (live.aparatoFin === apId) updates.aparatoFin = null;
          eng.updateElementById(targetId, updates);
          eng.render();
          eng._markDirty();
        }
        // La copia `fixtures` del ramal se escribió al CARGAR y nada la actualiza al quitar:
        // invalidarla (el re-ancla del sync leería la copia del trazo y resucitaría el conteo
        // recién borrado — orig. usuario "-" sin efecto tras reentrar).
        live.fixtures = undefined;
        // Sanitaria: al quitar el último aparato, también quitar el accesorio del extremo libre
        // (codo 90° sube o sifón) — orig. usuario #5: quitar el sifón desde el panel debe quitar
        // su símbolo en el dibujo.
        if (live.net === 'san') {
          const totalAfter = Object.entries(counts[storageKey] || {}).reduce(
            (s, [k, v]) => s + (k === apId ? Math.max(0, v - 1) : v),
            0,
          );
          if (totalAfter === 0) {
            const accIni = live.accesorioInicio;
            const accFin = live.accesorioFin;
            const hasAccIni = accIni === 'codo90rmSube' || accIni === 'sifon';
            const hasAccFin = accFin === 'codo90rmSube' || accFin === 'sifon';
            if (hasAccIni || hasAccFin) {
              const updates: Record<string, unknown> = {};
              if (hasAccIni) {
                updates.accesorioInicio = '';
                updates.diametroInicio = '';
              }
              if (hasAccFin) {
                updates.accesorioFin = '';
                updates.diametroFin = '';
              }
              eng.updateElementById(targetId, updates);
              eng.render();
              const planId = eng._loadedPlanId ?? '';
              if (hasAccIni || hasAccFin) {
                bumpHidroAccesorio('san', 'codo90rmSube', -1, targetId, planId);
              }
            }
          }
        }
      }
    }
    // Ítem 1: disco-primero (ver mutarConteo) + un snapshot final con todo persistido.
    mutarConteo(storageKey, setCounts, (curD) => {
      const v = (curD[apId] || 0) - 1;
      if (v <= 0) delete curD[apId];
      else curD[apId] = v;
      return curD; // vacío = lápida {} (ver mutarConteo)
    });
  } finally {
    if (engDec) engDec.resumeHistory();
  }
  const engEnd = engineRef.current;
  if (engEnd) {
    engEnd._markDirty();
  }
  if (esRedAparatosPresion(netId)) propagarAparatosPresion(netId);
  // Consistencia entre superficies (ver inc).
  try {
    emitAparatosClear();
  } catch {
    /* ignore */
  }
}

/** Adaptador de React: mismo contrato que los handlers inc/dec que estaban inline. */
export function useFixtureMutations(ctx: FixtureMutationCtx): {
  inc: (apId: string) => void;
  dec: (apId: string) => void;
} {
  const inc = (apId: string): void => mutarInc(ctx, apId);
  const dec = (apId: string): void => mutarDec(ctx, apId);
  return { inc, dec };
}
