/**
 * Tipos del motor RCI (Red Contra Incendio): el estado de entradas (RciState) y la forma de cada
 * resultado intermedio de compute(). Todos los módulos del motor importan sus tipos de aquí para
 * no crear ciclos de import. Ej: st.redes["A"].ramales[0].Lr = 18.67 (m de punta a conexión).
 */
import { ESP_DEF, type EspAcc, type HzEntry } from './tables';

export type { EspAcc, HzEntry, PipeSpec } from './tables';

/** Campo de entrada tal como lo maneja el HTML: número o "" (vacío). num() lo resuelve. */
export type NumIn = number | string;

/** Una fila de tubería, sirviendo tanto para el estado (ramales/tramos/cuarto) como para las
 *  filas que construye el cálculo (brazos de ramal, ruta de gabinetes). Las columnas de
 *  accesorios estándar (c45…ret) están en el orden de FIT/LEQ de tables.ts. */
export interface TuberiaRow {
  ni?: string;
  nf?: string;
  nombre?: string;
  mat?: string;
  dn?: string;
  L?: NumIn;
  c45?: NumIn;
  c90?: NumIn;
  clr?: NumIn;
  tee?: NumIn;
  mar?: NumIn;
  comp?: NumIn;
  ret?: NumIn;
  esp?: string;
  leqOtros?: NumIn;
  zi?: NumIn;
  zf?: NumIn;
  /* Solo ramales: geometría y rociadores */
  dib?: NumIn;
  fluyen?: NumIn;
  S?: NumIn;
  Lr?: NumIn;
  brazo?: NumIn;
  zr?: NumIn;
  zc?: NumIn;
  con?: string;
  roc?: boolean;
  k?: NumIn;
  /* Solo rutas de alimentación: aportes de ramales equilibrados o caudales fijos */
  ramal?: string;
  nRamal?: NumIn;
  _extra?: { ramal: string; n: number } | null;
  indiv?: boolean;
  qFijo?: NumIn;
  /* Solo gabinetes */
  salida?: boolean;
  qExtra?: number;
  [k: string]: unknown;
}

export interface RciMeta {
  proyecto: string;
  pais: string;
  ciudad: string;
  disenador: string;
  revision: string;
}

export interface RciLocal {
  codLocal: string;
  ocupLocal: string;
  exigeRoc: string;
  refRoc: string;
  exigeSP: string;
  refSP: string;
  adopNac: string;
  normElec: string;
  reqSismo: string;
  normSis: string;
  parSismo: string;
  zonaSis: string;
  cp: string;
  losaRestr: string;
}

export interface RciClas {
  almacen: string;
  arrumeH: NumIn;
  riesgo: string;
  sistema: string;
  qr: string;
  htecho: NumIn;
  constr: string;
  techoIncl: string;
  ocultoComb: string;
}

export interface RciRoc {
  K: NumIn;
  Pmin: NumIn;
  S: NumIn;
  L: NumIn;
  Dmuro: NumIn;
}

export interface RciTub {
  Vmax: NumIn;
  Pcomp: NumIn;
}

export interface RciMang {
  mangBomba: string;
  mangTanque: string;
  duracion: NumIn;
}

export interface RciSp {
  clase: string;
  num: NumIn;
  rociado: string;
  diam: NumIn;
  zMinSalida: NumIn;
}

export interface RciBomba {
  margen: NumIn;
  qrManual: NumIn;
  fchurn: NumIn;
  etaN: NumIn;
  eta150: NumIn;
  fs: NumIn;
  zFondo: NumIn;
  hmin: NumIn;
  hmax: NumIn;
  matSuc: string;
  dnSuc: string;
  lSuc: NumIn;
  c90: NumIn;
  tee: NumIn;
  comp: NumIn;
  chq: NumIn;
  altitud: NumIn;
  patmManual: NumIn;
  tagua: NumIn;
  npshr: NumIn;
  margenNpsh: NumIn;
  qjockey: NumIn;
}

export interface RciTanque {
  vextra: NumIn;
}

export interface RciSia {
  n: NumIn;
  entradas: NumIn;
  rosca: string;
  npt: NumIn;
  h: NumIn;
  mat: string;
  dn: string;
  L: NumIn;
  c90: NumIn;
  tee: NumIn;
  chq: NumIn;
  cierre: string;
  drenaje: string;
  hidrante: NumIn;
}

/** Montante NFPA 14 (standpipe): material/diámetro, alturas de salida de manguera (hS) y de
 *  derivación del piso (hD, en m sobre el NPT (Nivel de Piso Terminado)), cota de la base y la
 *  ruta del cuarto de bombas. */
export interface MontCfg {
  mat: string;
  dn: string;
  hS: NumIn;
  hD: NumIn;
  zBase: NumIn;
  holgura: NumIn;
  cuarto: TuberiaRow[];
}

export interface MontanteCfg {
  id: string;
  nombre: string;
  pisos: number[];
}

export interface NodoCfg {
  z: NumIn;
}

/** Una red de piso (planta arquitectónica): ramales y tramos en árbol hasta la derivación (raiz).
 *  Las cotas viven en nodos (modelo actual); zRam es la cota común de los ramales. */
export interface Red {
  raiz?: string;
  mat?: string;
  zRam?: NumIn;
  nodos?: Record<string, NodoCfg>;
  ramales: TuberiaRow[];
  tramos: TuberiaRow[];
}

export interface PisoGen {
  sot: number;
  pis: number;
  h: number;
  hs: number;
  z1: number;
}

export interface PisoRow {
  nombre: string;
  npt: NumIn;
  uso?: string;
  planta: string;
  riesgo: string;
  sistema: string;
  htecho: NumIn;
  qr: string;
  constr: string;
  techoIncl: string;
  ocultoComb: string;
  K: NumIn;
  S: NumIn;
  L: NumIn;
  salida: string;
  tip: string;
  vreg?: string;
  vrp?: string;
}

export interface RciPisos {
  zBomba: NumIn;
  activa: string;
  /** Representativo elegido a mano por tipología: id de tipología → nombre del piso. */
  rep: Record<string, string>;
  estado: Record<string, string>;
  gen: PisoGen;
  rows: PisoRow[];
}

export interface RciInf {
  secs: Record<string, unknown>;
  matricula: string;
  revs: unknown[];
}

/** Estado completo de entradas del proyecto RCI. Ej: clas.riesgo = "Riesgo leve" elige la fila
 *  de HZ que gobierna densidad, área y duración. */
export interface RciState {
  meta: RciMeta;
  local: RciLocal;
  clas: RciClas;
  roc: RciRoc;
  tub: RciTub;
  mang: RciMang;
  sp: RciSp;
  bomba: RciBomba;
  tanque: RciTanque;
  sia: RciSia;
  inf: RciInf;
  montantes: MontanteCfg[];
  redes: Record<string, Red>;
  mont: MontCfg;
  esp: EspAcc[];
  pisos: RciPisos;
  notas: string;
  /** Coeficientes C adoptados por el diseñador, por material: { "Acero SCH 40": { h: 120, s: 100 } }. */
  cmat?: Record<string, { h?: NumIn; s?: NumIn }>;
  /** Interruptor del cálculo automático de red (legado de la UI). */
  auto?: { on?: boolean };
}

/* ---------------- Resultados del cálculo ---------------- */

/** Contexto compartido de una corrida hidráulica: criterios, límites del proyecto y los Keq de
 *  los ramales ya calculados (para equilibrar aportes). Ej: Vmax = 6 m/s por defecto. */
export interface CalcCtx {
  cmat?: Record<string, { h?: NumIn; s?: NumIn }>;
  K: number;
  Pmin: number;
  sistema: string;
  Vmax: number;
  Pcomp: number;
  PreqSP: number;
  claseSP: string;
  branches: Record<string, RouteResult>;
  /** Catálogo de accesorios especiales (se asigna justo después de crear el ctx, como en el HTML). */
  esp?: EspAcc[];
  hD?: number | null;
}

/** Cálculo de una tubería individual cuando los datos son completos. */
export interface PipeCalc {
  ok: true;
  id: number;
  C: number;
  leq: number;
  leqFit: number;
  Lt: number;
  pfu: number;
  Pf: number;
  PfL: number;
  PfAcc: number;
  Pe: number;
  Pfin: number;
  V: number;
  leqEsp: number;
  dpEsp: number;
  espUnk: string[];
  espDet: string[];
}

/** Resultado de pipeRow: cálculo completo o el error que impide calcular. */
export type PipeRowRes = PipeCalc | { ok: false; err: string };

/** Una fila ya calculada dentro de una ruta: arranca en Pini con caudal Q y termina en Pfin.
 *  En la rama inválida Pini/q/Q/dnUsed pueden faltar (fila tras un error anterior). */
export type FilaRoute =
  | { ok: false; err: string; Pini?: number; q?: number; Q?: number; dnUsed?: string }
  | ({
      ok: true;
      Pini: number;
      q: number;
      Q: number;
      dnUsed: string;
      chkV: string;
      chkP: string;
    } & PipeCalc);

/** Resultado de route() sobre una secuencia de filas. Ej: la ruta de gabinetes cierra con
 *  Pend = 127.36 psi y Qend = 500 gpm en el ejemplo de verificación. */
export interface RouteResult {
  rows: FilaRoute[];
  Pend: number;
  Qend: number;
  valid: boolean;
  nSpr: number;
  nIndiv: number;
  qFix: number;
  /** K equivalente Q/√P que calcRamal agrega para el equilibrio de nudos. */
  Keq?: number;
  dn?: string;
  Vmax?: number;
}

/** Un ramal dentro del cálculo de la red: el row de entrada más su brazo calculado. */
export interface RamalCalc {
  r: TuberiaRow;
  i: number;
  id: string;
  nombre: string;
  dib: number | null;
  fl: number;
  auto: boolean;
  n0: number;
  n1: number;
  rEff?: TuberiaRow;
  rows?: TuberiaRow[];
  res?: RouteResult;
  brazo: number | null;
  Qeq?: number;
  Peq?: number;
}

export interface TramoCalc {
  t: TuberiaRow;
  i: number;
  de: string;
  a: string;
  res?: RouteResult | null;
  row?: TuberiaRow;
  Qeq?: number;
}

/** Aporte que llega a un nudo: un ramal (con su calc) o un tramo que viene de otro nudo. */
export type Inflow =
  | { tipo: 'ramal'; x: RamalCalc; P: number; Q: number; Qb?: number }
  | { tipo: 'tramo'; y: TramoCalc; P: number; Q: number; Qb?: number };

export interface NudoCalc {
  nombre: string;
  inflows: Inflow[];
  out: TramoCalc | null;
  P?: number;
  Q?: number;
  gov?: Inflow;
  solved?: boolean;
  Peq?: number;
}

/** Resultado de computeRed: el árbol resuelto desde el rociador más remoto hasta la raíz. */
export interface RedResult {
  rams: RamalCalc[];
  tramos: TramoCalc[];
  nodes: Record<string, NudoCalc>;
  root: string;
  rt: NudoCalc | null;
  errs: string[];
  Nop: number;
  dibTot: number;
  flTot: number;
  desc: string;
}

/** Criterios de diseño de rociadores (NFPA 13-2025, Tabla 19.2.3.1.1) para una clasificación y
 *  una geometría. Ej: Adis = 1066.24 ft² con QR y techo de 5.30 m en el ejemplo. */
export interface Criterios {
  hz: HzEntry;
  K: number;
  Pmin: number;
  S: number;
  L: number;
  HtFt: number;
  FSeco: number;
  RedQR: number;
  Adis: number;
  Llargo: number;
  Acorto: number;
  Acmax: number;
  Areal: number;
  Nreq: number;
  Nramal: number;
  Nramales: number;
  Nultimo: number;
  Q1: number;
  Prem: number;
  Qteo: number;
  Qmang: number;
  dmin: number;
  dmax: number;
}

/** Tipología: pisos con los mismos criterios y la misma planta. Ej: T1 con pisos [2,1,0]
 *  (P1, P2, P3 por índice) cuando los tres comparten riesgo, sistema y planta. */
export interface Tipologia {
  id: string;
  key: string | null;
  pisos: number[];
  mixed: number[];
  base: number;
  auto: boolean;
  highest: number;
  rep: number;
  roc: Criterios;
  hts: (number | null)[];
  enEntradas: boolean;
  planta: string;
  sistema?: string;
  riesgo: string;
}

/** Agrupación de pisos que compute() recibe: groups + tipOf (tipología de cada fila) + idx
 *  (filas ordenadas por NPT). activeId replica el activeTipId() del HTML. */
export interface Tips {
  groups: Tipologia[];
  tipOf: (string | null)[];
  idx: number[];
  activeId: string;
}

/** Una tipología ya calculada: su red (rd), el punto de operación (P, Q en la derivación) y la
 *  altura hD de esa derivación. pend = aún sin red dibujada. */
export interface TipCalc {
  g: Tipologia;
  pend?: boolean;
  ok?: boolean;
  rd?: RedResult;
  P?: number | null;
  Q?: number | null;
  hD?: number | null | undefined;
  roc: Criterios;
  riesgo: string;
}

/** Piso del edificio ya mapeado: el row más índice, decisión de VRP (Válvula Reductora de
 *  Presión) y válvula reguladora por piso. */
export interface PisoRowF {
  i: number;
  nombre: string;
  npt: number | null;
  salida: string;
  sinRoc: boolean;
  vreg: string;
  vrp: string;
}

/** Salida del perfil por piso: geometría (zT/zS), punto de la red (Preq/Q), presión requerida en
 *  bomba (res.Pend), holgura, estáticas y decisiones de válvulas. */
export interface PisoOut {
  f: PisoRowF;
  tId?: string;
  t?: TipCalc | null;
  zT: number | null;
  zS: number | null;
  rows?: TuberiaRow[];
  res?: RouteResult;
  Preq?: number;
  Q?: number;
  Pst?: number;
  PstS?: number;
  Qp?: number;
  avail?: number;
  holg?: number;
  disp?: number;
  okH?: boolean;
  vrpReq?: boolean;
  vrpSet?: number | null;
  vrp?: boolean;
  vrpFalta?: boolean;
  res15?: number | null;
  regRes?: boolean;
  regEst?: boolean;
  regReq?: boolean;
  reg?: boolean;
  regFalta?: boolean;
}

/** Edificio completo: una red por tipología, montante, ruta de gabinetes y perfil por piso. */
export interface Edificio {
  M: MontCfg;
  zB: number;
  zBase: number;
  hS: number;
  floors: PisoRowF[];
  groups: Tipologia[];
  typ: Record<string, TipCalc>;
  activeId: string;
  active?: TipCalc;
  pf: PisoOut[];
  outs: PisoOut[];
  gabRows: TuberiaRow[];
  dnM: string;
  qMax: number;
  qRocMax: number;
  cuarto: TuberiaRow[];
  montantes: MontanteCfg[];
  mont: MontanteCfg;
  /** Piso que gobierna la selección de la bomba (mayor presión neta). */
  gov?: PisoOut | null;
  PstMax?: number;
  hmin?: number;
  Pc?: number;
}

/** Una demanda contra la curva de la bomba: rociadores (D1) o montantes (D2). */
export interface Demanda {
  Q: number;
  Pdes: number;
  Psuc: number;
  P: number;
  disp?: number;
}

/** Selección de la bomba principal (NFPA 20) y sus datos de succión. Ej: Pnom = 141 psi con
 *  Qnom = 500 gpm y motor de 75 HP en el ejemplo. */
export interface BombaResult {
  IDs: number;
  Cs: number;
  leqS: number;
  LtS: number;
  D1: Demanda;
  D2: Demanda | null;
  Qdem: number;
  Qnom: number;
  Pnom: number;
  Pchurn: number;
  P150: number;
  ca: number;
  cb: number;
  curve: (q: number) => number;
  Pmaxsis: number;
  HPr: number;
  HP150: number;
  HPmot: number;
  Patm: number;
  pv: number;
  HfS: number;
  NPSHd: number;
  Vsuc: number;
  DsucMin: number;
  DdesMin: number;
  Ncab: number;
  DsucAd: number;
  PsMin: number;
  JkStop: number;
  JkStart: number;
  PpStart: number;
  Qjockey: number;
  DintReq: number;
}

/** Siamesa (conexión de bomberos, NFPA 14): presión que debe entregar el carro en las entradas. */
export interface SiaResult {
  S: RciSia;
  z: number;
  res: RouteResult | null;
  rows: TuberiaRow[];
  P: number | null;
  Q: number | null;
  alto: boolean;
  combinado: boolean;
}

export interface SpResult {
  activo: boolean;
  Preq: number;
  Qreq: number;
  dur: number;
  rows: TuberiaRow[];
  zAuto?: number;
  zMin?: number;
}

/** Tanque de almacenamiento (NFPA 22). Ej: V = 56.78 m³ útiles gobernados por los montantes. */
export interface TanqueResult {
  tip: string | null;
  dur: number;
  Vroc: number;
  Vsp: number;
  V: number;
}

/** Una verificación normativa con su estado y a dónde ir a corregir el dato. */
export interface Verificacion {
  lab: string;
  st: string;
  val: string;
  nor: string;
  guide: string;
  go?: string[];
}

/** Resultado completo de compute(): todo lo que la memoria de cálculo y las fases siguientes
 *  consumen. Ej: R.red.rt.P = 37.70 psi es la presión en la derivación del piso activo. */
export interface RciResult {
  roc: Criterios;
  branches: Record<string, RouteResult>;
  gen: null;
  red: RedResult | null;
  edif: Edificio;
  effRamales: { id: string; nombre: string; rows: TuberiaRow[] }[];
  Nop: number;
  Qroc: number;
  gab: RouteResult | null;
  sp: SpResult;
  sia: SiaResult | null;
  alim: RouteResult;
  effAlim: TuberiaRow[];
  bomba: BombaResult;
  tanque: TanqueResult;
  checks: Verificacion[];
  count: Record<string, number>;
}

/** Proyecto de ejemplo ("Cargar ejemplo de verificación" del HTML), extraído tal cual: edificio
 *  de oficinas de 3 pisos, riesgo leve QR, montante Clase III, bomba de 500 gpm a 141 psi. */
export const ejemploVerificacion = (): RciState => ({
  meta: {
    proyecto: 'Ejemplo de verificación – edificio de oficinas de 3 pisos',
    pais: 'Internacional',
    ciudad: '',
    disenador: '',
    revision: '',
  },
  local: {
    codLocal: 'NFPA 101 (referencia del ejemplo: registre aquí el código local vigente)',
    ocupLocal: 'Oficinas',
    exigeRoc: 'Sí',
    refRoc: 'Capítulo de la ocupación (ejemplo)',
    exigeSP: 'Sí',
    refSP: 'Capítulo de la ocupación (ejemplo)',
    adopNac: '',
    normElec: '',
    reqSismo: 'No',
    normSis: '',
    parSismo: '',
    zonaSis: '',
    cp: '',
    losaRestr: 'Sí',
  },
  clas: {
    almacen: 'No',
    arrumeH: '',
    riesgo: 'Riesgo leve',
    sistema: 'Húmedo',
    qr: 'Sí',
    htecho: 5.3,
    constr: 'No combustible / no obstruida',
    techoIncl: 'No',
    ocultoComb: 'No',
  },
  roc: { K: 5.6, Pmin: 7, S: 4.3, L: 3.53, Dmuro: 1.7 },
  tub: { Vmax: 6, Pcomp: 175 },
  mang: { mangBomba: 'Sí', mangTanque: 'Sí', duracion: 30 },
  sp: { clase: 'Clase III', num: 1, rociado: 'Sí', diam: 4, zMinSalida: 1.2 },
  bomba: {
    margen: 0.1,
    qrManual: '',
    fchurn: 1.2,
    etaN: 0.65,
    eta150: 0.6,
    fs: 1.0,
    zFondo: 0.3,
    hmin: 0.5,
    hmax: 3.5,
    matSuc: 'Acero SCH 10',
    dnSuc: '5"',
    lSuc: 4,
    c90: 2,
    tee: 1,
    comp: 2,
    chq: 0,
    altitud: 959,
    patmManual: '',
    tagua: 23.5,
    npshr: 3.0,
    margenNpsh: 0.5,
    qjockey: 2.0,
  },
  tanque: { vextra: 0 },
  sia: {
    n: 1,
    entradas: 2,
    rosca: 'Según el cuerpo de bomberos local',
    npt: 0,
    h: 0.75,
    mat: 'Acero SCH 10',
    dn: '4"',
    L: 6,
    c90: 2,
    tee: 1,
    chq: 1,
    cierre: 'No',
    drenaje: 'Sí',
    hidrante: 25,
  },
  inf: { secs: {}, matricula: '', revs: [] },
  montantes: [{ id: 'M1', nombre: 'Montante 1', pisos: [] }],
  redes: {
    A: {
      raiz: 'C',
      mat: 'Acero SCH 40',
      zRam: 5.3,
      nodos: { A: { z: '' }, B: { z: '' }, C: { z: 2.5 } },
      ramales: [
        {
          nombre: 'R2',
          ini: 'Eje F',
          dib: 5,
          fluyen: '',
          mat: '',
          dn: 'auto',
          S: '',
          Lr: 18.67,
          c90: '',
          tee: '',
          esp: '',
          leqOtros: '',
          zr: '',
          con: 'A',
        },
        {
          nombre: 'R1',
          ini: 'Eje F',
          dib: 5,
          fluyen: '',
          mat: '',
          dn: 'auto',
          S: '',
          Lr: 22.2,
          c90: 1,
          tee: 1,
          esp: '',
          leqOtros: '',
          zr: '',
          con: 'A',
        },
        {
          nombre: 'R3',
          ini: 'Eje F',
          dib: 6,
          fluyen: '',
          mat: '',
          dn: 'auto',
          S: '',
          Lr: 26.07,
          c90: 1,
          tee: '',
          esp: '',
          leqOtros: '',
          zr: '',
          con: 'B',
        },
      ],
      tramos: [
        {
          nombre: 'T1',
          de: 'A',
          a: 'B',
          mat: 'Acero SCH 40',
          dn: 'auto',
          L: 3.87,
          tee: 1,
          esp: '',
          leqOtros: '',
        },
        {
          nombre: 'T2',
          de: 'B',
          a: 'C',
          mat: 'Acero SCH 10',
          dn: '2"',
          L: 4.72,
          c90: 2,
          tee: 1,
          mar: 1,
          esp: 'DF',
          leqOtros: '',
        },
      ],
    },
  },
  mont: {
    mat: 'Acero SCH 10',
    dn: '4"',
    hS: 1.2,
    hD: 2.5,
    zBase: 0,
    holgura: 0,
    cuarto: [
      {
        ni: 'Base',
        nf: 'CB',
        mat: 'Acero SCH 10',
        dn: '4"',
        L: 3.0,
        tee: 3,
        comp: 2,
        ret: 1,
        esp: '',
        zi: 0,
        zf: 0,
      },
    ],
  },
  esp: ESP_DEF(),
  pisos: {
    zBomba: 0,
    activa: 'T1',
    rep: {},
    estado: { T1: 'Calculada' },
    gen: { sot: 0, pis: 3, h: 6.1, hs: 3, z1: 0 },
    rows: [
      {
        nombre: 'P3',
        npt: 12.2,
        uso: 'Oficinas',
        planta: 'A',
        riesgo: 'Riesgo leve',
        sistema: 'Húmedo',
        htecho: 5.3,
        qr: 'Sí',
        constr: 'No combustible / no obstruida',
        techoIncl: 'No',
        ocultoComb: 'No',
        K: 5.6,
        S: 4.3,
        L: 3.53,
        salida: '2½" + 1½"',
        tip: 'auto',
      },
      {
        nombre: 'P2',
        npt: 6.1,
        uso: 'Oficinas',
        planta: 'A',
        riesgo: 'Riesgo leve',
        sistema: 'Húmedo',
        htecho: 5.3,
        qr: 'Sí',
        constr: 'No combustible / no obstruida',
        techoIncl: 'No',
        ocultoComb: 'No',
        K: 5.6,
        S: 4.3,
        L: 3.53,
        salida: '2½" + 1½"',
        tip: 'auto',
      },
      {
        nombre: 'P1',
        npt: 0,
        uso: 'Recepción',
        planta: 'A',
        riesgo: 'Riesgo leve',
        sistema: 'Húmedo',
        htecho: 5.3,
        qr: 'Sí',
        constr: 'No combustible / no obstruida',
        techoIncl: 'No',
        ocultoComb: 'No',
        K: 5.6,
        S: 4.3,
        L: 3.53,
        salida: '2½" + 1½"',
        tip: 'auto',
      },
    ],
  },
  notas:
    'Gabinetes según NFPA 14, Clase III (válvula 2½" + manguera 1½"): 500 gpm a 100 psi en la salida más remota. Con rociadores en todo el edificio no se suma la demanda de rociadores: gobierna la mayor. Tramo T2 (B–C): L = 1,92 m de planta + 2,80 m de bajada a la derivación (5,30 − 2,50); 2 codos, en la base y en la cabeza de la bajada.',
});
