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
import {
  canalOBBDe,
  puntoEnCanalOBB,
  distPuntoACanalOBB,
} from '../lib/PlanoEngine/canalAssociation';
import { pisoCorto } from '../constants';
import { TRAZOS_PREFIX, ACTIVE_NETS_KEY } from '../constants/storage-keys';
import { loadFromStorage, getActiveProyectoId } from '../services/storageService';
import {
  loadRainwaterOverrides,
  saveRainwaterOverrides,
} from '../services/rainwaterOverridesService';
import type { DrawingData, RawElement } from '../utils/drawingSync';
import { areaParcialBajanteLl, materialComun, sumaOtrasAsociados } from '../utils/rainwaterRows';

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
  /** Material de cubierta (nombre completo en MATERIALES_CUBIERTA_LL): C derivado del
   *  catálogo de escorrentía. Sin material → fallback al coeficienteC manual. */
  materialCubierta?: string;
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
  /** Material de cubierta (C derivado) y de canal (n derivado) — port hoja "2. Canales". */
  materialCubierta?: string;
  materialCanal?: string;
  /** Área de muro vertical que descarga sobre el canal (m²) — A efectiva = A + 0.5·muro. */
  muroVertical?: number;
  /** Borde libre editable por fila (cm) — port hoja 2 (antes fijo 10 cm). */
  bordeLibreCm?: number;
  /** Id del canal dibujado (glifo) — solo fromCanal: para escribir b/h/longitud/pendiente
   *  de vuelta al dibujo (writeCanalDimsToDrawing). */
  drawId?: string;
  /** Id del plano del glifo — solo fromCanal (el write necesita el piso exacto). */
  drawPlanId?: string | number;
  /** Es true cuando b/h/longitud/pendiente provienen de un glifo de canal dibujado
   *  (tipo:'canal' en la red 'll') — la tabla los muestra editables y escribe de vuelta al
   *  dibujo (writeCanalDimsToDrawing), que sigue siendo la fuente de verdad (ítem 7). */
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
  updCanalSector: (sector: string, field: string, val: string | number) => void;
  /** Bajantes asociados por canal (ítem 8 usuario): id de canal → chips "BAN1-P1". */
  canalBajantes: Record<string, string[]>;
  canalAlimIds: Record<string, string[]>;
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

  // Refresco reactivo de lo derivado del dibujo (ítem 7 usuario): el memo de abajo lee
  // storage crudo — sin tick, editar base/pendiente en el visor (menú/panel) no se reflejaba
  // en la tabla hasta remontar. Mismo trío de eventos que BombaARDesign/FixturesPanel.
  const [trazosTick, setTrazosTick] = useState(0);
  useEffect(() => {
    const bump = () => setTrazosTick((n) => n + 1);
    window.addEventListener('storage', bump);
    window.addEventListener('civilflow_san_sync_changed', bump as EventListener);
    window.addEventListener('civilflow_hidro_sync_changed', bump as EventListener);
    return () => {
      window.removeEventListener('storage', bump);
      window.removeEventListener('civilflow_san_sync_changed', bump as EventListener);
      window.removeEventListener('civilflow_hidro_sync_changed', bump as EventListener);
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
  const delCanalLL = (id: string) => setCanalesLl((p) => p.filter((t) => t.id !== id));
  const updCanalLL = (id: string, field: string, val: string | number) =>
    setCanalesLl((p) => p.map((t) => (t.id === id ? { ...t, [field]: val } : t)));
  /** Upsert de override por SECTOR (ítem 7 usuario): las filas fromCanal no viven en el
   *  state (se sintetizan del dibujo), así que editarles área/intensidad creaba un no-op
   *  silencioso. Crea la fila manual mínima (solo sector + campo) — el merge de
   *  canalesLlAuto la consume y rellena el resto desde el glifo. */
  const updCanalSector = (sector: string, field: string, val: string | number) =>
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

  // Auto-puebla las filas de canal desde los ramales 'll' dibujados (net==='ll', no bajante),
  // con el mismo patrón de búsqueda de área por piso que ChequeoBajantesLluvias, en lugar de
  // partir de ceros.
  // En la misma pasada también recolecta los glifos de canal dibujados (tipo:'canal', el
  // handleCanalDown de PlanoEngine) por piso, porque ambos necesitan la misma lectura cruda
  // de storage por plano — los glifos de canal no pasan por TramosContext/buildTramos.ts (esa
  // tubería solo modela ramales/bajantes con semántica sanitaria/bajante), así que se leen
  // directo aquí, igual que `areas` arriba.
  const {
    areaAcumMap,
    drawnCanalGlyphs,
    canalAreaMap,
    canalBajantes,
    canalAlimIds,
    canalAlimInfo,
  } = useMemo(() => {
    const canalAreaMap: Record<string, number> = {};
    // Bajantes asociados por canal (ítem 8 usuario): id de canal → chips "BAN1-P1".
    const canalBajantes: Record<string, string[]> = {};
    const canalAlimIds: Record<string, string[]> = {};
    // Insumo por bajante para el canal (REQ canal = Σ bajantes): código (clave del override
    // en bajantesLl) + área dibujada — la fila del canal deriva SU Parcial/Otras/Material de
    // estos con la MISMA fórmula de la tabla de bajantes (areaParcialBajanteLl).
    const canalAlimInfo: Record<string, Array<{ code: string; areaDib: number }>> = {};
    const map: Record<string, number> = {};
    const glyphs: (RawElement & { piso: string; planId: string | number })[] = [];
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
        if (b.tipo === 'canal' && b.net === 'll')
          glyphs.push({ ...b, piso: String(plan.nivel), planId: plan.id });
      }
      // Área de cada canal = Σ áreas de los bajantes que le descargan (orig. usuario): un
      // ramal ll con un extremo dentro del OBB del canal trae el área de SU bajante
      // (el otro extremo a ≤2 px del glifo). OBB válido en diagonal (canalMarco).
      const canales = (data.bajantes || []).filter(
        (
          b,
        ): b is RawElement & {
          base?: number;
          longitud?: number;
          angulo?: number;
          x?: number;
          y?: number;
        } => b.tipo === 'canal' && b.net === 'll',
      );
      const bajLl = (data.bajantes || []).filter(
        (b): b is RawElement & { area_m2?: number; x?: number; y?: number } =>
          b.net === 'll' && b.tipo === 'bajante',
      );
      // Asociaciones MANUALES (checkboxes panel/menú, ped. usuario): bajante→canal (canalId)
      // y ramal→canal (esCanalId, con bajante resoluble por extremo). Se SUMAN a la
      // derivación geométrica para que la columna "Canales asociados" del chequeo y los
      // chips del canal reflejen también lo asociado a mano.
      const manuales: Record<string, Set<string>> = {};
      const manualDe = (idCanal: string): Set<string> =>
        (manuales[String(idCanal)] ||= new Set<string>());
      for (const b of bajLl) {
        const rawB = b as RawElement & { canalId?: string | null };
        if (rawB.canalId) manualDe(rawB.canalId).add(String(b.id));
      }
      for (const r of data.ramales || []) {
        const rawR = r as RawElement & { esCanalId?: string | null };
        if (!rawR.esCanalId || !r.pts || r.pts.length < 2) continue;
        for (const b of bajLl) {
          if (b.x == null || b.y == null) continue;
          if (r.pts.some((p) => Math.hypot(p[0] - (b.x as number), p[1] - (b.y as number)) < 2)) {
            manualDe(rawR.esCanalId).add(String(b.id));
            break;
          }
        }
      }
      const pxPerCm = cmToPlanePx(Number(data.scaleM ?? 0.5), 1); // px de plano por cm — MISMA conversión que el engine (antes: invertida, rect 25-100x el canal)
      const etiquetaBaj = (idB: string): string => {
        const bb = bajLl.find((x) => String(x.id) === idB);
        const sector = String(bb?.code || bb?.id || idB).split('-')[0];
        return `${sector}-${pisoCorto(Number(plan.nivel))}`;
      };
      for (const c of canales) {
        if (c.x == null || c.y == null) continue;
        const obb = canalOBBDe(pxPerCm, c);
        const enCanal = (pt: number[]): boolean => puntoEnCanalOBB(obb, pt[0], pt[1], 4);
        // SET de bajantes alimentadores (un bajante con VARIOS ramales al canal cuenta UNA vez).
        // Semilla = asociaciones manuales; la geometría agrega las dibujadas.
        const alimentadores = new Set<string>(manuales[String(c.id)] || []);
        for (const r of data.ramales || []) {
          if (r.net !== 'll' || !r.pts || r.pts.length < 2) continue;
          // Cualquier DIRECCIÓN: un extremo dentro del canal y el OTRO sobre el glifo del
          // bajante (el ramal puede salir del canal o llegar a él — esCanalId marca salida).
          const pS = r.pts[0];
          const pE = r.pts[r.pts.length - 1];
          const pBaj = enCanal(pS) ? pE : enCanal(pE) ? pS : null;
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
        // Distancia al OBB (no al centro) — en un canal largo el centro queda lejos.
        for (const b of bajLl) {
          if (b.x == null || b.y == null) continue;
          if (distPuntoACanalOBB(obb, b.x, b.y) < 2) alimentadores.add(String(b.id));
        }
        canalBajantes[String(c.id)] = [...alimentadores].map(etiquetaBaj).sort();
        canalAlimIds[String(c.id)] = [...alimentadores].map((idB) => `${String(plan.id)}|${idB}`);
        // Insumo por bajante asociado (código SIN piso = clave del override + área dibujada).
        canalAlimInfo[String(c.id)] = [...alimentadores]
          .map((idB) => {
            const b = bajLl.find((x) => String(x.id) === idB);
            return {
              code: String(b?.code || b?.id || idB).split('-')[0],
              areaDib: b?.area_m2 || 0,
            };
          })
          .sort((a, b) => a.code.localeCompare(b.code));
        // Área = Σ una sola vez por bajante alimentador.
        let area = 0;
        for (const idB of alimentadores) {
          const b = bajLl.find((x) => String(x.id) === idB);
          area += b?.area_m2 || 0;
        }
        if (area > 0) canalAreaMap[String(c.id)] = area;
      }
    }
    return {
      areaAcumMap: map,
      drawnCanalGlyphs: glyphs,
      canalAreaMap,
      canalBajantes,
      canalAlimIds,
      canalAlimInfo,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, trazosTick]);

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
      // ── Canal = Σ bajantes asociados (REQ: fuente única = overrides de los BAJANTES) ──
      // Con bajantes asociados, Parcial/Otras/Material cubierta del canal SE DERIVAN de los
      // overrides de aquellos con la MISMA fórmula de la tabla de bajantes
      // (areaParcialBajanteLl); al editar, la tabla de canales escribe updBajanteLL en cada
      // asociado (fan-out con reparto en RainChannelsCheck) y ambas tablas leen lo mismo
      // en vivo. Sin asociados: fallbacks propios del canal (comportamiento anterior).
      // La Intensidad queda INTENCIONALMENTE a nivel canal (los bajantes usan la suya en
      // sus propios chequeos).
      const alims = canalAlimInfo[String(glyph.id)] || [];
      const conAsoc = alims.length > 0;
      const areaParcialAsoc = alims.reduce(
        (s, a) => s + areaParcialBajanteLl(a.areaDib, undefined, manualBajMap.get(a.code)),
        0,
      );
      const areaOtrasAsoc = sumaOtrasAsociados(alims.map((a) => manualBajMap.get(a.code)));
      // Material común SOLO si TODOS los asociados comparten el mismo; mezclados/ninguno → ''
      // (placeholder de la celda; sin material no hay C y el cálculo del canal no dispara).
      const matComun = materialComun(alims.map((a) => manualBajMap.get(a.code)?.materialCubierta));
      // Área del canal = Σ áreas asignadas a los bajantes que le descargan (orig. usuario).
      // Override manual del canal primero; total dibujado del piso solo si ningún bajante
      // le descarga.
      const areaDeBajantes = canalAreaMap[String(glyph.id)] || 0;
      const manualBaj = manualBajMap.get(glyph.code || glyph.id);
      const areaAcumFallback =
        manual?.areaAcumulada ||
        areaDeBajantes ||
        manualBaj?.areaAcumulada ||
        areaAcumMap[glyph.piso] ||
        0;
      const areaParcial = conAsoc
        ? areaParcialAsoc
        : manual?.areaParcial || areaDeBajantes || manualBaj?.areaParcial || areaAcumFallback;
      const areaOtras = conAsoc ? areaOtrasAsoc : (manual?.areaOtras ?? 0);
      out.push({
        id: 'cg_' + glyph.id,
        sector,
        areaParcial,
        areaOtras,
        areaAcumulada: areaParcial + areaOtras,
        intensidad: manual?.intensidad ?? 100,
        coeficienteC: manual?.coeficienteC ?? 0,
        manning: manual?.manning ?? 0.009,
        materialCubierta: conAsoc ? matComun : manual?.materialCubierta,
        materialCanal: manual?.materialCanal,
        muroVertical: manual?.muroVertical,
        bordeLibreCm: manual?.bordeLibreCm,
        // Pendiente MANDA EL DIBUJO (ítem 7 usuario): la del glifo (default 2 en creación,
        // 2 en legacy sin el campo — igual que antes); fila manual → su propio valor.
        pendiente: (glyph.pendiente as number) ?? 2,
        // b/h siempre vienen del glifo dibujado, nunca del override manual — porque son
        // exactamente los valores que la herramienta de canal "importa" a la tabla; una
        // entrada manual aquí igual se revertiría en silencio en el próximo render
        // (canalesLlAuto se recalcula en cada pasada).
        b: (glyph.base as number) || 0,
        h: (glyph.altura as number) || 0,
        longitud: (glyph.longitud as number) || 0,
        piso: Number(glyph.piso),
        fromCanal: true,
        drawId: String(glyph.id),
        drawPlanId: glyph.planId,
      });
    }

    for (const m of canalesLl) {
      const key = m.sector || m.id;
      if (usedManual.has(key)) continue;
      out.push(m);
    }

    return out;
  }, [drawnCanalGlyphs, canalesLl, bajantesLl, areaAcumMap, canalAreaMap, canalAlimInfo]);

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
      canalBajantes,
      canalAlimIds,
      conRecolectora,
      setConRecolectora,
    }),
    [bajantesLl, canalesLlAuto, canalBajantes, canalAlimIds, conRecolectora],
  );

  return <RainwaterContext.Provider value={value}>{children}</RainwaterContext.Provider>;
}

/** Hook para acceder a los datos de cálculo de agua pluvial. @returns {RainwaterContextValue} */
export function useRainwater() {
  const ctx = useContext(RainwaterContext);
  if (!ctx) throw new Error('useRainwater must be used within RainwaterProvider');
  return ctx;
}
