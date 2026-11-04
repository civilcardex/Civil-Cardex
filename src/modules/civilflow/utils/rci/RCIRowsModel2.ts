/**
 * Modelo de filas EXTRAS de la UI de diseño RCI (Red Contra Incendio) — PARTE 1: hermana de
 * rowsModel.ts, misma doctrina (puro, sin React, sin find en bucles). Aquí viven el perfil de
 * presiones (filas, chips de acción y panel "qué hacer"), el equilibrio de nudos, el detalle
 * nudo a nudo y la ruta de gabinetes. Las cards de bomba/tanque, el sismo, el resumen de
 * hidráulica y el mapa de navegación están en rowsModelExtras.ts.
 * Ej: filasPerfilPiso(R.edif)[0].nombre = "P3" (el piso más alto gobierna la bomba).
 */

import { FIT } from '../../lib/rci/tables.ts';
import { num } from '../../lib/rci/hydraulics.ts';
import type {
  Edificio,
  FilaRoute,
  Inflow,
  RedResult,
  RouteResult,
  TuberiaRow,
} from '../../lib/rci/types.ts';

/* ============================ Utilidades (compartidas con rowsModelExtras) ============================ */

import { fmtEs as fmt } from '../../lib/rci/fmtEs.ts';
export { fmt };

/** Texto de un campo opcional para el modelo ('' si no viene). */
export const txt = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/* ============================ 1. Perfil de presiones ============================ */

/** Chip de acción del perfil: el color (c) y el texto que ve el diseñador. */
export interface ChipPerfil {
  c: 'OK' | 'NO' | 'REVISAR' | 'PENDIENTE';
  txt: string;
}

/** Una fila del perfil de presiones (una por piso con derivación), replicando perfilTable. */
export interface FilaPerfilPiso {
  i: number;
  nombre: string;
  npt: number | null;
  /** Id de la tipología del piso (T1…). */
  tId: string;
  /** Cota de la derivación del piso (m sobre el eje de la bomba). */
  zT: number | null;
  /** Cota de la salida de manguera (m). */
  zS: number | null;
  /** Caudal que pide el piso en su derivación (gpm). */
  Q: number | null;
  /** Presión requerida en la derivación (psi). */
  Preq: number | null;
  /** Presión disponible desde la bomba (psi). */
  disp: number | null;
  /** disp − Preq; la holgura mínima la fija el motor (E.hmin). */
  holg: number | null;
  /** Presión estática en la derivación (psi; contra la presión de componentes Pc). */
  Pst: number | null;
  /** Presión estática en la salida de manguera (psi). */
  PstS: number | null;
  /** Presión residual en la salida de 1½" con 100 gpm (psi; > 100 pide válvula reguladora). */
  res15: number | null;
  salida: string;
  /** true si su red cerró válida (si no, el piso está pendiente). */
  conRes: boolean;
  sinRoc: boolean;
  /** true con tipología sin red dibujada. */
  redPendiente: boolean;
  /** holgura ≥ mínima; null sin cálculo. */
  okH: boolean | null;
  vrp: boolean;
  vrpFalta: boolean;
  /** Ajuste sugerido de la VRP (Válvula Reductora de Presión) en psi. */
  vrpSet: number | null;
  reg: boolean;
  regFalta: boolean;
  /** Reguladora exigida por residual > 100 psi. */
  regRes: boolean;
  /** Reguladora exigida por estática > 175 psi. */
  regEst: boolean;
  /** true en el piso que gobierna la selección de la bomba. */
  gobierna: boolean;
}

/**
 * Filas del perfil de presiones, ordenadas de arriba hacia abajo (zT descendente, como el HTML).
 * Ej: en el ejemplo P3 gobierna y P1 es la estática más alta (170.62 psi en la derivación).
 */
export function filasPerfilPiso(edif: Edificio): FilaPerfilPiso[] {
  const conCota = edif.pf.filter((o) => o.zT !== null);
  conCota.sort((a, b) => (b.zT as number) - (a.zT as number));
  const filas: FilaPerfilPiso[] = [];
  for (const o of conCota) {
    filas.push({
      i: o.f.i,
      nombre: o.f.nombre,
      npt: o.f.npt,
      tId: txt(o.tId) || '—',
      zT: o.zT,
      zS: o.zS,
      Q: o.Q ?? null,
      Preq: o.Preq ?? null,
      disp: o.disp ?? null,
      holg: o.holg ?? null,
      Pst: o.Pst ?? null,
      PstS: o.PstS ?? null,
      res15: o.res15 !== undefined ? o.res15 : null,
      salida: o.f.salida,
      conRes: !!(o.res && o.res.valid),
      sinRoc: o.f.sinRoc,
      redPendiente: !!(o.t && o.t.pend),
      okH: o.okH === undefined ? null : o.okH,
      vrp: !!o.vrp,
      vrpFalta: !!o.vrpFalta,
      vrpSet: o.vrpSet === undefined || o.vrpSet === null ? null : o.vrpSet,
      reg: !!o.reg,
      regFalta: !!o.regFalta,
      regRes: !!o.regRes,
      regEst: !!o.regEst,
      gobierna: !!edif.gov && edif.gov === o,
    });
  }
  return filas;
}

/**
 * Chips de acción de una fila del perfil (columna "Acción" del HTML): qué corregir en ese piso.
 * Ej: con residual de 1½" sobre 100 psi → [{ c: 'REVISAR', txt: 'Válvula reguladora en gabinete' }].
 */
export function accionPerfil(o: FilaPerfilPiso, Pc = 175): ChipPerfil[] {
  const a: ChipPerfil[] = [];
  if (!o.conRes)
    a.push({
      c: 'PENDIENTE',
      txt: o.sinRoc ? 'Sin rociadores' : o.redPendiente ? 'Red pendiente' : 'Sin cálculo',
    });
  else if (o.okH === false) a.push({ c: 'NO', txt: 'Holgura insuficiente' });
  if (o.vrpFalta) a.push({ c: 'NO', txt: 'Falta VRP (marcada «No»)' });
  else if (o.vrp) {
    const est = o.Pst !== null && o.Pst > Pc;
    a.push({
      c: 'REVISAR',
      txt: o.vrpSet
        ? `VRP, ajuste ≈ ${o.vrpSet} psi`
        : est
          ? `VRP (estática ${fmt(o.Pst)} > ${fmt(Pc, 0)} psi)`
          : 'VRP (ajuste: falta la red)',
    });
  }
  if (o.regFalta) a.push({ c: 'NO', txt: 'Falta válvula reguladora (marcada «No»)' });
  else if (o.reg) a.push({ c: 'REVISAR', txt: 'Válvula reguladora en gabinete' });
  if (o.gobierna) a.push({ c: 'REVISAR', txt: 'Gobierna la bomba' });
  if (!a.length) a.push({ c: 'OK', txt: 'OK' });
  return a;
}

/** Una línea del panel "Qué hacer" del perfil: chip + texto con las correcciones de un piso. */
export interface AccionPiso {
  c: 'OK' | 'NO' | 'REVISAR' | 'PENDIENTE';
  txt: string;
}

/**
 * Panel "Qué hacer" del perfil (perfilSide del HTML): una línea por piso con problema y, si la
 * estática supera la presión de componentes (Pc), una línea por el montante.
 * Ej: el ejemplo devuelve 3 líneas REVISAR (válvula reguladora por residual > 100 psi).
 */
export function queHacerPerfil(edif: Edificio): AccionPiso[] {
  const Pc = edif.Pc || 175;
  const hmin = edif.hmin || 0;
  const filas = filasPerfilPiso(edif);
  const rows: AccionPiso[] = [];
  for (const o of filas) {
    const partes: string[] = [];
    let c: AccionPiso['c'] = 'OK';
    if (!o.conRes) {
      partes.push(o.sinRoc ? 'sin rociadores' : `tipología ${o.tId} sin red`);
      c = 'PENDIENTE';
    } else if (o.okH === false) {
      partes.push(
        `faltan ${fmt(-(o.holg as number) + hmin, 1)} psi: suba la bomba o reduzca pérdidas`,
      );
      c = 'NO';
    }
    if (o.vrp) {
      partes.push(
        `VRP en la derivación (estática ${fmt(o.Pst, 1)} > ${fmt(Pc, 0)})${o.vrpSet ? `, ajuste ≈ ${fmt(o.vrpSet, 1)} psi` : ''}`,
      );
      if (c === 'OK') c = 'REVISAR';
    }
    if (o.vrpFalta) {
      partes.push('requiere VRP y está marcada «No» en Tipologías');
      c = 'NO';
    }
    if (o.reg || o.regFalta) {
      const porque = o.regEst
        ? `estática ${fmt(o.PstS, 0)} psi > 175`
        : o.regRes
          ? `residual 1½" ${fmt(o.res15, 0)} psi > 100`
          : 'elegida por el diseñador';
      partes.push(
        `${o.regFalta ? 'requiere válvula reguladora y está marcada «No» en Tipologías' : 'válvula reguladora en la salida'} (${porque})`,
      );
      if (o.regFalta) c = 'NO';
      else if (c === 'OK') c = 'REVISAR';
    }
    if (partes.length) rows.push({ c, txt: `${o.nombre}: ${partes.join('; ')}.` });
  }
  for (const o of filas) {
    if ((o.Pst ?? 0) > Pc) {
      rows.push({
        c: 'REVISAR',
        txt: `Montante: tramo con estática > ${fmt(Pc, 0)} psi (${fmt(o.Pst)} en ${o.nombre}): componentes listados de mayor presión.`,
      });
      break;
    }
  }
  return rows;
}

/* ============================ 2. Nudos (equilibrio) ============================ */

/** Un aporte que llega a un nudo: su nombre visible, caudal, presión y caudal ya equilibrado. */
export interface AporteNudo {
  nombre: string;
  esRamal: boolean;
  /** Caudal propio del aporte (gpm). */
  Q: number;
  /** Presión que exige en el nudo (psi). */
  P: number;
  /** Caudal al elevarlo a la presión que gobierna el nudo, Q = K·√P (gpm). */
  Qb: number | null;
}

/** Una fila de la tabla de equilibrio de nudos. */
export interface FilaNudo {
  nudo: string;
  /** true en la derivación del montante (la raíz de la red). */
  esRaiz: boolean;
  alimenta: AporteNudo[];
  /** Nombre del aporte que gobierna (la mayor presión requerida). */
  gobierna: string;
  /** Presión requerida en el nudo (psi). */
  Preq: number;
  /** Qtotal con los aportes equilibrados (gpm). */
  Qtotal: number;
  /** Presión tras el equilibrio global hacia el rociador más remoto (psi). */
  Pequilibrada: number;
  /** Nudo hacia el que descarga ("Montante" en la raíz). */
  seAlimentaDe: string;
}

/** Nombre visible de un aporte: "R2" para un ramal, "T1 (A → B)" para un tramo. */
const nombreAporte = (f: Inflow): string => {
  if (f.tipo === 'ramal') return f.x.nombre;
  const nom = f.y.t && f.y.t.nombre ? String(f.y.t.nombre) : `T${f.y.i + 1}`;
  return `${nom} (${f.y.de} → ${f.y.a})`;
};

/**
 * Tabla de equilibrio de nudos de la red: nudo, aportes con su Q/P/→Q equilibrado, gobierna,
 * Preq, Qtotal, Pequilibrada y se alimenta de. Los no resueltos no se devuelven.
 * Ej: en el ejemplo el nudo A gobierna R1 con 20.29 psi y R2 se equilibra a 56.51 gpm.
 */
export function filasNudos(red: RedResult): FilaNudo[] {
  const resueltos = Object.values(red.nodes).filter((n) => n.solved);
  resueltos.sort(
    (a, b) =>
      (a.nombre === red.root ? 1 : 0) - (b.nombre === red.root ? 1 : 0) ||
      String(a.nombre).localeCompare(String(b.nombre), 'es', { numeric: true }),
  );
  const filas: FilaNudo[] = [];
  for (const n of resueltos) {
    const alimenta: AporteNudo[] = [];
    for (const f of n.inflows) {
      alimenta.push({
        nombre: nombreAporte(f),
        esRamal: f.tipo === 'ramal',
        Q: f.Q,
        P: f.P,
        Qb: f.Qb ?? null,
      });
    }
    filas.push({
      nudo: n.nombre,
      esRaiz: n.nombre === red.root,
      alimenta,
      gobierna: n.gov ? nombreAporte(n.gov) : '—',
      Preq: n.P ?? 0,
      Qtotal: n.Q ?? 0,
      Pequilibrada: n.Peq ?? n.P ?? 0,
      seAlimentaDe: n.out ? n.out.a : n.nombre === red.root ? 'Montante' : '—',
    });
  }
  return filas;
}

/* ============================ 3. Detalle nudo a nudo ============================ */

/** Un paso del detalle de un ramal: de nudo a nudo con presiones, caudales y pérdidas. */
export interface PasoRamal {
  ok: boolean;
  /** Error que impidió calcular el paso (null si ok). */
  err: string | null;
  ni: string;
  nf: string;
  /** Presión al entrar al paso (psi; en el primero es la del rociador más remoto, Prem). */
  Pini: number | null;
  /** Caudal del rociador del paso, q = K·√P (gpm). */
  q: number | null;
  /** Caudal acumulado que transporta la tubería (gpm). */
  Q: number | null;
  /** Longitud real del paso (m). */
  L: number | null;
  /** Longitud equivalente de accesorios (m). */
  Leq: number | null;
  Pf: number | null;
  Pe: number | null;
  Pfin: number | null;
  /** Velocidad del agua (m/s). */
  V: number | null;
}

/** El detalle completo de un ramal con flujo (cabecera + pasos). */
export interface DetalleRamal {
  nombre: string;
  /** Rociadores del ramal: "5" o "1–5" (del primero al último con flujo). */
  rociadores: string;
  /** Diámetro con el que se calculó. */
  dn: string;
  /** Coeficiente C de Hazen-Williams usado (del primer paso válido). */
  C: number | null;
  pasos: PasoRamal[];
}

/**
 * Detalle nudo a nudo de cada ramal con flujo de la red (el "redDetail" del HTML).
 * Ej: el primer paso de R2 arranca en 8.51 psi con q = 16.34 gpm (el rociador más remoto).
 */
export function filasDetalleNudo(red: RedResult): DetalleRamal[] {
  const out: DetalleRamal[] = [];
  for (const x of red.rams) {
    const res = x.res;
    if (!res) continue;
    const pasos: PasoRamal[] = [];
    let C: number | null = null;
    for (let j = 0; j < res.rows.length; j++) {
      const z = res.rows[j];
      const row: TuberiaRow | undefined = x.rows ? x.rows[j] : undefined;
      if (!z.ok) {
        pasos.push({
          ok: false,
          err: z.err || 'incompleto',
          ni: txt(row?.ni),
          nf: txt(row?.nf),
          Pini: null,
          q: null,
          Q: null,
          L: num(row?.L),
          Leq: null,
          Pf: null,
          Pe: null,
          Pfin: null,
          V: null,
        });
        continue;
      }
      if (C === null) C = z.C;
      pasos.push({
        ok: true,
        err: null,
        ni: txt(row?.ni),
        nf: txt(row?.nf),
        Pini: z.Pini,
        q: z.q,
        Q: z.Q,
        L: num(row?.L),
        Leq: z.leq,
        Pf: z.Pf,
        Pe: z.Pe,
        Pfin: z.Pfin,
        V: z.V,
      });
    }
    out.push({
      nombre: x.nombre,
      rociadores: x.n0 === x.n1 ? `${x.n0}` : `${x.n0}–${x.n1}`,
      dn: res.dn || '—',
      C,
      pasos,
    });
  }
  return out;
}

/* ============================ 4. Gabinetes ============================ */

/** Una fila de la ruta de gabinetes: tramo del montante + resultados del cálculo. */
export interface FilaGab {
  desde: string;
  hasta: string;
  /** true si ese nudo descarga su salida de manguera en el cálculo (las más remotas). */
  salida: boolean;
  /** Caudal fijo de la salida (gpm; 250 por salida Clase I/III, 100 Clase II). */
  qSalida: number | null;
  mat: string;
  dn: string;
  L: number | null;
  /** Accesorios del tramo resumidos ("3 tee · 2 comp · 1 ret"). */
  acc: string;
  zi: number | null;
  zf: number | null;
  dnUsado: string | null;
  /** Presión al entrar al tramo (psi; en el primero es el mínimo NFPA 14 de la salida remota). */
  Pini: number | null;
  /** Caudal que descarga la salida del nudo inicial (gpm). */
  qEntra: number | null;
  Q: number | null;
  C: number | null;
  Leq: number | null;
  /** Longitud total (real + Leq). */
  Ltotal: number | null;
  Pf: number | null;
  Pe: number | null;
  Pfin: number | null;
  V: number | null;
  /** "OK" | "P baja" | "P alta" | "Válv. reguladora" | "V alta" | "Incompleto". */
  estado: string;
  err: string | null;
}

/** Estado de una fila calculada, con la traducción de chkP del HTML (OK/PB/PA/REG). */
const estadoGab = (o: FilaRoute): string => {
  if (!o.ok) return 'Incompleto';
  if (o.chkV !== 'OK') return 'V alta';
  if (o.chkP === 'P ALTA') return 'P alta';
  if (o.chkP === 'P BAJA') return 'P baja';
  if (o.chkP === 'REGULAR') return 'Válv. reguladora';
  return 'OK';
};

/** Resumen de accesorios de una fila de tubería: "2 c90 · 1 tee · DF". */
const resumenAcc = (r: Partial<TuberiaRow>): string => {
  const p: string[] = [];
  for (const k of FIT) {
    const n = num(r[k]) || 0;
    if (n > 0) p.push(`${n} ${k}`);
  }
  if (r.esp) p.push(String(r.esp));
  return p.join(' · ');
};

/**
 * Filas de la ruta de gabinetes del montante (gabTable + renderGab del HTML): cada fila casa el
 * tramo de entrada (edif.gabRows[i]) con su resultado (gab.rows[i]).
 * Ej: el ejemplo cierra con 500 gpm @ 127.36 psi en el último tramo (Base → CB, cuarto de bombas).
 */
export function filasGabinete(edif: Edificio, gab: RouteResult | null): FilaGab[] {
  const filas: FilaGab[] = [];
  if (!gab) return filas;
  for (let i = 0; i < gab.rows.length; i++) {
    const r: Partial<TuberiaRow> = edif.gabRows[i] || {};
    const o = gab.rows[i];
    if (!o.ok) {
      filas.push({
        desde: txt(r.ni),
        hasta: txt(r.nf),
        salida: !!r.salida,
        qSalida: r.salida ? num(r.qFijo) : null,
        mat: txt(r.mat),
        dn: txt(r.dn),
        L: num(r.L),
        acc: resumenAcc(r),
        zi: num(r.zi),
        zf: num(r.zf),
        dnUsado: null,
        Pini: null,
        qEntra: null,
        Q: null,
        C: null,
        Leq: null,
        Ltotal: null,
        Pf: null,
        Pe: null,
        Pfin: null,
        V: null,
        estado: 'Incompleto',
        err: o.err || null,
      });
      continue;
    }
    filas.push({
      desde: txt(r.ni),
      hasta: txt(r.nf),
      salida: !!r.salida,
      qSalida: r.salida ? num(r.qFijo) : null,
      mat: txt(r.mat),
      dn: txt(r.dn),
      L: num(r.L),
      acc: resumenAcc(r),
      zi: num(r.zi),
      zf: num(r.zf),
      dnUsado: o.dnUsed,
      Pini: o.Pini,
      qEntra: o.q,
      Q: o.Q,
      C: o.C,
      Leq: o.leq,
      Ltotal: o.Lt,
      Pf: o.Pf,
      Pe: o.Pe,
      Pfin: o.Pfin,
      V: o.V,
      estado: estadoGab(o),
      err: null,
    });
  }
  return filas;
}
