/** Un tramo (pedazo de tubería) de una red tal como lo muestran las tablas: extremos (desde/hasta), diámetro, aparatos que sirve y resultados del cálculo. Ej: un ramal con qLps (Q (Caudal) en litros por segundo) y velCumple tras el diseño. */
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
  v_real?: number;
  yD?: number;
  qQ0?: number;
  velCumple?: boolean;
  presionOk?: boolean;
  pFin?: number;
  recibeDe?: string[];
  recibeDeIds?: string[];
  descargaEnId?: string | null;
  fixtures: Record<string, number>;
  /** Copia para MOSTRAR en montantes (la columna que sube y baja por el edificio): sus
   *  aparatos + los de los ramales que le llegan. La suma oficial (Σ) usa `fixtures`. */
  fixturesAgg?: Record<string, number>;
  accesorios?: Record<string, number>;
  ini?: string | { x: number; y: number } | null;
  fin?: string | { x: number; y: number } | null;
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
  ventRamalKey?: string | null;
  ventRamalDiamPulg?: number;
  caudal?: number;
  diametro?: string;
  diamPulg?: number;
  accesorioInicio?: string;
  accesorioFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
  padre?: string | null;
  padreTributarioLabel?: string | null;
  calCapacidad?: string;
  _nivelLabel?: string;
  _aparatosKey?: string;
}

/** Los 4 juegos de tramos de la sesión, uno por red: san (Sanitaria), af (Agua Fría), ac (Agua Caliente) y ll (Lluvias). */
export type TramosState = {
  tramosSan: Tramo[];
  tramosAf: Tramo[];
  tramosAc: Tramo[];
  tramosLl: Tramo[];
};

const netKey: Record<string, keyof TramosState> = {
  san: 'tramosSan',
  af: 'tramosAf',
  ac: 'tramosAc',
  ll: 'tramosLl',
};

function idMatch(t: Tramo, id: string): boolean {
  if (t._key) return t._key === id;
  return t.id === id;
}

/** Acciones que editan los tramos: reemplazar la lista de una red (SET_TRAMOS), borrar uno (DEL_TRAMO), cambiarle un campo (UPD_TRAMO, ej. field 'diametro') o sumarle un accesorio (UPD_TRAMO_ACC). */
export type TramosAction =
  | { type: 'SET_TRAMOS'; net: string; payload: Tramo[] }
  | { type: 'DEL_TRAMO'; net: string; id: string }
  | { type: 'UPD_TRAMO'; net: string; id: string; field: string; val: string | number | boolean }
  | { type: 'UPD_TRAMO_ACC'; net: string; id: string; accId: string; val: number };

/** Aplica una acción devolviendo un estado NUEVO sin mutar el anterior (como exige React). Ej: UPD_TRAMO con field 'diametro' y val '4"' cambia solo ese tramo, en la red que dice la acción. */
export function tramosReducer(state: TramosState, action: TramosAction): TramosState {
  switch (action.type) {
    case 'SET_TRAMOS': {
      const key = netKey[action.net];
      return { ...state, [key]: action.payload };
    }
    case 'DEL_TRAMO': {
      const key = netKey[action.net];
      return { ...state, [key]: state[key].filter((t) => !idMatch(t, action.id)) };
    }
    case 'UPD_TRAMO': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map((t) =>
          idMatch(t, action.id) ? { ...t, [action.field]: action.val } : t,
        ),
      };
    }
    case 'UPD_TRAMO_ACC': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map((t) =>
          idMatch(t, action.id)
            ? { ...t, accesorios: { ...t.accesorios, [action.accId]: action.val } }
            : t,
        ),
      };
    }
    default:
      return state;
  }
}
