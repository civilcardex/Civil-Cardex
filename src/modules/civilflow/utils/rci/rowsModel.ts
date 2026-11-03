/**
 * Modelo de filas de la UI de diseño RCI (Red Contra Incendio): convierte el estado del motor
 * (RciState) y su resultado (RciResult) en las filas planas que pintan las tablas — tipologías,
 * ramales, tramos, verificaciones agrupadas y pares etiqueta/valor de resultados — más las
 * semillas amarillas del "proyecto nuevo" del HTML de referencia. Puro: sin React ni storage.
 * Ej: filasRamales(red, rd)[1].Q = 50.75 (el ramal R1 del ejemplo cierra con 50.75 gpm).
 */

import { HZ, NOM, PIPES } from '../../lib/rci/tables.ts';
import { num } from '../../lib/rci/hydraulics.ts';
import { TECHO_DEF } from './extractRed.ts';
import type {
  BombaResult,
  Criterios,
  Edificio,
  PisoRow,
  RciState,
  Red,
  RedResult,
  RouteResult,
  SiaResult,
  TanqueResult,
  Tips,
  TuberiaRow,
  Verificacion,
} from '../../lib/rci/types.ts';

/* ============================ Catálogos de los desplegables ============================ */

/** Sí/No tal como lo guardan los selectores del motor (isSi lee exactamente "Sí"). */
export const SINO = ['Sí', 'No'] as const;
/** Decisión por piso: auto la calcula el motor, Sí/No la fuerza el diseñador. */
export const AUTO_SI_NO = ['auto', 'Sí', 'No'] as const;
/** Sistemas de NFPA 13 que cubre el cálculo. */
export const SISTEMAS = ['Húmedo', 'Seco'] as const;
/** Clasificaciones de riesgo (la llave de HZ) + pisos sin rociadores. */
export const RIESGOS: string[] = [...Object.keys(HZ), 'Sin rociadores'];
/** Construcción del techo (define la cobertura máxima en riesgo leve). */
export const CONSTR_OPCIONES = [
  'No combustible / no obstruida',
  'Combustible obstruida',
  'Combustible, elementos < 0,91 m',
] as const;
/** Salidas de manguera del montante por piso (NFPA 14). */
export const SALIDAS = ['Ninguna', '2½"', '1½"', '2½" + 1½"'] as const;
/** Clases de sistema de montantes (NFPA 14). */
export const CLASES_SP = ['Clase I', 'Clase II', 'Clase III'] as const;
/** Materiales comerciales (la llave de PIPES). */
export const MATERIALES: string[] = Object.keys(PIPES);
/** Diámetros nominales comerciales, con "auto" primero (el motor elige por velocidad). */
export const DIAMETROS = ['auto', ...NOM] as const;
/** Zonas de amenaza sísmica; vacío = auto con el perfil del país. */
export const ZONAS_SIS = ['', 'Baja', 'Intermedia', 'Alta'] as const;

/** Salida de manguera por defecto según la clase del sistema (NFPA 14). Ej: Clase II → '1½"'. */
export function salidaPorClase(clase: string): string {
  if (clase === 'Clase II') return '1½"';
  if (clase === 'Clase I') return '2½"';
  return '2½" + 1½"';
}

/* ============================ Semillas del proyecto nuevo ============================ */

/** ¿El campo NumIn/texto está sin llenar? ("" / null / undefined). */
const vacio = (v: unknown): boolean => v === '' || v === null || v === undefined;

/**
 * Siembra los amarillos de un estado recién extraído con los valores del "Nuevo proyecto" del
 * HTML de referencia (los mismos defaults: riesgo leve, húmedo, K 5.6, S×L 4.30×3.53…) y mapea
 * cada piso a la red extraída de SU plano (planta = planId). Solo llena lo VACÍO: los datos
 * digitados jamás se tocan (idempotente — llamar tras cada mezcla es seguro).
 * OJO: el motor lee la planta del piso en MAYÚSCULAS para buscar la red (st.redes[planta]);
 * los planIds del proyecto son numéricos (invariantes a mayúsculas), así que planta = planId
 * siempre matchea la clave que el extractor puso en st.redes.
 * Ej: sembrarRci(estadoVacio, 'Torre Norte').clas.riesgo = 'Riesgo leve'.
 */
export function sembrarRci(est: RciState, metaProyecto = ''): RciState {
  const salidaDef = salidaPorClase(
    est.sp.clase && !vacio(est.sp.clase) ? String(est.sp.clase) : 'Clase III',
  );
  let cambio = false;
  const graba = <T>(actual: T, defecto: T): T => {
    if (!vacio(actual)) return actual;
    if (vacio(defecto)) return actual;
    cambio = true;
    return defecto;
  };

  const meta = {
    ...est.meta,
    proyecto: graba(est.meta.proyecto, metaProyecto),
  };
  const local = {
    ...est.local,
    exigeRoc: graba(est.local.exigeRoc, 'Sí'),
    exigeSP: graba(est.local.exigeSP, 'No'),
    reqSismo: graba(est.local.reqSismo, 'No'),
    losaRestr: graba(est.local.losaRestr, 'Sí'),
  };
  const clas = {
    ...est.clas,
    almacen: graba(est.clas.almacen, 'No'),
    riesgo: graba(est.clas.riesgo, 'Riesgo leve'),
    sistema: graba(est.clas.sistema, 'Húmedo'),
    htecho: graba(est.clas.htecho, TECHO_DEF),
    qr: graba(est.clas.qr, 'Sí'),
    constr: graba(est.clas.constr, CONSTR_OPCIONES[0]),
    techoIncl: graba(est.clas.techoIncl, 'No'),
    ocultoComb: graba(est.clas.ocultoComb, 'No'),
  };
  const roc = {
    ...est.roc,
    K: graba(est.roc.K, 5.6),
    Pmin: graba(est.roc.Pmin, 7),
    S: graba(est.roc.S, 4.3),
    L: graba(est.roc.L, 3.53),
    Dmuro: graba(est.roc.Dmuro, 1.7),
  };
  const tub = { ...est.tub, Vmax: graba(est.tub.Vmax, 6), Pcomp: graba(est.tub.Pcomp, 175) };
  const mang = {
    ...est.mang,
    mangBomba: graba(est.mang.mangBomba, 'Sí'),
    mangTanque: graba(est.mang.mangTanque, 'Sí'),
    duracion: graba(est.mang.duracion, 30),
  };
  const sp = {
    ...est.sp,
    clase: graba(est.sp.clase, 'Clase III'),
    num: graba(est.sp.num, 1),
    rociado: graba(est.sp.rociado, 'Sí'),
    diam: graba(est.sp.diam, 4),
  };
  const sia = {
    ...est.sia,
    n: graba(est.sia.n, 1),
    entradas: graba(est.sia.entradas, 2),
    h: graba(est.sia.h, 0.75),
    mat: graba(est.sia.mat, 'Acero SCH 10'),
    dn: graba(est.sia.dn, '4"'),
    L: graba(est.sia.L, 6),
    c90: graba(est.sia.c90, 2),
    tee: graba(est.sia.tee, 1),
    chq: graba(est.sia.chq, 1),
    cierre: graba(est.sia.cierre, 'No'),
    drenaje: graba(est.sia.drenaje, 'Sí'),
  };
  const bomba = {
    ...est.bomba,
    margen: graba(est.bomba.margen, 0.1),
    fchurn: graba(est.bomba.fchurn, 1.2),
    etaN: graba(est.bomba.etaN, 0.65),
    eta150: graba(est.bomba.eta150, 0.6),
    fs: graba(est.bomba.fs, 1.0),
    zFondo: graba(est.bomba.zFondo, 0.3),
    hmin: graba(est.bomba.hmin, 0.5),
    hmax: graba(est.bomba.hmax, 2.0),
    matSuc: graba(est.bomba.matSuc, 'Acero SCH 10'),
    dnSuc: graba(est.bomba.dnSuc, '5"'),
    lSuc: graba(est.bomba.lSuc, 4),
    c90: graba(est.bomba.c90, 2),
    tee: graba(est.bomba.tee, 1),
    comp: graba(est.bomba.comp, 2),
    chq: graba(est.bomba.chq, 0),
    altitud: graba(est.bomba.altitud, 0),
    tagua: graba(est.bomba.tagua, 23.5),
    npshr: graba(est.bomba.npshr, 3.0),
    margenNpsh: graba(est.bomba.margenNpsh, 0.5),
    qjockey: graba(est.bomba.qjockey, 2.0),
  };
  /* Cuarto de bombas por defecto del "Nuevo proyecto" (Base → CB) si el diseñador no lo trajo. */
  let cuarto = est.mont.cuarto;
  if (!cuarto?.length) {
    cambio = true;
    cuarto = [
      {
        ni: 'Base',
        nf: 'CB',
        mat: 'Acero SCH 10',
        dn: 'auto',
        L: 5,
        tee: 1,
        comp: 1,
        ret: 1,
        esp: '',
        zi: 0,
        zf: 0,
      },
    ];
  }
  const mont = { ...est.mont, cuarto };

  const rows = est.pisos.rows.map((r) => {
    if (!vacio(r.riesgo)) return r;
    cambio = true;
    const planId = String((r as PisoRow & { planId?: string }).planId || '');
    return {
      ...r,
      planta: vacio(r.planta) ? planId || 'A' : r.planta,
      riesgo: clas.riesgo,
      sistema: vacio(r.sistema) ? clas.sistema : r.sistema,
      htecho: vacio(r.htecho) ? clas.htecho : r.htecho,
      qr: vacio(r.qr) ? clas.qr : r.qr,
      constr: vacio(r.constr) ? clas.constr : r.constr,
      techoIncl: vacio(r.techoIncl) ? clas.techoIncl : r.techoIncl,
      ocultoComb: vacio(r.ocultoComb) ? clas.ocultoComb : r.ocultoComb,
      K: vacio(r.K) ? roc.K : r.K,
      S: vacio(r.S) ? roc.S : r.S,
      L: vacio(r.L) ? roc.L : r.L,
      salida: vacio(r.salida) ? salidaDef : r.salida,
      tip: vacio(r.tip) ? 'auto' : r.tip,
    };
  });

  /* Material de cada red (el selector "Material de los ramales" del HTML, amarillo): si el
     dibujo no trae material en los trazos, el motor no encuentra diámetro para los tramos —
     se siembra el de referencia y las filas vacías heredan el de su red. Si luego se dibuja
     un material, el gris manda sobre el sembrado (mezclarOverrides). */
  const redes: Record<string, Red> = {};
  let redesCambio = false;
  for (const [clave, red] of Object.entries(est.redes)) {
    const matRed = vacio(red.mat) ? 'Acero SCH 40' : red.mat;
    let nFilas = 0;
    const ramales = red.ramales.map((r) => {
      if (!vacio(r.mat)) return r;
      nFilas++;
      return { ...r, mat: matRed };
    });
    const tramos = red.tramos.map((t) => {
      if (!vacio(t.mat)) return t;
      nFilas++;
      return { ...t, mat: matRed };
    });
    const cambioRed = vacio(red.mat) || nFilas > 0;
    if (cambioRed) {
      cambio = true;
      redesCambio = true;
      redes[clave] = { ...red, mat: matRed, ramales, tramos };
    } else {
      redes[clave] = red;
    }
  }

  if (!cambio) return est;
  return {
    ...est,
    meta,
    local,
    clas,
    roc,
    tub,
    mang,
    sp,
    sia,
    bomba,
    mont,
    ...(redesCambio ? { redes } : {}),
    pisos: { ...est.pisos, rows },
  };
}

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
  S: string;
  L: string;
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
      S: txtDe(r.S),
      L: txtDe(r.L),
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
export interface ResumenTipologia {
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
  Lr: number | null;
  /** Diámetro con el que se calculó (el auto resuelto). */
  dnUsado: string | null;
  /** Caudal del ramal en su conexión (gpm). */
  Q: number | null;
  /** Presión que pide el ramal en su conexión (psi). */
  P: number | null;
  /** Brazo del ramal: L − (fluyen − 1) × S. */
  brazo: number | null;
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
    filas.push({
      id: txtDe((r as TuberiaRow & { id?: string }).id),
      nombre: txtDe(r.nombre) || `R${i + 1}`,
      con: txtDe(r.con),
      dib: num(r.dib),
      fluyen: x ? x.fl : null,
      auto: x ? x.auto : true,
      dn: txtDe(r.dn) || 'auto',
      mat: txtDe(r.mat),
      Lr: num(r.Lr),
      dnUsado: res?.valid ? (res.dn ?? null) : null,
      Q: res?.valid ? res.Qend : null,
      P: res?.valid ? res.Pend : null,
      brazo: x?.brazo ?? null,
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
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const y = porIndice.get(i);
    const primera = y?.res?.rows?.[0];
    const calc = primera && primera.ok ? primera : null;
    const esLlegada = txtDe(t.a) === raiz;
    const desg = desgloseDeTramo(t, esLlegada, techo, altDeriv);
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
      ok: !!y?.res?.valid,
    });
  }
  return filas;
}

/* ============================ Sección 7: verificaciones ============================ */

/** Los grupos de verificaciones y el ancla a la que salta "Ir al dato": el id es el ancla
 *  `rci-<id>` de cada sección de la pantalla de diseño. */
export const GRUPOS_CHECK: { id: string; l: string }[] = [
  { id: 'normativa', l: 'Normativa local' },
  { id: 'tipologias', l: 'Tipologías' },
  { id: 'hidraulica', l: 'Hidráulica' },
  { id: 'montantes', l: 'Montante y siamesa' },
  { id: 'bomba', l: 'Bomba y tanque' },
  { id: 'generales', l: 'Generales' },
];

/** Grupo (ancla) al que pertenece una verificación: manda el campo "go" del motor (a dónde ir a
 *  corregir el dato). Ej: clas.riesgo → 'tipologias', sia.L → 'montantes'. */
export function grupoDeCheck(v: Verificacion): string {
  const go0 = v.go?.[0] || '';
  const go1 = v.go?.[1] || '';
  if (go0 === 'pisos' || go1.startsWith('piso:')) return 'tipologias';
  if (go1.startsWith('local.') || go0 === 'sismo') return 'normativa';
  if (go1.startsWith('clas.') || go1.startsWith('roc.')) return 'tipologias';
  if (go1.startsWith('mont.') || go1.startsWith('sia.') || go1.startsWith('sp.'))
    return 'montantes';
  if (go1.startsWith('bomba.') || go1.startsWith('tanque.') || go1.startsWith('mang.'))
    return 'bomba';
  if (go1.startsWith('tub.') || go0 === 'hidraulica') return 'hidraulica';
  return 'generales';
}

/** Un grupo de verificaciones ya armado para la tabla. */
export interface GrupoChecks {
  id: string;
  l: string;
  items: Verificacion[];
}

/** Agrupa las 44 verificaciones del compute por sección de la pantalla (una sola pasada con
 *  mapa; los grupos sin items no se devuelven). Ej: filasVerificaciones(R.checks) del ejemplo
 *  reparte sus 44 CUMPLE entre los 6 grupos. */
export function filasVerificaciones(checks: Verificacion[]): GrupoChecks[] {
  const porGrupo = new Map<string, Verificacion[]>();
  for (const v of checks) {
    const g = grupoDeCheck(v);
    const lista = porGrupo.get(g);
    if (lista) lista.push(v);
    else porGrupo.set(g, [v]);
  }
  const grupos: GrupoChecks[] = [];
  for (const { id, l } of GRUPOS_CHECK) {
    const items = porGrupo.get(id);
    if (items && items.length) grupos.push({ id, l, items });
  }
  return grupos;
}

/* ============================ Resultados en pares etiqueta/valor ============================ */

/** Una línea de resultados "etiqueta: valor unidad (nota)". */
export interface KvRci {
  l: string;
  v: string;
  u?: string;
  nota?: string;
}

/** Número con decimales es-CO; "—" si no es finito. */
const f1 = (x: number | null | undefined, d = 2): string =>
  typeof x === 'number' && isFinite(x)
    ? x.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

/** Criterios de rociadores — tabla 1 «Rociador y área de diseño» (9 filas, orden del HTML de
 *  referencia). qrTxt/sistemaTxt llegan de st.clas (no viven en Criterios).
 *  Ej: con el ejemplo, «Área adoptada» = 1.066,2 ft² (QR −29 %). */
export function kvRociadorDiseno(ro: Criterios, qrTxt: string, sistemaTxt: string): KvRci[] {
  return [
    {
      l: 'Tipo: ¿respuesta rápida?',
      v: qrTxt,
      nota: 'reduce el área en húmedo, riesgo leve u ordinario y techo ≤ 6,1 m',
    },
    { l: 'Factor K', v: f1(ro.K, 1), u: 'gpm/psi½' },
    { l: 'Presión mínima', v: f1(ro.Pmin, 1), u: 'psi', nota: 'mín. 7 psi o la del listado' },
    {
      l: 'Sistema',
      v: sistemaTxt,
      nota: sistemaTxt === 'Seco' ? 'área +30 %, C acero 100' : undefined,
    },
    {
      l: 'Densidad',
      v: `${ro.hz.d.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`,
      u: 'gpm/ft²',
      nota: ro.hz.d === ro.hz.a ? undefined : `área base ${f1(ro.hz.a, 0)} ft²`,
    },
    { l: 'Área base', v: f1(ro.hz.a, 0), u: 'ft²', nota: 'punto único de la Tabla 19.2.3.1.1' },
    {
      l: 'Reducción QR',
      v: ro.RedQR > 0 ? `${f1(ro.RedQR * 100, 0)} %` : '—',
      nota: 'solo sistema húmedo; área mínima 768 ft²',
    },
    {
      l: 'Factor sistema seco',
      v: ro.FSeco > 1 ? `${f1(ro.FSeco, 2)}` : '—',
      nota: ro.FSeco > 1 ? 'área +30 %' : 'sistema húmedo o pendiente ≤ 2:12',
    },
    { l: 'Área adoptada', v: f1(ro.Adis, 1), u: 'ft²', nota: `${f1(ro.Adis * 0.092903, 1)} m²` },
  ];
}

/** Criterios de rociadores — tabla 2 «Cobertura y caudales» (9 filas, orden del HTML).
 *  Ej: con el ejemplo, «Rociadores exigidos» = 7 (3 ramales × 3; 7 con flujo). */
export function kvRociadorCobertura(ro: Criterios, Nop: number | null): KvRci[] {
  return [
    {
      l: 'Cobertura máxima por rociador',
      v: f1(ro.Acmax, 0),
      u: 'ft²',
      nota: 'según el techo (225/168/130 en leve)',
    },
    { l: 'S, L máximos', v: `${f1(ro.hz.s, 1)} / ${f1(ro.hz.l, 1)}`, u: 'm' },
    {
      l: 'S × L real',
      v: `${f1(ro.S)} × ${f1(ro.L)}`,
      u: 'm',
      nota: `área real ${f1(ro.Areal, 1)} ft²`,
    },
    {
      l: 'Rociadores exigidos en el área',
      v: `${ro.Nreq}`,
      nota:
        Nop !== null
          ? `${Nop} con flujo en la red`
          : `${ro.Nramales} ramales × ${ro.Nramal} (último: ${ro.Nultimo})`,
    },
    { l: 'Rociador más remoto', v: f1(ro.Q1), u: 'gpm', nota: `a ${f1(ro.Prem)} psi` },
    {
      l: 'Presión del más remoto',
      v: f1(ro.Prem, 1),
      u: 'psi',
      nota: `K ${f1(ro.K, 1)} @ Pmin ${f1(ro.Pmin, 1)}`,
    },
    { l: 'Caudal teórico', v: f1(ro.Qteo, 1), u: 'gpm' },
    {
      l: 'Mangueras (adicionales)',
      v: f1(ro.Qmang, 0),
      u: 'gpm',
      nota: `tabla: ${ro.hz.hose} gpm`,
    },
    {
      l: 'Duración (mín–máx)',
      v: ro.dmin === ro.dmax ? `${ro.dmin}` : `${ro.dmin}–${ro.dmax}`,
      u: 'min',
    },
  ];
}

/** Resultados del montante y su ruta: Ø usado, demanda de gabinetes y ruta del cuarto.
 *  Ej: el ejemplo cierra con 500 gpm @ 127.36 psi en la brida de la bomba. */
export function kvMontante(edif: Edificio, gab: RouteResult | null): KvRci[] {
  const filas: KvRci[] = [
    {
      l: 'Ø usado del montante',
      v: edif.dnM || '—',
      nota: edif.M.dn === 'auto' ? 'auto (velocidad + mínimo de norma)' : undefined,
    },
    {
      l: 'Cota de la base del montante',
      v: f1(edif.zBase),
      u: 'm',
      nota: 'sobre el eje de la bomba',
    },
    {
      l: 'Salidas con manguera',
      v: `${edif.outs.length}`,
      nota: edif.outs.length
        ? edif.outs.map((o) => `${o.f.nombre} (${o.f.salida})`).join(', ')
        : 'márquelas en Tipologías',
    },
  ];
  if (gab && gab.valid) {
    filas.push({
      l: 'Demanda de montantes (Clase)',
      v: `${f1(gab.Qend, 1)}`,
      u: 'gpm',
      nota: `${f1(gab.Pend)} psi en la brida de la bomba`,
    });
  } else {
    filas.push({
      l: 'Demanda de montantes (Clase)',
      v: '—',
      nota: 'requiere salidas marcadas y el cuarto de bombas completo',
    });
  }
  return filas;
}

/** Resultados de la siamesa (conexión de bomberos). Ej: el ejemplo pide 125.1 psi con 500 gpm. */
export function kvSiamesa(sia: SiaResult | null): KvRci[] {
  if (!sia)
    return [
      {
        l: 'Siamesa',
        v: '—',
        nota: 'se activa cuando el código exige montantes (Normativa local)',
      },
    ];
  return [
    {
      l: 'Presión requerida en las entradas',
      v: sia.P !== null ? f1(sia.P, 1) : '—',
      u: 'psi',
      nota:
        sia.P !== undefined && sia.Q !== null
          ? `con ${f1(sia.Q, 1)} gpm del carro de bomberos`
          : 'complete material, Ø y L de la siamesa',
    },
    { l: 'Altura de la conexión', v: f1(sia.z), u: 'm', nota: 'sobre el andén (0,46–1,22 m)' },
  ];
}

/** Resultados de bomba (NFPA 20) y tanque (NFPA 22). Ej: el ejemplo selecciona 500 gpm @ 141 psi
 *  con motor de 75 HP y tanque de 56.78 m³ gobernado por los montantes. */
export function kvBombaTanque(b: BombaResult, t: TanqueResult, gobernante: string | null): KvRci[] {
  const filas: KvRci[] = [
    {
      l: 'Demanda de rociadores (D1)',
      v: `${f1(b.D1.Q, 1)}`,
      u: 'gpm',
      nota: `${f1(b.D1.P, 1)} psi netos en la bomba`,
    },
    {
      l: 'Demanda de montantes (D2)',
      v: b.D2 ? `${f1(b.D2.Q, 1)}` : 'No aplica',
      u: b.D2 ? 'gpm' : undefined,
      nota: b.D2 ? `${f1(b.D2.P, 1)} psi netos — gobierna` : undefined,
    },
    {
      l: 'Bomba seleccionada',
      v: `${f1(b.Qnom, 0)}`,
      u: 'gpm',
      nota: `a ${f1(b.Pnom, 0)} psi (demanda ${f1(b.Qdem, 1)} gpm; margen aplicado)`,
    },
    {
      l: 'Presión a caudal cero (churn)',
      v: `${f1(b.Pchurn, 1)}`,
      u: 'psi',
      nota: `${Math.round((b.Pchurn / Math.max(1, b.Pnom)) * 100)} % de la nominal (NFPA 20: ≤ 140 %)`,
    },
    { l: 'Presión al 150 %', v: `${f1(b.P150, 1)}`, u: 'psi', nota: '≥ 65 % de la nominal' },
    {
      l: 'Motor comercial',
      v: `${f1(b.HPmot, 0)}`,
      u: 'HP',
      nota: `requeridos ${f1(Math.max(b.HPr, b.HP150), 1)} HP`,
    },
    {
      l: 'Presión máx. del sistema',
      v: `${f1(b.Pmaxsis, 1)}`,
      u: 'psi',
      nota: 'churn + nivel máximo del tanque',
    },
    {
      l: 'Jockey: arranque / parada',
      v: `${f1(b.JkStart, 0)} / ${f1(b.JkStop, 0)}`,
      u: 'psi',
      nota: `${f1(b.Qjockey, 1)} gpm; la principal arranca a ${f1(b.PpStart, 0)} psi`,
    },
    { l: 'NPSH disponible', v: f1(b.NPSHd), u: 'm', nota: `succión ${f1(b.Vsuc)} m/s al 150 %` },
    {
      l: 'Tanque contra incendio',
      v: f1(t.V, 1),
      u: 'm³',
      nota: `${t.dur} min${t.tip ? ` · gobierna ${t.tip}` : ''}${gobernante ? ` · piso gobernante ${gobernante}` : ''}`,
    },
  ];
  return filas;
}
