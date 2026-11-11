/**
 * Modelo de filas EXTRAS de la UI de diseño RCI (Red Contra Incendio) — PARTE 2: hermana de
 * rowsModel.ts y rowsModelRci2.ts, misma doctrina (puro, sin React, sin find en bucles). Aquí
 * viven las cards de bomba y tanque (demandas, selección, cuarto, succión, jockey, tanque), el
 * rectángulo de fuego, el conteo de soportes sísmicos, el resumen de hidráulica, el strip de la
 * derivación y el mapa de navegación de las verificaciones (RUTA_DE + SUBS_POR_TAB).
 * Ej: kvDemandas(R.bomba)[1].v = "500,0" (la demanda D2 de los montantes del ejemplo).
 */

import { PIPES } from '../../lib/rci/tables.ts';
import { num } from '../../lib/rci/hydraulics.ts';
import type { KvRci } from './RCIRowsModel.ts';
import { fmt, txt } from './RCIRowsModel2.ts';
import type {
  BombaResult,
  Criterios,
  Demanda,
  Edificio,
  FilaRoute,
  PisoRow,
  RamalCalc,
  RciLocal,
  RciSp,
  Red,
  RedResult,
  RouteResult,
  TanqueResult,
  Tipologia,
} from '../../lib/rci/types.ts';

/* ============================ 5. Cards de bomba y tanque ============================ */

/** Card "Demandas" (demTable): D1 rociadores y D2 montantes con Q, P de descarga/succión y neta. */
export function kvDemandas(b: BombaResult): KvRci[] {
  const dem = (l: string, d: Demanda): KvRci => ({
    l,
    v: fmt(d.Q, 1),
    u: 'gpm',
    nota: `P desc. ${fmt(d.Pdes, 2)} − P succ. ${fmt(d.Psuc, 2)} = ${fmt(d.P, 2)} psi netos`,
  });
  const filas: KvRci[] = [dem('D1 · Rociadores + mangueras', b.D1)];
  if (b.D2) filas.push(dem('D2 · Montantes (gabinetes)', b.D2));
  else filas.push({ l: 'D2 · Montantes (gabinetes)', v: 'No aplica' });
  return filas;
}

/** Card "Selección" (selTable): los puntos de la curva NFPA 20 y el motor comercial. */
export function kvSeleccion(
  b: BombaResult,
  edif: Edificio,
  qrManual?: unknown,
  margen?: unknown,
): KvRci[] {
  const mg = num(margen);
  return [
    {
      l: 'Piso que gobierna',
      v: edif.gov ? `${edif.gov.f.nombre} (${txt(edif.gov.tId) || '—'})` : '—',
    },
    {
      l: 'Caudal nominal',
      v: fmt(b.Qnom, 0),
      u: 'gpm',
      nota: num(qrManual) !== null ? 'Adoptado manualmente' : 'Tamaño estándar NFPA 20',
    },
    {
      l: 'Presión neta nominal',
      v: fmt(b.Pnom, 0),
      u: 'psi',
      nota:
        mg !== null ? `Máx. demanda × (1 + ${fmt(mg * 100, 0)} %)` : 'Máx. demanda × (1 + margen)',
    },
    {
      l: 'Presión a caudal cero (churn)',
      v: fmt(b.Pchurn, 1),
      u: 'psi',
      nota: '≤ 140 % de la nominal',
    },
    { l: 'Presión mínima al 150 %', v: fmt(b.P150, 1), u: 'psi', nota: '≥ 65 % de la nominal' },
    {
      l: 'Presión máxima del sistema',
      v: fmt(b.Pmaxsis, 1),
      u: 'psi',
      nota: 'Churn + estática máx. de succión',
    },
    { l: 'Potencia al caudal nominal', v: fmt(b.HPr, 1), u: 'HP' },
    { l: 'Potencia al 150 %', v: fmt(b.HP150, 1), u: 'HP' },
    {
      l: 'Motor comercial mínimo',
      v: fmt(b.HPmot, 1),
      u: 'HP',
      nota: 'Sin sobrecarga hasta el 150 %',
    },
    {
      l: 'Succión / descarga mínimas',
      v: `${b.DsucMin}" / ${b.DdesMin}"`,
      nota: 'Tabla resumen NFPA 20',
    },
    { l: 'Válvulas de manguera del cabezal', v: `${b.Ncab} × 2½"`, nota: 'Tabla resumen NFPA 20' },
  ];
}

/** Agregado de una ruta (la función agg del HTML): solo si TODAS las filas cerraron. */
export interface RutaAgregada {
  /** Caudal de la ruta (gpm). */
  Q: number;
  /** Presión al inicio (psi). */
  Pb: number;
  /** Suma de pérdidas por fricción + accesorios (psi). */
  Pf: number;
  /** Suma de desnivel (psi). */
  Pe: number;
  /** Presión al final (psi; en la brida de la bomba). */
  Pc: number;
  /** Velocidad máxima de la ruta (m/s). */
  V: number;
  dn: string;
  /** Suma de longitudes equivalentes de accesorios (m). */
  leq: number;
}

/** Agrupa una ruta completa en un solo resumen; null si falta una fila por calcular. */
export function rutaAgregada(rows: FilaRoute[]): RutaAgregada | null {
  let Pf = 0,
    Pe = 0,
    leq = 0,
    V = 0;
  let p0: Extract<FilaRoute, { ok: true }> | null = null;
  let pn: Extract<FilaRoute, { ok: true }> | null = null;
  for (const o of rows) {
    if (!o.ok) return null;
    if (!p0) p0 = o;
    pn = o;
    Pf += o.Pf;
    Pe += o.Pe;
    leq += o.leq || 0;
    if (o.V > V) V = o.V;
  }
  if (!p0 || !pn) return null;
  return { Q: p0.Q, Pb: p0.Pini, Pf, Pe, Pc: pn.Pfin, V, dn: p0.dnUsed, leq };
}

/**
 * Card "Cuarto de bombas" (cbTable): el tramo montante + cuarto para D1 (piso que gobierna) y
 * para D2 (gabinetes desde "Base" hasta "CB"). Sin ruta válida el lado muestra "—".
 * Ej: el ejemplo exige 59.34 psi (D1) y 127.36 psi (D2) en la brida de la bomba.
 */
export function kvCuarto(edif: Edificio, gab: RouteResult | null): KvRci[] {
  const d1 = edif.gov && edif.gov.res ? rutaAgregada(edif.gov.res.rows.slice(1)) : null;
  let d2: RutaAgregada | null = null;
  if (gab && gab.rows.length) {
    let ib = -1;
    for (let i = 0; i < edif.gabRows.length; i++) {
      if (txt(edif.gabRows[i].ni) === 'Base') {
        ib = i;
        break;
      }
    }
    if (ib >= 0) d2 = rutaAgregada(gab.rows.slice(ib));
  }
  const lado = (o: RutaAgregada | null, k: keyof RutaAgregada, d = 1): string =>
    o ? fmt(o[k] as number, d) : '—';
  const filas: KvRci[] = [
    { l: 'Caudal D1 / D2', v: `${lado(d1, 'Q')} / ${lado(d2, 'Q')}`, u: 'gpm' },
    {
      l: 'Presión en la base del montante D1 / D2',
      v: `${lado(d1, 'Pb')} / ${lado(d2, 'Pb')}`,
      u: 'psi',
    },
    {
      l: 'Pérdidas D1 / D2 (tubería + accesorios)',
      v: `${lado(d1, 'Pf', 2)} / ${lado(d2, 'Pf', 2)}`,
      u: 'psi',
    },
  ];
  if ((d1 && Math.abs(d1.Pe) > 0.005) || (d2 && Math.abs(d2.Pe) > 0.005)) {
    filas.push({
      l: 'Desnivel D1 / D2',
      v: `${lado(d1, 'Pe', 2)} / ${lado(d2, 'Pe', 2)}`,
      u: 'psi',
    });
  }
  filas.push(
    {
      l: 'Presión exigida en la brida (CB) D1 / D2',
      v: `${lado(d1, 'Pc')} / ${lado(d2, 'Pc')}`,
      u: 'psi',
      nota: 'gobierna la mayor',
    },
    { l: 'Velocidad máxima D1 / D2', v: `${lado(d1, 'V', 2)} / ${lado(d2, 'V', 2)}`, u: 'm/s' },
    {
      l: 'Ø usado · Leq D1 / D2',
      v: `${d1 ? `${d1.dn} · ${fmt(d1.leq)} m` : '—'} / ${d2 ? `${d2.dn} · ${fmt(d2.leq)} m` : '—'}`,
    },
  );
  return filas;
}

/** Card "Succión" (sucTable): geometría, atmósfera y NPSH disponible al 150 %. */
export function kvSuccion(b: BombaResult, npshr?: unknown, margenNpsh?: unknown): KvRci[] {
  const req = (num(npshr) || 0) + (num(margenNpsh) || 0);
  return [
    { l: 'Ø interno de succión', v: fmt(b.IDs, 1), u: 'mm' },
    { l: 'Longitud total de succión (real + Leq)', v: fmt(b.LtS), u: 'm' },
    { l: 'Velocidad en succión al 150 %', v: fmt(b.Vsuc), u: 'm/s', nota: '≤ 4,57 m/s' },
    { l: 'Presión atmosférica', v: fmt(b.Patm), u: 'm.c.a.' },
    { l: 'Presión de vapor', v: fmt(b.pv), u: 'm.c.a.' },
    { l: 'Pérdidas en succión al 150 %', v: fmt(b.HfS), u: 'm' },
    {
      l: 'NPSH disponible',
      v: fmt(b.NPSHd),
      u: 'm',
      nota: req > 0 ? `Requerido + margen: ${fmt(req, 1)} m` : undefined,
    },
  ];
}

/** Card "Jockey" (jkTable): las tres presiones de arranque/parada de la cadena de bombas. */
export function kvJockey(b: BombaResult): KvRci[] {
  return [
    {
      l: 'Jockey: parada',
      v: fmt(b.JkStop, 0),
      u: 'psi',
      nota: 'Churn + estática mínima de succión',
    },
    { l: 'Jockey: arranque', v: fmt(b.JkStart, 0), u: 'psi', nota: 'Parada − 10 psi' },
    {
      l: 'Bomba principal: arranque',
      v: fmt(b.PpStart, 0),
      u: 'psi',
      nota: 'Arranque jockey − 5 psi',
    },
  ];
}

/** Card "Tanque" (tqTable): volumen de rociadores, de montantes y el útil que gobierna. */
export function kvTanque(b: BombaResult, t: TanqueResult): KvRci[] {
  return [
    {
      l: 'Volumen rociadores + mangueras',
      v: fmt(t.Vroc, 1),
      u: 'm³',
      nota: `${fmt(t.dur, 0)} min`,
    },
    {
      l: 'Volumen montantes',
      v: fmt(t.Vsp, 1),
      u: 'm³',
      nota: b.D2 ? '30 min' : 'Sin demanda de montantes',
    },
    {
      l: 'Volumen útil del tanque',
      v: fmt(t.V, 1),
      u: 'm³',
      nota: `Mayor de los dos + reserva${t.tip ? ` · gobierna ${t.tip}` : ''}`,
    },
  ];
}

/* ============================ 6. Rectángulo de fuego ============================ */

/** Los datos que pinta el rectángulo de fuego (drawRect del HTML), en m y rociadores. */
export interface RectFuego {
  /** Separación entre rociadores del ramal (m). */
  S: number;
  /** Separación entre ramales (m). */
  L: number;
  /** Rociadores por ramal del lado largo. */
  Nramal: number;
  /** Ramales que cubre el área de diseño. */
  Nramales: number;
  /** Rociadores en operación del área. */
  Nreq: number;
  /** Lado largo del rectángulo teórico, 1,2·√A (m). */
  Llargo: number;
  /** Lado corto, área (m²) / lado largo (m). */
  Acorto: number;
  /** Área de diseño (ft²). */
  Adis: number;
}

/**
 * Datos del rectángulo de fuego de una tipología. Ej: el ejemplo da 11.94 × 8.29 m con 7
 * rociadores (3 + 3 + 1) dentro de un área de 1066.24 ft².
 */
export function datosRectangulo(ro: Criterios): RectFuego {
  const Acorto = ro.Acorto > 0 ? ro.Acorto : (ro.Adis * 0.092903) / Math.max(0.01, ro.Llargo);
  return {
    S: ro.S,
    L: ro.L,
    Nramal: ro.Nramal,
    Nramales: ro.Nramales,
    Nreq: ro.Nreq,
    Llargo: ro.Llargo,
    Acorto,
    Adis: ro.Adis,
  };
}

/* ============================ 7. Soportes sísmicos ============================ */

/** NFPA 13 cap. 18: separación máxima entre riostras laterales / longitudinales / de cuatro vías de un montante (m). */
export const SIS_LAT = 12.2;
export const SIS_LONG = 24.4;
export const SIS_4V = 7.6;

/**
 * Diámetro en pulgadas de una tubería comercial: catálogo PIPES del material o, si no está,
 * el parseo de la string de pulgadas del HTML ('2 1/2"' → 2.5). Ej: inchOf('Acero SCH 10', '4"') = 4.
 */
export function inchOf(mat: string, dn: unknown): number | null {
  const p = PIPES[mat] && PIPES[mat][String(dn)];
  if (p) return p.inch;
  return (
    parseFloat(
      String(dn)
        .replace(' 1/2', '.5')
        .replace(' 1/4', '.25')
        .replace('1/2', '0.5')
        .replace('3/4', '0.75'),
    ) || null
  );
}

/** Un tipo de tipología en el conteo sísmico (las longitudes y riostras que le corresponden). */
export interface SismoTip {
  id: string;
  /** Número de pisos que representa (una tipología implícita cuenta 1). */
  nF: number;
  /** Rango de pisos ("P1, P2, P3"); vacío en implícitas. */
  pisos?: string;
  /** true si la tipología aún no tiene red calculada. */
  sin?: boolean;
  /** Longitud total de tramos (troncales y secundarias, m). */
  Lm?: number;
  /** Riostras laterales de los tramos. */
  lat?: number;
  /** Riostras longitudinales de los tramos. */
  lon?: number;
  /** Ramales de 2½" o más (llevan riostra lateral). */
  ramG?: number;
  /** Longitud de esos ramales (m). */
  LrG?: number;
  /** Riostras laterales de los ramales grandes. */
  latR?: number;
  /** Ramales menores: llevan restricción. */
  restr?: number;
}

/** Una fila del desglose de holguras por diámetro: pulgadas y juego (50 mm, 100 mm desde 4"). */
export interface SismoHolg {
  dn: string;
  i: number;
  mm: number;
}

/** Conteo sísmico completo: por tipología, altura del montante, penetraciones, cuatro vías,
 *  acoples y holguras por diámetro. null sin edificio. */
export interface SismoK {
  tips: SismoTip[];
  /** Altura del montante: cota máxima (derivación o salida) − base (m). */
  hM: number;
  /** Penetraciones de losa (pisos sobre la base − 1). */
  nPen: number;
  /** ¿Restricción en penetración de losa? (local.losaRestr distinto de "No"). */
  losaR: boolean;
  /** Riostras de cuatro vías adicionales por altura (0 con restricción de losa). */
  fourInt: number;
  /** Riostras de cuatro vías por montante: nM·(1 + fourInt). */
  four: number;
  /** Acoples flexibles: nM·(2 + 2·nPen). */
  acop: number;
  /** Longitud del cuarto de bombas (m). */
  Lc: number;
  /** Riostras laterales del cuarto. */
  latC: number;
  /** Número de montantes (sp.num). */
  nM: number;
  /** Holguras por diámetro, de menor a mayor (50 mm; 100 mm desde 4"). */
  holg: SismoHolg[];
}

/** "P2 – P3" (o la lista corta) de los pisos de una tipología, para tablas de tipologías/sismo. */
export function rangoTipologia(g: Tipologia, rows: PisoRow[]): string {
  const n: string[] = [];
  for (const i of g.pisos) n.push(String(rows[i]?.nombre || '(sin nombre)'));
  return n.length <= 3 ? n.join(', ') : `${n[0]} a ${n[n.length - 1]} (${n.length})`;
}

/**
 * Port del sismoConteo del HTML: conteo indicativo de soportes sísmicos (NFPA 13 cap. 18) por
 * tipología — tramos con riostras lateral/longitudinal, ramales de 2½"+ con riostra y los
 * menores con restricción, cuatro vías por altura (sin restricción de losa), acoples por
 * penetración y holguras por diámetro.
 * Ej: el ejemplo (montante de 14.7 m, losaRestr Sí) da four = 1 y acop = 6.
 */
export function sismoConteo(
  edif: Edificio,
  pisos: PisoRow[],
  sp: RciSp,
  local: RciLocal,
  redes?: Record<string, Red>,
): SismoK | null {
  const tips: SismoTip[] = [];
  for (const t of Object.values(edif.typ)) {
    const implicit = (t.g as Tipologia & { implicit?: boolean }).implicit;
    if (!t.rd) {
      tips.push({ id: t.g.id, sin: true, nF: t.g.pisos.length || 1 });
      continue;
    }
    const red: Partial<Red> = (redes || {})[t.g.planta] || {};
    const nF = implicit ? 1 : t.g.pisos.length || 1;
    let Lm = 0;
    for (const y of t.rd.tramos) Lm += num(y.t.L) || 0;
    const ramG: RamalCalc[] = [];
    let LrG = 0;
    let latR = 0;
    for (const x of t.rd.rams) {
      const dn = x.res ? x.res.dn : x.r.dn;
      if ((inchOf(txt((x.rEff || x.r).mat) || txt(red.mat), dn) || 0) >= 2.5) {
        ramG.push(x);
        const Lr = num(x.r.Lr) || 0;
        LrG += Lr;
        latR += Math.max(1, Math.ceil(Lr / SIS_LAT));
      }
    }
    const lat = Lm > 0 ? Math.max(1, Math.ceil(Lm / SIS_LAT)) : 0;
    const lon = Lm > 0 ? Math.max(1, Math.ceil(Lm / SIS_LONG)) : 0;
    tips.push({
      id: t.g.id,
      nF,
      pisos: implicit ? '' : rangoTipologia(t.g, pisos),
      Lm,
      lat,
      lon,
      ramG: ramG.length,
      LrG,
      latR,
      restr: t.rd.rams.length - ramG.length,
    });
  }
  const zs: number[] = [];
  for (const o of edif.pf) if (o.zT !== null) zs.push(o.zT);
  for (const o of edif.outs) zs.push(o.zS as number);
  const hM = zs.length ? Math.max(...zs) - edif.zBase : 0;
  let nConT = 0;
  for (const o of edif.pf) if (o.zT !== null && o.zT > edif.zBase + 0.5) nConT++;
  const nPen = Math.max(0, nConT - 1);
  let Lc = 0;
  for (const r of edif.cuarto || []) Lc += num(r.L) || 0;
  const nM = Math.max(1, num(sp.num) || 1);
  const dns = new Map<string, number>();
  const addDn = (mat: unknown, dn: unknown): void => {
    const i = inchOf(txt(mat), dn);
    if (i) dns.set(String(dn), i);
  };
  for (const t of Object.values(edif.typ)) {
    if (!t.rd) continue;
    for (const x of t.rd.rams) addDn((x.rEff || x.r).mat, x.res ? x.res.dn : x.r.dn);
    for (const y of t.rd.tramos)
      addDn(
        y.t.mat,
        y.res && y.res.rows[0] ? (y.res.rows[0] as { dnUsed?: string }).dnUsed : y.t.dn,
      );
  }
  addDn(edif.M.mat, edif.dnM);
  for (const r of edif.cuarto || []) addDn(r.mat, r.dn);
  const losaR = local.losaRestr !== 'No';
  const fourInt = hM > 0.9 && !losaR ? Math.max(0, Math.ceil(hM / SIS_4V) - 1) : 0;
  const holg: SismoHolg[] = [];
  const pares = [...dns.entries()].sort((a, b) => a[1] - b[1]);
  for (const [dn, i] of pares) holg.push({ dn, i, mm: i >= 4 ? 100 : 50 });
  return {
    tips,
    hM,
    nPen,
    losaR,
    fourInt,
    four: hM > 0.9 ? nM * (1 + fourInt) : 0,
    acop: hM > 0.9 ? nM * (2 + 2 * nPen) : 0,
    Lc,
    latC: Lc > 0 ? Math.max(1, Math.ceil(Lc / SIS_LAT)) : 0,
    nM,
    holg,
  };
}

/* ============================ 9. Strip de la derivación ============================ */

/**
 * "A garantizar en la derivación" (el strip dstrip del HTML): caudal y presión que el montante
 * debe entregar en la derivación del piso. null si la red no cierra completa.
 * Ej: stripDerivacion(R.red) del ejemplo = { Q: 128.54, P: 37.70 }.
 */
export function stripDerivacion(red: RedResult | null): { Q: number; P: number } | null {
  if (!red || !red.rt || !red.rt.solved || red.errs.length) return null;
  return { Q: red.rt.Q as number, P: red.rt.P as number };
}

/* ============================ 10. Mapa de navegación ============================ */

/** Una sub-pestaña de una página: id (para RUTA_DE) y título visible. */
export interface SubTab {
  id: string;
  l: string;
}

/**
 * Sub-pestañas de cada página de diseño RCI, con sus títulos: el shell de navegación la consume
 * y RUTA_DE garantiza que todo "Ir al dato" caiga en una sub-pestaña de esta lista.
 * Ej: SUBS_POR_TAB['hidraulica'] = ramales + tramos.
 */
export const SUBS_POR_TAB: Record<string, SubTab[]> = {
  entradas: [
    { id: 'normativa', l: 'Normativa local' },
    { id: 'clasificacion', l: 'Clasificación y riesgo' },
    { id: 'tuberia', l: 'Tubería y mangueras' },
    { id: 'montantes', l: 'Montantes NFPA 14' },
    { id: 'siamesa', l: 'Siamesa' },
    { id: 'seleccion', l: 'Bomba: selección' },
    { id: 'succion', l: 'Succión y NPSH' },
    { id: 'jockey', l: 'Bomba: jockey' },
    { id: 'tanque', l: 'Tanque' },
  ],
  rociadores: [
    { id: 'datos', l: 'Datos del proyecto' },
    { id: 'criterios', l: 'Criterios NFPA 13' },
  ],
  tipologias: [
    { id: 'pisos', l: 'Pisos del edificio' },
    { id: 'tipos', l: 'Tipologías y avisos' },
    { id: 'corte', l: 'Corte esquemático' },
  ],
  hidraulica: [
    { id: 'ramales', l: 'Ramales' },
    { id: 'tramos', l: 'Tramos y nudos' },
  ],
  gabinetes: [{ id: 'ruta', l: 'Ruta de gabinetes' }],
  perfil: [{ id: 'grafico', l: 'Perfil de presiones' }],
  bomba: [
    { id: 'demanda', l: 'Demandas' },
    { id: 'seleccion', l: 'Selección NFPA 20' },
    { id: 'cuarto', l: 'Cuarto de bombas' },
    { id: 'succion', l: 'Succión' },
    { id: 'jockey', l: 'Jockey' },
    { id: 'tanque', l: 'Tanque' },
  ],
  sismo: [{ id: 'criterios', l: 'Soportes sísmicos' }],
  verificaciones: [{ id: 'todas', l: 'Todas' }],
};

/** Destino de un "Ir al dato": pestaña + sub-pestaña (+ campo exacto si lo hay). */
export interface RutaCheck {
  tab: string;
  sub: string;
  /** El path del dato dentro del estado (ej: 'local.reqSismo'). */
  campo?: string;
}

/** Familia (prefijo del path) → sub-pestaña de Entradas. */
const SUB_ENTRADAS: Record<string, string> = {
  local: 'normativa',
  clas: 'clasificacion',
  tub: 'tuberia',
  mang: 'tuberia',
  sp: 'montantes',
  mont: 'montantes',
  sia: 'siamesa',
  tanque: 'tanque',
  pisos: 'seleccion',
};

/** Campos de bomba que viven en la sub-pestaña de selección / de succión. */
const BOMBA_SEL = new Set(['margen', 'qrManual', 'fchurn', 'etaN', 'eta150', 'fs']);
const BOMBA_SUC = new Set([
  'zFondo',
  'hmin',
  'hmax',
  'matSuc',
  'dnSuc',
  'lSuc',
  'c90',
  'tee',
  'comp',
  'chq',
  'altitud',
  'patmManual',
  'tagua',
  'npshr',
  'margenNpsh',
]);

/**
 * Mapa de navegación de las verificaciones: convierte el "go" del motor (Verificacion.go) en la
 * (pestaña, sub-pestaña, campo) donde corregir el dato. Ej: ['entradas','local.reqSismo'] →
 * { tab: 'entradas', sub: 'normativa', campo: 'local.reqSismo' }; ['hidraulica'] → ramales.
 */
export function RUTA_DE(go: string[]): RutaCheck {
  const tab = go[0] || 'verificaciones';
  const campo = go[1] || undefined;
  const path = campo || '';
  const punto = path.indexOf('.');
  const fam = punto >= 0 ? path.slice(0, punto) : '';
  const hoja = punto >= 0 ? path.slice(punto + 1) : '';
  switch (tab) {
    case 'entradas': {
      let sub = SUB_ENTRADAS[fam] || '';
      if (fam === 'bomba')
        sub = BOMBA_SUC.has(hoja)
          ? 'succion'
          : BOMBA_SEL.has(hoja) || !hoja
            ? 'seleccion'
            : 'jockey';
      if (!sub) sub = (SUBS_POR_TAB.entradas[0] || { id: 'normativa', l: '' }).id;
      return campo ? { tab, sub, campo } : { tab, sub };
    }
    case 'rociadores':
      return campo
        ? {
            tab,
            sub: path.startsWith('clas.qr') || path.startsWith('roc.') ? 'datos' : 'criterios',
            campo,
          }
        : { tab, sub: 'criterios' };
    case 'tipologias': {
      /* go = ['tipologias', 'pisos']: el segundo elemento nombra la SUB-pestaña, no un campo
       * (los checks de S/L/DMR no apuntan a una celda concreta). */
      const dato = campo && campo !== 'pisos' ? campo : undefined;
      return dato
        ? { tab: 'tipologias', sub: 'pisos', campo: dato }
        : { tab: 'tipologias', sub: 'pisos' };
    }
    case 'pisos':
      /* Compatibilidad con los go viejos: la pestaña 'pisos' ahora se llama 'tipologias'. */
      return campo
        ? { tab: 'tipologias', sub: 'pisos', campo }
        : { tab: 'tipologias', sub: 'pisos' };
    case 'hidraulica':
      return { tab, sub: (go[2] || '').includes('tramos') ? 'tramos' : 'ramales' };
    case 'gabinetes':
      return { tab, sub: 'ruta' };
    case 'perfil':
      return { tab, sub: 'grafico' };
    case 'bomba':
      return campo ? { tab, sub: 'demanda', campo } : { tab, sub: 'demanda' };
    case 'sismo':
      return campo ? { tab, sub: 'criterios', campo } : { tab, sub: 'criterios' };
    default:
      return { tab: 'verificaciones', sub: 'todas' };
  }
}
