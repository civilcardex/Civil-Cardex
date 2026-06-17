export interface Tramo {
  id: string;
  _key?: string;
  piso: number;
  pisoDesde?: number;
  pisoHasta?: number;
  esBajante?: boolean;
  desde?: string;
  hasta?: string;
  descripcion?: string;
  diamDisPulg?: number;
  nSalidas?: number;
  nmaning?: number;
  sPercent?: number;
  qLps?: number;
  recibeDe?: string[];
  recibeDeIds?: string[];
  fixtures: Record<string, number>;
  accesorios?: Record<string, any>;
  ini?: { x: number; y: number } | null;
  fin?: { x: number; y: number } | null;
  totalL?: number;
  Lh?: number;
  Lv?: number;
  deltaZ?: number;
  material?: string;
  bajR?: number;
  bajLong?: number;
  bajFDarcy?: number;
  bajDprop?: number;
  ventDprop?: number;
  area_m2?: number;
  pisoBase?: number;
  pisoCima?: number;
  code?: string;
  label?: string;
  dInt?: number;
  diametro_interno?: number;
}

export type TramosState = {
  tramosSan: Tramo[];
  tramosAf: Tramo[];
  tramosAc: Tramo[];
  tramosLl: Tramo[];
};

const netKey: Record<string, keyof TramosState> = {
  san: 'tramosSan', af: 'tramosAf', ac: 'tramosAc', ll: 'tramosLl',
};

function idMatch(t: Tramo, net: string, id: string): boolean {
  return net === 'll' ? t._key === id : t.id === id;
}

type TramosAction =
  | { type: 'SET_TRAMOS'; net: string; payload: Tramo[] }
  | { type: 'ADD_SAN'; newId: string }
  | { type: 'ADD_LL'; newKey: string }
  | { type: 'DEL_TRAMO'; net: string; id: string }
  | { type: 'UPD_TRAMO'; net: string; id: string; field: string; val: any }
  | { type: 'UPD_TRAMO_FIX'; net: string; id: string; fix: string; val: any }
  | { type: 'UPD_TRAMO_ACC'; net: string; id: string; accId: string; val: any };

export function tramosReducer(state: TramosState, action: TramosAction): TramosState {
  switch (action.type) {
    case 'SET_TRAMOS': {
      const key = netKey[action.net];
      return { ...state, [key]: action.payload };
    }
    case 'ADD_SAN':
      return {
        ...state,
        tramosSan: [...state.tramosSan, {
          id: action.newId, piso: 1, pisoDesde: 1, pisoHasta: 1, fixtures: {}, recibeDe: [],
          esBajante: false, descripcion: '', diamDisPulg: 0, nSalidas: 0, nmaning: 0,
          sPercent: 0, bajR: (7 / 24), bajLong: 3, bajFDarcy: 0.025, bajDprop: 0, ventDprop: 0,
        }],
      };
    case 'ADD_LL':
      return {
        ...state,
        tramosLl: [...state.tramosLl, {
          _key: action.newKey, id: '', piso: 0, esBajante: false, desde: '', hasta: '',
          descripcion: '', diamDisPulg: 0, nSalidas: 0, nmaning: 0, sPercent: 0, fixtures: {},
        }],
      };
    case 'DEL_TRAMO': {
      const key = netKey[action.net];
      return { ...state, [key]: state[key].filter(t => !idMatch(t, action.net, action.id)) };
    }
    case 'UPD_TRAMO': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map(t =>
          idMatch(t, action.net, action.id) ? { ...t, [action.field]: action.val } : t
        ),
      };
    }
    case 'UPD_TRAMO_FIX': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map(t =>
          idMatch(t, action.net, action.id) ? { ...t, fixtures: { ...t.fixtures, [action.fix]: action.val } } : t
        ),
      };
    }
    case 'UPD_TRAMO_ACC': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map(t =>
          idMatch(t, action.net, action.id) ? { ...t, accesorios: { ...t.accesorios, [action.accId]: action.val } } : t
        ),
      };
    }
    default:
      return state;
  }
}
