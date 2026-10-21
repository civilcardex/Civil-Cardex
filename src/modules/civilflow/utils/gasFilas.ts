import type { PlanItem } from '../context/PlanosContexto.tsx';
import { GAS } from '../constants/ingenieriaDatosGas.ts';
import { normalizeDnLabel } from './formatoUtiles.ts';
import { calculaFilasGas, accesoriosDeTramo, propiosDeTramo } from './gasCalculoFilas.ts';
import { loadFromStorage } from '../services/almacenamientoServicio.ts';
import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  GAS_DATOS_KEY,
} from '../constants/almacenamientoClaves.ts';
import { factoresGas } from './gasUtiles.ts';
import { claveGas } from './gasRed.ts';
import type { DrawingData, RawElement } from './dibujoSync.ts';

interface GasRamalRaw extends RawElement {
  Lh?: number;
}

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
export function lookupDn(mat: string, dn: string) {
  const normDn = normalizeDnLabel(dn);
  // PEAD = polietileno de alta densidad: mismas filas que PE al PE (el catálogo de
  // materiales lo ofrece pero la tabla GAS no trae filas propias).
  const matEff = mat === 'PEAD' ? 'PE al PE' : mat;
  return allDn().find((x) => x.mat === matEff && (x.dn === dn || x.dn === normDn)) || null;
}

/**
 * Catálogo completo de diámetros por material (material, K, DN y diámetro interior).
 * Lo usan los desplegables de la pantalla de diseño de gas.
 */
export function listaDn(): Array<{ mat: string; K: number; dn: string; d: number }> {
  return allDn();
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
  qConsumo: number;
  fAlt: number;
  fTemp: number;
  fDens: number;
  qDiseno: number;
  dP: number;
  dPAcum: number;
  vel: number;
  pIni: number;
  pFin: number;
  chequeo: string;
}

export function computeGasRows(plans: PlanItem[], pais?: string): GasRow[] {
  const datos = loadFromStorage<GasDatosGenerales>(GAS_DATOS_KEY, GAS_DATOS_DEFAULT);
  const pMin = Number(datos.pmin) || 17;
  const { pAtm, DR, fAlt, fTemp, fDens } = factoresGas(datos);

  const gasTramos: {
    id: string;
    planId: string | number;
    piso: number;
    ini: string;
    fin: string;
    longitud: number;
    material: string;
    diametro: string;
    esTrib?: boolean;
    pts?: number[][];
    _tribReversed?: boolean;
  }[] = [];
  for (const plano of plans) {
    if (!plano || plano.status !== 'confirmed' || plano.nivel == null) continue;
    const data = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
    if (!data) continue;
    for (const r of (data.ramales || []) as GasRamalRaw[]) {
      if (r.net !== 'gas') continue;
      gasTramos.push({
        id: r.id,
        planId: plano.id,
        piso: Number(r.piso ?? plano.nivel) || 0,
        ini: r.ini || '',
        fin: r.fin || '',
        longitud: r.totalL || r.Lh || 0,
        material: r.material || '',
        diametro: r.diametro || '',
        esTrib: r.tipo === 'tributario',
        pts: r.pts || [],
        _tribReversed: (r as { _tribReversed?: boolean })._tribReversed,
      });
    }
  }

  const gasAcc = loadFromStorage<Record<string, Record<string, number>>>(GAS_ACC_KEY, {});
  const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
    APARATOS_BY_TRAMO_KEY,
    {},
  );

  // Consumo acumulado por tramo: el tronco lleva la demanda de toda su red descendente.
  const propios = new Map<string, Record<string, number>>();
  for (const t of gasTramos) {
    propios.set(claveGas(t.planId, t.id), propiosDeTramo(aparatos, { id: t.id, planId: t.planId }));
  }

  const porClave = new Map(gasTramos.map((t) => [claveGas(t.planId, t.id), t]));
  // El cálculo vive en gasCalcRows.ts (compartido con la pantalla de diseño de gas).
  // Las filas salen en el orden del recorrido (raíz primero, luego por piso descendente).
  return calculaFilasGas({
    tramos: gasTramos.map((t) => ({
      id: t.id,
      planId: t.planId,
      piso: t.piso,
      longitud: t.longitud,
      esTrib: t.esTrib === true,
      pts: t.pts,
      _tribReversed: t._tribReversed,
    })),
    dIntDe: (t) => {
      const src = porClave.get(claveGas(t.planId, t.id))!;
      const opt = lookupDn(src.material, src.diametro);
      return opt ? opt.d : 0;
    },
    accDe: (t) => accesoriosDeTramo(gasAcc, { id: t.id, planId: t.planId }),
    propios,
    pMin,
    factores: { pAtm, DR, fAlt, fTemp, fDens },
    pais,
  }).map((f) => {
    const t = porClave.get(f.clave)!;
    const opt = lookupDn(t.material, t.diametro);
    return {
      id: t.id,
      piso: t.piso,
      ini: t.ini,
      fin: t.fin,
      material: t.material,
      dn: opt ? opt.dn : t.diametro,
      dInt: opt ? opt.d : 0,
      K: opt ? opt.K : 0,
      longitud: t.longitud,
      le: f.le,
      qConsumo: f.qConsumo,
      fAlt: f.fAlt,
      fTemp: f.fTemp,
      fDens: f.fDens,
      qDiseno: f.qDiseno,
      dP: f.dP,
      dPAcum: f.dPAcum,
      vel: f.vel,
      pIni: f.pIni,
      pFin: f.pFin,
      chequeo: f.chequeo,
    };
  });
}
