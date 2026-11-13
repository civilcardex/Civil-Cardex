/** Filas de las tablas de tipologías e hidráulica del diseño RCI (Red Contra Incendio):
 *  convierte el estado del motor (RciState) y su resultado (RciResult) en las filas planas que
 *  pintan las tablas — pisos/tipologías, ramales y tramos del piso activo. Puro: sin React ni
 *  storage. Ej: filasRamales(red, rd)[1].Q = 50.75 (el ramal R1 del ejemplo cierra con 50.75 gpm). */

import { num } from '../../../lib/rci/hydraulics.ts';
import type {
  Edificio,
  PisoRow,
  RciState,
  Red,
  RedResult,
  Tips,
  TuberiaRow,
  NumIn,
} from '../../../lib/rci/types.ts';

/* ============================ Sección 2: tipologías ============================ */

/** Una fila de la tabla de tipologías: gris = nombre/NPT (del plano), amarillo = el resto. */
export interface FilaTipologia {
  i: number;
  nombre: string;
  npt: string;
  planId: string;
  uso: string;
  planta: string;
  riesgo: string;
  sistema: string;
  htecho: string;
  qr: string;
  constr: string;
  techoIncl: string;
  ocultoComb: string;
  K: string;
  /** Presión mínima del piso (psi); vacío = la global del proyecto. */
  Pmin: string;
  S: string;
  L: string;
  /** Distancia máxima de rociador a muro (m); vacío = la global del proyecto. */
  Dmuro: string;
  salida: string;
  vreg: string;
  vrp: string;
  tip: string;
  /** Id de la tipología que agrupa este piso (T1…), null sin clasificar. */
  tipId: string | null;
  /** ¿Es el piso representativo de su tipología? (la que se calcula — marca ★). */
  esRep: boolean;
}

/** Texto de un NumIn para un input (número o vacío). */
const txtDe = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Filas de la tabla de pisos/tipologías. Ej: filasTipologias(est, tips)[0].esRep marca el piso
 *  representativo que el motor usa para calcular la red de su tipología. */
export function filasTipologias(est: RciState, tips: Tips | null): FilaTipologia[] {
  const reps = new Set<number>();
  for (const g of tips ? tips.groups : []) reps.add(g.rep);
  const filas: FilaTipologia[] = [];
  const rows = est.pisos.rows;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    filas.push({
      i,
      nombre: txtDe(r.nombre),
      npt: txtDe(r.npt),
      planId: String((r as PisoRow & { planId?: string }).planId || ''),
      uso: txtDe(r.uso),
      planta: txtDe(r.planta),
      riesgo: txtDe(r.riesgo),
      sistema: txtDe(r.sistema),
      htecho: txtDe(r.htecho),
      qr: txtDe(r.qr),
      constr: txtDe(r.constr),
      techoIncl: txtDe(r.techoIncl),
      ocultoComb: txtDe(r.ocultoComb),
      K: txtDe(r.K),
      Pmin: txtDe((r as PisoRow & { Pmin?: NumIn }).Pmin),
      S: txtDe(r.S),
      L: txtDe(r.L),
      Dmuro: txtDe(r.Dmuro),
      salida: txtDe(r.salida) || 'Ninguna',
      vreg: txtDe(r.vreg) || 'auto',
      vrp: txtDe(r.vrp) || 'auto',
      tip: txtDe(r.tip) || 'auto',
      tipId: tips ? (tips.tipOf[i] ?? null) : null,
      esRep: reps.has(i),
    });
  }
  return filas;
}

/** Resumen de una tipología para la línea "T1 · P3+P2+P1 · Riesgo leve · Húmedo". */
interface ResumenTipologia {
  id: string;
  pisos: string;
  riesgo: string;
  sistema: string;
  planta: string;
  representativo: string;
  /** true si su red ya está calculada y cerró sin errores. */
  conRed: boolean;
  /** Presión/caudal en la derivación de su red (gobierna la bomba junto a las demás). */
  P: number | null;
  Q: number | null;
}

/** Resumen de tipologías (una línea por grupo). Ej: la T1 del ejemplo → P 37.70 psi, Q 128.54 gpm. */
export function resumenTipologias(tips: Tips, edif: Edificio | null): ResumenTipologia[] {
  const filas: ResumenTipologia[] = [];
  for (const g of tips.groups) {
    const nombres: string[] = [];
    for (const i of g.pisos)
      nombres.push(txtDe(edif ? edif.floors[i]?.nombre : null) || `Piso ${i + 1}`);
    const t = edif ? edif.typ[g.id] : null;
    filas.push({
      id: g.id,
      pisos: nombres.join(' + '),
      riesgo: g.riesgo || '—',
      sistema: g.sistema || '—',
      planta: g.planta,
      representativo: t ? nombres[g.pisos.indexOf(t.g.rep)] || '—' : '—',
      conRed: !!t && !!t.ok,
      P: t && t.P != null ? t.P : null,
      Q: t && t.Q != null ? t.Q : null,
    });
  }
  return filas;
}

/* ============================ Sección 4: hidráulica ============================ */

/** Fila de la tabla de ramales del piso activo: gris = nombre/conexión/dibujados, amarillo =
 *  fluyen/diámetro/material/S; los resultados los llena el compute. */
export interface FilaRamalRci {
  id: string;
  nombre: string;
  /** Nudo donde conecta (A, B…; la última letra es la derivación del montante). */
  con: string;
  /** Rociadores dibujados en el plano (gris 🔒). */
  dib: number | null;
  /** Rociadores con flujo en el cálculo (el amarillo o el reparto automático). */
  fluyen: number | null;
  /** true si el reparto de rociadores fue automático (el campo fluyen está vacío). */
  auto: boolean;
  /** Diámetro digitado ('auto' = lo elige el motor por velocidad). */
  dn: string;
  mat: string;
  /** Longitud del ramal (punta → conexión), con la bajada incluida si llega a la derivación. */
  /** Tipo de rociador del ramal (Colgante/Montante/Oculto/Colgante seco; 'Colgante' si no trae). */
  troc: string;
  Lr: number | null;
  /** Diámetro con el que se calculó (el auto resuelto). */
  dnUsado: string | null;
  /** Caudal del ramal en su conexión (gpm). */
  Q: number | null;
  /** Presión que pide el ramal en su conexión (psi). */
  P: number | null;
  /** Brazo del ramal: L − (fluyen − 1) × S. */
  brazo: number | null;
  /** Numeración global de rociadores del ramal: «Roc n0» y «n0–n1» (del compute). */
  rocIni: number | null;
  rocFin: number | null;
  /** Pérdidas totales del ramal: fricción + accesorios del brazo (psi, suma de sus filas). */
  Pf: number | null;
  /** Presión por desnivel del ramal (psi, suma de sus filas). */
  Pe: number | null;
  /** K equivalente Q/√P del ramal visto desde su nudo. */
  Keq: number | null;
  /** Velocidad máxima dentro del ramal (m/s). */
  Vmax: number | null;
  /** Caudal/presión EQUILIBRADOS del ramal con la presión real de su nudo. */
  Qeq: number | null;
  Peq: number | null;
  /** true si la ruta del ramal cerró con datos completos. */
  ok: boolean;
}

/** Filas de ramales del piso activo, en el orden del dibujo (el primero es el más remoto).
 *  Ej: filasRamales(redA, rd)[1] = R1 con 50.75 gpm @ 20.29 psi en el ejemplo. */
export function filasRamales(red: Red | undefined, rd: RedResult | null): FilaRamalRci[] {
  const porIndice = new Map<number, RedResult['rams'][number]>();
  for (const x of rd ? rd.rams : []) porIndice.set(x.i, x);
  const filas: FilaRamalRci[] = [];
  const rows = red ? red.ramales : [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const x = porIndice.get(i);
    const res = x?.res;
    const filasOk = res ? res.rows.filter((z) => z.ok) : [];
    filas.push({
      id: txtDe((r as TuberiaRow & { id?: string }).id),
      nombre: txtDe(r.nombre) || `R${i + 1}`,
      con: txtDe(r.con),
      dib: num(r.dib),
      fluyen: x ? x.fl : null,
      auto: x ? x.auto : true,
      dn: txtDe(r.dn) || 'auto',
      mat: txtDe(r.mat),
      troc: txtDe((r as { troc?: unknown }).troc) || 'Colgante',
      Lr: num(r.Lr),
      dnUsado: res?.valid ? (res.dn ?? null) : null,
      Q: res?.valid ? res.Qend : null,
      P: res?.valid ? res.Pend : null,
      brazo: x?.brazo ?? null,
      rocIni: x && x.fl > 0 ? x.n0 : null,
      rocFin: x && x.fl > 0 ? x.n1 : null,
      Pf: res?.valid ? filasOk.reduce((s, z) => s + z.Pf, 0) : null,
      Pe: res?.valid ? filasOk.reduce((s, z) => s + z.Pe, 0) : null,
      Keq: res?.valid && res.Keq !== undefined ? res.Keq : null,
      Vmax: res?.valid && res.Vmax !== undefined ? res.Vmax : null,
      Qeq: x?.Qeq ?? null,
      Peq: x?.Peq ?? null,
      ok: !!res?.valid,
    });
  }
  return filas;
}

/** Desglose de la L de un tramo en planta + bajada a la derivación. Manda lo que el extractor
 *  escribió (desgPlanta/desgBajada); sin ellos, en el tramo que llega a la derivación la bajada
 *  es techo − altDeriv y la planta es el resto. Ej: T2 del ejemplo (L 4.72) → 1.92 + 2.80. */
export function desgloseDeTramo(
  t: TuberiaRow,
  esLlegada: boolean,
  techo: number,
  altDeriv: number,
): { planta: number | null; bajada: number | null } {
  const desgP = num(t.desgPlanta);
  const desgB = num(t.desgBajada);
  if (desgP !== null || desgB !== null) return { planta: desgP, bajada: desgB };
  const L = num(t.L);
  if (!esLlegada || L === null) return { planta: L, bajada: null };
  const bajada = Math.max(0, techo - altDeriv);
  return { planta: Math.max(0, L - bajada), bajada };
}

/** Fila de la tabla de tramos (nudo a nudo hasta la derivación). */
export interface FilaTramoRci {
  id: string;
  nombre: string;
  de: string;
  a: string;
  mat: string;
  /** Diámetro digitado ('auto' = el motor elige). */
  dn: string;
  /** Longitud total del tramo (planta + bajada cuando llega a la derivación). */
  L: number | null;
  desgPlanta: number | null;
  desgBajada: number | null;
  /** Diámetro con el que se calculó. */
  dnUsado: string | null;
  /** Caudal total que transporta el tramo (gpm). */
  Q: number | null;
  /** Pérdida por fricción + accesorios (psi). */
  Pf: number | null;
  /** Presión por desnivel (psi). */
  Pe: number | null;
  /** Presión al final del tramo (psi; en la derivación es la que pide el piso). */
  Pfin: number | null;
  /** Velocidad del agua (m/s). */
  V: number | null;
  /** Caudal PROPIO del tramo: los ramales que le llegan en su nudo de inicio, equilibrados (gpm). */
  Qpropio: number | null;
  /** Caudal que le llega de OTROS tramos que alimenta (los anteriores en el orden) (gpm). */
  Qotros: number | null;
  /** Presión al INICIO del tramo (psi, la primera fila de su ruta). */
  Pini: number | null;
  ok: boolean;
}

/** Filas de tramos del piso activo. Ej: la T2 del ejemplo cierra con Q 128.54 y Pfin 37.70. */
export function filasTramos(
  red: Red | undefined,
  rd: RedResult | null,
  techo: number,
  altDeriv: number,
): FilaTramoRci[] {
  const porIndice = new Map<number, RedResult['tramos'][number]>();
  for (const y of rd ? rd.tramos : []) porIndice.set(y.i, y);
  const filas: FilaTramoRci[] = [];
  const rows = red ? red.tramos : [];
  const raiz = txtDe(red?.raiz);
  /* Nudos del resultado por nombre: de ahí salen los aportes (ramales equilibrados y tramos
   * aguas arriba) del caudal propio vs el de otros en el nudo de inicio de cada tramo. */
  const nodosRes = rd?.nodes || {};
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const y = porIndice.get(i);
    const primera = y?.res?.rows?.[0];
    const calc = primera && primera.ok ? primera : null;
    const esLlegada = txtDe(t.a) === raiz;
    const desg = desgloseDeTramo(t, esLlegada, techo, altDeriv);
    /* Q propio vs de otros en el nudo de inicio (los aportes que este tramo RECIBE). */
    let qPropio: number | null = null;
    let qOtros: number | null = null;
    const nudo = nodosRes[txtDe(t.de)];
    if (nudo) {
      let a = 0;
      let b = 0;
      for (const f of nudo.inflows) {
        if (f.tipo === 'ramal') a += f.Q;
        else b += f.Q;
      }
      qPropio = a;
      qOtros = b;
    }
    filas.push({
      id: txtDe((t as TuberiaRow & { id?: string }).id),
      nombre: txtDe(t.nombre) || `T${i + 1}`,
      de: txtDe(t.de),
      a: txtDe(t.a),
      mat: txtDe(t.mat),
      dn: txtDe(t.dn) || 'auto',
      L: num(t.L),
      desgPlanta: desg.planta,
      desgBajada: desg.bajada,
      dnUsado: primera?.dnUsed ?? null,
      Q: calc ? calc.Q : null,
      Pf: calc ? calc.Pf : null,
      Pe: calc ? calc.Pe : null,
      Pfin: y?.res?.valid ? y.res.Pend : null,
      V: calc ? calc.V : null,
      Qpropio: qPropio,
      Qotros: qOtros,
      Pini: calc ? calc.Pini : null,
      ok: !!y?.res?.valid,
    });
  }
  return filas;
}
