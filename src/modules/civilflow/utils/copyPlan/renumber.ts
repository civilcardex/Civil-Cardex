/**
 * Renumeración de ids al copiar: siembra contadores por tipo desde el máximo EXISTENTE del piso
 * destino (ramal, bajante, montante, red pública, contador, calentador), acuña etiquetas de
 * tributario T#<padre> libres por raíz y captura el offset del fantasma (anillo de asociación)
 * ANTES de pisar el id viejo. Ej: destino con RS1..RS3 → las copias llegan como RS4, RS5…
 */
import { uniqRamalId } from '../../lib/PlanoEngine/PlanoState.ts';
import type { PlanoRamal, PlanoBajante } from '../../lib/PlanoEngine/PlanoState.ts';
import type { CopyElement } from './types.ts';

/** Contadores de numeración por tipo de elemento (mutables: los fantasmas incrementan bajante/montante después). */
export interface Contadores {
  ramal: number;
  bajante: number;
  montante: number;
  rp: number;
  cnt: number;
  cal: number;
}

/** Resultado del renombre: los contadores vivos y el offset del anillo por id VIEJO de bajante. */
export interface RenombreResult {
  contadores: Contadores;
  offsetFantasma: Map<string, { dx: number; dy: number }>;
}

/** Renombra los elementos copiados IN SITU (muta src* y oldToNew) y devuelve contadores + offsets. */
export function renombrarElementos(
  engine: { ramales: PlanoRamal[]; bajantes: PlanoBajante[] },
  netId: string,
  pfx: string,
  bmPfx: string,
  monPfx: string,
  srcRamales: CopyElement[],
  srcBajantes: CopyElement[],
  srcGlobals: CopyElement[],
  srcPid: string,
  oldToNew: Record<string, string>,
): RenombreResult {
  /* ── Generar nuevos IDs ── */
  const maxForType = (arr: (PlanoRamal | PlanoBajante)[], regex: RegExp): number =>
    arr.reduce((m: number, e) => {
      const mr = e.id?.match(regex);
      return mr ? Math.max(m, parseInt(mr[1], 10)) : m;
    }, 0);

  // Los contadores máximos se calculaban con un .filter sobre engine.ramales/engine.bajantes
  // COMPLETOS cada uno (6 recorridos completos por lote). Con un recorrido por red y tipo
  // basta: los filtros salen de las listas ya acotadas.
  const ramalesDeLaRed = engine.ramales.filter((r) => r.net === netId);
  const bajantesDeLaRed = engine.bajantes.filter((b) => b.net === netId);
  const maxRamal = maxForType(
    ramalesDeLaRed.filter((r) => r.tipo === 'ramal'),
    new RegExp('^' + pfx + '(\\d+)$'),
  );
  const maxBajante = maxForType(
    bajantesDeLaRed.filter((b) => b.tipo === 'bajante'),
    new RegExp('^' + bmPfx + '(\\d+)$'),
  );
  const maxMontante = maxForType(
    bajantesDeLaRed.filter((b) => b.tipo === 'montante'),
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
  const contadores: Contadores = {
    ramal: maxRamal,
    bajante: maxBajante,
    montante: maxMontante,
    rp: maxRp,
    cnt: maxCnt,
    cal: maxCal,
  };

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
    contadores.ramal++;
    const newId = pfx + contadores.ramal;
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
      contadores.bajante++;
      const newId = bmPfx + contadores.bajante;
      oldToNew[origId] = newId;
      b.id = newId;
      b.code = newId;
    } else if (b.tipo === 'montante') {
      contadores.montante++;
      const newId = monPfx + contadores.montante + '_' + netId;
      oldToNew[origId] = newId;
      b.id = newId;
      b.code = monPfx + contadores.montante;
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
      contadores.rp++;
      const newId = 'RP' + contadores.rp;
      oldToNew[origId] = newId;
      b.id = newId;
      b.code = newId;
    } else if (b.tipo === 'contador') {
      contadores.cnt++;
      const pfx = b.net === 'gas' ? 'CTNG' : 'CNTAF';
      const newId = pfx + contadores.cnt;
      oldToNew[origId] = newId;
      b.id = newId;
      b.code = newId;
    } else if (b.tipo === 'calentador') {
      contadores.cal++;
      const newId = 'CALENT' + contadores.cal;
      oldToNew[origId] = newId;
      b.id = newId;
      b.code = newId;
    }
    b.copiaPiso = true;
  }

  return { contadores, offsetFantasma };
}
