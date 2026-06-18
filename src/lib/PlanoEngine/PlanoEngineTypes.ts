import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
  PlanoLevel,
  PlanoNetCounts,
  PlanoActiveRamal,
  PlanoActiveArea,
  PlanoRamalDefaults,
} from './PlanoState';

export interface IPlanoEngineCore {
  dims: PlanoDimension[];
  textAnnots: PlanoTextAnnotation[];
  areas: PlanoArea[];
  ramales: PlanoRamal[];
  bajantes: PlanoBajante[];
  activeRamal: PlanoActiveRamal | null;
  activeArea: PlanoActiveArea | null;
  selId: string | null;
  _hiddenNets: Set<string>;
  _lockedNets: Set<string>;
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
  canv: HTMLCanvasElement;
  padreTributario: string | null;
  nivelActual: PlanoLevel | null;
  _dimStart: { x: number; y: number } | null;
  _netCounts: Record<string, PlanoNetCounts>;
  _ramalDefaults: PlanoRamalDefaults | null;
  _dirty: boolean;
  _onRequestTextCb: ((x: number, y: number, cb: (text: string) => void) => void) | null;
  nptLevels: PlanoLevel[];
  ghostDrag: { id: string; startX: number; startY: number; baseDx: number; baseDy: number } | null;
  lblDrag: { id: string; offX: number; offY: number } | null;
  txtDrag: { id: string; startX: number; startY: number; origX: number; origY: number } | null;
  bajDrag: { id: string; offX: number; offY: number } | null;
  ptDrag: { id: string; ptIdx: number } | null;
  areaDrag: { id: string; startX: number; startY: number } | null;
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
  snapAngle(x0: number, y0: number, x1: number, y1: number): { x: number; y: number };
  snapToExisting(x: number, y: number): { x: number; y: number } | null;
  snapPreviewToPadre(x: number, y: number): { x: number; y: number } | null;
  getBajantesFantasma(): PlanoBajante[];
  render(): void;
  _emitSelect(el: unknown): void;
  _emitStatus(msg: string): void;
  _markDirty(): void;
  _statusMsg(): string;
  _renumberRamales(netId: string): void;
  _renumberBajantes(netId: string): void;
  _renumberMontantes(): void;
  _renumberAreas(): void;
  selectAt(cx: number, cy: number): void;
  getSelected(): PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null;
  deleteSelected(): void;
}
