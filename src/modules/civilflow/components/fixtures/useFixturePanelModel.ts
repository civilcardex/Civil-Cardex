/**
 * Modelo puro del panel de aparatos (FixturesPanel): los criterios que deciden si un tramo
 * es de solo lectura, cuántas UD (Unidades de Descarga) muestra, y las filas de accesorios.
 * Funciones sin React: reciben sus datos por parámetro y el panel las llama desde sus hooks.
 * Ej: esTramoPropagado({storageKey: 'af_RAF1_3', netId: 'af', ...}) -> true si RAF1 trae UD
 * heredadas de una unión o montante (el panel se vuelve opaco).
 */
import { ACCESORIOS_HIDRO, GAS_ACCESORIOS } from '../../constants';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { leerHeredadosPresion, leerFoldTribPresion } from '../../utils/propagation';
import { loadFromStorage } from '../../services/storageService.ts';
import type { DrawingData } from '../../utils/drawingSync.ts';
import { agregarCargaDeBajante } from './bajanteAggregate.ts';
import type { CountsMap, SelectableTarget } from '../fixturesStorage.ts';
import { bajanteLabel, ramalLabel } from '../../utils/accessoryAbbreviations.ts';

/** Lo mínimo del motor que el panel necesita para sus criterios (sin acoplar a PlanoEngine). */
export interface MotorPanel {
  bajantes: Array<{ id: string; net?: string }>;
  ramales: Array<{ id: string; net?: string; padre?: string | null }>;
}

/** Ref al motor como lo guarda el panel (puede estar sin piso cargado). */
export type RefMotorPanel = { current: MotorPanel | null };

/**
 * Tramo con herencia propagada (RAF3): sus UD las trae aguas arriba — el panel se vuelve SOLO
 * LECTURA (opaco); la edición es en los ramales/montante fuente. Criterio POR RED: presión
 * (af/ac/gas) lee los DOS libros del propagador — heredados (uniones/montante) y plegado de
 * TRIBUTARIOS; san/ll son receptores si (a) su clave aparece como DESTINO en el libro
 * ucAplicado de algún bajante del piso, (b) son SALIDA de un bajante, o (c) tienen
 * TRIBUTARIOS conectados que traen aparatos (DFS por `padre`).
 */
export function esTramoPropagado(p: {
  storageKey: string | null;
  targetId: string | null;
  netId: string;
  planId?: string | number;
  counts: CountsMap;
  engineRef: RefMotorPanel;
  exitsDeBajante: (bajId: string) => Set<string>;
}): boolean {
  const { storageKey, targetId, netId, planId, counts, engineRef, exitsDeBajante } = p;
  if (!storageKey || !targetId) return false;
  if (netId === 'af' || netId === 'ac' || netId === 'gas') {
    const her = leerHeredadosPresion(storageKey);
    const fold = leerFoldTribPresion(storageKey);
    return (
      Object.values(her).some((v: number) => v > 0) ||
      Object.values(fold).some((v: number) => v > 0)
    );
  }
  if (netId === 'san' || netId === 'll') {
    try {
      const d = loadFromStorage<{
        bajantes?: Array<{ ucAplicado?: Record<string, Record<string, number>> }>;
      } | null>(TRAZOS_PREFIX + String(planId ?? ''), null);
      for (const b of d?.bajantes || []) {
        const e = (b.ucAplicado || {})[storageKey];
        if (e && Object.keys(e).some((k) => (e[k] || 0) > 0)) return true;
      }
    } catch {
      /* sin storage: no bloquear */
    }
    const eng = engineRef.current;
    if (eng) {
      // (b) Salida de un bajante: el espejo reescribe su clave en cada pase.
      for (const b of eng.bajantes) {
        if (b.net !== netId) continue;
        if (exitsDeBajante(b.id).has(targetId)) return true;
      }
      // (c) Tributarios conectados: cualquier descendiente por `padre` con aparatos propios
      // bloquea — su carga sube al ramal por plegado (el ramal no es fuente).
      const vistas = new Set<string>([targetId]);
      const cola: string[] = [targetId];
      while (cola.length > 0) {
        const actual = cola.pop() as string;
        for (const r of eng.ramales) {
          if (r.net !== netId || r.padre !== actual || vistas.has(r.id)) continue;
          vistas.add(r.id);
          const m = counts[`${netId}_${r.id}_${planId}`] || {};
          if (Object.values(m).some((v: number) => v > 0)) return true;
          cola.push(r.id);
        }
      }
    }
  }
  return false;
}

/**
 * Ramal/espejo que NO se edita desde el panel: montantes asociados entre pisos (origenId, en
 * su red af/ac/gas/vent), el Ldesvio (LD_) san/ll, bajantes asociados desde arriba o a una
 * bomba, y cualquier salida de un bajante (el espejo manda sus UD). Ej: un ramal con cola
 * sobre BAN1 -> true, panel opaco.
 */
export function esEspejoDeBajante(p: {
  targetId: string | null;
  netId: string;
  selElement: SelectableTarget | null;
  engineRef: RefMotorPanel;
  exitsDeBajante: (bajId: string) => Set<string>;
}): boolean {
  const { targetId, netId, selElement, engineRef, exitsDeBajante } = p;
  if (!targetId) return false;
  // MONTANTES asociados entre pisos (orig. usuario): mismo solo-lectura que bajantes, en su
  // red (af/ac/gas/vent). El resto de gates de espejos quedan en san/ll como estaban.
  const esRedAsociable =
    netId === 'san' ||
    netId === 'll' ||
    netId === 'af' ||
    netId === 'ac' ||
    netId === 'gas' ||
    netId === 'vent';
  if (!esRedAsociable) return false;
  if (selElement?.tipo === 'montante') {
    const origenM = selElement as { origenId?: string };
    if (origenM.origenId) return true;
  }
  if (netId !== 'san' && netId !== 'll') return false;
  // Todo Ldesvio es el espejo del bajante superior — siempre solo lectura.
  if (targetId.startsWith('LD_')) return true;
  // Bajante asociado desde arriba (origenId) o a una bomba (bombaEnId): UDs del grupo.
  const origen = selElement as { origenId?: string; bombaEnId?: string } | null;
  if (origen?.origenId || origen?.bombaEnId) return true;
  const eng = engineRef.current;
  if (!eng) return false;
  for (const baj of eng.bajantes) {
    if (baj.net !== netId) continue;
    if (exitsDeBajante(baj.id).has(targetId)) return true;
  }
  return false;
}

/**
 * Agregado de UD del bajante: delega en agregarCargaDeBajante (clave propia + ramales que
 * drenan en él, menos las salidas espejo). Wrapper de módulo para que el panel mantenga su
 * useCallback con la misma firma de siempre.
 */
export function agregadoBajanteDe(args: {
  bajId: string;
  counts: CountsMap;
  netId: string;
  planId?: string | number;
  sanConnectivity: Parameters<typeof agregarCargaDeBajante>[0]['sanConnectivity'];
  tramosPiso: Parameters<typeof agregarCargaDeBajante>[0]['tramosPiso'];
  exits: Set<string>;
  engineRef: Parameters<typeof agregarCargaDeBajante>[0]['engineRef'];
}): Record<string, number> {
  return agregarCargaDeBajante(args);
}

/**
 * Decrementa el codo 90° medio de gas: la fila única de la sidebar suma medio + sube + baja,
 * así que el − quita de la orientación que tenga unidades primero.
 * Ej: acc {codos_90_std_sube: 2} -> decAccGas('codos_90_std_sube').
 */
export function gasCodoDecDe(
  acc: Record<string, number>,
  accId: string,
  decAccGas: (id: string) => void,
): void {
  const target = [accId, `${accId}_sube`, `${accId}_baja`].find((k) => (acc[k] || 0) > 0);
  if (target) decAccGas(target);
}

/** Las tres orientaciones reales del codo 90° medio AF/AC (la fila única las fusiona). */
export const AFAC_CODO_MERGE: Record<string, string[]> = {
  codo90rm: ['codo90rm', 'codo90rmSube', 'codo90rmBaja'],
};
/** Igual para las dos familias de codos 90° de gas (std y rl). */
export const GAS_CODO_MERGE: Record<string, string[]> = {
  codos_90_std: ['codos_90_std', 'codos_90_std_sube', 'codos_90_std_baja'],
  codos_90_rl: ['codos_90_rl', 'codos_90_rl_sube', 'codos_90_rl_baja'],
};

/**
 * Decrementa el codo 90° medio AF/AC: +/− escriben sobre ids REALES vivos (un codo manual en
 * 'codo90rm' sería borrado por calcHydroAccessories al re-sincronizar), así que el − quita de
 * la orientación (sube/baja/base) que tenga unidades primero.
 */
export function afAcCodoDecDe(
  acc: Record<string, number>,
  accId: string,
  decAcc: (id: string) => void,
): void {
  if (accId !== 'codo90rm') return decAcc(accId);
  const target = ['codo90rmSube', 'codo90rmBaja', 'codo90rm'].find((k) => (acc[k] || 0) > 0);
  if (target) decAcc(target);
}

/**
 * Filas de accesorios de AF/AC: catálogo hidro sin tees/tapón (la tabla hidráulica los calcula
 * sola) ni las variantes sube/baja; el codo90rm se muestra fusionado como "Codo medio 90°".
 */
export function itemsAccAfAc(): typeof ACCESORIOS_HIDRO {
  return ACCESORIOS_HIDRO.filter(
    (a) =>
      // Literal inline: la lista es fija (7 ids), no escala con el plano.
      ![
        'teeDirecto',
        'teeSube',
        'teeBaja',
        'teeTapon',
        'teeLlaveTerminal',
        'tapon',
        'llaveTerminal',
      ].includes(a.id) &&
      a.id !== 'codo90rmSube' &&
      a.id !== 'codo90rmBaja',
  ).map((a) => (a.id === 'codo90rm' ? { ...a, nombre: 'Codo medio 90°' } : a));
}

/** Filas de accesorios de gas: catálogo de gas sin las variantes _sube/_baja (fusionadas). */
export function itemsAccGas(): typeof GAS_ACCESORIOS {
  return GAS_ACCESORIOS.filter((a) => !a.id.endsWith('_sube') && !a.id.endsWith('_baja'));
}

/**
 * Etiqueta COMPLETA del elemento seleccionado con sufijo de piso (p. ej. "RS1-P1"/"BAN2-P1") —
 * la misma del canvas. Ramales llevan el piso ACTUAL; bajantes/cajas/bomba/montantes su
 * pisoBase.
 */
export function etiquetaDelTarget(
  t: SelectableTarget | null,
  opts: { rejillasArea?: boolean; nivelLbl?: string },
): string {
  if (!t) return '';
  const pisoBase = (t as { pisoBase?: string }).pisoBase;
  if (t.tipo === 'bajante' || t.tipo === 'caja_san' || t.tipo === 'caja_ll' || t.tipo === 'bomba')
    return bajanteLabel(t, pisoBase);
  if (t.tipo === 'montante') return bajanteLabel(t, pisoBase);
  if (opts.rejillasArea && t.id?.startsWith('AR')) return t.label || t.id;
  return ramalLabel(t, opts.nivelLbl) || t.id || '';
}

/**
 * Todos los ramales del plano actual (storage crudo, no el motor en vivo) — necesario para
 * hallar, en AF/AC/gas, qué ramal acumula la UC (Unidades de Consumo) combinada de un empalme.
 * Se re-lee fresco en cada render (el dibujo cambia constantemente con el panel abierto).
 */
export function leerRamalesDePlan(
  planId: string | number | undefined,
  engineRef: { current: { ramales: unknown[] } | null },
): DrawingData['ramales'] {
  const fromStorage = planId
    ? loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + planId, null)?.ramales || []
    : [];
  if (fromStorage.length > 0) return fromStorage;
  // Fallback al motor vivo (planId puede ser string vs number, o storage aún no volcado)
  return (engineRef.current?.ramales || []).filter((r) => {
    // Filtrar por planId si existe; si no, tomar todos de la red activa
    const pid = (r as unknown as { planId?: string | number }).planId;
    return planId == null || pid == null || String(pid) === String(planId);
  }) as unknown as DrawingData['ramales'];
}
