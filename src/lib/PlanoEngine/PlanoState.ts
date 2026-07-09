// NETS: Drawing-engine network definitions (ucType, bmType, bmPfx, etc).
// For UI display use uiConfig.REDES instead (has lbl, sub, ico, icoImg).
export const NETS = [
  { id: 'af', lbl: 'RAF', col: '#4D8FF7', ucType: 'uc', bmType: 'montante', bmPfx: 'MAF', bmIco: '⬆', emoji: '💧', name: 'Agua fría' },
  { id: 'ac', lbl: 'RAC', col: '#F04545', ucType: 'uc', bmType: 'montante', bmPfx: 'MAC', bmIco: '⬆', emoji: '🔥', name: 'Agua caliente' },
  { id: 'san', lbl: 'RS', col: '#F5A623', ucType: 'ud', bmType: 'bajante', bmPfx: 'BAN', bmIco: '⬇', emoji: '🚽', name: 'Sanitaria' },
  { id: 'vent', lbl: 'REV', col: '#808080', ucType: null, bmType: 'bajante', bmPfx: 'BREV', bmIco: '⬇', emoji: '🌬', name: 'Ventilación' },
  { id: 'll', lbl: 'RALL', col: '#8B5CF6', ucType: 'ud', bmType: 'bajante', bmPfx: 'BALL', bmIco: '⬇', emoji: '🌧', name: 'Aguas lluvias' },
  { id: 'gas', lbl: 'RG', col: '#A855F7', ucType: null, bmType: 'montante', bmPfx: 'MG', bmIco: '⬆', emoji: '⛽', name: 'Gas' },
  { id: 'rci', lbl: 'RRCI', col: '#F87171', ucType: null, bmType: 'montante', bmPfx: 'MRCI', bmIco: '⬆', emoji: '🔴', name: 'Contra incendio' },
  { id: 'rec', lbl: 'RREC', col: '#22D3EE', ucType: null, bmType: 'montante', bmPfx: 'MREC', bmIco: '⬆', emoji: '🔄', name: 'Recirculación' },
  { id: 'bom', lbl: 'RBOM', col: '#8A9BB8', ucType: null, bmType: 'bajante', bmPfx: 'BOM', bmIco: '⬇', emoji: '⬆️', name: 'Bombeo' },
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

export interface LabelBoxCorners {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  corners: { x: number; y: number }[];
}

export interface CanvasBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function checkActiveNet(engine: IPlanoEngineCore, netId: string): boolean {
  const activeNets = engine.activeNetworks as Set<string> | undefined;
  return activeNets ? activeNets.has(netId) : true;
}

// Used ONLY for snapping the cursor while drawing (snapToExisting): ventilación is designed to
// land its risers exactly on a sanitaria point so the existing reventilado marker (renderVentCodos)
// lines up. It must NOT be used for any rigid "move together" / auto-connect mechanism — those
// stay strictly same-net so unrelated networks never get welded together just by proximity.
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
export function isArea(el: PlanoElement | null): el is PlanoArea {
  return el != null && '_polyBox' in el;
}

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
  aparatoInicio?: string;
  aparatoFin?: string;
  nSalidas?: number;
  _labelBox?: LabelBoxCorners;
  _net?: string;
  diamPulg?: number;
  bilateralCrossings?: number[][];
  accMed?: Record<string, string>;
}

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
  ucAcum: number;
  ucExtra: number;
  area_m2: number;
  desplazamientos: Record<string, { dx: number; dy: number; Ldesvio: null }>;
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
  ghostData?: Record<string, { dNominal?: string; direccion?: 'sube' | 'baja' | 'continua' | 'mantiene'; labelX?: number; labelY?: number }>;
  isFantasma?: boolean;
  diamPulg?: number;
  diametro?: string;
}

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

export interface PlanoDimension {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  L: number;
}

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

export interface PlanoLevel {
  label?: string;
  npt?: number;
  n?: string;
}

export interface PlanoNetCounts {
  ramal: number;
  tributario: number;
}

export type PlanoElement = PlanoRamal | PlanoBajante | PlanoArea | PlanoTextAnnotation | PlanoDimension;

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

export type MultiDragOrigData = Record<string, {
  type: 'ramal' | 'bajante' | 'text';
  origPts?: number[][];
  origLabelX?: number;
  origLabelY?: number;
  origLabelAngle?: number;
  origX?: number;
  origY?: number;
}>;

export interface IPlanoEngineCore {
  dims: PlanoDimension[];
  textAnnots: PlanoTextAnnotation[];
  areas: PlanoArea[];
  ramales: PlanoRamal[];
  bajantes: PlanoBajante[];
  activeRamal: PlanoActiveRamal | null;
  activeArea: PlanoActiveArea | null;
  selId: string | null;
  _isGhostSel: boolean;
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
  _dimStart: { x: number; y: number } | null;
  _netCounts: Record<string, PlanoNetCounts>;
  _ramalDefaults: PlanoRamalDefaults | null;
  _dirty: boolean;
  _onRequestTextCb: ((x: number, y: number, cb: (text: string) => void) => void) | null;
  _loadedPlanId: string | null;
  planId?: string;
  _onDirtyCb: (() => void) | null;
  _lastMouseCvs: { x: number; y: number };
  _snapToSegment(x: number, y: number, pts: number[][], threshold?: number): { x: number; y: number } | null;
  nptLevels: PlanoLevel[];
  ghostDrag: { id: string; startX: number; startY: number; baseDx: number; baseDy: number } | null;
  lblDrag: { id: string; offX: number; offY: number } | null;
  txtDrag: { id: string; startX: number; startY: number; origX: number; origY: number } | null;
  bajDrag: { id: string; offX: number; offY: number } | null;
  ptDrag: { id: string; ptIdx: number; slideConstraint?: { otherId: string; segmentIdx: number }; accMedSlide?: { ax: number; ay: number; bx: number; by: number } } | null;
  areaDrag: { id: string; startX: number; startY: number } | null;
  dimDrag: { id: string; startX: number; startY: number } | null;
  ramalDrag: { id: string; startX: number; startY: number; origPts: [number, number][]; origLabelX?: number; origLabelY?: number; connBaj?: { id: string; origX: number; origY: number; origLblX: number; origLblY: number; atIdx: number }[]; connRamales?: { id: string; origPts: [number, number][] }[] } | null;
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
  snapAngle(x0: number, y0: number, x1: number, y1: number): { x: number; y: number };
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
  selectAt(cx: number, cy: number): void;
  getSelected(): PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null;
  deleteSelected(ids?: string[]): void;
  setActiveNet(id: string): void;
  triggerAlert(title: string, msg: string): void;
  triggerAccesorioModal(data: { ramalId: string; angleDeg: number; junctionIndex: number; net: string; isTee?: boolean }): void;
}
