/**
 * Tipos del motor RCI (Red Contra Incendio): el estado de entradas (RciState) y la forma de cada
 * resultado intermedio de compute(). Todos los módulos del motor importan sus tipos de aquí para
 * no crear ciclos de import. Ej: st.redes["A"].ramales[0].Lr = 18.67 (m de punta a conexión).
 */
import type { EspAcc, HzEntry } from './tables';

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
  /** Tipo de rociador del ramal (v1.7.80): Colgante (default) | Montante | Oculto |
   *  'Colgante seco'. No cambia el cálculo; en sistema seco se exige montante/colgante seco. */
  troc?: string;
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

/** Identificación del proyecto (pestaña «Datos del proyecto»): nombre, país/ciudad, diseñador
 *  y revisión. Ej: {proyecto:'Edificio Eureka', pais:'Colombia', revision:'B'}. */
export interface RciMeta {
  proyecto: string;
  pais: string;
  ciudad: string;
  disenador: string;
  revision: string;
}

/** Normativa local (pestaña «Normativa local»): qué exige el código local del país —
 *  rociadores, salidas de manguera, adopción nacional, norma eléctrica y requisitos sísmicos
 *  (zona, factor Cp, losa restringida). Ej: exigeSP='Sí' con refSP='Cap. 9 del código local'
 *  obliga a calcular el montante NFPA 14. */
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

/** Clasificación y riesgo (NFPA 13 cap. 4): riesgo (leve/ordinario/extra), sistema
 *  (Húmedo/Seco), geometría del techo (altura, construcción, pendiente, ocultos combustibles)
 *  y rociador de respuesta rápida (qr). Ej: riesgo='Riesgo leve' + sistema='Seco' suma 30 %
 *  al área de diseño y baja el C de Hazen-Williams a 100. */
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

/** Datos del rociador de la tipología activa: K (factor K, gpm/psi½), Pmin (presión mínima en
 *  el rociador más remoto, psi), S y L (separación entre rociadores y entre ramales, m) y
 *  Dmuro (distancia al muro, m). Ej: K=5.6 con Pmin=7 calcula Q = K·√P ≈ 14.8 gpm. */
export interface RciRoc {
  K: NumIn;
  Pmin: NumIn;
  S: NumIn;
  L: NumIn;
  Dmuro: NumIn;
}

/** Límites de la red de tubería: Vmax (velocidad máxima, m/s) y Pcomp (presión que exigen los
 *  componentes, psi — donde exige válvula reductora VRP). Ej: Vmax=6 marca «NO CUMPLE» la
 *  verificación de velocidad si un tramo llega a 6.4 m/s. */
export interface RciTub {
  Vmax: NumIn;
  Pcomp: NumIn;
}

/** Mangueras de bomberos: largo en la succión de la bomba y en el tanque, y duración de la
 *  descarga que el tanque debe sostener. Ej: duracion=60 dimensiona el tanque de NFPA 22. */
export interface RciMang {
  mangBomba: string;
  mangTanque: string;
  duracion: NumIn;
}

/** Rociadores de protección especial (SP): una demanda aparte de la del riesgo general —
 *  clase de almacenamiento, n.º de rociadores simultáneos, diámetro y cota mínima de salida
 *  (m). Ej: clase='Almacenamiento en estantes' con num=12 añade su demanda a la bomba. */
export interface RciSp {
  clase: string;
  num: NumIn;
  rociado: string;
  diam: NumIn;
  zMinSalida: NumIn;
}

/** Cuarto de bombas: margen de presión, churn (fchurn), eficiencias (etaN/eta150, %), factor
 *  de servicio (fs), succión (material/diámetro/largo + accesorios c90/tee/comp/chq), niveles
 *  del tanque (zFondo/hmin/hmax, m), altitud (m s. n. m. — ajusta la presión atmosférica del
 *  NPSH (Net Positive Suction Head, carga neta positiva de succión)) y jockey (qjockey). */
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

/** Volumen extra del tanque (m³) además del que exige la duración de mangueras. Ej:
 *  vextra=5 suma 5 m³ al V total de NFPA 22. */
export interface RciTanque {
  vextra: NumIn;
}

/** Siamesa (conexión de bomberos a la calle): n.º de entradas y rosca, altura sobre el NPT
 *  (m), material/diámetro y su tubería de alimentación (L y accesorios). Ej: entradas=2 con
 *  dn='4"' y L=15 calcula la presión que debe entregar la bomba de bomberos. */
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

/** Gabinete dibujado en el plano (gris): el elemento del motor `tipo:'gabinete'` con código
 *  GABn. Ej: {code:'GAB1', npt:3.5, planId:'12'} — npt = nptBase del piso donde cayó. */
export interface RciGabinete {
  code: string;
  npt: number;
  planId: string;
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

/** Un montante del edificio (puede haber varios): su id, nombre y los pisos (índices de
 *  nivel) que atiende. Ej: {id:'M1', nombre:'Montante norte', pisos:[0,1,2]}. */
export interface MontanteCfg {
  id: string;
  nombre: string;
  pisos: number[];
}

/** Cota de un nodo del árbol de la red (z, en m — la misma referencia que zRam). Ej:
 *  nodos:{A:{z:3.5}} fija la altura del nudo A para el perfil de presiones. */
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

/** Generador rápido de pisos del formulario: n.º de sótanos, n.º de pisos, altura de piso
 *  (m), altura de salida de manguera (m) y cota del piso 1 (m). Ej: {sot:1, pis:5, h:3.2}
 *  crea 6 niveles encadenados. */
export interface PisoGen {
  sot: number;
  pis: number;
  h: number;
  hs: number;
  z1: number;
}

/** Fila de la tabla «Pisos del edificio»: nombre/NPT (Nivel de Piso Terminado) y planta
 *  llegan del PLANO (gris); riesgo, sistema, techo, QR, K, S, L y salidas se editan. Ej:
 *  salida='2½" + 1½"' marca un gabinete Clase III en ese piso. */
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
  /** Id del plano dueño de la fila (lo escribe el extractor; GRIS). Ej: '12'. */
  planId?: string;
  vreg?: string;
  vrp?: string;
}

/** Bloque de pisos del edificio: zBomba (cota de la bomba, m), la planta activa, el
 *  representativo por tipología (rep), el generador (gen) y las filas (rows). Ej:
 *  rep:{T1:'Piso 3'} calcula la red de T1 sobre el NPT de P3. */
export interface RciPisos {
  zBomba: NumIn;
  activa: string;
  /** Representativo elegido a mano por tipología: id de tipología → nombre del piso. */
  rep: Record<string, string>;
  estado: Record<string, string>;
  gen: PisoGen;
  rows: PisoRow[];
}

/** Datos de informe: matrícula profesional y revisiones (van a la memoria de cálculo). Ej:
 *  matricula='CC 123456 - CIVIL'. */
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
  /** Gabinetes GABn leídos del DIBUJO (gris): código, NPT del piso donde caen y planId de su
   *  plano. Alimenta la ruta de montantes/gabinetes de building.ts. Ej:
   *  [{code:'GAB1', npt:3.5, planId:'12'}]. */
  gabinetes?: RciGabinete[];
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

/** Un tramo (tubería común entre nudos) dentro del cálculo de la red: el row de entrada, de
 *  qué nudo a qué nudo va y su ruta calculada. Ej: de:'A' a:'B' con res valida la tubería que
 *  alimenta el ramal. */
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

/** Un nudo del árbol de la red: los aportes que le llegan (inflows), la salida (out) y la
 *  presión/caudal resueltos. Ej: gov = el aporte que GOBIERNA el nudo (el de P más alta). */
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

/** Resultado del cálculo de rociadores especiales (SP): presión/caudal requeridos, duración y
 *  sus filas de tubería. Ej: Preq=175 psi entra a la comparación «gobierna la mayor» de la
 *  bomba. */
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
