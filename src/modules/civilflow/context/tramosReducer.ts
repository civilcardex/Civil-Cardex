export interface Tramo {
  id: string;
  _key?: string;
  tipo?: string;
  planId?: string;
  piso: number;
  pisoDesde?: number;
  pisoHasta?: number;
  esBajante?: boolean;
  desde?: string;
  hasta?: string;
  descripcion?: string;
  diamDisPulg?: number;
  diametroOriginal?: string;
  nSalidas?: number;
  nmaning?: number;
  sPercent?: number;
  qLps?: number;
  recibeDe?: string[];
  recibeDeIds?: string[];
  descargaEnId?: string | null;
  fixtures: Record<string, number>;
  accesorios?: Record<string, number>;
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
  net?: string;
  _net?: string;
  ventRamalKey?: string;
  caudal?: number;
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

export function idMatch(t: Tramo, id: string): boolean {
  if (t._key) return t._key === id;
  return t.id === id;
}

export type TramosAction =
  | { type: 'SET_TRAMOS'; net: string; payload: Tramo[] }
  | { type: 'DEL_TRAMO'; net: string; id: string }
  | { type: 'UPD_TRAMO'; net: string; id: string; field: string; val: string | number | boolean }
  | { type: 'UPD_TRAMO_ACC'; net: string; id: string; accId: string; val: number };

export function tramosReducer(state: TramosState, action: TramosAction): TramosState {
  switch (action.type) {
    case 'SET_TRAMOS': {
      const key = netKey[action.net];
      return { ...state, [key]: action.payload };
    }
    case 'DEL_TRAMO': {
      const key = netKey[action.net];
      return { ...state, [key]: state[key].filter(t => !idMatch(t, action.id)) };
    }
    case 'UPD_TRAMO': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map(t =>
          idMatch(t, action.id) ? { ...t, [action.field]: action.val } : t
        ),
      };
    }
    case 'UPD_TRAMO_ACC': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map(t =>
          idMatch(t, action.id) ? { ...t, accesorios: { ...t.accesorios, [action.accId]: action.val } } : t
        ),
      };
    }
    default:
      return state;
  }
}
