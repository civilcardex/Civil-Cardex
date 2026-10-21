import { LE_K } from '../constants';
import { perfilDe } from '../constants/countryStandards';
import { renouardByType, qDisenoGas } from './gasUtils.ts';
import { mapaPadresGas, acumuladosGas, claveGas, type GasTramoNeto } from './gasNetwork.ts';

/**
 * Núcleo de cálculo de la red de gas (una sola cuenta para toda la app).
 *
 * Antes vivía duplicado en dos sitios: `checkRows` dentro de GasDesign.tsx (con los diámetros
 * y accesorios VIVOS de la pantalla) y `computeGasRows` en gasRows.ts (con lo que hay en
 * storage, para la tabla resumen). La fórmula es la misma; lo que cambia son las ENTRADAS,
 * así que aquí van por parámetro: cada pantalla dice de dónde saca el diámetro interior, los
 * accesorios y los factores.
 */

/** Tipos de accesorio que aportan longitud equivalente (Le, la longitud extra que representa
 *  el accesorio en la tubería) a la pérdida de carga. */
export const GAS_ACC_KEYS = [
  'codos_90_std',
  'codos_90_std_sube',
  'codos_90_std_baja',
  'codos_90_rl',
  'codos_90_rl_sube',
  'codos_90_rl_baja',
  'te_linea',
  'te_ramal',
  'teeTapon',
  'valvula_bola',
] as const;

/** Tramo de gas tal como lo necesita la cuenta: identidad, piso, largo y geometría. */
export interface TramoGasCalc {
  id: string;
  planId: string | number;
  piso: number;
  /** Largo desarrollado (m). */
  longitud: number;
  /** Es un tributario (cuelga de otro tramo): sirve para elegir el padre en la unión. */
  esTrib: boolean;
  pts?: number[][];
  _tribReversed?: boolean;
}

/** Factores de corrección por altitud/temperatura/densidad (salen de factoresGas). */
export interface FactoresGasCalc {
  pAtm: number;
  DR: number;
  fAlt: number;
  fTemp: number;
  fDens: number;
}

/** Resultado por tramo: la fila de cálculo de la red de gas. */
export interface FilaGasCalc {
  /** Clave única "piso:id" (los ids de ramal se repiten entre pisos). */
  clave: string;
  id: string;
  planId: string | number;
  piso: number;
  /** Longitud equivalente de los accesorios (m). */
  le: number;
  /** Consumo por criterio Renouard (m³/h). */
  qConsumo: number;
  fAlt: number;
  fTemp: number;
  fDens: number;
  /** Caudal de diseño (m³/h), con el piso de 2.7 de la norma. */
  qDiseno: number;
  /** Pérdida de carga del tramo (mbar). */
  dP: number;
  /** Pérdida acumulada desde el inicio de la red (mbar). */
  dPAcum: number;
  /** Velocidad del gas (m/s). */
  vel: number;
  /** Presión al inicio del tramo (mbar). */
  pIni: number;
  /** Presión al final del tramo (mbar). */
  pFin: number;
  /** 'O.K.' | 'NO' | '—' (sin caudal o sin diámetro). */
  chequeo: string;
}

export interface EntradaCalculoGas {
  /** Tramos que participan en la red (los que quedan fuera no se cuentan). */
  tramos: TramoGasCalc[];
  /** Diámetro interior del tubo (mm) por tramo; 0 si no hay material/diámetro elegido. */
  dIntDe: (t: TramoGasCalc) => number;
  /** Accesorios instalados (cantidad por tipo) por tramo. */
  accDe: (t: TramoGasCalc) => Record<string, number>;
  /** Aparatos (focos) propios de cada tramo, por clave "piso:id". */
  propios: Map<string, Record<string, number>>;
  /** Presión mínima de la red (mbar). */
  pMin: number;
  /** Factores de corrección del sitio. */
  factores: FactoresGasCalc;
  /** País: fija los límites de velocidad y de pérdida acumulada. */
  pais?: string;
}

/**
 * Calcula la red de gas: consumo acumulado por tramo, caudal de diseño, pérdida de carga,
 * presión a lo largo del recorrido y el chequeo contra la norma del país.
 *
 * El recorrido se ordena por PROFUNDIDAD en el árbol (el padre antes que el hijo) para que la
 * presión se herede de arriba hacia abajo; a igual profundidad, por piso descendente.
 */
export function calculaFilasGas(entrada: EntradaCalculoGas): FilaGasCalc[] {
  const { tramos, dIntDe, accDe, propios, pMin, factores, pais } = entrada;
  const { pAtm, DR, fAlt, fTemp, fDens } = factores;

  const tramosNeto: GasTramoNeto[] = tramos.map((t) => ({
    id: t.id,
    planId: t.planId,
    pts: t.pts,
    _tribReversed: t._tribReversed,
  }));
  const esTribDe = new Map<string, boolean>(
    tramos.map((t) => [claveGas(t.planId, t.id), t.esTrib] as const),
  );
  const padres = mapaPadresGas(tramosNeto, (t) => esTribDe.get(claveGas(t.planId, t.id)) === true);

  // Profundidad en el árbol: el padre tiene SIEMPRE menor profundidad que el hijo, así que
  // ordenando por profundidad el padre se calcula antes y la presión se hereda bien.
  const prof = new Map<string, number>();
  const depth = (k: string, g = 0): number => {
    if (prof.has(k)) return prof.get(k)!;
    if (g > tramos.length) return 0;
    const pa = padres.get(k);
    const d = pa ? depth(pa, g + 1) + 1 : 0;
    prof.set(k, d);
    return d;
  };
  for (const t of tramos) depth(claveGas(t.planId, t.id));
  const orden = [...tramos].sort(
    (a, b) =>
      (prof.get(claveGas(a.planId, a.id)) ?? 0) - (prof.get(claveGas(b.planId, b.id)) ?? 0) ||
      b.piso - a.piso,
  );

  const acumulados = acumuladosGas(tramosNeto, padres, propios);

  const result: FilaGasCalc[] = [];
  const pFinPorClave = new Map<string, number>();
  const dPAcumPorClave = new Map<string, number>();
  for (const t of orden) {
    const dInt = dIntDe(t) || 0;
    const acc = accDe(t) || {};
    let sumLe = 0;
    for (const k of GAS_ACC_KEYS)
      sumLe += (acc[k] || 0) * ((LE_K as Record<string, number>)[k] || 0);
    const le = dInt > 0 ? (dInt * sumLe) / 1000 : 0;
    const appCounts = acumulados.get(claveGas(t.planId, t.id)) || {};
    const qRenouard = renouardByType(appCounts);
    const qDiseno = qDisenoGas(qRenouard, { pAtm, DR, fAlt, fTemp, fDens });
    const dP =
      dInt > 0
        ? ((23200 * (le + (t.longitud || 0)) * Math.pow(qDiseno, 1.82)) / Math.pow(dInt, 4.82)) *
          Math.pow(DR, 0.82)
        : 0;
    const vel = dInt > 0 ? (354 * qDiseno * 101.325) / (dInt * dInt) / pAtm : 0;
    const clave = claveGas(t.planId, t.id);
    const padre = padres.get(clave);
    // Presión por TOPOLOGÍA: nace del padre; la raíz, de la presión del operador.
    const pIni = padre ? (pFinPorClave.get(padre) ?? pMin) : pMin;
    const pFin = pIni - dP;
    pFinPorClave.set(clave, pFin);
    const dPAcum = (padre ? (dPAcumPorClave.get(padre) ?? 0) : 0) + dP;
    dPAcumPorClave.set(clave, dPAcum);
    // Chequeo del país: V ≤ vMax y pérdida acumulada ≤ dpMax.
    const limGas = perfilDe(pais).gas;
    const ok =
      vel > 0 && vel <= limGas.vMax && dP > 0
        ? dPAcum <= limGas.dpMax
          ? 'O.K.'
          : 'NO'
        : dP > 0
          ? 'NO'
          : '—';
    result.push({
      clave,
      id: t.id,
      planId: t.planId,
      piso: t.piso,
      le,
      qConsumo: qRenouard,
      fAlt,
      fTemp,
      fDens,
      qDiseno,
      dP,
      dPAcum,
      vel,
      pIni,
      pFin,
      chequeo: ok,
    });
  }
  return result;
}

/**
 * Accesorios de un tramo: la clave compuesta "gas_id_planId" con respaldo al formato viejo
 * (solo id), porque los ids de ramal se repiten entre pisos.
 */
export function accesoriosDeTramo(
  accPorId: Record<string, Record<string, number>>,
  t: { id: string; planId: string | number },
): Record<string, number> {
  return accPorId[`gas_${t.id}_${t.planId}`] || accPorId[t.id] || {};
}

/**
 * Aparatos (focos) propios de un tramo: misma clave que los accesorios ("gas_id_planId").
 */
export function propiosDeTramo(
  aparatos: Record<string, Record<string, number>>,
  t: { id: string; planId: string | number },
): Record<string, number> {
  const appPid = t.planId ? `_${String(t.planId)}` : '';
  return aparatos[`gas_${t.id}${appPid}`] || aparatos[`gas_${t.id}`] || {};
}
