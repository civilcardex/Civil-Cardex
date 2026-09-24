import { loadFromStorage, saveToStorage } from '../services/storageService';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../constants/storage-keys';
import { NETS, uniqRamalId } from '../lib/PlanoEngine/PlanoState';
import { isLdesvioRamalId } from './crossFloorStorage';
import { direccionSegura } from '../lib/PlanoEngine/direccionReglas';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../lib/PlanoEngine/PlanoState';

export interface CopySourceSelection {
  netId: string;
  tipos: Set<string>;
}

/** Alineación de láminas entre pisos: el origen de calibración de cada plano (mismo punto
 *  físico del AutoCAD marcado en cada lámina). Con láminas desalineadas, el MISMO punto
 *  físico cae en px distintos por piso — la copia traslada la geometría por el delta de
 *  orígenes para que la posición relativa a los elementos del PDF se preserve. */
export interface CopyAlineacion {
  origenSrc?: { x_px: number; y_px: number } | null;
  origenDst?: { x_px: number; y_px: number } | null;
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
  totalL?: number;
  direccion?: string;
  nptBase?: number;
  labelX?: number;
  labelY?: number;
  copiaPiso?: boolean;
  bloqueado?: boolean;
  _labelBox?: unknown;
  _circ?: unknown;
  _ghost?: unknown;
  _ghostLabelBox?: unknown;
  _net?: unknown;
  isFantasma?: unknown;
  desplazamientos?: unknown;
  pisoBase?: unknown;
  ghostData?: unknown;
}

// Copia total (orig. usuario): los datos hidráulicos SÍ viajan — diámetros, materiales,
// accesorios, aparatos, fixtures y conteos (remapeados a los ids nuevos del piso destino).
// Solo se descartan cachés de render/fantasmas y punteros entre pisos (descargaEnId/origenId),
// que referencian otro piso y ya no significan nada en el destino.
function copyStoreKeys(
  pairs: Array<{ oldId: string; newId: string }>,
  netId: string,
  srcPid: string,
  dstPid: string,
): void {
  if (pairs.length === 0) return;
  const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
    APARATOS_BY_TRAMO_KEY,
    {},
  );
  const hidro = loadFromStorage<
    Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
  >(HYDRO_DATA_STORAGE_KEY, {});
  const gas = loadFromStorage<Record<string, Record<string, number>>>(GAS_ACC_KEY, {});
  let aC = false;
  let hC = false;
  let gC = false;
  for (const { oldId, newId } of pairs) {
    const from = `${netId}_${oldId}_${srcPid}`;
    const to = `${netId}_${newId}_${dstPid}`;
    if (aparatos[from] && !aparatos[to]) {
      aparatos[to] = { ...aparatos[from] };
      aC = true;
    }
    if (hidro[from] && !hidro[to]) {
      hidro[to] = { ...hidro[from], accesorios: { ...(hidro[from].accesorios || {}) } };
      hC = true;
    }
    // Gas vive como `gas_<id>_<plan>` (y legado `gas_<id>` sin plan, compartido — ese no
    // se toca: copiarlo duplicaría el conteo en el piso origen).
    const gFrom = `gas_${oldId}_${srcPid}`;
    const gTo = `gas_${newId}_${dstPid}`;
    const gVal = gas[gFrom] ?? gas[`gas_${oldId}`];
    if (gVal && !gas[gTo]) {
      gas[gTo] = { ...gVal };
      gC = true;
    }
  }
  if (aC) saveToStorage(APARATOS_BY_TRAMO_KEY, aparatos);
  if (hC) saveToStorage(HYDRO_DATA_STORAGE_KEY, hidro);
  if (gC) saveToStorage(GAS_ACC_KEY, gas);
}

/** Modo "solo fantasmas": las copias reales se retiraron DESPUÉS de sembrar sus claves de
 *  conteos — borrar las claves destino de esos ids para no dejar UDs huérfanas contando. */
function purgarClavesDeCopias(
  pairs: Array<{ oldId: string; newId: string }>,
  netId: string,
  dstPid: string,
): void {
  if (pairs.length === 0) return;
  const aparatos = loadFromStorage<Record<string, unknown>>(APARATOS_BY_TRAMO_KEY, {});
  const hidro = loadFromStorage<Record<string, unknown>>(HYDRO_DATA_STORAGE_KEY, {});
  const gas = loadFromStorage<Record<string, unknown>>(GAS_ACC_KEY, {});
  let cambio = false;
  for (const { newId } of pairs) {
    for (const [store, key] of [
      [aparatos, `${netId}_${newId}_${dstPid}`],
      [hidro, `${netId}_${newId}_${dstPid}`],
      [gas, `gas_${newId}_${dstPid}`],
    ] as const) {
      if (key in store) {
        delete store[key];
        cambio = true;
      }
    }
  }
  if (cambio) {
    saveToStorage(APARATOS_BY_TRAMO_KEY, aparatos);
    saveToStorage(HYDRO_DATA_STORAGE_KEY, hidro);
    saveToStorage(GAS_ACC_KEY, gas);
  }
}

/**
 * Copia elementos filtrados por red/tipo de un plano origen a uno destino, renumerando ids.
 * Copia TODO (geometría + diámetros, materiales, accesorios, aparatos, fixtures y conteos
 * remapeados a los ids nuevos). Filtra redes ocultas y tipos no seleccionados.
 * FANTASMA (definición usuario): el MISMO bajante copiado en su posición DESPLAZADA
 * (x+dx, y+dy del anillo de asociación) — según `opciones.fantasmas` se copian solo los
 * originales, solo los desplazados o ambos.
 * @param engine - Motor destino (se usa para renumerar y persistir).
 * @param targetPlanId - Id del plano destino.
 * @param sourcePlanId - Id del plano origen.
 * @param selections - Redes y tipos a copiar.
 * @param opciones - Modo fantasma (default 'ambos').
 * @returns Conteo copiado (lo que queda en el destino) y redes omitidas.
 */
export interface CopyOpciones {
  fantasmas?: 'fantasmas' | 'originales' | 'ambos';
}

export function copyDrawingFromPlan(
  engine: ExtendedEngine,
  targetPlanId: string,
  sourcePlanId: string,
  selections: CopySourceSelection[],
  alineacion?: CopyAlineacion,
  opciones?: CopyOpciones,
): CopyResult {
  const sourceRaw = loadFromStorage(`trazos_${sourcePlanId}`, null);
  if (!sourceRaw) return { copied: 0, skippedNets: ['El plano origen no tiene datos de dibujo'] };

  const sourceData = (typeof sourceRaw === 'string' ? JSON.parse(sourceRaw) : sourceRaw) as {
    ramales?: CopyElement[];
    bajantes?: CopyElement[];
    scaleM?: number;
    crossFloorGhosts?: Array<Record<string, unknown>>;
  };
  // FANTASMA (orig. usuario) = el MISMO bajante copiado en su posición DESPLAZADA por el
  // anillo de asociación (x+dx, y+dy), con dirección 'sube'. El modo decide qué viaja:
  // originales / desplazados / ambos (ver CopyOpciones).
  const modoFantasmas = opciones?.fantasmas ?? 'ambos';
  const srcPid = String(sourcePlanId);

  // PUNTO (orig. usuario: 3.99 vs 3.92 a la misma referencia): cada piso calibra su propio
  // PDF (scaleM = metros por pixel). Copiar coordenadas en crudo arrastra la diferencia de
  // calibración — el mismo trazo mide distinto en cada piso. Normalizar: escalar las
  // coordenadas copiadas por escala_origen/escala_destino. Con la escala única del proyecto
  // (calGlobal) el factor es EXACTAMENTE 1 y la geometría viaja BIT-EXACTA — sin el toFixed
  // que reescribía cada coordenada aunque nada cambiara (causa raíz de cotas distintas
  // entre pisos tras copiar: ver incidente 2026-09-21).
  const srcScale = Number(sourceData.scaleM) || 0.5;
  const dstScale = (engine as { scaleM?: number }).scaleM || srcScale;
  const calibFactor = dstScale > 0 ? srcScale / dstScale : 1;
  // Alineación por origen de calibración (láminas de AutoCAD desalineadas entre pisos):
  // p_dst = (p_src − origen_src) × f + origen_dst  ⇔  p_src × f + offset. Con orígenes
  // iguales y f = 1 la transformación es la identidad EXACTA y la geometría viaja sin tocar.
  const oS = alineacion?.origenSrc ?? null;
  const oD = alineacion?.origenDst ?? null;
  const usaOrigen = !!(oS && oD);
  const offX = usaOrigen ? oD!.x_px - oS!.x_px * calibFactor : 0;
  const offY = usaOrigen ? oD!.y_px - oS!.y_px * calibFactor : 0;
  const mismoEscala = Math.abs(calibFactor - 1) < 1e-9;
  const mismoOrigen = !usaOrigen || (Math.abs(offX) < 1e-9 && Math.abs(offY) < 1e-9);
  const sinTransform = mismoEscala && mismoOrigen;

  const sourceRamales: CopyElement[] = sourceData.ramales || [];
  const sourceBajantes: CopyElement[] = sourceData.bajantes || [];

  let totalCopied = 0;
  const skippedNets: string[] = [];
  const oldToNew: Record<string, string> = {};

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

    // PUNTO 5: los Ldesvio de asociaciones jamás se convierten en ramales reales al copiar.
    const srcRamales = sourceRamales.filter(
      (r) => r.net === netId && copyRamalTipos.has(r.tipo) && !isLdesvioRamalId(r.id),
    );
    // Sin partición: TODOS los bajantes son fuente de ambas formas — el FANTASMA es el
    // MISMO bajante renderizado desplazado (definición usuario); el clon desplazado se
    // genera tras el push según el modo.
    const srcBajantes = sourceBajantes.filter(
      (b) => b.net === netId && copyBajanteTipos.has(b.tipo),
    );
    const srcGlobals = sourceBajantes.filter((b) => copyGlobalTipos.has(b.tipo) && b.net === netId);

    if (srcRamales.length === 0 && srcBajantes.length === 0 && srcGlobals.length === 0) continue;

    const srcAll = [...srcRamales, ...srcBajantes, ...srcGlobals];
    const knownIds = new Set(Object.keys(oldToNew));

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

    // Mapa: oldPadreId -> ETIQUETA NUEVA del padre en el destino (se llena durante el
    // renombre de ramales, abajo). Antes se llenaba con las etiquetas del ORIGEN y los
    // tributarios copiados quedaban referenciando la numeración del piso viejo
    // (T1RS1 aunque su padre renombrado fuera RS2 — orig. usuario: la etiqueta debe llevar
    // el consecutivo DEL PISO destino).
    const padreLabelMap: Record<string, string> = {};

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
      padreLabelMap[oldId] = newId;
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

    // Offset del FANTASMA por bajante, keyeado por el ID VIEJO (revOld en el consumo busca
    // por viejo): capturarlo AQUÍ, antes de pisar b.id — keyear después llenaba el mapa con
    // ids nuevos y los clones jamás se generaban con destino ya poblado (bug destino ocupado).
    const offsetFantasma = new Map<string, { dx: number; dy: number }>();
    for (const b of srcBajantes as unknown as Array<{
      id: string;
      desplazamientos?: Record<string, { dx?: number; dy?: number }>;
    }>) {
      const d = b.desplazamientos && Object.values(b.desplazamientos)[0];
      if (d && (d.dx || d.dy)) offsetFantasma.set(b.id, { dx: d.dx || 0, dy: d.dy || 0 });
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
      delete el.desplazamientos;
      delete (el as CopyElement).pisoBase;
    }
    // Copia total (orig. usuario): geometría + estructura remapeada + TODOS los datos
    // hidráulicos (diámetros, materiales, accesorios, aparatos, fixtures) y los conteos
    // remapeados a los ids nuevos del piso destino.
    const selPairs = Object.keys(oldToNew)
      .filter((k) => !knownIds.has(k))
      .map((k) => ({ oldId: k, newId: oldToNew[k] }));
    // mergesFrom: remapear a los ids nuevos; sin sus piezas, se suelta (colgaría un
    // downstream de un upstream que no existe en el destino).
    for (const r of srcRamales as unknown as { mergesFrom?: unknown }[]) {
      if (!Array.isArray(r.mergesFrom)) continue;
      const m = (r.mergesFrom as string[]).map((id) => oldToNew[id]).filter(Boolean);
      if (m.length) r.mergesFrom = m;
      else delete r.mergesFrom;
    }
    // Libros de herencia (ucAplicado/ucAplicadoHidro): sus claves son ids de ramales
    // destino — remapear los copiados, soltar el resto (acreditarían UDs de trazos que no
    // existen en el destino).
    for (const b of [...srcBajantes, ...srcGlobals] as unknown as Record<string, unknown>[]) {
      for (const k of ['ucAplicado', 'ucAplicadoHidro'] as const) {
        const book = b[k] as Record<string, Record<string, number>> | undefined;
        if (!book || typeof book !== 'object') continue;
        const nb: Record<string, Record<string, number>> = {};
        for (const [dk, dv] of Object.entries(book)) {
          if (oldToNew[dk]) nb[oldToNew[dk]] = dv;
        }
        if (Object.keys(nb).length) b[k] = nb;
        else delete b[k];
      }
    }
    copyStoreKeys(selPairs, netId, srcPid, String(targetPlanId));
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
      isFantasma?: boolean;
      area_m2?: number;
    }[]) {
      b.descargaEnId = null;
      b.origenId = null;
      // Área NO viaja (orig. usuario): la captación pertenece al bajante original — la copia
      // arranca sin área hasta que se le asigne la suya.
      delete b.area_m2;
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

    // Normalización de calibración SOLO si hay algo que corregir: mismo escala y mismos
    // orígenes ⇒ geometría bit-exacta (posiciones idénticas ⇒ cotas idénticas en todos los
    // pisos). Con láminas desalineadas, el delta de orígenes traslada la copia al mismo
    // punto físico de la lámina destino.
    if (!sinTransform) {
      const escalaPt = (pt: number[]): number[] => [
        +(pt[0] * calibFactor + offX).toFixed(3),
        +(pt[1] * calibFactor + offY).toFixed(3),
      ];
      for (const r of srcRamales) {
        if (r.pts) r.pts = r.pts.map((pt) => escalaPt(pt));
        if (r.labelX != null) r.labelX = +(r.labelX * calibFactor + offX).toFixed(3);
        if (r.labelY != null) r.labelY = +(r.labelY * calibFactor + offY).toFixed(3);
      }
      for (const b of srcBajantes as unknown as Array<{
        x?: number;
        y?: number;
        labelX?: number;
        labelY?: number;
      }>) {
        if (b.x != null) b.x = +(b.x * calibFactor + offX).toFixed(3);
        if (b.y != null) b.y = +(b.y * calibFactor + offY).toFixed(3);
        if (b.labelX != null) b.labelX = +(b.labelX * calibFactor + offX).toFixed(3);
        if (b.labelY != null) b.labelY = +(b.labelY * calibFactor + offY).toFixed(3);
      }
      // PUNTO 13: totalL recalculado con la ESCALA DEL PISO DESTINO (la copia heredaba el total
      // del origen — con escalas distintas las distancias no coincidían). La traslación no
      // afecta longitudes.
      const scaleDestino = (engine as { scaleM?: number }).scaleM || 0.5;
      for (const r of srcRamales) {
        if (!r.pts || r.pts.length < 2) continue;
        let px = 0;
        for (let i = 0; i + 1 < r.pts.length; i++)
          px += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
        r.totalL = +((px / 96) * 2.54 * scaleDestino).toFixed(3);
      }
    }
    // PUNTO 9 (copia): 'baja' sin piso debajo en el destino → 'continua'.
    for (const b of srcBajantes)
      b.direccion = direccionSegura(engine, b, b.direccion) ?? b.direccion;
    engine.ramales.push(...(srcRamales as unknown as PlanoRamal[]));
    engine.bajantes.push(
      ...(srcBajantes as unknown as PlanoBajante[]),
      ...(srcGlobals as unknown as PlanoBajante[]),
    );

    // Copias FANTASMA (definición usuario): el mismo bajante en su posición DESPLAZADA
    // (x+dx, y+dy del anillo) con direccion 'sube' — la versión dashed de la imagen. Se
    // generan tras el push (x/y ya transformadas por la alineación).
    const revOld: Record<string, string> = {};
    for (const [o, n] of Object.entries(oldToNew)) revOld[n] = o;
    const phantoms: PlanoBajante[] = [];
    const oldIdsConClon = new Set<string>();
    if (modoFantasmas !== 'originales') {
      const nuevos = (
        engine.bajantes as unknown as Array<
          Record<string, unknown> & { id: string; tipo: string; x?: number; y?: number }
        >
      ).slice(-(srcBajantes.length + srcGlobals.length));
      for (const b of nuevos) {
        const off = offsetFantasma.get(revOld[b.id] || b.id);
        if (!off) continue;
        oldIdsConClon.add(revOld[b.id] || b.id);
        // El anillo es un VECTOR en px crudos del frame origen: escalarlo por calibFactor
        // (la traslación ya se cancela — b.x/y están transformados; la escala no).
        const f = calibFactor || 1;
        const ph = {
          ...b,
          x: (b.x ?? 0) + off.dx * f,
          y: (b.y ?? 0) + off.dy * f,
          direccion: 'sube',
        } as Record<string, unknown> & { tipo: string; id: string };
        // Sin labelX/labelY heredados: quedaban en la posición del bajante base, lejos del
        // glifo desplazado — el render auto-posiciona la etiqueta junto al símbolo.
        delete ph.labelX;
        delete ph.labelY;
        if (ph.tipo === 'montante') {
          montanteCounter++;
          ph.id = monPfx + montanteCounter + '_' + netId;
        } else {
          bajanteCounter++;
          ph.id = bmPfx + bajanteCounter;
        }
        ph.code = ph.id;
        phantoms.push(ph as unknown as PlanoBajante);
      }
      if (modoFantasmas === 'fantasmas') {
        // Solo fantasmas: retirar las copias REALES recién agregadas (y ramales seleccionados)
        // — queda solo la versión desplazada (sube). SIN bajantes con anillo (phantoms vacío)
        // el destino queda como estaba: se retira todo y el conteo da 0 (antes: splice total
        // + "✓ N copiados" con el canvas intacto).
        (engine.bajantes as unknown[]).splice(
          engine.bajantes.length - srcBajantes.length - srcGlobals.length,
          srcBajantes.length + srcGlobals.length,
        );
        (engine.ramales as unknown[]).splice(engine.ramales.length - srcRamales.length);
        if (phantoms.length) {
          // Los clones heredaron punteros de las copias retiradas: sanear contra lo que
          // SIGUE vivo (los ramales referenciados se splicean arriba).
          const vivos = new Set<string>([
            ...(engine.bajantes as Array<{ id: string }>).map((b) => b.id),
            ...(engine.ramales as Array<{ id: string }>).map((r) => r.id),
          ]);
          for (const ph of phantoms as unknown as Array<Record<string, unknown>>) {
            for (const k of ['recibeDeIds', 'alimentaIds'] as const) {
              const arr = ph[k] as string[] | undefined;
              if (Array.isArray(arr)) ph[k] = arr.filter((id) => vivos.has(id));
            }
            if (ph.descargaEnId && !vivos.has(String(ph.descargaEnId))) delete ph.descargaEnId;
          }
          purgarClavesDeCopias(selPairs, netId, String(targetPlanId));
        }
      }
      if (phantoms.length) engine.bajantes.push(...(phantoms as unknown as PlanoBajante[]));
    }

    // PUNTO (orig. usuario): las COTAS NO se copian — al copiar bajantes con una cota cerca,
    // la cota viajaba también con la copia. Las cotas pertenecen a la anotación del plano
    // destino y se acotan allí manualmente.

    // Doble etiqueta (orig. usuario): si el piso origen proyectó un FANTASMA del bajante en
    // este piso destino, el bajante ahora copiado coexistía con ese fantasma residual que
    // muestra el mismo código — dos etiquetas para el mismo elemento. Tras copiar DESDE un
    // plano, TODOS sus fantasmas proyectados aquí son redundantes (sus bajantes ya están
    // materializados como copias); se retiran por sourcePlanId y por id viejo/nuevo.
    // Doble etiqueta: el XFG que este destino proyectaba del origen es redundante cuando el
    // bajante quedó MATERIALIZADO aquí. En 'originales' son todos; con clones ('ambos'/
    // 'fantasmas') SOLO los que tienen clon — sin clon el usuario pidió conservar la proyección
    // (test copyFloorsAndDiametros 'ambos': XFG sin anillo sobrevive).
    if (modoFantasmas === 'originales' || oldIdsConClon.size > 0) {
      const conClonOld = [...oldIdsConClon].map((o) => ({ o, n: oldToNew[o] }));
      const copiedOldIds = new Set(
        modoFantasmas === 'originales' ? Object.keys(oldToNew) : conClonOld.map((x) => x.o),
      );
      const copiedNewIds = new Set(
        modoFantasmas === 'originales'
          ? Object.values(oldToNew)
          : conClonOld.map((x) => x.n).filter(Boolean as unknown as (n: string) => boolean),
      );
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
    }

    engine._netCounts[netId] = engine._netCounts[netId] || { ramal: 0, tributario: 0 };
    if (ramalCounter > engine._netCounts[netId].ramal) {
      engine._netCounts[netId].ramal = ramalCounter;
    }

    // Conteo HONESTO: lo que queda en el destino tras los splice — en modo fantasmas solo
    // los clones (las bases se retiraron; antes se contaba srcAll completo siempre).
    if (modoFantasmas === 'fantasmas') totalCopied += phantoms.length;
    else totalCopied += srcAll.length + (modoFantasmas === 'ambos' ? phantoms.length : 0);
  }

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
