/**
 * Herramientas compartidas de las verificaciones RCI: el tipo DibujoPiso (geometría del piso
 * activo del visor), el modelo de tipologías TpsItem y los agregadores add/addT/addR que llenan
 * la lista de verificaciones. La fachada checks.ts crea las tres y las reparte en un ChecksCtx.
 * Ej: crearAdd(L)('X', 'CUMPLE', '2 m', 'NFPA 13', 'guía') deja guide='' en la fila.
 */
import type {
  Criterios,
  FilaRoute,
  RciResult,
  RciState,
  RouteResult,
  Verificacion,
} from '../types';

/** Geometría del piso activo del visor para las verificaciones que dependen del dibujo:
 *  muros = polilíneas de guías marcadas esMuro; ramPts = polilíneas de ramales rci (tipo
 *  ramal, sin tributarios). Coordenadas ya convertidas a METROS por el llamador. */
export interface DibujoPiso {
  muros: number[][][];
  ramPts: number[][][];
}

/* Tipologías a verificar: en el edificio, todas las que tienen criterios (y red, para las de la red);
   sin edificio, la única red de Entradas. Cada verificación se evalúa por tipología y se informa la peor. */
export type TpsItem = {
  id: string;
  ro: Criterios;
  riesgo: string;
  rd: RciResult['red'];
  Nop: number;
  Qroc: number;
  routes: RouteResult[];
  rows: FilaRoute[];
  bld?: boolean;
  /** Tipo de sistema de la tipología ('Húmedo'/'Seco'; el de clas si la tipología no lo trae). */
  sis: string;
};

/** Estados de una verificación ordenados de mejor a peor: el agregador informa el peor. */
const RK: Record<string, number> = { CUMPLE: 0, PENDIENTE: 1, REVISAR: 2, 'NO CUMPLE': 3 };

/** Firma del agregador simple: añade una verificación a la lista (guía vacía cuando CUMPLE). */
export type AddFn = (
  lab: string,
  st_: string,
  val: string,
  nor: string,
  guide: string,
  go?: string[],
) => void;

/** Crea el agregador simple sobre la lista L de la fachada. */
export function crearAdd(L: Verificacion[]): AddFn {
  return (lab, st_, val, nor, guide, go): void => {
    L.push({ lab, st: st_, val, nor, guide: st_ === 'CUMPLE' ? '' : guide, go });
  };
}

/** Firma del agregador por tipología: evalúa fn(t) en cada tipología (o en `list`) e informa la peor. */
export type AddTFn = (
  lab: string,
  nor: string,
  go: string[] | undefined,
  fn: (t: TpsItem) => { st: string; val: string; guide: string },
  list?: TpsItem[],
) => void;

/** Crea el agregador por tipología (volcado vía `add`). `multi` = hay más de una tipología
 *  (el valor muestra cada una). */
export function crearAddT(tps: TpsItem[], multi: boolean, add: AddFn): AddTFn {
  /* Una verificación por tipología: fn(t) → { st, val, guide }. Con varias tipologías el valor muestra cada una
     y "Ir al dato" abre la primera que falla. */
  return (lab, nor, go, fn, list): void => {
    const L0 = list || tps;
    if (!L0.length)
      return add(
        lab,
        'PENDIENTE',
        'Sin redes calculadas',
        nor,
        'Calcule la red de al menos una tipología en Hidráulica.',
        ['hidraulica'],
      );
    const it = L0.map((t) => Object.assign({ t }, fn(t)));
    const w = it.reduce((x, y) => (RK[y.st] > RK[x.st] ? y : x), it[0]);
    if (!multi) return add(lab, w.st, w.val, nor, w.guide, go);
    const bad = it.filter((x) => x.st !== 'CUMPLE');
    add(
      lab,
      w.st,
      it.map((x) => `${x.t.id}: ${x.val}`).join(' · '),
      nor,
      bad.map((x) => `${x.t.id}: ${x.guide}`).join(' '),
      go && bad.length ? [go[0], go[1] || '', bad.find((x) => x.st === w.st)!.t.id] : go,
    );
  };
}

/** Firma del agregador por filas de tubería (tipologías con red + montante como tipología virtual). */
export type AddRFn = (
  lab: string,
  nor: string,
  go: string[],
  fn: (rows: FilaRoute[]) => { st: string; val: string; guide: string },
) => void;

/** Crea el agregador por filas sobre tB (volcado vía `add`): evalúa fn(rows) por tipología y
 *  por montante/gabinetes. */
export function crearAddR(tB: TpsItem[], multi: boolean, add: AddFn): AddRFn {
  return (lab, nor, go, fn): void => {
    const it = tB.map((t) => Object.assign({ t }, fn(t.rows)));
    const w = it.reduce(
      (x, y) => (RK[y.st] > RK[x.st] ? y : x),
      it[0] || { t: null as unknown as TpsItem, st: 'CUMPLE', val: '—', guide: '' },
    );
    const bad = it.filter((x) => x.st !== 'CUMPLE'),
      sh = multi || bad.some((x) => x.t.bld);
    const go2 = bad.length
      ? bad[0].t.bld
        ? ['entradas', 'mont.dn']
        : [go[0], go[1] || '', bad[0].t.id]
      : go;
    add(
      lab,
      w.st,
      sh
        ? (bad.length ? bad : it.slice(0, 1))
            .map((x) => (bad.length ? `${x.t.id}: ${x.val}` : x.val))
            .join(' · ')
        : w.val,
      nor,
      sh ? bad.map((x) => `${x.t.id}: ${x.guide}`).join(' ') : w.guide,
      multi || bad.length ? go2 : go,
    );
  };
}

/** Contexto que la fachada checks() pasa a cada verificador de dominio: el estado, el resultado,
 *  los derivados compartidos (cita del país, tipologías) y los agregadores ya creados sobre L.
 *  Ej: verificarSiamesa(ctx) llama ctx.add('Siamesa: …', 'CUMPLE', '1,0 m', 'NFPA 14', '', go). */
export interface ChecksCtx {
  st: RciState;
  R: RciResult;
  /** Cita de la norma de diseño con el marco legal del país del proyecto. Ej: CO → 'NFPA 13-2025 (NSR-10 J)'. */
  cita: string;
  /** Todas las tipologías a verificar (las del edificio o la única red de Entradas). */
  tps: TpsItem[];
  /** Subconjunto de tps con red calculada. */
  tpsRed: TpsItem[];
  /** Filas de montante + ruta del cuarto de bombas + gabinetes (fuera de las tipologías). */
  bldRows: FilaRoute[];
  add: AddFn;
  addT: AddTFn;
  addR: AddRFn;
  /** Geometría del piso activo (muros/ramales rci en metros); undefined = sin dibujo, no aplica. */
  dibujo?: DibujoPiso;
}
