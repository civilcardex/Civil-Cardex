/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import { useTramos } from '../context/TramosContext';
import { useProject } from '../context/ProjectContext';
import { useApparatus } from '../context/ApparatusContext';
import { usePlans } from '../context/PlansContext';
import { REDES } from '../constants';
import { parseDecimalInput, parseIntInput } from '../utils/parseDecimal';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import { devError } from '../../../utils/devError';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { loadProyectoData, saveRedesActivas } from '../services/proyectoDataService';
import {
  ACTIVE_NETS_KEY,
  ACTIVE_PROYECTO_ID_KEY,
  OPEN_TAB_KEY,
  NET_COLOR_PREFIX,
  NETS_CHANGED_EVENT,
} from '../constants/storage-keys';

export interface Piso {
  id: string | number;
  n: number;
  npt: number | string;
  ok: boolean;
  tipo: string;
  h: string;
}

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

export function useWorkAreaState() {
  const tramosCtx = useTramos();
  const projectCtx = useProject();
  const apparatusCtx = useApparatus();
  const plansCtx = usePlans();

  const [tab, setTab] = useState<string>('info');

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
    return new Set(['san', 'll']);
  });

  const redesActivas = useMemo(
    () => REDES.filter((r) => redes.has(r.id) && r.id !== 'vent' && r.id !== 'recolectora'),
    [redes],
  );

  // Cloud sync for "Redes activas"/"Equipos activos" — was localStorage-only, so it never
  // followed the project (reopening from Profile, a fresh browser, or another device always
  // fell back to the hardcoded ['san','ll'] default). Mirrors ProjectContext's restoreDone
  // pattern: redesRestoreDone starts true only when local data already exists for the active
  // project (so a genuinely-cleared cache pulls from Supabase instead of the save effect
  // immediately persisting the default over whatever was saved before).
  const [redesRestoreDone, setRedesRestoreDone] = useState(() => {
    const proyectoId = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
    if (!proyectoId) return true;
    return loadFromStorage(ACTIVE_NETS_KEY, null) != null;
  });

  useEffect(() => {
    if (redesRestoreDone) return;
    const proyectoId = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
    if (!proyectoId) return;
    let ignore = false;
    (async () => {
      const data = await loadProyectoData(Number(proyectoId));
      if (!ignore && data?.redesActivas && data.redesActivas.length > 0) {
        setRedes(new Set(data.redesActivas));
      }
      if (!ignore) setRedesRestoreDone(true);
    })();
    return () => {
      ignore = true;
    };
    // Mount-once — redesRestoreDone already encodes the no-restore-needed case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveToStorage(ACTIVE_NETS_KEY, [...redes]);
    window.dispatchEvent(new CustomEvent(NETS_CHANGED_EVENT, { detail: [...redes] }));
    if (!redesRestoreDone) return;
    const proyectoId = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
    if (!proyectoId) return;
    const timer = setTimeout(() => {
      saveRedesActivas(Number(proyectoId), [...redes]);
    }, 1200);
    return () => clearTimeout(timer);
  }, [redes, redesRestoreDone]);

  const [redActiva, setRedActiva] = useState<string>('san');
  const [sanPage, setSanPage] = useState<number>(1);
  const [llPage, setLlPage] = useState<number>(1);
  const [afPage, setAfPage] = useState<number>(1);
  const [acPage, setAcPage] = useState<number>(1);
  const [bomPage, setBomPage] = useState<number>(1);
  const [gasPage, setGasPage] = useState<number>(1);

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

  // Keep the generator inputs in sync with the piso list itself. The list is the source of
  // truth once generated (and the part that survives reloads — localStorage now, cloud restore
  // on a fresh browser), so the inputs must reflect it instead of staying at their initial
  // empty values. Editing an input never changes `pisos`, so this only fires when the list
  // actually changes (generate, manual add/remove, cloud restore) — never mid-typing.
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
      nSotFinal = 0; // ignore basements if no height
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
        // No saved override — sync CSS var default into NETS[].col so the drawing engine
        // (which reads exclusively from NETS[].col) uses the same color as the UI/color
        // picker (which reads from CSS variables). Prevents lluvias defaulting to purple
        // (#8B5CF6 hardcoded in PlanoState.ts) while CSS var says cyan (#22d3ee).
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

  const prevPlansLenRef = useRef(0);
  useEffect(() => {
    const len = plansCtx.plans.length;
    if (len > 0 && len > prevPlansLenRef.current) {
      setSelectedPlanId(plansCtx.plans[len - 1].id);
    } else if (len > 0 && !plansCtx.plans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(plansCtx.plans[0].id);
    } else if (len === 0) {
      setSelectedPlanId(null);
    }
    prevPlansLenRef.current = len;
    // Deliberately keyed off plans.length only (compared against the ref-tracked previous
    // length) to detect "a plan was added" vs. other cases; selectedPlanId is also *set* here,
    // so adding it as a dep would make this effect re-fire on its own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansCtx.plans.length]);

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
    bomPage,
    setBomPage,
    gasPage,
    setGasPage,
    netColors,
    setNetColors,
    planDrag,
    setPlanDrag,
    selectedPlanId,
    setSelectedPlanId,
    selectedPlan,
    selectedPlanUrl,
    setSelectedPlanUrl,
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
