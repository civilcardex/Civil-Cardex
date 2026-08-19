import type { PlanItem } from '../context/PlansContext';
import { LE_K } from '../constants';
import { GAS } from '../constants/engineeringDataGas';
import { normalizeDnLabel } from './formatUtils';
import { loadFromStorage } from '../services/storageService';
import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  GAS_DATOS_KEY,
} from '../constants/storage-keys';
import { renouardByType } from './gasUtils';
import type { DrawingData, RawElement } from './drawingSync';

interface GasRamalRaw extends RawElement {
  Lh?: number;
}

const ACC_KEYS = [
  'codos_90_std',
  'codos_90_std_sube',
  'codos_90_std_baja',
  'codos_90_rl',
  'codos_90_rl_sube',
  'codos_90_rl_baja',
  'te_linea',
  'te_ramal',
  'valvula_bola',
];

export interface GasDatosGenerales {
  alt: string;
  patm: string;
  temp: string;
  pmin: string;
  densRel: string;
}

export const GAS_DATOS_DEFAULT: GasDatosGenerales = {
  alt: '959',
  patm: '90.32',
  temp: '23',
  pmin: '17',
  densRel: '0.67',
};

let allDnCache: { mat: string; K: number; dn: string; d: number }[] | null = null;
function allDn() {
  if (!allDnCache) {
    allDnCache = [];
    GAS.forEach((g) =>
      g.rows.forEach((r) => allDnCache!.push({ mat: g.mat, K: g.K, dn: r.dn, d: r.d })),
    );
  }
  return allDnCache;
}
function lookupDn(mat: string, dn: string) {
  const normDn = normalizeDnLabel(dn);
  return allDn().find((x) => x.mat === mat && (x.dn === dn || x.dn === normDn)) || null;
}

export interface GasRow {
  id: string;
  piso: number;
  ini: string;
  fin: string;
  material: string;
  dn: string;
  dInt: number;
  K: number;
  longitud: number;
  le: number;
  dP: number;
  vel: number;
  pIni: number;
  pFin: number;
  chequeo: string;
}

export function computeGasRows(plans: PlanItem[]): GasRow[] {
  const datos = loadFromStorage<GasDatosGenerales>(GAS_DATOS_KEY, GAS_DATOS_DEFAULT);
  const pMin = Number(datos.pmin) || 17;
  const pAtm = Number(datos.patm) || 101.325;
  const T = Number(datos.temp) || 23;
  const DR = Number(datos.densRel) || 0.67;
  const fAlt = 101.325 / pAtm;
  const fTemp = Math.sqrt(288 / (273 + T));
  const fDens = Math.sqrt(0.67 / DR);

  const gasTramos: {
    id: string;
    planId: string | number;
    piso: number;
    ini: string;
    fin: string;
    longitud: number;
    material: string;
    diametro: string;
  }[] = [];
  for (const plano of plans) {
    if (!plano || plano.status !== 'confirmed' || plano.nivel == null) continue;
    const data = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
    if (!data) continue;
    for (const r of (data.ramales || []) as GasRamalRaw[]) {
      if (r.net !== 'gas' || r.tipo === 'tributario') continue;
      gasTramos.push({
        id: r.id,
        planId: plano.id,
        piso: Number(r.piso ?? plano.nivel) || 0,
        ini: r.ini || '',
        fin: r.fin || '',
        longitud: r.totalL || r.Lh || 0,
        material: r.material || '',
        diametro: r.diametro || '',
      });
    }
  }
  gasTramos.sort((a, b) => (b.piso || 0) - (a.piso || 0));

  const gasAcc = loadFromStorage<Record<string, Record<string, number>>>(GAS_ACC_KEY, {});
  const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
    APARATOS_BY_TRAMO_KEY,
    {},
  );

  const result: GasRow[] = [];
  let pAcum = pMin;
  for (const t of gasTramos) {
    const opt = lookupDn(t.material, t.diametro);
    const dInt = opt ? opt.d : 0;
    const K = opt ? opt.K : 0;
    const dn = opt ? opt.dn : t.diametro;

    const acc = gasAcc[t.id] || {};
    let sumLe = 0;
    for (const k of ACC_KEYS) sumLe += (acc[k] || 0) * ((LE_K as Record<string, number>)[k] || 0);
    const le = dInt > 0 ? (dInt * sumLe) / 1000 : 0;
    const appPid = t.planId ? `_${String(t.planId)}` : '';
    const appCounts = aparatos[`gas_${t.id}${appPid}`] || aparatos[`gas_${t.id}`] || {};
    const qRenouard = renouardByType(appCounts);
    const qDiseno = Math.max(qRenouard * fAlt * fTemp * fDens, 2.7);
    const dP =
      dInt > 0
        ? ((23200 * (le + t.longitud) * Math.pow(qDiseno, 1.82)) / Math.pow(dInt, 4.82)) *
          Math.pow(DR, 0.82)
        : 0;
    const vel = dInt > 0 ? (354 * qDiseno * 101.325) / (dInt * dInt) / pAtm : 0;
    const pIni = pAcum;
    const pFin = pAcum - dP;
    pAcum = pFin;
    const ok = vel > 0 && vel <= 10 && dP > 0 ? 'O.K.' : dP > 0 ? 'NO' : '—';
    result.push({
      id: t.id,
      piso: t.piso,
      ini: t.ini,
      fin: t.fin,
      material: t.material,
      dn,
      dInt,
      K,
      longitud: t.longitud,
      le,
      dP,
      vel,
      pIni,
      pFin,
      chequeo: ok,
    });
  }
  return result;
}
