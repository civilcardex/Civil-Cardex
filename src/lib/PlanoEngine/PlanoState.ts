export const NETS = [
  { id: 'af', lbl: 'RAF', col: '#4D8FF7', ucType: 'uc', bmType: 'montante', bmPfx: 'MAF', bmIco: '⬆', emoji: '💧', name: 'Agua fría' },
  { id: 'ac', lbl: 'RAC', col: '#F04545', ucType: 'uc', bmType: 'montante', bmPfx: 'MAC', bmIco: '⬆', emoji: '🔥', name: 'Agua caliente' },
  { id: 'san', lbl: 'RS', col: '#F5A623', ucType: 'ud', bmType: 'bajante', bmPfx: 'BAN', bmIco: '⬇', emoji: '💩', name: 'Sanitaria' },
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
  _labelBox?: LabelBoxCorners;
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
  totalL?: number;
  pendiente?: number;
  piso?: string;
  _circ?: { x: number; y: number; r: number };
  _ghost?: { x: number; y: number; r: number };
  _labelBox?: LabelBoxCorners;
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
