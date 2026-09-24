import {
  useState,
  useMemo,
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { usePlans } from './PlansContext';
import { cmToPlanePx } from '../lib/PlanoEngine/planoCoords';
import { TRAZOS_PREFIX, ACTIVE_NETS_KEY } from '../constants/storage-keys';
import { loadFromStorage, getActiveProyectoId } from '../services/storageService';
import {
  loadRainwaterOverrides,
  saveRainwaterOverrides,
} from '../services/rainwaterOverridesService';
import type { DrawingData, RawElement } from '../utils/drawingSync';

interface AreaRaw {
  areaM2?: number;
}
export interface BajanteLL {
  id: string;
  bajante: string;
  areaParcial: number;
  /** Área Otras (orig. usuario): editable desde la tabla, default 0. */
  areaOtras: number;
  /** Área TOTAL = areaParcial + areaOtras — alimenta el caudal real. */
  areaAcumulada: number;
  intensidad: number;
  coeficienteC: number;
  R: string;
  manning: number;
  diamPropuesto: number;
}
export interface CanalLL {
  id: string;
  sector: string;
  areaParcial: number;
  /** Área Otras (orig. usuario): editable desde la tabla, default 0. */
  areaOtras: number;
  /** Área TOTAL = areaParcial + areaOtras — alimenta el caudal real. */
  areaAcumulada: number;
  intensidad: number;
  coeficienteC: number;
  manning: number;
  pendiente: number;
  b: number;
  h: number;
  /** Largo horizontal del canal (cm), solo para glifos dibujados (fromCanal). */
  longitud?: number;
  /** plan.nivel del piso del canal — solo glifos dibujados (para la columna Nivel). */
  piso?: number;
  /** Es true cuando b/h provienen de un glifo de canal dibujado (tipo:'canal' en la red 'll') — en
   * ese caso la tabla debe mostrar esos dos campos como solo lectura, porque el dibujo es la
   * fuente de verdad de ambos (ver canalesLlAuto abajo). */
  fromCanal?: boolean;
}
interface RainwaterContextValue {
  bajantesLl: BajanteLL[];
  addBajanteLL: () => void;
  delBajanteLL: (id: string) => void;
  updBajanteLL: (id: string, field: string, val: string | number) => void;
  canalesLl: CanalLL[];
  addCanalLL: () => void;
  delCanalLL: (id: string) => void;
  updCanalLL: (id: string, field: string, val: string | number) => void;
  conRecolectora: boolean;
  setConRecolectora: (v: boolean) => void;
}

/** Exportado para lecturas null-safe (useContext directo) desde árboles sin provider —
 *  p. ej. useCaudalLl del visor, que debe funcionar también sin RainwaterProvider. */
export const RainwaterContext = createContext<RainwaterContextValue | null>(null);

/** Provee los cálculos de drenaje pluvial: bajantes LL, canales LL, toggle de recolectora. Se auto-puebla desde los datos del dibujo. */
export function RainwaterProvider({ children }: { children?: ReactNode }) {
  const { plans } = usePlans();

  const [bajantesLl, setBajantesLl] = useState<BajanteLL[]>([]);

  const [canalesLl, setCanalesLl] = useState<CanalLL[]>([]);

  // Persistencia de overrides manuales (gap 5): se restauran desde la BD al montar y se
  // sincronizan debounced (600 ms). Lo autocalculado sigue derivándose del dibujo; estas
  // tablas solo guardan lo que el usuario editó a mano.
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadRainwaterOverrides(proyectoId).then((overrides) => {
      if (cancelled) return;
      if (overrides.bajantes.length > 0) setBajantesLl(overrides.bajantes);
      if (overrides.canales.length > 0) setCanalesLl(overrides.canales);
    });
    return () => {
      cancelled = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveRainwaterOverrides(proyectoId, bajantesLl, canalesLl);
    }, 600);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [bajantesLl, canalesLl]);

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

  const addCanalLL = () =>
    setCanalesLl((p) => [
      ...p,
      {
        id: `CLL-${p.length + 1}`,
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
  const delCanalLL = (id: string) => setCanalesLl((p) => p.filter((t) => t.id !== id));
  const updCanalLL = (id: string, field: string, val: string | number) =>
    setCanalesLl((p) => p.map((t) => (t.id === id ? { ...t, [field]: val } : t)));

  // Auto-puebla las filas de canal desde los ramales 'll' dibujados (net==='ll', no bajante),
  // con el mismo patrón de búsqueda de área por piso que ChequeoBajantesLluvias, en lugar de
  // partir de ceros.
  // En la misma pasada también recolecta los glifos de canal dibujados (tipo:'canal', el
  // handleCanalDown de PlanoEngine) por piso, porque ambos necesitan la misma lectura cruda
  // de storage por plano — los glifos de canal no pasan por TramosContext/buildTramos.ts (esa
  // tubería solo modela ramales/bajantes con semántica sanitaria/bajante), así que se leen
  // directo aquí, igual que `areas` arriba.
  const { areaAcumMap, drawnCanalGlyphs, canalAreaMap } = useMemo(() => {
    const canalAreaMap: Record<string, number> = {};
    const map: Record<string, number> = {};
    const glyphs: (RawElement & { piso: string })[] = [];
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage<(DrawingData & { areas?: AreaRaw[] }) | string | null>(
        TRAZOS_PREFIX + plan.id,
        null,
      );
      if (!raw) continue;
      let data: DrawingData & { areas?: AreaRaw[] } = raw as DrawingData & { areas?: AreaRaw[] };
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          continue;
        }
      }
      const totalArea = (data.areas || []).reduce((s, a) => s + (a.areaM2 || 0), 0);
      map[String(plan.nivel)] = totalArea;
      for (const b of data.bajantes || []) {
        if (b.tipo === 'canal' && b.net === 'll') glyphs.push({ ...b, piso: String(plan.nivel) });
      }
      // Área de cada canal = Σ áreas de los bajantes que le descargan (orig. usuario): un
      // ramal ll cuyo ÚLTIMO punto cae en el rectángulo del canal trae el área de SU bajante
      // (el otro extremo a ≤2 px del glifo). Rect del canal desde (x,y) + longitud/base cm.
      const canales = (data.bajantes || []).filter(
        (b): b is RawElement & { base?: number; longitud?: number; x?: number; y?: number } =>
          b.tipo === 'canal' && b.net === 'll',
      );
      const bajLl = (data.bajantes || []).filter(
        (b): b is RawElement & { area_m2?: number; x?: number; y?: number } =>
          b.net === 'll' && b.tipo === 'bajante',
      );
      const pxPerCm = cmToPlanePx(Number(data.scaleM ?? 0.5), 1); // px de plano por cm — MISMA conversión que el engine (antes: invertida, rect 25-100x el canal)
      for (const c of canales) {
        if (c.x == null || c.y == null) continue;
        const cx = c.x;
        const cy = c.y;
        const w = (c.longitud ?? 0) * pxPerCm;
        const h = (c.base ?? 0) * pxPerCm;
        const pad = 4;
        const enRect = (pt: number[]): boolean =>
          pt[0] >= cx - pad && pt[0] <= cx + w + pad && pt[1] >= cy - pad && pt[1] <= cy + h + pad;
        // SET de bajantes alimentadores (un bajante con VARIOS ramales al canal cuenta UNA vez).
        const alimentadores = new Set<string>();
        for (const r of data.ramales || []) {
          if (r.net !== 'll' || !r.pts || r.pts.length < 2) continue;
          // Cualquier DIRECCIÓN: un extremo dentro del canal y el OTRO sobre el glifo del
          // bajante (el ramal puede salir del canal o llegar a él — esCanalId marca salida).
          const pS = r.pts[0];
          const pE = r.pts[r.pts.length - 1];
          const pBaj = enRect(pS) ? pE : enRect(pE) ? pS : null;
          if (!pBaj) continue;
          for (const b of bajLl) {
            if (b.x == null || b.y == null) continue;
            if (Math.hypot(pBaj[0] - b.x, pBaj[1] - b.y) < 2) {
              alimentadores.add(String(b.id));
              break;
            }
          }
        }
        // Bajante dibujado directamente sobre el canal (sin ramal): también alimentador.
        for (const b of bajLl) {
          if (b.x == null || b.y == null) continue;
          if (enRect([b.x, b.y])) alimentadores.add(String(b.id));
        }
        // Área = Σ una sola vez por bajante alimentador.
        let area = 0;
        for (const idB of alimentadores) {
          const b = bajLl.find((x) => String(x.id) === idB);
          area += b?.area_m2 || 0;
        }
        if (area > 0) canalAreaMap[String(c.id)] = area;
      }
    }
    return { areaAcumMap: map, drawnCanalGlyphs: glyphs, canalAreaMap };
  }, [plans]);

  const canalesLlAuto = useMemo(() => {
    const manualMap = new Map<string, CanalLL>();
    for (const c of canalesLl) manualMap.set(c.sector || c.id, c);
    const usedManual = new Set<string>();
    // Overrides manuales de bajantes (para etiquetar SU área asignada al canal).
    const manualBajMap = new Map<string, (typeof bajantesLl)[number]>();
    for (const m of bajantesLl) manualBajMap.set(m.bajante || m.id, m);
    const out: CanalLL[] = [];

    for (const glyph of drawnCanalGlyphs) {
      // Solo el nombre base ("CNL1" de "CNL1-P1") — el piso va en su propia columna.
      const sector = (glyph.code || glyph.id).split('-')[0];
      const manual = manualMap.get(sector);
      if (manual) usedManual.add(manual.sector || manual.id);
      // Área del canal = Σ áreas asignadas a los bajantes que le descargan (orig. usuario).
      // Override manual del canal primero; total dibujado del piso solo si ningún bajante
      // le descarga.
      const areaDeBajantes = canalAreaMap[String(glyph.id)] || 0;
      const manualBaj = manualBajMap.get(glyph.code || glyph.id);
      const areaAcum =
        manual?.areaAcumulada ||
        areaDeBajantes ||
        manualBaj?.areaAcumulada ||
        areaAcumMap[glyph.piso] ||
        0;
      const areaOtras = manual?.areaOtras ?? 0;
      const areaParcial =
        manual?.areaParcial || areaDeBajantes || manualBaj?.areaParcial || areaAcum;
      out.push({
        id: 'cg_' + glyph.id,
        sector,
        areaParcial,
        areaOtras,
        areaAcumulada: areaParcial + areaOtras,
        intensidad: manual?.intensidad ?? 100,
        coeficienteC: manual?.coeficienteC ?? 0.0278,
        manning: manual?.manning ?? 0.009,
        pendiente: 2,
        // b/h siempre vienen del glifo dibujado, nunca del override manual — porque son
        // exactamente los valores que la herramienta de canal "importa" a la tabla; una
        // entrada manual aquí igual se revertiría en silencio en el próximo render
        // (canalesLlAuto se recalcula en cada pasada).
        b: (glyph.base as number) || 0,
        h: (glyph.altura as number) || 0,
        longitud: (glyph.longitud as number) || 0,
        piso: Number(glyph.piso),
        fromCanal: true,
      });
    }

    for (const m of canalesLl) {
      const key = m.sector || m.id;
      if (usedManual.has(key)) continue;
      out.push(m);
    }

    // La pendiente del canal es siempre 2% (S=2%) — fija por diseño, no editable en la tabla.
    for (const c of out) c.pendiente = 2;

    return out;
  }, [drawnCanalGlyphs, canalesLl, bajantesLl, areaAcumMap, canalAreaMap]);

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
        coeficienteC: 0.0278,
        R: '',
        manning: 0,
        diamPropuesto: 0,
      },
    ]);
  const delBajanteLL = (id: string) => setBajantesLl((p) => p.filter((t) => t.id !== id));
  const updBajanteLL = (id: string, field: string, val: string | number) =>
    setBajantesLl((p) => {
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
            coeficienteC: 0.0278,
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
      conRecolectora,
      setConRecolectora,
    }),
    [bajantesLl, canalesLlAuto, conRecolectora],
  );

  return <RainwaterContext.Provider value={value}>{children}</RainwaterContext.Provider>;
}

/** Hook para acceder a los datos de cálculo de agua pluvial. @returns {RainwaterContextValue} */
export function useRainwater() {
  const ctx = useContext(RainwaterContext);
  if (!ctx) throw new Error('useRainwater must be used within RainwaterProvider');
  return ctx;
}
