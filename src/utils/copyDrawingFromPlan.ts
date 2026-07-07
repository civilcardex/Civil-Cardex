import { loadFromStorage, saveToStorage } from "../services/storageService";
import { APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY, GAS_ACC_KEY } from "../constants/storage-keys";
import { NETS } from "../lib/PlanoEngine/PlanoState";
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from "../lib/PlanoEngine/PlanoState";

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
  _labelBox?: unknown;
  _circ?: unknown;
  _ghost?: unknown;
  _ghostLabelBox?: unknown;
  _net?: unknown;
  isFantasma?: unknown;
  ghostData?: unknown;
}

function deleteKeys(store: Record<string, unknown>, pred: (k: string) => boolean): void {
  for (const k of Object.keys(store)) {
    if (pred(k)) delete store[k];
  }
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

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
    if (!net) { skippedNets.push(netId); continue; }
    const pfx = net.lbl;
    const bmPfx = net.bmPfx;
    const tPfx = 'T'; // Tributario prefix

    const copyRamalTipos = new Set(['ramal', 'tributario'].filter(t => tipos.has(t)));
    const copyBajanteTipos = new Set(['bajante', 'montante'].filter(t => tipos.has(t)));
    const copyGlobalTipos = new Set(['red_publica', 'contador', 'calentador'].filter(t => tipos.has(t)));

    const srcRamales = sourceRamales.filter((r) => r.net === netId && copyRamalTipos.has(r.tipo));
    const srcBajantes = sourceBajantes.filter((b) => b.net === netId && copyBajanteTipos.has(b.tipo));
    const srcGlobals = sourceBajantes.filter((b) => copyGlobalTipos.has(b.tipo) && b.net === netId);

    if (srcRamales.length === 0 && srcBajantes.length === 0 && srcGlobals.length === 0) continue;

    const srcAll = [...srcRamales, ...srcBajantes, ...srcGlobals];

    /* ── CAPTURE source data from all 3 stores BEFORE any deletion ── */
    const srcSnapshot: Record<string, { aparato?: unknown; hidro?: unknown; gasAcc?: unknown }> = {};
    for (const el of srcAll) {
      srcSnapshot[el.id] = {};

      const apKey = `${netId}_${el.id}_${srcPid}`;
      if (aparatos[apKey] !== undefined) srcSnapshot[el.id].aparato = deepClone(aparatos[apKey]);

      const hdKey = `${netId}_${el.id}_${srcPid}`;
      if (hidroData[hdKey] !== undefined) srcSnapshot[el.id].hidro = deepClone(hidroData[hdKey]);

      if (gasAcc[el.id] !== undefined) srcSnapshot[el.id].gasAcc = deepClone(gasAcc[el.id]);
    }

    /* ── Remove existing matching elements from engine ── */
    const existingToRemove: (PlanoRamal | PlanoBajante)[] = [];
    if (copyRamalTipos.size > 0) {
      existingToRemove.push(...engine.ramales.filter((r) => r.net === netId && copyRamalTipos.has(r.tipo)));
    }
    if (copyBajanteTipos.size > 0) {
      existingToRemove.push(...engine.bajantes.filter((b) => b.net === netId && copyBajanteTipos.has(b.tipo)));
    }
    if (copyGlobalTipos.size > 0) {
      existingToRemove.push(...engine.bajantes.filter((b) => copyGlobalTipos.has(b.tipo)));
    }
    const removeIds = new Set(existingToRemove.map((e) => e.id));

    engine.ramales = engine.ramales.filter((r) => !removeIds.has(r.id));
    engine.bajantes = engine.bajantes.filter((b) => !removeIds.has(b.id));

    for (const r of engine.ramales) {
      if (removeIds.has(r.ini)) r.ini = '';
      if (removeIds.has(r.fin)) r.fin = '';
      if (r.padre && removeIds.has(r.padre)) r.padre = null;
    }
    for (const b of engine.bajantes) {
      b.recibeDeIds = (b.recibeDeIds || []).filter((id: string) => !removeIds.has(id));
      b.alimentaIds = (b.alimentaIds || []).filter((id: string) => !removeIds.has(id));
      if (b.descargaEnId && removeIds.has(b.descargaEnId)) b.descargaEnId = null;
    }

    /* ── Clear selection if selected element was removed ── */
    if (engine.selId && removeIds.has(engine.selId)) {
      engine.selId = null;
      engine._isGhostSel = false;
      engine._emitSelect(null);
    }

    /* ── Clean target entries from all 3 stores ── */
    for (const id of removeIds) {
      deleteKeys(aparatos, (k: string) => k.endsWith(`_${id}_${tgtPid}`));
      deleteKeys(hidroData, (k: string) => k.endsWith(`_${id}_${tgtPid}`));
      deleteKeys(gasAcc, (k: string) => k === id);
    }

    /* ── Generate new IDs ── */
    const maxForType = (arr: (PlanoRamal | PlanoBajante)[], regex: RegExp): number =>
      arr.reduce((m: number, e) => {
        const mr = e.id?.match(regex);
        return mr ? Math.max(m, parseInt(mr[1], 10)) : m;
      }, 0);

    const maxRamal = maxForType(engine.ramales.filter((r) => r.net === netId && r.tipo === 'ramal'), new RegExp('^' + pfx + '(\\d+)$'));
    const maxBajante = maxForType(engine.bajantes.filter((b) => b.net === netId && b.tipo === 'bajante'), new RegExp('^' + bmPfx + '(\\d+)$'));
    const maxMontante = maxForType(engine.bajantes.filter((b) => b.net === netId && b.tipo === 'montante'), new RegExp('^' + bmPfx + '(\\d+)_' + netId + '$'));
    const maxRp = maxForType(engine.bajantes.filter((b) => b.tipo === 'red_publica'), /^RP(\d+)$/);
    const maxCnt = maxForType(engine.bajantes.filter((b) => b.tipo === 'contador'), /^(?:CTNG|CNTAF|cntAF)(\d+)$/);
    const maxCal = maxForType(engine.bajantes.filter((b) => b.tipo === 'calentador'), /^(?:CALENT|calentG)(\d+)$/);
    const maxTrib = maxForType(engine.ramales.filter((r) => r.net === netId && r.tipo === 'tributario'), /^T(\d+)$/);

    let ramalCounter = maxRamal;
    let bajanteCounter = maxBajante;
    let montanteCounter = maxMontante;
    let rpCounter = maxRp;
    let cntCounter = maxCnt;
    let calCounter = maxCal;
    let tributarioCounter = maxTrib;

    // Build map: oldPadreId -> newLabel of padre in destination
    const padreLabelMap: Record<string, string> = {};
    // First process all 'ramal' entries to fill padreLabelMap
    for (const r of srcRamales) {
      if (r.tipo === 'ramal' && r.padre) {
        // Parent exists in source - map its label
        const padreInSrc = srcRamales.find((x: any) => x.id === r.padre);
        if (padreInSrc) {
          padreLabelMap[r.padre] = padreInSrc.label || padreInSrc.id;
        }
      }
    }

    for (const r of srcRamales) {
      if (r.tipo === 'ramal') {
        const oldId = r.id;
        ramalCounter++;
        const newId = pfx + ramalCounter;
        oldToNew[oldId] = newId;
        r.id = newId;
        r.label = newId;
        // Update father map: future tributarios with this padre should reference new label
        padreLabelMap[oldId] = newId;
      } else {
        const oldId = r.id;
        const oldPadre = r.padre || '';
        tributarioCounter++;
        const newId = tPfx + tributarioCounter;
        oldToNew[oldId] = newId;
        r.id = newId;
        // Tributario label: T#<padreLabel> e.g., T1RS5
        const padreLabel = oldPadre ? (padreLabelMap[oldPadre] || oldPadre) : '';
        r.label = padreLabel ? `${newId}${padreLabel}` : newId;
      }
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
        const newId = bmPfx + montanteCounter + '_' + netId;
        oldToNew[origId] = newId;
        b.id = newId;
        b.code = bmPfx + montanteCounter;
      }
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
    }

    /* ── Remap internal references ── */
    for (const el of srcAll) {
      if (el.ini && oldToNew[el.ini]) el.ini = oldToNew[el.ini];
      if (el.fin && oldToNew[el.fin]) el.fin = oldToNew[el.fin];
      if (el.padre && oldToNew[el.padre]) el.padre = oldToNew[el.padre];
      if (el.recibeDeIds) {
        el.recibeDeIds = el.recibeDeIds
          .map((id: string) => oldToNew[id] || id)
          .filter((id: string) => engine.ramales.some((r) => r.id === id) || engine.bajantes.some((b) => b.id === id));
      }
      if (el.alimentaIds) {
        el.alimentaIds = el.alimentaIds
          .map((id: string) => oldToNew[id] || id)
          .filter((id: string) => engine.ramales.some((r) => r.id === id) || engine.bajantes.some((b) => b.id === id));
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

    engine.ramales.push(...(srcRamales as unknown as PlanoRamal[]));
    engine.bajantes.push(...(srcBajantes as unknown as PlanoBajante[]), ...(srcGlobals as unknown as PlanoBajante[]));

    engine._netCounts[netId] = engine._netCounts[netId] || { ramal: 0, tributario: 0 };
    if (ramalCounter > engine._netCounts[netId].ramal) {
      engine._netCounts[netId].ramal = ramalCounter;
    }

    /* ── Write captured source data to new IDs ── */
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
    // Ignore save errors
  }

  engine._dirty = true;
  engine._markDirty();
  engine.render();

  try {
    window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed'));
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
  } catch {
    // Ignore event errors
  }

  return { copied: totalCopied, skippedNets };
}
