import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { devError } from '../../utils/devError';
import { calcAPU, calcCargos, esHoraPais, sumFactorPrestacional } from './calc';
import { civilManagerLoad, civilManagerSave, defaultState } from './storage';
import type { ApuCalculado, CargoCalculado, CivilManagerState } from './types';

type Action = { type: 'LOAD'; state: CivilManagerState } | { type: 'PATCH'; patch: Partial<CivilManagerState> };

function reducer(state: CivilManagerState, action: Action): CivilManagerState {
  switch (action.type) {
    case 'LOAD':
      return action.state;
    case 'PATCH':
      return { ...state, ...action.patch };
    default:
      return state;
  }
}

interface CivilManagerContextValue {
  state: CivilManagerState;
  patch: (patch: Partial<CivilManagerState>) => void;
  loaded: boolean;
  cargosCalc: CargoCalculado[];
  factorPrest: number;
  esHora: boolean;
  apusBasicoCalc: ApuCalculado[];
  apusCalc: ApuCalculado[];
  apuCalcMap: Map<string, ApuCalculado>;
}

const CivilManagerContext = createContext<CivilManagerContextValue | null>(null);

export function CivilManagerProvider({ children }: { children?: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, defaultState);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const hadDataRef = useRef(false);

  useEffect(() => {
    civilManagerLoad()
      .then(loadedState => {
        if (loadedState) {
          const hasAny = loadedState.apus.length || loadedState.equipos.length || loadedState.insumos.length || loadedState.cuadrillas.length;
          if (hasAny) hadDataRef.current = true;
          dispatch({ type: 'LOAD', state: loadedState });
        }
      })
      .catch(e => devError('CivilManagerContext load:', e))
      .finally(() => {
        loadedRef.current = true;
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      const nowEmpty = !state.apus.length && !state.equipos.length && !state.insumos.length && !state.cuadrillas.length;
      if (nowEmpty && hadDataRef.current) {
        devError('CivilManagerContext: guardado de estado vacío bloqueado (safeguard)');
        return;
      }
      civilManagerSave(state).catch(e => devError('CivilManagerContext save:', e));
    }, 300);
    return () => clearTimeout(t);
  }, [state]);

  const patch = (p: Partial<CivilManagerState>) => dispatch({ type: 'PATCH', patch: p });

  const factorPrest = useMemo(() => sumFactorPrestacional(state.factoresPrestaciones), [state.factoresPrestaciones]);
  const esHora = useMemo(() => esHoraPais(state.config.pais, state.config_listas.perfiles_pais), [state.config.pais, state.config_listas.perfiles_pais]);
  const cargosCalc = useMemo(
    () => calcCargos(state.cargos, state.config, factorPrest, state.config_listas.perfiles_pais),
    [state.cargos, state.config, factorPrest, state.config_listas.perfiles_pais]
  );

  const apusBasicoCalc = useMemo(() => {
    const basicos = state.apus.filter(a => a.es_basico);
    const usarFP = state.config.usar_fp_en_apu;
    return basicos.map(a => calcAPU(a, cargosCalc, state.equipos, state.insumos, null, state.config.herr_pct, factorPrest, usarFP, esHora));
  }, [state.apus, state.equipos, state.insumos, cargosCalc, state.config.herr_pct, state.config.usar_fp_en_apu, factorPrest, esHora]);

  const apusCalc = useMemo(() => {
    const usarFP = state.config.usar_fp_en_apu;
    return state.apus.map(a => calcAPU(a, cargosCalc, state.equipos, state.insumos, apusBasicoCalc, state.config.herr_pct, factorPrest, usarFP, esHora));
  }, [state.apus, state.equipos, state.insumos, cargosCalc, apusBasicoCalc, state.config.herr_pct, state.config.usar_fp_en_apu, factorPrest, esHora]);

  const apuCalcMap = useMemo(() => new Map(apusCalc.map(a => [a.id, a])), [apusCalc]);

  const value = useMemo<CivilManagerContextValue>(
    () => ({ state, patch, loaded, cargosCalc, factorPrest, esHora, apusBasicoCalc, apusCalc, apuCalcMap }),
    [state, loaded, cargosCalc, factorPrest, esHora, apusBasicoCalc, apusCalc, apuCalcMap]
  );

  return <CivilManagerContext.Provider value={value}>{children}</CivilManagerContext.Provider>;
}

export function useCivilManager(): CivilManagerContextValue {
  const ctx = useContext(CivilManagerContext);
  if (!ctx) throw new Error('useCivilManager must be used within CivilManagerProvider');
  return ctx;
}
