import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { devError } from '../../utils/devError.ts';
import { emitErrorGuardado } from '../../utils/saveToCloud.ts';
import {
  calcAPU,
  calcCargos,
  configurarMoneda,
  esHoraPais,
  sumFactorPrestacional,
} from './calc.ts';
import {
  civilManagerLoad,
  civilManagerSave,
  defaultState,
  hayRespaldoAnterior,
  guardarCmSalida,
  saveCmDraft,
} from './storage.ts';
import { captureCmScope, type CmStorageScope } from './storage/session.ts';
import type { ApuCalculado, CargoCalculado, CivilManagerState } from './types.ts';

type Action =
  { type: 'LOAD'; state: CivilManagerState } | { type: 'PATCH'; patch: Partial<CivilManagerState> };

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
  loadError: string | null;
  /** Conflicto de versiones sin resolver (banner del shell). */
  /** Respaldo legado detectado (aviso one-shot, dismissable). */
  avisoLegado: boolean;
  descartarAvisoLegado: () => void;
  cargosCalc: CargoCalculado[];
  factorPrest: number;
  esHora: boolean;
  apusBasicoCalc: ApuCalculado[];
  apusCalc: ApuCalculado[];
  apuCalcMap: Map<string, ApuCalculado>;
}

const CivilManagerContext = createContext<CivilManagerContextValue | null>(null);

/**
 * Estado global del módulo CM (Civil Manager): carga de IDB/Supabase al montar, autoguardado
 * con debounce de 300 ms tras cada patch, y los cálculos derivados (cargos, FP (Factor
 * Prestacional), APU (Análisis de Precios Unitarios)) memoizados. Ej: editar un insumo
 * recalcula el costo_unitario de todos los APU que lo usan.
 */
export function CivilManagerProvider({ children }: { children?: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, defaultState);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Conflicto de versiones SIN resolver (H-02): el borrador local ganó al cargar y cada
   *  guardado vuelve a chocar. El banner del shell ofrece subir el borrador o usar la nube. */
  /** Respaldo legado detectado (H-08): aviso one-shot, sin migración automática. */
  const [avisoLegado, setAvisoLegado] = useState(false);
  const loadedRef = useRef(false);
  const scopeRef = useRef<CmStorageScope | null>(null);
  const hydratedState = useRef<CivilManagerState | null>(null);
  const hadDataRef = useRef(false);

  // Un solo símbolo de moneda para todo el módulo (fmtMoneda): se actualiza
  // al cargar y ante cualquier cambio de config.moneda.
  useEffect(() => {
    configurarMoneda(state.config.moneda);
  }, [state.config.moneda]);

  useEffect(() => {
    let cancelled = false;
    captureCmScope()
      .then(async (scope) => {
        if (!scope) throw new Error('Selecciona un proyecto desde tu perfil.');
        if (cancelled) return;
        const loadedState = await civilManagerLoad(scope);
        if (cancelled) return;
        scopeRef.current = scope;
        loadedRef.current = true;
        if (loadedState) {
          const hasAny =
            loadedState.apus.length ||
            loadedState.equipos.length ||
            loadedState.insumos.length ||
            loadedState.cuadrillas.length;
          if (hasAny) hadDataRef.current = true;
          hydratedState.current = loadedState;
          dispatch({ type: 'LOAD', state: loadedState });
        }
        const legado = await hayRespaldoAnterior();
        if (!cancelled) {
          setAvisoLegado(legado);
        }
      })
      .catch((e) => {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : 'No se pudo cargar el proyecto.');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Último estado visto (para el flush al salir): el ref se actualiza en el efecto de
   * guardado (fuera del render). */
  const ultimoEstado = useRef(state);

  /* FLUSH al salir (H-02): desmontar y pagehide comparten UNA escritura idempotente por
   * estado; el borrador solo se marca pendiente si quedan colecciones sin confirmar contra
   * la base. Si IndexedDB falla, se conserva la señal de error (no se afirma que quedó). */
  const flushHechoDe = useRef<CivilManagerState | null>(null);
  useEffect(() => {
    const flush = () => {
      const scope = scopeRef.current;
      const st = ultimoEstado.current;
      if (!scope || st === hydratedState.current || flushHechoDe.current === st) return;
      flushHechoDe.current = st;
      guardarCmSalida(scope, st).catch((e) => {
        devError('CivilManagerContext flush al salir:', e);
        emitErrorGuardado(
          'civilmanager',
          'No se pudo conservar el borrador local al salir: la última edición puede no quedar en este dispositivo.',
        );
      });
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  useEffect(() => {
    ultimoEstado.current = state;
    const scope = scopeRef.current;
    if (!loadedRef.current || !scope || state === hydratedState.current) return;
    // Borrador a IDB con debounce corto (H-11): escribir TODO el estado en cada tecla
    // clonaba el objeto completo por pulsación; el autosave a BD sigue a los 300 ms.
    const t = setTimeout(() => {
      void saveCmDraft(scope, state);
      const nowEmpty =
        !state.apus.length &&
        !state.equipos.length &&
        !state.insumos.length &&
        !state.cuadrillas.length;
      if (nowEmpty && hadDataRef.current) {
        // Safeguard de hidratación: el borrador local YA quedó escrito arriba (el usuario no
        // pierde nada), pero a la nube no se envía — aviso VISIBLE (auditoría 2026-11-27).
        devError('CivilManagerContext: guardado de estado vacío bloqueado (safeguard)');
        emitErrorGuardado(
          'civilmanager',
          'Estado vacío: no se envió a la nube. El borrador quedó en este dispositivo.',
        );
        return;
      }
      // El aviso global queda visible aunque se cierre esta sección mientras guarda.
      civilManagerSave(state, scope).catch((e) => {
        devError('CivilManagerContext save:', e);
        emitErrorGuardado('civilmanager', e instanceof Error ? e.message : String(e));
      });
    }, 300);
    return () => clearTimeout(t);
  }, [state]);

  /** Cierra el aviso del respaldo legado (el registro IDB NO se toca). */
  const descartarAvisoLegado = useCallback((): void => setAvisoLegado(false), []);

  const patch = (p: Partial<CivilManagerState>) => dispatch({ type: 'PATCH', patch: p });

  const factorPrest = useMemo(
    () => sumFactorPrestacional(state.factoresPrestaciones),
    [state.factoresPrestaciones],
  );
  const esHora = useMemo(
    () => esHoraPais(state.config.pais, state.config_listas.perfiles_pais),
    [state.config.pais, state.config_listas.perfiles_pais],
  );
  const cargosCalc = useMemo(
    () => calcCargos(state.cargos, state.config, factorPrest, state.config_listas.perfiles_pais),
    [state.cargos, state.config, factorPrest, state.config_listas.perfiles_pais],
  );

  const apusBasicoCalc = useMemo(() => {
    const basicos = state.apus.filter((a) => a.es_basico);
    const usarFP = state.config.usar_fp_en_apu;
    return basicos.map((a) =>
      calcAPU(
        a,
        cargosCalc,
        state.equipos,
        state.insumos,
        null,
        state.config.herr_pct,
        factorPrest,
        usarFP,
        esHora,
      ),
    );
  }, [
    state.apus,
    state.equipos,
    state.insumos,
    cargosCalc,
    state.config.herr_pct,
    state.config.usar_fp_en_apu,
    factorPrest,
    esHora,
  ]);

  const apusCalc = useMemo(() => {
    const usarFP = state.config.usar_fp_en_apu;
    return state.apus.map((a) =>
      calcAPU(
        a,
        cargosCalc,
        state.equipos,
        state.insumos,
        apusBasicoCalc,
        state.config.herr_pct,
        factorPrest,
        usarFP,
        esHora,
      ),
    );
  }, [
    state.apus,
    state.equipos,
    state.insumos,
    cargosCalc,
    apusBasicoCalc,
    state.config.herr_pct,
    state.config.usar_fp_en_apu,
    factorPrest,
    esHora,
  ]);

  const apuCalcMap = useMemo(() => new Map(apusCalc.map((a) => [a.id, a])), [apusCalc]);

  const value = useMemo<CivilManagerContextValue>(
    () => ({
      state,
      patch,
      loaded,
      loadError,
      avisoLegado,
      descartarAvisoLegado,
      cargosCalc,
      factorPrest,
      esHora,
      apusBasicoCalc,
      apusCalc,
      apuCalcMap,
    }),
    [
      state,
      loaded,
      loadError,
      avisoLegado,
      descartarAvisoLegado,
      cargosCalc,
      factorPrest,
      esHora,
      apusBasicoCalc,
      apusCalc,
      apuCalcMap,
    ],
  );

  return <CivilManagerContext.Provider value={value}>{children}</CivilManagerContext.Provider>;
}

/** Accede al estado y cálculos del módulo CM (ej: `patch({config: {...}})` para cambiar el salario base). Lanza error fuera del provider — el dato nunca llega undefined en silencio. */
export function useCivilManager(): CivilManagerContextValue {
  const ctx = useContext(CivilManagerContext);
  if (!ctx) throw new Error('useCivilManager must be used within CivilManagerProvider');
  return ctx;
}
