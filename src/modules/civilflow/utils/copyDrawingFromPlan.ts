import { loadFromStorage, saveToStorage } from '../services/storageService';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../constants/storage-keys';
import { NETS, uniqRamalId } from '../lib/PlanoEngine/PlanoState';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../lib/PlanoEngine/PlanoState';

export interface CopySourceSelection {
  netId: string;
  tipos: Set<string>;
}

export interface CopyResult {
  copied: number;
  skippedNets: string[];
}

interface ExtendedEngine extends IPlanoEngineCore {
  saveWork(): unknown;
}

interface CopyElement {
  id: string;
  net: string;
  tipo: string;
  pts?: number[][];
  recibeDeIds?: string[];
  alimentaIds?: string[];
  descargaEnId?: string | null;
  code?: string;
  ini?: string;
  fin?: string;
  padre?: string | null;
  label?: string;
  copiaPiso?: boolean;
  bloqueado?: boolean;
  _labelBox?: unknown;
  _circ?: unknown;
  _ghost?: unknown;
  _ghostLabelBox?: unknown;
  _net?: unknown;
  isFantasma?: unknown;
  ghostData?: unknown;
}

/**
 * Copia elementos filtrados por red/tipo de un plano origen a uno destino, renumerando ids.
 * Filtra redes ocultas y tipos no seleccionados; preserva asociaciones y recalcula totales.
 * @param engine - Motor destino (se usa para renumerar y persistir).
 * @param targetPlanId - Id del plano destino.
 * @param sourcePlanId - Id del plano origen.
 * @param selections - Redes y tipos a copiar.
 * @returns Conteo copiado y redes omitidas.
 */
export function copyDrawingFromPlan(
  engine: ExtendedEngine,
  targetPlanId: string,
  sourcePlanId: string,
  selections: CopySourceSelection[],
): CopyResult {
  const sourceRaw = loadFromStorage(`trazos_${sourcePlanId}`, null);
  if (!sourceRaw) return { copied: 0, skippedNets: ['El plano origen no tiene datos de dibujo'] };

  const sourceData = (typeof sourceRaw === 'string' ? JSON.parse(sourceRaw) : sourceRaw) as {
    ramales?: CopyElement[];
    bajantes?: CopyElement[];
  };
  const sourceRamales: CopyElement[] = sourceData.ramales || [];
  const sourceBajantes: CopyElement[] = sourceData.bajantes || [];

  let totalCopied = 0;
  const skippedNets: string[] = [];
  const oldToNew: Record<string, string> = {};
  const srcPid = String(sourcePlanId);
  const tgtPid = String(targetPlanId);

  const aparatos = loadFromStorage(APARATOS_BY_TRAMO_KEY, {}) as Record<string, unknown>;
  const hidroData = loadFromStorage(HYDRO_DATA_STORAGE_KEY, {}) as Record<string, unknown>;
  const gasAcc = loadFromStorage(GAS_ACC_KEY, {}) as Record<string, unknown>;

  for (const sel of selections) {
    const { netId, tipos } = sel;
    if (tipos.size === 0) continue;

    const net = NETS.find((n) => n.id === netId);
    if (!net) {
      skippedNets.push(netId);
      continue;
    }
    const pfx = net.lbl;
    const bmPfx = net.bmPfx;
    // Prefijo de montante: para redes donde bmType === 'montante', usar net.bmPfx (MAF, MAC, etc.)
    // Para redes donde bmType === 'bajante' (saneamiento, ll), los montantes tienen su propio
    // prefijo 'M'+lbl
    const monPfx = net.bmType === 'montante' ? net.bmPfx || 'MON' : 'M' + (net.lbl || 'MON');

    const copyRamalTipos = new Set(['ramal', 'tributario'].filter((t) => tipos.has(t)));
    const copyBajanteTipos = new Set(['bajante', 'montante'].filter((t) => tipos.has(t)));
    const copyGlobalTipos = new Set(
      ['red_publica', 'contador', 'calentador'].filter((t) => tipos.has(t)),
    );

    const srcRamales = sourceRamales.filter((r) => r.net === netId && copyRamalTipos.has(r.tipo));
    const srcBajantes = sourceBajantes.filter(
      (b) => b.net === netId && copyBajanteTipos.has(b.tipo),
    );
    const srcGlobals = sourceBajantes.filter((b) => copyGlobalTipos.has(b.tipo) && b.net === netId);

    if (srcRamales.length === 0 && srcBajantes.length === 0 && srcGlobals.length === 0) continue;

    const srcAll = [...srcRamales, ...srcBajantes, ...srcGlobals];

    /* ── CAPTURAR datos fuente de los 3 stores ANTES de cualquier borrado ── */
    const srcSnapshot: Record<string, { aparato?: unknown; hidro?: unknown; gasAcc?: unknown }> =
      {};
    for (const el of srcAll) {
      srcSnapshot[el.id] = {};

      const apKey = `${netId}_${el.id}_${srcPid}`;
      if (aparatos[apKey] !== undefined)
        srcSnapshot[el.id].aparato = structuredClone(aparatos[apKey]);

      const hdKey = `${netId}_${el.id}_${srcPid}`;
      if (hidroData[hdKey] !== undefined)
        srcSnapshot[el.id].hidro = structuredClone(hidroData[hdKey]);

      if (gasAcc[el.id] !== undefined) srcSnapshot[el.id].gasAcc = structuredClone(gasAcc[el.id]);
    }

    /* ── Los elementos del piso destino SE CONSERVAN (orig. usuario) ── */
    /* Antes se borraban los coincidentes (misma red+tipo) y los contadores reiniciaban en 1,
     * reseteando el piso actual. Ahora todo lo existente se mantiene y las copias toman la
     * numeración consecutivo siguiente de ESTE piso (los contadores de abajo ya siembran del
     * máximo existente); copiar dos veces el mismo origen duplica el dibujo — el usuario puede
     * borrar lo que sobra a mano. */

    /* ── Generar nuevos IDs ── */
    const maxForType = (arr: (PlanoRamal | PlanoBajante)[], regex: RegExp): number =>
      arr.reduce((m: number, e) => {
        const mr = e.id?.match(regex);
        return mr ? Math.max(m, parseInt(mr[1], 10)) : m;
      }, 0);

    const maxRamal = maxForType(
      engine.ramales.filter((r) => r.net === netId && r.tipo === 'ramal'),
      new RegExp('^' + pfx + '(\\d+)$'),
    );
    const maxBajante = maxForType(
      engine.bajantes.filter((b) => b.net === netId && b.tipo === 'bajante'),
      new RegExp('^' + bmPfx + '(\\d+)$'),
    );
    const maxMontante = maxForType(
      engine.bajantes.filter((b) => b.net === netId && b.tipo === 'montante'),
      new RegExp('^' + monPfx + '(\\d+)_' + netId + '$'),
    );
    const maxRp = maxForType(
      engine.bajantes.filter((b) => b.tipo === 'red_publica'),
      /^RP(\d+)$/,
    );
    const maxCnt = maxForType(
      engine.bajantes.filter((b) => b.tipo === 'contador'),
      /^(?:CTNG|CNTAF|cntAF)(\d+)$/,
    );
    const maxCal = maxForType(
      engine.bajantes.filter((b) => b.tipo === 'calentador'),
      /^(?:CALENT|calentG)(\d+)$/,
    );

    let ramalCounter = maxRamal;
    let bajanteCounter = maxBajante;
    let montanteCounter = maxMontante;
    let rpCounter = maxRp;
    let cntCounter = maxCnt;
    let calCounter = maxCal;

    // Etiquetas de tributario ocupadas (engine + copias de este lote): los tributarios reales
    // usan uniqRamalId() como id (timestamp), así que sembrar el contador por ID (/^T(\d+)$/)
    // casi siempre arrancaba en 1 y acuñaba T1RS5 duplicando una etiqueta existente — doble
    // etiqueta en el plano tras copiar (orig. usuario). La numeración se hace por ETIQUETA y
    // por raíz de padre, igual que allocTributaryNumber en el motor.
    const usedTribLabels = new Set(
      engine.ramales
        .filter((r) => r.tipo === 'tributario' && r.net === netId)
        .map((r) => r.label || r.id),
    );
    const nextTribLabel = (root: string): { id: string; label: string } => {
      for (let n = 1; ; n++) {
        const label = `T${n}${root}`;
        if (!usedTribLabels.has(label)) {
          usedTribLabels.add(label);
          return { id: uniqRamalId(), label };
        }
      }
    };

    // Construir mapa: oldPadreId -> newLabel del padre en destino
    const padreLabelMap: Record<string, string> = {};
    // Primero procesar todas las entradas 'ramal' para llenar padreLabelMap
    for (const r of srcRamales) {
      if (r.tipo === 'ramal' && r.padre) {
        // El padre existe en source - mapear su etiqueta
        const padreInSrc = srcRamales.find((x) => x.id === r.padre);
        if (padreInSrc) {
          padreLabelMap[r.padre] = padreInSrc.label || padreInSrc.id;
        }
      }
    }

    // Ramales primero (los tributarios necesitan el mapa de padres completo); luego
    // tributarios en orden de fuente — el padre de un tributario copiado (otro tributario)
    // ya pasó por aquí y dejó su label nuevo en padreLabelMap.
    for (const r of srcRamales) {
      if (r.tipo !== 'ramal') continue;
      const oldId = r.id;
      ramalCounter++;
      const newId = pfx + ramalCounter;
      oldToNew[oldId] = newId;
      r.id = newId;
      r.label = newId;
      // Actualizar mapa del padre: los tributarios futuros con este padre deben referenciar la
      // nueva etiqueta
      padreLabelMap[oldId] = newId;
      r.copiaPiso = true;
      r.bloqueado = true;
    }
    for (const r of srcRamales) {
      if (r.tipo !== 'tributario') continue;
      const oldId = r.id;
      const oldPadre = r.padre || '';
      // Etiqueta de tributario: T#<padreLabel> p. ej. T1RS5 — número libre POR RAÍZ.
      const padreLabel = oldPadre ? padreLabelMap[oldPadre] || oldPadre : '';
      const { id: newId, label } = nextTribLabel(padreLabel);
      oldToNew[oldId] = newId;
      r.id = newId;
      r.label = label;
      padreLabelMap[oldId] = label;
      r.copiaPiso = true;
      r.bloqueado = true;
    }

    for (const b of srcBajantes) {
      const origId = b.id;
      if (b.tipo === 'bajante') {
        bajanteCounter++;
        const newId = bmPfx + bajanteCounter;
        oldToNew[origId] = newId;
        b.id = newId;
        b.code = newId;
      } else if (b.tipo === 'montante') {
        montanteCounter++;
        const newId = monPfx + montanteCounter + '_' + netId;
        oldToNew[origId] = newId;
        b.id = newId;
        b.code = monPfx + montanteCounter;
      }
      b.copiaPiso = true;
      // Origen de la copia: los fantasmas entre pisos que proyectaban ESTE bajante quedan
      // redundantes (su etiqueta se duplica) y se reconocen por esta huella.
      (b as { copiadoDePlan?: string; copiadoDeId?: string }).copiadoDePlan = srcPid;
      (b as { copiadoDePlan?: string; copiadoDeId?: string }).copiadoDeId = origId;
    }

    for (const b of srcGlobals) {
      const origId = b.id;
      if (b.tipo === 'red_publica') {
        rpCounter++;
        const newId = 'RP' + rpCounter;
        oldToNew[origId] = newId;
        b.id = newId;
        b.code = newId;
      } else if (b.tipo === 'contador') {
        cntCounter++;
        const pfx = b.net === 'gas' ? 'CTNG' : 'CNTAF';
        const newId = pfx + cntCounter;
        oldToNew[origId] = newId;
        b.id = newId;
        b.code = newId;
      } else if (b.tipo === 'calentador') {
        calCounter++;
        const newId = 'CALENT' + calCounter;
        oldToNew[origId] = newId;
        b.id = newId;
        b.code = newId;
      }
      b.copiaPiso = true;
    }

    /* ── Reasignar referencias internas ── */
    // El ramal/bajante referenciado puede ser uno que se copia en ESTE MISMO lote — todavía no
    // existirá en engine.ramales/engine.bajantes (ese push ocurre más abajo), así que el chequeo
    // de existencia también debe aceptar todo lo que oldToNew está por introducir. Sin esto, los
    // recibeDeIds de un bajante apuntando a un ramal copiado junto a él siempre fallaban el
    // chequeo de array en vivo y se quitaban en silencio — el símbolo del bajante se copiaba, pero
    // su conexión hidráulica no.
    const willExist = new Set(Object.values(oldToNew));
    for (const el of srcAll) {
      if (el.ini && oldToNew[el.ini]) el.ini = oldToNew[el.ini];
      if (el.fin && oldToNew[el.fin]) el.fin = oldToNew[el.fin];
      if (el.padre && oldToNew[el.padre]) el.padre = oldToNew[el.padre];
      if (el.recibeDeIds) {
        el.recibeDeIds = el.recibeDeIds
          .map((id: string) => oldToNew[id] || id)
          .filter(
            (id: string) =>
              willExist.has(id) ||
              engine.ramales.some((r) => r.id === id) ||
              engine.bajantes.some((b) => b.id === id),
          );
      }
      if (el.alimentaIds) {
        el.alimentaIds = el.alimentaIds
          .map((id: string) => oldToNew[id] || id)
          .filter(
            (id: string) =>
              willExist.has(id) ||
              engine.ramales.some((r) => r.id === id) ||
              engine.bajantes.some((b) => b.id === id),
          );
      }
      if (el.descargaEnId && oldToNew[el.descargaEnId]) {
        el.descargaEnId = oldToNew[el.descargaEnId];
      }
    }

    for (const el of srcAll) {
      delete el._labelBox;
      delete el._circ;
      delete el._ghost;
      delete el._ghostLabelBox;
      delete el._net;
      delete el.isFantasma;
      delete el.ghostData;
    }
    // Los punteros de asociación entre pisos (descargaEnId/origenId) referencian un bajante
    // específico en OTRO piso específico — copiar el elemento a un piso nuevo bajo un id nuevo
    // vuelve obsoleto cualquier puntero así (o apunta a la nada, o peor, a algún bajante no
    // relacionado que ahora resulta compartir el id viejo). Ni esta herramienta ni su caller
    // tienen forma de saber cuál debería ser la asociación del elemento copiado en el piso nuevo,
    // así que se descarta por completo en vez de arrastrar un enlace que ya no significa nada.
    for (const b of [...srcBajantes, ...srcGlobals] as unknown as {
      descargaEnId?: string | null;
      origenId?: string | null;
      desplazamientos?: unknown;
      pisoBase?: string;
    }[]) {
      b.descargaEnId = null;
      b.origenId = null;
      delete b.desplazamientos;
      // pisoBase registra el piso al que "pertenece" un bajante/montante/global — renderBajantes.ts
      // nunca dibuja el círculo propio del elemento cuando difiere de la etiqueta del piso
      // cargado actualmente (esa discrepancia es cómo un fantasma entre pisos permanece invisible
      // salvo como marcador de fantasma). Dejado en la etiqueta del piso FUENTE, cada elemento
      // copiado fallaba en silencio al renderizarse por completo en el piso destino aunque existiera
      // en engine.bajantes. Debe estamparse con la etiqueta del piso destino, que es cualquier piso
      // cargado actualmente (el copy siempre corre hacia el plano abierto).
      b.pisoBase = engine.nivelActual?.label ?? '';
    }

    engine.ramales.push(...(srcRamales as unknown as PlanoRamal[]));
    engine.bajantes.push(
      ...(srcBajantes as unknown as PlanoBajante[]),
      ...(srcGlobals as unknown as PlanoBajante[]),
    );

    // Doble etiqueta (orig. usuario): si el piso origen proyectó un FANTASMA del bajante en
    // este piso destino, el bajante ahora copiado coexistía con ese fantasma residual que
    // muestra el mismo código — dos etiquetas para el mismo elemento. Tras copiar DESDE un
    // plano, TODOS sus fantasmas proyectados aquí son redundantes (sus bajantes ya están
    // materializados como copias); se retiran por sourcePlanId y por id viejo/nuevo.
    const copiedOldIds = new Set(Object.keys(oldToNew));
    const copiedNewIds = new Set(Object.values(oldToNew));
    engine.crossFloorGhosts = (engine.crossFloorGhosts || []).filter((g) => {
      const ghost = g as {
        sourceBajanteId?: string;
        targetBajanteId?: string;
        code?: string;
        sourcePlanId?: string | number;
      };
      return (
        String(ghost.sourcePlanId ?? '') !== srcPid &&
        !copiedOldIds.has(ghost.sourceBajanteId || '') &&
        !copiedNewIds.has(ghost.targetBajanteId || '') &&
        !(ghost.code && copiedNewIds.has(ghost.code))
      );
    });

    engine._netCounts[netId] = engine._netCounts[netId] || { ramal: 0, tributario: 0 };
    if (ramalCounter > engine._netCounts[netId].ramal) {
      engine._netCounts[netId].ramal = ramalCounter;
    }

    /* ── Escribir datos fuente capturados en los nuevos IDs ── */
    for (const [oldId, newId] of Object.entries(oldToNew)) {
      const snap = srcSnapshot[oldId];
      if (!snap) continue;

      if (snap.aparato !== undefined) {
        aparatos[`${netId}_${newId}_${tgtPid}`] = snap.aparato;
      }
      if (snap.hidro !== undefined) {
        hidroData[`${netId}_${newId}_${tgtPid}`] = snap.hidro;
      }
      if (snap.gasAcc !== undefined) {
        gasAcc[newId] = snap.gasAcc;
      }
    }

    totalCopied += srcAll.length;
  }

  saveToStorage(APARATOS_BY_TRAMO_KEY, aparatos);
  saveToStorage(HYDRO_DATA_STORAGE_KEY, hidroData);
  saveToStorage(GAS_ACC_KEY, gasAcc);

  try {
    const work = engine.saveWork();
    if (work && typeof work === 'object') {
      (work as { ts?: number }).ts = Date.now();
      saveToStorage(`trazos_${targetPlanId}`, work);
    }
  } catch {
    // Ignorar errores de guardado
  }

  engine._dirty = true;
  engine._markDirty();
  engine.render();

  try {
    window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed'));
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
  } catch {
    // Ignorar errores de evento
  }

  return { copied: totalCopied, skippedNets };
}
