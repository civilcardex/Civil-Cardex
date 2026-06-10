export type TramosState = {
  tramosSan: any[];
  tramosAf: any[];
  tramosAc: any[];
  tramosLl: any[];
};

type TramosAction =
  | { type: 'SET_SAN'; payload: any[] }
  | { type: 'SET_AF'; payload: any[] }
  | { type: 'SET_AC'; payload: any[] }
  | { type: 'SET_LL'; payload: any[] }
  | { type: 'ADD_SAN'; newId: string }
  | { type: 'ADD_LL'; newKey: string }
  | { type: 'DEL_SAN'; id: string }
  | { type: 'DEL_AF'; id: string }
  | { type: 'DEL_AC'; id: string }
  | { type: 'DEL_LL'; key: string }
  | { type: 'UPD_SAN'; id: string; field: string; val: any }
  | { type: 'UPD_AF'; id: string; field: string; val: any }
  | { type: 'UPD_AC'; id: string; field: string; val: any }
  | { type: 'UPD_LL'; key: string; field: string; val: any }
  | { type: 'UPD_SAN_FIX'; id: string; fix: string; val: any }
  | { type: 'UPD_AF_FIX'; id: string; fix: string; val: any }
  | { type: 'UPD_AC_FIX'; id: string; fix: string; val: any }
  | { type: 'UPD_AF_ACC'; id: string; accId: string; val: any }
  | { type: 'UPD_AC_ACC'; id: string; accId: string; val: any };

export function tramosReducer(state: TramosState, action: TramosAction): TramosState {
  switch (action.type) {
    case 'SET_SAN':
      return { ...state, tramosSan: action.payload };
    case 'SET_AF':
      return { ...state, tramosAf: action.payload };
    case 'SET_AC':
      return { ...state, tramosAc: action.payload };
    case 'SET_LL':
      return { ...state, tramosLl: action.payload };
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
          descripcion: '', diamDisPulg: 0, nSalidas: 0, nmaning: 0, sPercent: 0,
        }],
      };
    case 'DEL_SAN':
      return { ...state, tramosSan: state.tramosSan.filter(t => t.id !== action.id) };
    case 'DEL_AF':
      return { ...state, tramosAf: state.tramosAf.filter(t => t.id !== action.id) };
    case 'DEL_AC':
      return { ...state, tramosAc: state.tramosAc.filter(t => t.id !== action.id) };
    case 'DEL_LL':
      return { ...state, tramosLl: state.tramosLl.filter(t => t._key !== action.key) };
    case 'UPD_SAN':
      return {
        ...state,
        tramosSan: state.tramosSan.map(t => t.id === action.id ? { ...t, [action.field]: action.val } : t),
      };
    case 'UPD_AF':
      return {
        ...state,
        tramosAf: state.tramosAf.map(t => t.id === action.id ? { ...t, [action.field]: action.val } : t),
      };
    case 'UPD_AC':
      return {
        ...state,
        tramosAc: state.tramosAc.map(t => t.id === action.id ? { ...t, [action.field]: action.val } : t),
      };
    case 'UPD_LL':
      return {
        ...state,
        tramosLl: state.tramosLl.map(t => t._key === action.key ? { ...t, [action.field]: action.val } : t),
      };
    case 'UPD_SAN_FIX':
      return {
        ...state,
        tramosSan: state.tramosSan.map(t =>
          t.id === action.id ? { ...t, fixtures: { ...t.fixtures, [action.fix]: action.val } } : t
        ),
      };
    case 'UPD_AF_FIX':
      return {
        ...state,
        tramosAf: state.tramosAf.map(t =>
          t.id === action.id ? { ...t, fixtures: { ...t.fixtures, [action.fix]: action.val } } : t
        ),
      };
    case 'UPD_AC_FIX':
      return {
        ...state,
        tramosAc: state.tramosAc.map(t =>
          t.id === action.id ? { ...t, fixtures: { ...t.fixtures, [action.fix]: action.val } } : t
        ),
      };
    case 'UPD_AF_ACC':
      return {
        ...state,
        tramosAf: state.tramosAf.map(t =>
          t.id === action.id ? { ...t, accesorios: { ...t.accesorios, [action.accId]: action.val } } : t
        ),
      };
    case 'UPD_AC_ACC':
      return {
        ...state,
        tramosAc: state.tramosAc.map(t =>
          t.id === action.id ? { ...t, accesorios: { ...t.accesorios, [action.accId]: action.val } } : t
        ),
      };
    default:
      return state;
  }
}
