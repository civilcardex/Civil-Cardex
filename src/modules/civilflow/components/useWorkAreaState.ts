/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import { useDebouncedEffect } from '../../../hooks/useDebouncedEffect';
import { useTramos } from '../context/TramosContext';
import { useProject } from '../context/ProjectContext';
import { useApparatus } from '../context/ApparatusContext';
import { usePlans } from '../context/PlansContext';
import { REDES } from '../constants';
import { parseDecimalInput, parseIntInput } from '../utils/parseDecimal';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import { devError } from '../../../utils/devError';
import { loadFromStorage, saveToStorage, getActiveProyectoId } from '../services/storageService';
import { loadProyectoData, saveRedesActivas } from '../services/projectDataService';
import { loadNetColors, applyNetColors } from '../services/netColorsService';
import {
  ACTIVE_NETS_KEY,
  OPEN_TAB_KEY,
  NET_COLOR_PREFIX,
  NETS_CHANGED_EVENT,
} from '../constants/storage-keys';
import type { Piso } from '../lib/shared/projectTypes';
import { NAV_TABS } from '../constants/uiConfig';
import { setAyudaContext } from '../../../components/help/helpContext';

/** Intro de 1-2 líneas por pestaña para el panel de ayuda. */
const AYUDA_INTROS: Record<string, string> = {
  info: 'Datos del proyecto, ubicación, niveles y parámetros generales que alimentan todo el diseño.',
  planos: 'Carga y calibración de los planos PDF sobre los que se dibujan las redes.',
  datos: 'Catálogo maestro de materiales y parámetros de cálculo por red.',
  visor: 'Dibujo de redes sobre el plano: trazar ramales, ubicar bajantes, aparatos y accesorios.',
  redes: 'Tablas de diseño por red: caudales, diámetros, velocidades y verificaciones normativas.',
  iso: 'Representación isométrica 3D del diseño, detalle de aparatos y equipos de bombeo.',
  inf: 'Informes y memorias de cálculo generadas a partir del diseño.',
  crit: 'Normativa aplicada al proyecto y verificaciones de cumplimiento.',
};

/** Red activa → intro del panel de ayuda (orig. usuario: ayuda solo de la red activa). */
const AYUDA_REDES_INTROS: Record<string, string> = {
  san: 'Cálculo de UD, diseño de tramos, bajantes y ventilación de la red sanitaria.',
  ll: 'Método racional, diseño de lluvias, chequeo de bajantes (Wyly-Eaton) y canales.',
  af: 'Unidades de consumo, diseño Hazen-Williams, acometida y accesorios de agua fría.',
  ac: 'Unidades de consumo, diseño, selección de calentador y accesorios de agua caliente.',
  gas: 'Datos generales, Renouard (NTC 3728), chequeo de red y rejillas de ventilación (NTC 3631).',
  rejillas: 'Ventilación de recintos con gas (NTC 3631): sectores, aberturas y rejillas.',
  bom: 'Cálculo y selección de la bomba de aguas residuales y su cámara.',
  ep: 'Equipo de presión constante: datos de entrada, potencia y especificación.',
  rci: 'Cuarto de bombas de red contra incendio (NFPA 20).',
};

function useSyncedRef<T>(initial: T): [T, (v: T) => void, React.MutableRefObject<T>] {
  const [val, _set] = useState<T>(initial);
  const ref = useRef(val);
  useEffect(() => {
    ref.current = val;
  }, [val]);
  const set = useCallback((v: T) => {
    ref.current = v;
    _set(v);
  }, []);
  return [val, set, ref];
}

const UI_TAB_KEY = 'civilflow_ui_tab';
const UI_RED_KEY = 'civilflow_ui_red';
const UI_PAGES_KEY = 'civilflow_ui_pages';

/** Lee UI persistida sin romper fuera del navegador (tests/SSR). */
function leerUI(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Persiste UI sin romper fuera del navegador. */
function guardarUI(key: string, val: string): void {
  try {
    sessionStorage.setItem(key, val);
  } catch {
    /* sin almacenamiento: la pestaña solo vive en memoria */
  }
}

/** Páginas por red guardadas como un solo JSON. */
function leerPaginas(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(UI_PAGES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
    /* cae a defaults */
  }
  return {};
}

export function useWorkAreaState() {
  const tramosCtx = useTramos();
  const projectCtx = useProject();
  const apparatusCtx = useApparatus();
  const plansCtx = usePlans();

  // La pestaña/red/páginas sobreviven a remontajes del subtree (el rebote a 'info' en el
  // primer ingreso a redes era un remount con estado efímero, no una recarga real).
  const paginasInit = useMemo(() => leerPaginas(), []);
  const [tab, setTab] = useState<string>(() => leerUI(UI_TAB_KEY) || 'info');
  useEffect(() => guardarUI(UI_TAB_KEY, tab), [tab]);

  // Ayuda contextual (orig. usuario): reporta módulo + pestaña activa a la navbar. La sub-pestaña
  // de isometría la reporta IsometriaTab (hijo, reporta más específico): el padre la OMITE y al
  // salir de 'iso' este efecto (que corre después del cleanup del hijo) restaura el reporte.
  useEffect(() => {
    if (tab === 'iso' || tab === 'redes') return;
    const label = NAV_TABS.find((t) => t.id === tab)?.l || tab;
    setAyudaContext({
      key: `cf:${tab}`,
      modulo: 'Civil Flow',
      seccion: label,
      intro: AYUDA_INTROS[tab] || AYUDA_INTROS.info,
    });
    return () => setAyudaContext(null);
  }, [tab]);

  useEffect(() => {
    const openTab = sessionStorage.getItem(OPEN_TAB_KEY);
    if (openTab) {
      setTab(openTab);
      sessionStorage.removeItem(OPEN_TAB_KEY);
    }
  }, []);

  const [redes, setRedes] = useState<Set<string>>(() => {
    const saved = loadFromStorage(ACTIVE_NETS_KEY, null);
    if (saved && Array.isArray(saved)) return new Set(saved);
    return new Set(['san', 'vent', 'll']);
  });

  const redesActivas = useMemo(
    () =>
      REDES.filter(
        (r) => redes.has(r.id) && r.id !== 'vent' && r.id !== 'recolectora' && r.id !== 'rejillas',
      ),
    [redes],
  );

  // Sincronización en la nube de "Redes activas"/"Equipos activos" — antes solo vivía en
  // localStorage, así que nunca seguía al proyecto (reabrir desde Profile, un navegador nuevo
  // u otro dispositivo siempre recaía en el default hardcodeado ['san','ll']). Replica el
  // patrón restoreDone de ProjectContext: redesRestoreDone arranca en true solo si ya existen
  // datos locales del proyecto activo (para que una caché realmente limpiada cargue desde
  // Supabase en vez de que el efecto de guardado persista el default sobre lo guardado antes).
  const [redesRestoreDone, setRedesRestoreDone] = useState(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return true;
    return loadFromStorage(ACTIVE_NETS_KEY, null) != null;
  });

  useEffect(() => {
    if (redesRestoreDone) return;
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let ignore = false;
    (async () => {
      const data = await loadProyectoData(proyectoId);
      if (!ignore && data?.redesActivas && data.redesActivas.length > 0) {
        setRedes(new Set(data.redesActivas));
      }
      if (!ignore) setRedesRestoreDone(true);
    })();
    return () => {
      ignore = true;
    };
    // Se ejecuta una sola vez — redesRestoreDone ya codifica el caso en que no hay nada que restaurar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El guardado con debounce de 1200ms se cancelaba al desmontar (navegar al visor/lógica antes
  // de que corriera): localStorage y NETS_CHANGED_EVENT nunca se escribían y el visor — que lee
  // active_nets UNA vez al montar — mostraba el set viejo ("me toca volver a activarlas").
  // El unmount-flush ANTES solo subía BD. Ahora el flush hace TODO (localStorage + evento + BD)
  // y corre tanto en el debounce como en el desmonte: salir dentro de la ventana de 1.2 s ya
  // no pierde los checks.
  const redesSaveRef = useRef(redes);
  useEffect(() => {
    redesSaveRef.current = redes;
  }, [redes]);
  const redesRestoreDoneSaveRef = useRef(redesRestoreDone);
  useEffect(() => {
    redesRestoreDoneSaveRef.current = redesRestoreDone;
  }, [redesRestoreDone]);
  const flushRedes = useCallback(() => {
    saveToStorage(ACTIVE_NETS_KEY, [...redesSaveRef.current]);
    window.dispatchEvent(
      new CustomEvent(NETS_CHANGED_EVENT, { detail: [...redesSaveRef.current] }),
    );
    if (!redesRestoreDoneSaveRef.current) return;
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    saveRedesActivas(proyectoId, [...redesSaveRef.current]);
  }, []);
  useDebouncedEffect(
    () => {
      flushRedes();
    },
    1200,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [redes, redesRestoreDone],
  );
  useEffect(() => {
    return () => flushRedes();
  }, [flushRedes]);

  const [redActiva, setRedActiva] = useState<string>(() => leerUI(UI_RED_KEY) || 'san');
  useEffect(() => guardarUI(UI_RED_KEY, redActiva), [redActiva]);

  // Ayuda contextual por RED (orig. usuario): en Diseño de redes el panel muestra SOLO la
  // ayuda de la red/equipo activo (cf:redes:<red>).
  useEffect(() => {
    if (tab !== 'redes') return;
    const red = REDES.find((r) => r.id === redActiva);
    setAyudaContext({
      key: `cf:redes:${redActiva}`,
      modulo: 'Civil Flow',
      seccion: `Diseño de redes · ${red?.lbl || redActiva}`,
      intro: AYUDA_REDES_INTROS[redActiva] || 'Diseño y verificación de la red activa.',
    });
    return () => setAyudaContext(null);
  }, [tab, redActiva]);
  const pag = (red: string): number => {
    const v = paginasInit[red];
    return Number.isInteger(v) && (v as number) >= 1 ? (v as number) : 1;
  };
  const [sanPage, setSanPage] = useState<number>(() => pag('san'));
  const [llPage, setLlPage] = useState<number>(() => pag('ll'));
  const [afPage, setAfPage] = useState<number>(() => pag('af'));
  const [acPage, setAcPage] = useState<number>(() => pag('ac'));
  const [gasPage, setGasPage] = useState<number>(() => pag('gas'));
  const [rciPage, setRciPage] = useState<number>(() => pag('rci'));
  useEffect(() => {
    guardarUI(
      UI_PAGES_KEY,
      JSON.stringify({
        san: sanPage,
        ll: llPage,
        af: afPage,
        ac: acPage,
        gas: gasPage,
        rci: rciPage,
      }),
    );
  }, [sanPage, llPage, afPage, acPage, gasPage, rciPage]);

  // Re-clamp: al apagar la subred 'rejillas', el total de gas baja (7→5) y una página
  // 5/6 quedaba fuera de rango (PageNav pintaba "6 de 4"). Encender 'rejillas' NO mueve
  // la página — el render condicional ya redirige la 4 a RejillasVentilacion.
  useEffect(() => {
    if (!redes.has('rejillas') && gasPage > 4) setGasPage(4);
  }, [redes, gasPage, setGasPage]);

  const [netColors, setNetColors] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    REDES.forEach((r) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(`--${r.id}`).trim();
      init[r.id] = v || '#666';
    });
    return init;
  });

  const [planDrag, setPlanDrag] = useState<boolean>(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const selectedPlan = useMemo(
    () => plansCtx.plans.find((p) => p.id === selectedPlanId) || null,
    [plansCtx.plans, selectedPlanId],
  );
  const [selectedPlanUrl, setSelectedPlanUrl] = useState<string | null>(null);
  const pendingPlanos = useMemo(
    () => plansCtx.plans.filter((p) => p.status === 'pending'),
    [plansCtx.plans],
  );
  const confirmedPlanos = useMemo(
    () => plansCtx.plans.filter((p) => p.status === 'confirmed'),
    [plansCtx.plans],
  );

  const [nSotanos, setNSotanos, nSotanosRef] = useSyncedRef<string>('');
  const [nPisos, setNPisos, nPisosRef] = useSyncedRef<string>('');
  const [altPiso, setAltPiso, altPisoRef] = useSyncedRef<string>('');
  const [altSotano, setAltSotano, altSotanoRef] = useSyncedRef<string>('');
  const [nptPiso1, setNptPiso1, nptPiso1Ref] = useSyncedRef<string>('');
  const [conCubierta, setConCubierta, conCubiertaRef] = useSyncedRef<boolean>(false);

  // Mantiene los inputs del generador sincronizados con la lista de pisos misma. Una vez
  // generada, la lista es la fuente de verdad (y lo único que sobrevive recargas — localStorage
  // ahora, restauración en la nube en un navegador nuevo), así que los inputs deben reflejarla
  // en lugar de quedarse en sus valores iniciales vacíos. Editar un input nunca cambia `pisos`,
  // por lo que este efecto solo se dispara cuando la lista realmente cambia (generar, agregar/
  // quitar manual, restauración en la nube) — nunca mientras se escribe.
  useEffect(() => {
    if (projectCtx.pisos.length === 0) return;
    const niveles = projectCtx.pisos.filter((p) => p.tipo === 'piso');
    const sotanos = projectCtx.pisos.filter((p) => p.tipo === 'sotano');
    if (niveles.length > 0) {
      setNPisos(String(niveles.length));
      const h = niveles[0].h;
      if (h) setAltPiso(String(h));
      const p1 = niveles.find((p) => p.n === 1);
      if (p1 && p1.npt !== '' && p1.npt != null) setNptPiso1(String(p1.npt));
    }
    if (sotanos.length > 0) {
      setNSotanos(String(sotanos.length));
      const h = sotanos[0].h;
      if (h) setAltSotano(String(h));
    }
    setConCubierta(projectCtx.pisos.some((p) => p.tipo === 'cubierta'));
  }, [
    projectCtx.pisos,
    setNPisos,
    setNSotanos,
    setAltPiso,
    setAltSotano,
    setNptPiso1,
    setConCubierta,
  ]);

  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!alertMsg) return;
    const t = setTimeout(() => setAlertMsg(null), 5000);
    return () => clearTimeout(t);
  }, [alertMsg]);

  const generarPisos = () => {
    const MAX = 50;
    const nSot = Math.min(parseIntInput(nSotanosRef.current) || 0, MAX);
    const nPis = Math.min(parseIntInput(nPisosRef.current) || 0, MAX);

    if (nPis > 0 && !nptPiso1Ref.current.trim()) {
      setAlertMsg('Ingrese NPT Piso 1');
      return;
    }
    let nSotFinal = nSot;
    if (nSot > 0 && !altSotanoRef.current.trim()) {
      nSotFinal = 0; // se ignoran los sótanos si no hay altura
      if (nPis === 0) {
        setAlertMsg('Ingrese la altura de sótano');
        return;
      }
    }
    if (nPis > 0 && !altPisoRef.current.trim()) {
      setAlertMsg('Ingrese la altura de entrepiso');
      return;
    }
    if (nPis === 0 && nSotFinal === 0) {
      setAlertMsg('Ingrese la cantidad de pisos o sótanos válidos');
      return;
    }

    const hPis = parseDecimalInput(altPisoRef.current) || 0;
    const hSot = parseDecimalInput(altSotanoRef.current) || 0;
    const npt1 = parseDecimalInput(nptPiso1Ref.current) || 0;
    const l: Piso[] = [];
    for (let i = nSotFinal; i >= 1; i--)
      l.push({
        id: 's' + i,
        n: -i,
        npt: +(npt1 - i * hSot).toFixed(2),
        ok: false,
        tipo: 'sotano',
        h: hSot.toFixed(2),
      });
    for (let i = 1; i <= nPis; i++)
      l.push({
        id: 'p' + i,
        n: i,
        npt: +(npt1 + (i - 1) * hPis).toFixed(2),
        ok: false,
        tipo: 'piso',
        h: hPis.toFixed(2),
      });
    if (conCubiertaRef.current)
      l.push({
        id: 'cub',
        n: 99,
        npt: +(npt1 + nPis * hPis).toFixed(2),
        ok: false,
        tipo: 'cubierta',
        h: hPis.toFixed(2),
      });
    projectCtx.setPisos(l);
    setAlertMsg(null);
  };

  const onIntChange = useCallback(
    (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      const onlyDigits = e.target.value.replace(/[^\d]/g, '');
      setter(onlyDigits);
    },
    [],
  );
  const onIntBlur = useCallback(
    (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => {
      const v = parseIntInput(e.target.value);
      if (v !== null) setter(String(v));
    },
    [],
  );
  const onDecChange = useCallback(
    (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      const normalized = e.target.value.replace(/,/g, '.');
      setter(normalized);
    },
    [],
  );
  const onDecBlur = useCallback(
    (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => {
      const v = parseDecimalInput(e.target.value);
      if (v !== null) {
        setter(v.toFixed(2));
      }
    },
    [],
  );

  const delPiso = (id: string | number) =>
    projectCtx.setPisos((prev: Piso[]) => prev.filter((p) => p.id !== id));

  const addPiso = () => {
    if (!altPisoRef.current.trim()) {
      setAlertMsg('Ingrese la altura de entrepiso');
      return;
    }
    projectCtx.setPisos((prev: Piso[]) => {
      const pisosPOS = prev.filter((p) => p.tipo === 'piso').sort((a, b) => b.n - a.n);
      const maxN = pisosPOS.length ? Math.max(...pisosPOS.map((p) => p.n)) : 0;
      const hPis = parseFloat(altPisoRef.current) || 0;
      const baseNpt = pisosPOS.length
        ? parseFloat(String(pisosPOS[0].npt)) || 0
        : parseFloat(nptPiso1Ref.current) || 0;
      const newNpt = +(baseNpt + (pisosPOS.length > 0 ? hPis : 0)).toFixed(2);
      const newPiso = {
        id: Date.now(),
        n: maxN + 1,
        npt: newNpt,
        ok: false,
        tipo: 'piso',
        h: hPis.toFixed(2),
      };
      const cubIx = prev.findIndex((p) => p.tipo === 'cubierta');
      const insertAt = cubIx >= 0 ? cubIx + 1 : 0;
      const copy = [...prev];
      copy.splice(insertAt, 0, newPiso);
      return copy;
    });
  };

  const addSotano = () => {
    if (!altSotanoRef.current.trim()) {
      setAlertMsg('Ingrese la altura de sótano');
      return;
    }
    projectCtx.setPisos((prev: Piso[]) => {
      const pisoNEG = prev.filter((p) => p.tipo === 'sotano').sort((a, b) => a.n - b.n);
      const minN = pisoNEG.length ? Math.min(...pisoNEG.map((p) => p.n)) : 0;
      const hSot = parseFloat(altSotanoRef.current) || 0;
      const baseNpt = pisoNEG.length
        ? parseFloat(String(pisoNEG[0].npt)) || 0
        : parseFloat(nptPiso1Ref.current) || 0;
      const newNpt = +(baseNpt - hSot).toFixed(2);
      const newSotano = {
        id: Date.now(),
        n: minN === 0 ? -1 : minN - 1,
        npt: newNpt,
        ok: false,
        tipo: 'sotano',
        h: hSot.toFixed(2),
      };
      return [...prev, newSotano];
    });
  };

  useEffect(() => {
    const restored: Record<string, string> = {};
    REDES.forEach((r) => {
      const raw = localStorage.getItem(NET_COLOR_PREFIX + r.id);
      const saved = raw
        ? (() => {
            try {
              return JSON.parse(raw);
            } catch {
              return raw;
            }
          })()
        : null;
      if (saved && typeof saved === 'string') {
        document.documentElement.style.setProperty('--' + r.id, saved);
        try {
          const nets = NETS;
          const net = nets.find((n) => n.id === r.id);
          if (net) net.col = saved;
        } catch (e) {
          devError(e);
        }
        restored[r.id] = saved;
      } else {
        // Sin override guardado — sincroniza el default de la variable CSS hacia NETS[].col
        // para que el motor de dibujo (que lee exclusivamente de NETS[].col) use el mismo color
        // que la UI/selector de color (que lee de variables CSS). Evita que lluvias quede en
        // morado (#8B5CF6 hardcodeado en PlanoState.ts) mientras la variable CSS dice cyan
        // (#22d3ee).
        const cssVal = getComputedStyle(document.documentElement)
          .getPropertyValue('--' + r.id)
          .trim();
        if (cssVal) {
          try {
            const net = NETS.find((n) => n.id === r.id);
            if (net) net.col = cssVal;
          } catch (e) {
            devError(e);
          }
        }
      }
    });
    if (Object.keys(restored).length > 0) {
      setNetColors((prev) => ({ ...prev, ...restored }));
    }
  }, []);

  // Colores de redes desde la fuente de verdad (perfiles.net_colors), aplicados después del
  // restore local para que la BD gane. loadNetColors además refresca el caché de localStorage.
  useEffect(() => {
    let cancelled = false;
    void loadNetColors().then((colors) => {
      if (cancelled) return;
      applyNetColors(colors);
      setNetColors((prev) => ({ ...prev, ...colors }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      const pdfFile =
        selectedPlan.file.type === 'application/pdf'
          ? selectedPlan.file
          : new File([selectedPlan.file], selectedPlan.file.name, { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfFile);
      setSelectedPlanUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setSelectedPlanUrl(null);
      };
    } else {
      setSelectedPlanUrl(null);
    }
  }, [selectedPlan]);

  // Ítem 9/10: al crecer `plans` por la precarga silenciosa en paralelo (ProfilePage/PlansContext
  // publican PDFs conforme llegan), NO re-seleccionar el último plan — eso descartaba el plano que
  // el usuario acababa de abrir y forzaba una reinicialización del visor. Solo se auto-selecciona
  // cuando la selección actual no existe (o nunca hubo): en ese caso se toma el primero disponible.
  // Un plan agregado manualmente (addPlans) no cambia la selección a menos que no haya ninguna.
  useEffect(() => {
    const len = plansCtx.plans.length;
    if (len === 0) {
      setSelectedPlanId(null);
    } else if (!plansCtx.plans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(plansCtx.plans[0].id);
    }
    // Deliberadamente depende de plans.length y selectedPlanId: cuando la precarga agrega planes,
    // length cambia pero selectedPlanId ya apunta a uno válido → no se toca. Solo se re-sincroniza
    // si la selección quedó inválida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansCtx.plans.length, selectedPlanId]);

  const fileRef = useRef<HTMLInputElement>(null);

  return {
    ...tramosCtx,
    ...projectCtx,
    ...apparatusCtx,
    ...plansCtx,

    tab,
    setTab,
    redes,
    setRedes,
    redesRestoreDone,
    redesActivas,
    redActiva,
    setRedActiva,
    sanPage,
    setSanPage,
    llPage,
    setLlPage,
    afPage,
    setAfPage,
    acPage,
    setAcPage,
    gasPage,
    setGasPage,
    rciPage,
    setRciPage,
    netColors,
    setNetColors,
    planDrag,
    setPlanDrag,
    selectedPlanId,
    setSelectedPlanId,
    selectedPlan,
    selectedPlanUrl,
    pendingPlanos,
    confirmedPlanos,
    nSotanos,
    setNSotanos,
    nPisos,
    setNPisos,
    altPiso,
    setAltPiso,
    altSotano,
    setAltSotano,
    nptPiso1,
    setNptPiso1,
    conCubierta,
    setConCubierta,
    generarPisos,
    alertMsg,
    setAlertMsg,
    onIntChange,
    onIntBlur,
    onDecChange,
    onDecBlur,
    delPiso,
    addPiso,
    addSotano,
    fileRef,
  };
}
