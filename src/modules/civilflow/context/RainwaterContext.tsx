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
import { cmToPlanePx } from '../lib/PlanoEngine/planoCoords.ts';
import {
  canalOBBDe,
  puntoEnCanalOBB,
  distPuntoACanalOBB,
} from '../lib/PlanoEngine/channelAssociation';
import { pisoCorto, pisoCortoLoose } from '../constants/helpers.ts';
import { TRAZOS_PREFIX, ACTIVE_NETS_KEY } from '../constants/storage-keys.ts';
import { loadFromStorage, getActiveProyectoId } from '../services/storageService.ts';
import { devError } from '../../../utils/devError.ts';
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
import {
  loadRainwaterOverrides,
  saveRainwaterOverrides,
} from '../services/rainwaterOverridesService.ts';
import type { DrawingData, RawElement } from '../utils/drawingSync.ts';
import { areaParcialBajanteLl, materialComun, sumaOtrasAsociados } from '../utils/rainwaterRows.ts';
import { sectorDe } from '../utils/formatUtils.ts';
import { EV_SAN_SYNC, EV_HIDRO_SYNC, EV_STORAGE } from '../utils/fixtureEvents.ts';

/**
 * Contexto del cálculo pluvial (ll = Lluvias): bajantes de cubierta (BLL) y canales (CLL)
 * que se auto-pueblan del dibujo (áreas, materiales, intensidad) y guardan las ediciones
 * manuales del usuario (areaOtras) en BD. Ej: dibujas un canal sobre el plano, la tabla
 * "Canales" aparece con su sector y su área, y tu edición de áreaOtras sobrevive al reload.
 */

interface AreaRaw {
  areaM2?: number;
}
/** Bajante pluvial de la tabla de lluvias: áreas (parcial + otras), intensidad de lluvia, coeficiente C de escorrentía (cuánta lluvia llega al tubo) y diámetro propuesto. */
export interface BajanteLL {
  id: string;
  bajante: string;
  areaParcial: number;
  /** Área Otras: metros cuadrados de techo extra que el usuario suma a mano (pedido del cliente); editable desde la tabla, por defecto 0. */
  areaOtras: number;
  /** Área TOTAL = areaParcial + areaOtras — de ella sale el caudal real (Q, o sea cuántos litros por segundo escurren). */
  areaAcumulada: number;
  intensidad: number;
  coeficienteC: number;
  /** Material de cubierta (nombre completo en MATERIALES_CUBIERTA_LL): de él sale C, el
   *  coeficiente de escorrentía (cuánta lluvia llega al tubo y cuánta se absorbe en el
   *  techo), según el catálogo. Sin material se usa el coeficienteC manual. */
  materialCubierta?: string;
  R: string;
  manning: number;
  diamPropuesto: number;
}
/** Canal pluvial de la tabla de lluvias: geometría (b, h, pendiente), material con su n de Manning (rugosidad) y borde libre. Ej: canal de concreto n=0.013 con b=30 cm. */
export interface CanalLL {
  id: string;
  sector: string;
  areaParcial: number;
  /** Área Otras: metros cuadrados de techo extra que el usuario suma a mano (pedido del cliente); editable desde la tabla, por defecto 0. */
  areaOtras: number;
  /** Área TOTAL = areaParcial + areaOtras — de ella sale el caudal real (Q, o sea cuántos litros por segundo escurren). */
  areaAcumulada: number;
  intensidad: number;
  coeficienteC: number;
  manning: number;
  pendiente: number;
  b: number;
  h: number;
  /** Largo horizontal del canal (cm), solo para glifos dibujados (fromCanal). */
  longitud?: number;
  /** Nivel (el piso) del canal — solo glifos dibujados (fromCanal); alimenta la columna Nivel. */
  piso?: number;
  /** Material de cubierta (de él sale C, el coeficiente de escorrentía) y de canal (sale
   *  n, el coeficiente de Manning, qué tan rugoso es el canal) — hoja "2. Canales". */
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
  /** Es true cuando b/h/longitud/pendiente provienen de un canal dibujado (glifo) en la
   *  red 'll' — la tabla los muestra editables y escribe de vuelta al dibujo
   *  (writeCanalDimsToDrawing), que sigue siendo la fuente de verdad. */
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
  /** Cambio único de material de canal: lo llaman tablas, panel derecho y menú contextual
   *  y todos escriben por el mismo camino. `ref` = drawId del glifo o id de la fila. */
  setMaterialCanal: (ref: string, field: 'materialCubierta' | 'materialCanal', mat: string) => void;
  /** Bajantes asociados a cada canal (pedido del cliente): id de canal → chips "BAN1-P1". */
  canalBajantes: Record<string, string[]>;
  canalAlimIds: Record<string, string[]>;
  conRecolectora: boolean;
  setConRecolectora: (v: boolean) => void;
}

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const sector = sectorDe(String(bb?.code || bb?.id || idB));
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
              code: sectorDe(String(b?.code || b?.id || idB)),
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
      const sector = sectorDe(glyph.code || glyph.id);
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
