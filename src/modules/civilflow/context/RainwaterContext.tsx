import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { usePlans } from './PlansContext.tsx';
import { pisoCortoLoose } from '../constants/helpers.ts';
import { ACTIVE_NETS_KEY } from '../constants/storage-keys.ts';
import { loadFromStorage, getActiveProyectoId } from '../services/storageService.ts';
import { devError } from '../../../utils/devError.ts';
import { asociarCanalesPorOBB, derivarCanalesLlAuto } from './rainwaterDerived.ts';
import type { BajanteLL, CanalLL, RainwaterContextValue } from './rainwaterTypes.ts';
import {
  leerEspejo,
  guardarEspejo,
  unirOverrides,
  claveBajante,
  claveCanal,
  baseDeChip,
  agregarTumba,
  quitarTumba,
} from '../utils/rainwaterOverrideStore.ts';
import { loadRainwaterOverrides, saveRainwaterOverrides } from './rainwaterOverridesService.ts';
import { sectorDe } from '../utils/formatUtils.ts';
import { EV_SAN_SYNC, EV_HIDRO_SYNC, EV_STORAGE } from '../utils/fixtureEvents.ts';

/**
 * Contexto del cálculo pluvial (ll = Lluvias): bajantes de cubierta (BLL) y canales (CLL)
 * que se auto-pueblan del dibujo (áreas, materiales, intensidad) y guardan las ediciones
 * manuales del usuario (areaOtras) en BD. Ej: dibujas un canal sobre el plano, la tabla
 * "Canales" aparece con su sector y su área, y tu edición de áreaOtras sobrevive al reload.
 */

export type { BajanteLL, CanalLL, RainwaterContextValue } from './rainwaterTypes.ts';

/** Contexto exportado para poder leerlo sin proveedor y sin romper (ej: el visor usa useCaudalLl). */
export const RainwaterContext = createContext<RainwaterContextValue | null>(null);

/** Provee el cálculo pluvial (ll (Lluvias)): bajantes + canales; se auto-puebla del dibujo. */
export function RainwaterProvider({ children }: { children?: ReactNode }) {
  const { plans } = usePlans();

  const [bajantesLl, setBajantesLl] = useState<BajanteLL[]>(() => leerEspejo()?.bajantes ?? []);

  const [canalesLl, setCanalesLl] = useState<CanalLL[]>(() => leerEspejo()?.canales ?? []);

  // Tumbas contra resurrección: claves borradas que la unión con BD no revive.
  const [tumbas, setTumbas] = useState<string[]>(() => leerEspejo()?.tumbas ?? []);
  const tumbasRef = useRef<string[]>(tumbas);
  useEffect(() => {
    tumbasRef.current = tumbas;
  }, [tumbas]);

  // Ref fresca para del/upd (leen la fila sin capturar state en el closure).
  const filasRef = useRef({ bajantesLl, canalesLl });
  useEffect(() => {
    filasRef.current = { bajantesLl, canalesLl };
  }, [bajantesLl, canalesLl]);

  // Espejo local sincrónico en cada cambio: el roundtrip por BD (debounce + race al
  // navegar) perdía ediciones del visor antes de que las tablas las leyeran.
  useEffect(() => {
    const pid = getActiveProyectoId();
    if (!pid) return;
    guardarEspejo(pid, bajantesLl, canalesLl, tumbas);
  }, [bajantesLl, canalesLl, tumbas]);

  // Persistencia de overrides manuales (gap 5): se restauran desde la BD al montar y se
  // sincronizan debounced (600 ms). Lo autocalculado sigue derivándose del dibujo; estas
  // tablas solo guardan lo que el usuario editó a mano.
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadRainwaterOverrides(proyectoId)
      .then((overrides) => {
        if (cancelled) return;
        // Unión (local manda): una carga de BD anterior al último flush no pisa ediciones
        // recién hechas en otra instancia del provider (visor→tablas).
        setBajantesLl((prev) =>
          unirOverrides(prev, claveBajante, overrides.bajantes, tumbasRef.current),
        );
        setCanalesLl((prev) =>
          unirOverrides(prev, claveCanal, overrides.canales, tumbasRef.current),
        );
      })
      .catch((e) => devError('RainwaterContext load overrides:', e));
    return () => {
      cancelled = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, []);

  // Snapshot fresco + bandera para el flush de desmonte (los closures nacen viejos).
  const pendientesRef = useRef({ bajantesLl, canalesLl });
  const sucioRef = useRef(false);
  useEffect(() => {
    pendientesRef.current = { bajantesLl, canalesLl };
  }, [bajantesLl, canalesLl]);
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    sucioRef.current = true;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      sucioRef.current = false;
      void saveRainwaterOverrides(proyectoId, bajantesLl, canalesLl).catch((e) =>
        devError('RainwaterContext save overrides:', e),
      );
    }, 600);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [bajantesLl, canalesLl]);
  // Flush SOLO al desmontar (cambio visor→tablas): antes el timer se cancelaba y la edición
  // del dibujo nunca llegaba a BD — la tabla (provider nuevo, lee BD) no la mostraba.
  // Efecto con [] para no disparar en cada edición (mataría el debounce).

  useEffect(
    () => () => {
      if (!sucioRef.current) return;
      sucioRef.current = false;
      const proyectoId = getActiveProyectoId();
      if (!proyectoId) return;
      const p = pendientesRef.current;
      void saveRainwaterOverrides(proyectoId, p.bajantesLl, p.canalesLl).catch((e) =>
        devError('RainwaterContext flush overrides:', e),
      );
    },
    [],
  );

  const [conRecolectora, setConRecolectora] = useState<boolean>(() => {
    try {
      const saved = loadFromStorage<string[]>(ACTIVE_NETS_KEY, [] as unknown as string[]);
      if (saved && Array.isArray(saved)) return saved.includes('recolectora');
    } catch {
      /* ignorar */
    }
    return false;
  });
  useEffect(() => {
    const handler = (e: Event) => {
      const nets = (e as CustomEvent).detail;
      if (Array.isArray(nets)) setConRecolectora(nets.includes('recolectora'));
    };
    window.addEventListener('civilflow_nets_changed', handler);
    return () => window.removeEventListener('civilflow_nets_changed', handler);
  }, []);

  // Refresco reactivo de lo derivado del dibujo (ítem 7 usuario): el memo de abajo lee
  // storage crudo — sin tick, editar base/pendiente en el visor (menú/panel) no se reflejaba
  // en la tabla hasta remontar. Mismo trío de eventos que BombaARDesign/FixturesPanel.
  const [trazosTick, setTrazosTick] = useState(0);
  useEffect(() => {
    const bump = () => setTrazosTick((n) => n + 1);
    window.addEventListener(EV_STORAGE, bump);
    window.addEventListener(EV_SAN_SYNC, bump as EventListener);
    window.addEventListener(EV_HIDRO_SYNC, bump as EventListener);
    return () => {
      window.removeEventListener(EV_STORAGE, bump);
      window.removeEventListener(EV_SAN_SYNC, bump as EventListener);
      window.removeEventListener(EV_HIDRO_SYNC, bump as EventListener);
    };
  }, []);
  // Remap de sectores cuando el motor renumera canales (borrar uno cierra huecos CNL):
  // las filas manuales se clavean por sector = code — sin esto quedaban huérfanas y el
  // canal renombrado nacía sin material/áreas.
  useEffect(() => {
    const onRenum = (e: Event): void => {
      const idMap = (e as CustomEvent<{ idMap?: Record<string, string> }>).detail?.idMap;
      if (!idMap) return;
      setCanalesLl((prev) =>
        prev.map((c) => (idMap[c.sector] ? { ...c, sector: idMap[c.sector] } : c)),
      );
    };
    window.addEventListener('civilflow_canales_renumerados', onRenum);
    return () => window.removeEventListener('civilflow_canales_renumerados', onRenum);
  }, []);

  const addCanalLL = () =>
    setCanalesLl((p) => [
      ...p,
      {
        // ponytail: sin colisión tras deletes (antes length+1 re-usaba ids)
        id: `CLL-${Date.now().toString(36)}`,
        sector: '',
        areaParcial: 0,
        areaOtras: 0,
        areaAcumulada: 0,
        intensidad: 0,
        coeficienteC: 0,
        manning: 0,
        pendiente: 0,
        b: 0,
        h: 0,
      },
    ]);
  const delCanalLL = (id: string) => {
    const row = filasRef.current.canalesLl.find((t) => t.id === id);
    setTumbas((prev) => agregarTumba(prev, row ? claveCanal(row) : id));
    setCanalesLl((p) => p.filter((t) => t.id !== id));
  };
  const updCanalLL = (id: string, field: string, val: string | number) => {
    const row = filasRef.current.canalesLl.find((t) => t.id === id);
    setTumbas((prev) => {
      let n = quitarTumba(prev, id);
      if (row) n = quitarTumba(n, claveCanal(row));
      if (field === 'sector' && typeof val === 'string' && val) n = quitarTumba(n, val);
      return n;
    });
    setCanalesLl((p) => p.map((t) => (t.id === id ? { ...t, [field]: val } : t)));
  };
  /** Crea o edita la edición manual de un SECTOR (pedido del cliente): las filas de canal
   *  dibujado no existen en la lista (se arman del dibujo al vuelo), así que editarles
   *  área o intensidad no hacía nada y nadie se enteraba. Acá se crea la fila mínima
   *  (sector + campo) — el merge de canalesLlAuto la toma y rellena el resto desde el glifo. */
  const updCanalSector = (sector: string, field: string, val: string | number) => {
    setTumbas((prev) => {
      let n = quitarTumba(prev, sector);
      if (field === 'sector' && typeof val === 'string' && val) n = quitarTumba(n, val);
      return n;
    });
    setCanalesLl((p) => {
      const i = p.findIndex((t) => (t.sector || t.id) === sector);
      if (i >= 0) {
        const cp = [...p];
        cp[i] = { ...cp[i], [field]: val };
        return cp;
      }
      return [
        ...p,
        {
          // ponytail: sin colisión tras deletes (antes length+1 re-usaba ids)
          id: `CLL-${Date.now().toString(36)}`,
          sector,
          areaParcial: 0,
          areaOtras: 0,
          areaAcumulada: 0,
          intensidad: 100,
          coeficienteC: 0,
          manning: 0.009,
          pendiente: 2,
          b: 0,
          h: 0,
          [field]: val,
        },
      ];
    });
  };

  // Asociaciones canal↔bajante, áreas por piso y glifos de canal dibujado: derivadas del
  // dibujo crudo en storage (cuerpo en rainwaterDerived.ts — los glifos de canal no pasan
  // por TramosContext/buildTramos.ts, así que se leen directo, igual que `areas`). El memo
  // conserva las mismas deps de antes: trazosTick no entra al cuerpo pero sí al recálculo,
  // sin él editar base/pendiente en el visor no se reflejaba en la tabla hasta remontar.
  const {
    areaAcumMap,
    drawnCanalGlyphs,
    canalAreaMap,
    canalBajantes,
    canalAlimIds,
    canalAlimInfo,
  } = useMemo(
    () => asociarCanalesPorOBB(plans),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans, trazosTick],
  );

  // Filas auto de canal: glifo dibujado + override manual + insumos de los bajantes
  // asociados (cuerpo en rainwaterDerived.ts; mismas deps de siempre).
  const canalesLlAuto = useMemo(
    () =>
      derivarCanalesLlAuto(
        drawnCanalGlyphs,
        canalesLl,
        bajantesLl,
        areaAcumMap,
        canalAreaMap,
        canalAlimInfo,
      ),
    [drawnCanalGlyphs, canalesLl, bajantesLl, areaAcumMap, canalAreaMap, canalAlimInfo],
  );

  const addBajanteLL = () =>
    setBajantesLl((p) => [
      ...p,
      {
        id: `BLL-${p.length + 1}`,
        bajante: '',
        areaParcial: 0,
        areaOtras: 0,
        areaAcumulada: 0,
        intensidad: 100,
        coeficienteC: 0,
        R: '',
        manning: 0,
        diamPropuesto: 0,
      },
    ]);
  const delBajanteLL = (id: string) => {
    const row = filasRef.current.bajantesLl.find(
      (t) => t.id === id || (t.bajante && t.bajante === id),
    );
    setTumbas((prev) => agregarTumba(prev, row ? claveBajante(row) : id));
    setBajantesLl((p) => p.filter((t) => t.id !== id));
  };
  const updBajanteLL = (id: string, field: string, val: string | number) => {
    const row = filasRef.current.bajantesLl.find(
      (t) => t.id === id || (t.bajante && t.bajante === id),
    );
    setTumbas((prev) => {
      let n = quitarTumba(prev, id);
      if (row) n = quitarTumba(n, claveBajante(row));
      if (field === 'bajante' && typeof val === 'string' && val) n = quitarTumba(n, val);
      return n;
    });
    return setBajantesLl((p) => {
      const exists = p.some((t) => t.id === id || (t.bajante && t.bajante === id));
      if (!exists && id) {
        return [
          ...p,
          {
            id: `BLL-${p.length + 1}`,
            bajante: id,
            areaParcial: 0,
            areaOtras: field === 'areaOtras' ? (val as number) : 0,
            areaAcumulada: 0,
            intensidad: field === 'intensidad' ? (val as number) : 100,
            coeficienteC: 0,
            materialCubierta: field === 'materialCubierta' ? (val as string) : '',
            R: field === 'R' ? (val as string) : '',
            manning: field === 'manning' ? (val as number) : 0,
            diamPropuesto: field === 'diamPropuesto' ? (val as number) : 0,
          },
        ];
      }
      return p.map((t) =>
        t.id === id || (t.bajante && t.bajante === id) ? { ...t, [field]: val } : t,
      );
    });
  };

  // Ref fresca para setMaterialCanal: es plain-const fuera del memo de value, así que sin
  // esto leería canalesLlAuto/canalBajantes del primer render (fan-out ciego = la regresión
  // "el material no se refleja": con asociados vacíos caía al override del canal y la fila,
  // que deriva de los bajantes, nunca cambiaba).
  const datosRef = useRef({ canalesLlAuto, canalBajantes });
  useEffect(() => {
    datosRef.current = { canalesLlAuto, canalBajantes };
  }, [canalesLlAuto, canalBajantes]);
  /** Cambio único de material de canal (tablas + panel + menú): si el canal tiene bajantes
   *  asociados, el material de cubierta se reparte a todos (la fila muestra el común y
   *  todos quedan iguales); si no, se guarda propio del canal. `ref` = drawId o id. */
  const setMaterialCanal = useCallback(
    (ref: string, field: 'materialCubierta' | 'materialCanal', mat: string): void => {
      const { canalesLlAuto, canalBajantes } = datosRef.current;
      const row = canalesLlAuto.find((c) => c.drawId === ref || c.id === ref);
      if (!row) return;
      if (field === 'materialCubierta' && row.drawId) {
        const asoc = canalBajantes[row.drawId] || [];
        if (asoc.length > 0) {
          for (const chip of asoc) updBajanteLL(baseDeChip(chip), 'materialCubierta', mat);
          return;
        }
      }
      if (row.fromCanal && row.sector) {
        updCanalSector(row.sector, field, mat);
        return;
      }
      updCanalLL(row.id, field, mat);
    },
    [],
  );

  const value = useMemo(
    () => ({
      bajantesLl,
      addBajanteLL,
      delBajanteLL,
      updBajanteLL,
      canalesLl: canalesLlAuto,
      addCanalLL,
      delCanalLL,
      updCanalLL,
      updCanalSector,
      setMaterialCanal,
      canalBajantes,
      canalAlimIds,
      conRecolectora,
      setConRecolectora,
    }),
    [bajantesLl, canalesLlAuto, canalBajantes, canalAlimIds, conRecolectora, setMaterialCanal],
  );

  return <RainwaterContext.Provider value={value}>{children}</RainwaterContext.Provider>;
}

/** Lee los datos de cálculo de agua pluvial (ll). Falla fuera del provider. */
export function useRainwater() {
  const ctx = useContext(RainwaterContext);
  if (!ctx) throw new Error('useRainwater must be used within RainwaterProvider');
  return ctx;
}

/** Desplegables de material de lluvias (ll) para el panel derecho y el menú contextual:
 *  misma fuente y mismo camino de escritura que las tablas Chequeo (lo que cambies aquí
 *  se ve allá y al revés). Funciona también sin proveedor: devuelve null y la UI oculta
 *  los desplegables en vez de romper. */
export function useMaterialesLl() {
  const ctx = useContext(RainwaterContext);
  return useMemo(() => {
    if (!ctx) return null;
    /** Chip "BALL1-P1" del bajante (etiqueta visible, como las tablas). */
    const chipDeBajante = (codeBase: string, nivel: unknown): string =>
      `${sectorDe(String(codeBase))}-${pisoCortoLoose(nivel)}`;
    /** Clave del override: CÓDIGO BASE sin piso — las tablas, el caudal y el canal leen
     *  por code/id base. Con fallback a huérfanas con sufijo (formato viejo del panel). */
    const claveDe = (chip: string): string => baseDeChip(chip);
    const huerfanaDe = (base: string): string | null => {
      const h = ctx.bajantesLl.find(
        (m) => m.bajante != null && m.bajante !== base && baseDeChip(m.bajante) === base,
      );
      return h ? h.id : null;
    };
    const materialDeBajante = (chip: string): string => {
      const base = claveDe(chip);
      const propia = ctx.bajantesLl.find(
        (m) => m.id === base || m.bajante === base,
      )?.materialCubierta;
      if (propia != null) return propia;
      const hId = huerfanaDe(base);
      if (hId) return ctx.bajantesLl.find((m) => m.id === hId)?.materialCubierta ?? '';
      return '';
    };
    const setMaterialBajante = (chip: string, mat: string): void => {
      const base = claveDe(chip);
      const huerfana = huerfanaDe(base);
      if (huerfana) ctx.delBajanteLL(huerfana);
      ctx.updBajanteLL(base, 'materialCubierta', mat);
    };
    const canalDe = (drawId: string): CanalLL | undefined =>
      ctx.canalesLl.find((c) => c.drawId === drawId);
    return {
      chipDeBajante,
      materialDeBajante,
      setMaterialBajante,
      canalDe,
      setMaterialCanal: ctx.setMaterialCanal,
    };
  }, [ctx]);
}
