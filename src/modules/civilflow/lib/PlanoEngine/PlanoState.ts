import type { LabelBoxCorners, CrossFloorGhost } from '../shared/crossFloorGhostTypes';
export type { LabelBoxCorners, CrossFloorGhost } from '../shared/crossFloorGhostTypes';

/** Definiciones de las redes que dibuja el motor (color, prefijo de etiqueta, tipo de bajante, icono).
 *  Para los nombres/iconos que se muestran en la interfaz, usar uiConfig.REDES en su lugar. */
export const NETS = [
  {
    id: 'af',
    lbl: 'RAF',
    col: '#4D8FF7',
    ucType: 'uc',
    bmType: 'montante',
    bmPfx: 'MAF',
    bmIco: '⬆',
    emoji: '💧',
    name: 'Agua fría',
  },
  {
    id: 'ac',
    lbl: 'RAC',
    col: '#F04545',
    ucType: 'uc',
    bmType: 'montante',
    bmPfx: 'MAC',
    bmIco: '⬆',
    emoji: '🔥',
    name: 'Agua caliente',
  },
  {
    id: 'san',
    lbl: 'RS',
    col: '#F5A623',
    ucType: 'ud',
    bmType: 'bajante',
    bmPfx: 'BAN',
    bmIco: '⬇',
    emoji: '🚽',
    name: 'Sanitaria',
  },
  {
    id: 'vent',
    lbl: 'REV',
    col: '#808080',
    ucType: null,
    bmType: 'bajante',
    bmPfx: 'BREV',
    bmIco: '⬇',
    emoji: '🌬',
    name: 'Ventilación',
  },
  {
    id: 'll',
    lbl: 'RALL',
    col: '#8B5CF6',
    ucType: 'ud',
    bmType: 'bajante',
    bmPfx: 'BALL',
    bmIco: '⬇',
    emoji: '🌧',
    name: 'Aguas lluvias',
  },
  {
    id: 'recolectora',
    lbl: 'RECOLL',
    col: '#7C3AED',
    ucType: null,
    bmType: 'bajante',
    bmPfx: 'RECOLL',
    bmIco: '⬇',
    emoji: '🏠',
    name: 'Canal recolectora',
  },
  {
    id: 'gas',
    lbl: 'RG',
    col: '#A855F7',
    ucType: null,
    bmType: 'montante',
    bmPfx: 'MG',
    bmIco: '⬆',
    emoji: '⛽',
    name: 'Gas',
  },
  {
    id: 'rci',
    lbl: 'RRCI',
    col: '#F87171',
    ucType: null,
    bmType: 'montante',
    bmPfx: 'MRCI',
    bmIco: '⬆',
    emoji: '🔴',
    name: 'Contra incendio',
  },
  {
    id: 'rec',
    lbl: 'RREC',
    col: '#22D3EE',
    ucType: null,
    bmType: 'montante',
    bmPfx: 'MREC',
    bmIco: '⬆',
    emoji: '🔄',
    name: 'Recirculación',
  },
  {
    id: 'bom',
    lbl: 'RBOM',
    col: '#8A9BB8',
    ucType: null,
    bmType: 'bajante',
    bmPfx: 'BOM',
    bmIco: '⬇',
    emoji: '⬆️',
    name: 'Bombeo',
  },
];

export interface PlanoNet {
  id: string;
  lbl: string;
  col: string;
  ucType: string | null;
  bmType: string;
  bmPfx: string;
  bmIco: string;
  emoji: string;
  name: string;
}

export interface CanvasBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ¿Está activa esta red? — Consulta el conjunto de redes activas del motor; si no hay conjunto
 *  definido, todas las redes se consideran activas.
 *  @param engine Instancia del motor
 *  @param netId Id de la red a consultar
 *  @returns true si la red está activa (o si no existe un conjunto de activas) */
export function checkActiveNet(engine: IPlanoEngineCore, netId: string): boolean {
  const activeNets = engine.activeNetworks as Set<string> | undefined;
  return activeNets ? activeNets.has(netId) : true;
}

/**
 * Avisa al caller que debe abortar si `netId` está inactiva (le muestra una alerta al usuario).
 * Si la red está habilitada pero no es la activa, cambia automáticamente a ella.
 * @param engine Instancia del motor
 * @param netId Id de la red destino
 * @returns true si el caller debe abortar; false si puede continuar con seguridad
 */
export function ensureActiveNet(engine: IPlanoEngineCore, netId: string): boolean {
  if (netId === engine.activeNet) return false;
  if (!checkActiveNet(engine, netId)) {
    const netObj = NETS.find((n) => n.id === netId);
    engine.triggerAlert(
      'Red inactiva',
      `Debe activar la red de ${netObj ? netObj.name : netId} en la información general`,
    );
    return true;
  }
  engine.setActiveNet(netId);
  return false;
}

export function initNetCounts(target: { _netCounts: Record<string, PlanoNetCounts> }): void {
  target._netCounts = {};
  NETS.forEach((n) => {
    target._netCounts[n.id] = { ramal: 0, tributario: 0 };
  });
}

export function allocNetNumber(
  target: { _netCounts: Record<string, PlanoNetCounts> },
  netId: string,
  tipo: 'ramal' | 'tributario',
  isTaken: (n: number) => boolean,
): number {
  if (!target._netCounts[netId]) target._netCounts[netId] = { ramal: 0, tributario: 0 };
  let n = ++target._netCounts[netId][tipo];
  while (isTaken(n)) n = ++target._netCounts[netId][tipo];
  return n;
}

/** Ventilación y sanitaria se "enganchan" entre sí mientras se DIBUJA (el cursor se pega a la
 *  otra red) — pero NO deben usarse para auto-conectar o mover juntas: eso queda estrictamente
 *  dentro de la misma red.
 *  @param a Id de la primera red
 *  @param b Id de la segunda red
 *  @returns true si las dos redes se enganchan durante el snap del cursor */
export function netsSnapLinked(a: string, b: string): boolean {
  return a === b || (a === 'vent' && b === 'san') || (a === 'san' && b === 'vent');
}

export function isBajante(el: PlanoElement | null): el is PlanoBajante {
  return el != null && '_circ' in el;
}
export function isRamal(el: PlanoElement | null): el is PlanoRamal {
  return el != null && 'pts' in el;
}
export function isTextAnnotation(el: PlanoElement | null): el is PlanoTextAnnotation {
  return el != null && '_box' in el;
}
export function isDimension(el: PlanoElement | null): el is PlanoDimension {
  return el != null && 'L' in el;
}
export function isArea(el: PlanoElement | null): el is PlanoArea {
  return el != null && '_polyBox' in el;
}

/** Un tramo de tubería (ramal) dibujado en el plano, con sus puntos, etiquetas y datos hidráulicos. */
export interface PlanoRamal {
  id: string;
  net: string;
  tipo: string;
  padre: string | null;
  pts: number[][];
  totalL: number;
  label: string;
  ini: string;
  fin: string;
  piso: string;
  dz: string;
  uc: number;
  labelX: number;
  labelY: number;
  labelAngle: number;
  material: string;
  diametro: string;
  pendiente: number;
  bloqueado?: boolean;
  accesorioInicio?: string;
  accesorioFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
  aparatoInicio?: string;
  aparatoFin?: string;
  nSalidas?: number;
  _labelBox?: LabelBoxCorners;
  _net?: string;
  diamPulg?: number;
  _tribReversed?: boolean;
  accMed?: Record<string, string>;
  caudal?: number;
  lvert?: string;
  // Solo lo lleva un ramal CREADO AUTOMÁTICAMENTE al dividir una unión T/Y
  // (autoSplitJunctionAndSumFlow en PlanoEngineDrawing.ts) — guarda los ids de los dos ramales
  // que se juntan en él. Lo leen waterNetworkRows.ts / WaterNetworkDesign.tsx para forzar que el
  // total de UC de ESTE ramal sea la suma de esos dos, sin importar hacia qué lado corra el árbol
  // dirigido general por este punto (ese árbol se orienta hacia la fuente real de toda la red,
  // y en una unión local arbitraria puede correr en cualquier dirección).
  mergesFrom?: [string, string];
  // Solo para el viaje de ida/vuelta a la base de datos: aparato-id -> cantidad, el mismo dato
  // que FixturesPanel.tsx guarda en APARATOS_BY_TRAMO_KEY (localStorage) para este ramal. El
  // motor NO lo lee — se adjunta aquí solo para que storageService.ts lo lleve hacia/desde la
  // columna `fixtures` de la BD; el mapa de localStorage sigue siendo la fuente de verdad que la
  // interfaz lee/escribe durante la sesión.
  fixtures?: Record<string, number>;
  // Igual que `fixtures`: solo para el viaje ida/vuelta a la base de datos. Accesorios
  // hidrosanitarios ({ accesorios, Lh, nSalidas }) y de gas (aparato-id -> cantidad) que
  // FixturesPanel/GasDesign guardan en HYDRO_DATA_STORAGE_KEY / GAS_ACC_KEY (localStorage).
  // El motor NO los lee — storageService.ts los lleva hacia/desde `hydro_accesorios` /
  // `gas_accesorios` de planos_ramales.
  hydroAcc?: { accesorios: Record<string, number>; Lh: number; nSalidas: number };
  gasAcc?: Record<string, number>;
  // Posición en el plano de la etiqueta "S D=..." de un sifón, una vez que el usuario la arrastró
  // fuera de su posición calculada por defecto (renderRamales.ts). Indefinido = usar la posición
  // por defecto.
  sifonLabelIni?: [number, number];
  sifonLabelFin?: [number, number];
  _sifonLabelBoxIni?: LabelBoxCorners;
  _sifonLabelBoxFin?: LabelBoxCorners;
}

/** Bajante o montante (tubería vertical) que conecta los niveles del edificio. */
export interface PlanoBajante {
  id: string;
  net: string;
  tipo: string;
  code: string;
  x: number;
  y: number;
  pisoBase: string;
  pisoCima: string;
  nptBase: number;
  nptCima: number;
  hVert: number;
  dNominal: string;
  recibeDeIds: string[];
  alimentaIds: string[];
  descargaEnId: string | null;
  /** Puntero inverso: `${originPlanId}|${originBajanteId}` del bajante del piso superior que
   * DESCARGA en este — lo fija el selector "Origen". Es solo una ayuda de visualización/búsqueda;
   * el enlace real vive en el `descargaEnId` del origen (guardado en el storage de su piso). */
  origenId?: string | null;
  ucAcum: number;
  ucExtra: number;
  area_m2: number;
  desplazamientos: Record<string, { dx: number; dy: number; Ldesvio?: string | null }>;
  lblOffX: number;
  lblOffY: number;
  labelAngle: number;
  labelX: number;
  labelY: number;
  direccion?: 'sube' | 'baja' | 'continua' | 'mantiene';
  aparato?: string;
  totalL?: number;
  pendiente?: number;
  piso?: string;
  bajR?: number;
  _circ?: { x: number; y: number; r: number };
  _ghost?: { x: number; y: number; r: number };
  _ghostLabelBox?: LabelBoxCorners;
  _labelBox?: LabelBoxCorners;
  ghostData?: Record<
    string,
    {
      dNominal?: string;
      direccion?: 'sube' | 'baja' | 'continua' | 'mantiene';
      labelX?: number;
      labelY?: number;
    }
  >;
  isFantasma?: boolean;
  diamPulg?: number;
  diametro?: string;
  acoDiam?: string;
  capacidad?: string;
  /** Factor de simultaneidad del calentador (%), guardado desde la pantalla de selección del
   * calentador para que el "caudal ajustado" sobreviva al recargar y siga al usuario entre
   * dispositivos. */
  factorSim?: number;
  /** Sección transversal del canal recolectora (tipo:'canal', solo red 'll'), en cm — se importa a
   * la tabla de chequeo hidráulico "canal recolectora" (RainChannelsCheck.tsx). x/y es la esquina
   * superior-izquierda del rectángulo (no el centro, a diferencia de los demás glifos de bajante).
   * En planta el rectángulo dibujado es base (tamaño vertical) × longitud (tamaño horizontal);
   * altura es la profundidad en el eje Z, solo visible en isometría. */
  base?: number;
  altura?: number;
  /** Tamaño horizontal del canal en planta (cm) — el largo que recorre el canal en el dibujo. */
  longitud?: number;
  /** Caja del canal en píxeles de canvas (alineada a los ejes, sin rotación), calculada al
   * renderizar — se usa para detectar el clic en las manijas de redimensionado de las esquinas y
   * para arrastrar el cuerpo. */
  _canalBox?: { x: number; y: number; w: number; h: number };
  /** Dirección del flujo del canal recolectora, igual a la dirección en que el usuario lo
   * arrastró al dibujarlo (esquina 1 → esquina 2), como la dirección dibujada de un ramal. Se
   * fija al crearlo en handleCanalDown; alimenta la flecha de flujo centrada del canal. */
  _canalFlowDir?: 'derecha' | 'izquierda' | 'abajo' | 'arriba';
  /** Solo tiene sentido en un bajante de lluvia ("ll"): id del canal (tipo:'canal') cuyo
   * rectángulo lo contiene actualmente. Lo fija/limpia canalAssociation.ts automáticamente al
   * crear o arrastrar el bajante — un bajante solo puede estar DENTRO de un canal, nunca fuera de
   * uno al que está asociado (ver resolveAndClampToCanal). Alimenta las flechas de flujo del
   * canal. */
  canalId?: string | null;
  /** Asociación manual de un canal (tipo:'canal') con un bajante de lluvia que está FUERA de su
   *  rectángulo — se elige desde el menú contextual del canal y se dibuja una línea de conexión
   *  simple (tubería) entre ambos. Un bajante DENTRO del canal no usa esto: entra por canalId. */
  bajanteExternoId?: string | null;
}

/** Área poligonal dibujada en el plano (p.ej. techos, zonas de drenaje). */
export interface PlanoArea {
  id: string;
  pts: number[][];
  color: string;
  label: string;
  labelX: number;
  labelY: number;
  labelAngle: number;
  areaM2: number;
  net?: string;
  _labelBox?: LabelBoxCorners;
  _polyBox?: CanvasBox;
}

/** Cota lineal (medida) entre dos puntos del plano. */
export interface PlanoDimension {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  L: number;
  // Posición en el plano de la etiqueta, una vez que el usuario la arrastró fuera de la posición
  // automática (punto medio + desplazamiento). Indefinida hasta el primer arrastre.
  lblX?: number;
  lblY?: number;
  _labelPos?: { x: number; y: number };
}

/** Texto libre colocado sobre el plano. */
export interface PlanoTextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontMm: number;
  boxW: number;
  lblOffX: number;
  lblOffY: number;
  textAngle: number;
  _box?: CanvasBox;
}

/** Línea de construcción/referencia dibujada libremente sobre el plano — NO es un ramal real:
 *  queda excluida de todo cálculo hidráulico, tabla y exportación. Es solo una ayuda de trazo
 *  que el usuario puede rotar en pasos de 45°/90° y convertir después en un ramal real de la red
 *  para la que fue dibujada. */
export interface PlanoGuideLine {
  id: string;
  net: string;
  pts: [number, number][];
  _labelBox?: LabelBoxCorners;
}

/** Nivel de un edificio — etiqueta, cota NPT e índice ordinal. */
export interface PlanoLevel {
  label?: string;
  npt?: number;
  n?: string | number;
}

export interface PlanoNetCounts {
  ramal: number;
  tributario: number;
}

/** Todos los tipos de elemento que el motor puede dibujar y seleccionar. */
export type PlanoElement =
  | PlanoRamal
  | PlanoBajante
  | PlanoArea
  | PlanoTextAnnotation
  | PlanoDimension
  | PlanoGuideLine;

export interface PlanoActiveRamal {
  id?: string;
  net: string;
  tipo: string;
  padre: string | null;
  pts: number[][];
  totalL: number;
}

export interface PlanoActiveArea {
  pts: number[][];
  color: string;
}

export interface PlanoRamalDefaults {
  material: string;
  diametro: string;
  pendiente: number;
}

export type MultiDragOrigData = Record<
  string,
  {
    type: 'ramal' | 'bajante' | 'text';
    origPts?: number[][];
    origLabelX?: number;
    origLabelY?: number;
    origLabelAngle?: number;
    origX?: number;
    origY?: number;
  }
>;

/** Contrato público del motor de dibujo PlanoEngine. Expone el estado, las transformaciones de
 *  coordenadas, el snapping, el renderizado, los helpers de selección/arrastre y los slots
 *  transitorios de interacción. */
export interface IPlanoEngineCore {
  dims: PlanoDimension[];
  textAnnots: PlanoTextAnnotation[];
  areas: PlanoArea[];
  ramales: PlanoRamal[];
  bajantes: PlanoBajante[];
  crossFloorGhosts: CrossFloorGhost[];
  guideLines: PlanoGuideLine[];
  _guideStart: { x: number; y: number } | null;
  activeRamal: PlanoActiveRamal | null;
  activeArea: PlanoActiveArea | null;
  selId: string | null;
  selectedGhostId: string | null;
  _isGhostSel: boolean;
  // Traza DEV del flujo de selección (handleSelectDown/selectAt) — imprime _onDownHandler.
  _debugSel?: { x: number; y: number; notes: string[]; final: string | null } | null;
  _yeeFlashKey: string | null;
  _hiddenNets: Set<string>;
  _lockedNets: Set<string>;
  activeNetworks: Set<string> | undefined;
  activeNet: string;
  mouseX: number;
  mouseY: number;
  zoom: number;
  offX: number;
  offY: number;
  snapMode: boolean;
  tool: string;
  tipoTramo: string;
  scaleM: number;
  definedScaleM: number;
  canv: HTMLCanvasElement;
  cw: HTMLElement;
  dpr: number;
  pageW: number;
  pageH: number;
  panX: number;
  panY: number;
  panX0: number;
  panY0: number;
  panning: boolean;
  drawingAcc: boolean;
  dirty: boolean;
  offCtx: CanvasRenderingContext2D | null;
  padreTributario: string | null;
  nivelActual: PlanoLevel | null;
  // Transitorio: se fija justo después de que el primer punto de un ramal de ventilación nuevo se
  // pega a un vértice de sanitaria (unión de codo reventilado) — fuerza la dirección del PRIMER
  // segmento a coincidir con la dirección local del ramal sanitario en ese punto, en vez del snap
  // genérico de 45°. Se limpia una vez colocado ese primer segmento.
  _ventFirstSegDir?: { x: number; y: number } | null;
  _dimStart: { x: number; y: number } | null;
  // Estado de la primera esquina para la herramienta de arrastre de rectángulo del canal — mismo
  // patrón de "clic-mueve-clic" (rubber-band) que _dimStart/_guideStart.
  _canalStart: { x: number; y: number } | null;
  // Estado transitorio de cada arrastre (se fija en handleMouseDown, se consume en
  // handleDragUp/handleDragMove; siempre vuelve a null al terminar el arrastre).
  _bajDragBackupXY?: { x: number; y: number; labelX?: number; labelY?: number } | null;
  _bajDragBackupPts?: Record<string, number[][]> | null;
  _lblDragIsParent?: boolean;
  _pendingLblDrag?: { id: string; offX: number; offY: number; dist: number; isGhost: boolean };
  _dragBackupPts?: number[][] | null;
  _dragLinkedBackupPts?: Record<string, number[][]> | null;
  _netCounts: Record<string, PlanoNetCounts>;
  _ramalDefaults: PlanoRamalDefaults | null;
  _dirty: boolean;
  _onRequestTextCb: ((x: number, y: number, cb: (text: string) => void) => void) | null;
  _loadedPlanId: string | number | null;
  planId?: string | number;
  _onDirtyCb: (() => void) | null;
  _lastMouseCvs: { x: number; y: number };
  // Punto (en coords de canvas) donde el usuario hizo clic para seleccionar el ramal actual —
  // usado por el atajo Suprimir para recortar el extremo CERCA DEL CLIC DE SELECCIÓN, no el que
  // queda cerca del cursor al momento de pulsar la tecla (que puede estar en otro lado del plano).
  _selPointCvs?: { x: number; y: number };
  _snapToSegment(
    x: number,
    y: number,
    pts: number[][],
    threshold?: number,
  ): { x: number; y: number } | null;
  nptLevels: PlanoLevel[];
  ghostDrag: { id: string; startX: number; startY: number; baseDx: number; baseDy: number } | null;
  lblDrag: { id: string; offX: number; offY: number; slot?: 'ini' | 'fin' } | null;
  txtDrag: { id: string; startX: number; startY: number; origX: number; origY: number } | null;
  dimLblDrag: { id: string; offX: number; offY: number } | null;
  txtResize: {
    id: string;
    corner: 'tl' | 'tr' | 'bl' | 'br';
    anchorX: number;
    anchorY: number;
    startDist: number;
    origFontMm: number;
    origBoxWpx: number;
  } | null;
  bajDrag: { id: string; offX: number; offY: number } | null;
  // Redimensionado del rectángulo de un canal por sus manijas de esquina — anchorX/anchorY son las
  // coordenadas de la esquina OPUESTA en el plano (no en píxeles de canvas, a diferencia de
  // txtResize), capturadas al agarrar y fijas durante todo el gesto; base/altura y la esquina
  // arrastrada se recalculan en vivo desde la posición del cursor en cada movimiento.
  canalResizeDrag: {
    id: string;
    corner: 'tl' | 'tr' | 'bl' | 'br';
    anchorX: number;
    anchorY: number;
  } | null;
  ptDrag: {
    id: string;
    ptIdx: number;
    slideConstraint?: { otherId: string; segmentIdx: number };
    accMedSlide?: { ax: number; ay: number; bx: number; by: number };
    linkedPts?: { id: string; ptIdx: number }[];
  } | null;
  areaDrag: { id: string; startX: number; startY: number } | null;
  dimDrag: { id: string; startX: number; startY: number } | null;
  ramalDrag: {
    id: string;
    startX: number;
    startY: number;
    origPts: [number, number][];
    origLabelX?: number;
    origLabelY?: number;
    connBaj?: {
      id: string;
      origX: number;
      origY: number;
      origLblX: number;
      origLblY: number;
      atIdx: number;
    }[];
    connRamales?: {
      id: string;
      origPts: [number, number][];
      origLabelX?: number;
      origLabelY?: number;
    }[];
  } | null;
  multiSel: string[];
  multiDrag: { startX: number; startY: number; origData: MultiDragOrigData } | null;
  marqueeRect: { x1: number; y1: number; x2: number; y2: number } | null;
  MM: {
    lblName: number;
    lblInfo: number;
    lblCode: number;
    flowEmoji: number;
    coord: number;
  };
  readonly labelScaleM: number;

  toCvs(px: number, py: number): { x: number; y: number };
  toPlane(cx: number, cy: number): { x: number; y: number };
  mm2cvs(mm: number): number;
  pxToM(px: number): number;
  realMmToCanvasPx(realRadiusMm: number): number;
  cmToCanvasPx(cm: number): number;
  cmToPlanePx(cm: number): number;
  snapAngle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    net?: string,
    tipo?: string,
  ): { x: number; y: number };
  snapToExisting(x: number, y: number): { x: number; y: number } | null;
  snapPreviewToPadre(x: number, y: number): { x: number; y: number } | null;
  getBajantesFantasma(): PlanoBajante[];
  render(): void;
  scheduleRender(): void;
  _emitSelect(el: unknown): void;
  _emitStatus(msg: string): void;
  _emitDelete(ids: string[]): void;
  _markDirty(): void;
  _statusMsg(): string;
  _renumberRamales(netId: string): void;
  _renumberBajantes(netId: string): void;
  _renumberMontantes(): void;
  _renumberAreas(): void;
  updateElementById(id: string, fields: Record<string, unknown>): void;
  selectAt(cx: number, cy: number): void;
  getSelected():
    | PlanoRamal
    | PlanoBajante
    | PlanoTextAnnotation
    | PlanoArea
    | PlanoDimension
    | PlanoGuideLine
    | null;
  deleteSelected(ids?: string[]): void;
  setActiveNet(id: string): void;
  triggerAlert(title: string, msg: string): void;
  triggerAccesorioModal(data: {
    ramalId: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  }): void;
}
