import { useState, useRef, useMemo, useEffect } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import { useTramos } from "../context/TramosContext";
import { useProject } from "../context/ProjectContext";
import { useApparatus } from "../context/ApparatusContext";
import { usePlans } from "../context/PlansContext";
import { REDES } from "../constants";
import { parseDecimalInput, parseIntInput } from "../utils/parseDecimal";
import { NETS } from "../lib/PlanoEngine";
import { loadFromStorage, saveToStorage } from "../services/storageService";

export function useWorkAreaState() {
  const tramosCtx = useTramos();
  const projectCtx = useProject();
  const apparatusCtx = useApparatus();
  const plansCtx = usePlans();

  const [tab, setTab] = useState<string>('info');

  useEffect(() => {
    const openTab = sessionStorage.getItem('openTab');
    if (openTab) {
      setTab(openTab);
      sessionStorage.removeItem('openTab');
    }
  }, []);

  const [redes, setRedes] = useState<Set<string>>(() => {
    const saved = loadFromStorage('active_nets', null);
    if (saved && Array.isArray(saved)) return new Set(saved);
    return new Set(['san', 'll']);
  });

  const redesActivas = useMemo(() => REDES.filter(r => redes.has(r.id)), [redes]);

  useEffect(() => {
    saveToStorage('active_nets', [...redes]);
    window.dispatchEvent(new CustomEvent('civilflow_nets_changed', { detail: [...redes] }));
  }, [redes]);

  const [redActiva, setRedActiva] = useState<string>('san');
  const [sanPage, setSanPage] = useState<number>(1);
  const [llPage, setLlPage] = useState<number>(1);
  const [afPage, setAfPage] = useState<number>(1);
  const [acPage, setAcPage] = useState<number>(1);
  const [bomPage, setBomPage] = useState<number>(1);
  const [gasPage, setGasPage] = useState<number>(1);

  const [netColors, setNetColors] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    REDES.forEach(r => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(`--${r.id}`).trim();
      init[r.id] = v || '#666';
    });
    return init;
  });

  const [planDrag, setPlanDrag] = useState<boolean>(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const selectedPlan = useMemo(() => plansCtx.plans.find((p: any) => p.id === selectedPlanId) || null, [plansCtx.plans, selectedPlanId]);
  const [selectedPlanUrl, setSelectedPlanUrl] = useState<string | null>(null);
  const pendingPlanos = useMemo(() => plansCtx.plans.filter((p: any) => p.status === 'pending'), [plansCtx.plans]);
  const confirmedPlanos = useMemo(() => plansCtx.plans.filter((p: any) => p.status === 'confirmed'), [plansCtx.plans]);

  const [nSotanos, setNSotanos] = useState<string>('');
  const [nPisos, setNPisos] = useState<string>('');
  const [altPiso, setAltPiso] = useState<string>('');
  const [altSotano, setAltSotano] = useState<string>('');
  const [nptPiso1, setNptPiso1] = useState<string>('');
  const [conCubierta, setConCubierta] = useState<boolean>(false);

  const generarPisos = () => {
    const MAX = 50;
    const nSot = Math.min(parseIntInput(nSotanos) || 0, MAX);
    const nPis = Math.min(parseIntInput(nPisos) || 0, MAX);
    const hPis = parseDecimalInput(altPiso) || 0;
    const hSot = parseDecimalInput(altSotano) || 0;
    const npt1 = parseDecimalInput(nptPiso1) || 0;
    const l: any[] = [];
    for (let i = nSot; i >= 1; i--)
      l.push({ id: 's' + i, n: -i, npt: +((npt1 - (i * hSot)).toFixed(2)), ok: false, tipo: 'sotano' });
    for (let i = 1; i <= nPis; i++)
      l.push({ id: 'p' + i, n: i, npt: +((npt1 + ((i - 1) * hPis)).toFixed(2)), ok: false, tipo: 'piso' });
    if (conCubierta)
      l.push({ id: 'cub', n: 99, npt: +((npt1 + (nPis * hPis)).toFixed(2)), ok: false, tipo: 'cubierta' });
    projectCtx.setPisos(l);
  };

  const onIntChange = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/[^\d]/g, '');
    setter(onlyDigits);
  };
  const onIntBlur = (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => {
    const v = parseIntInput(e.target.value);
    if (v !== null) setter(String(v));
  };
  const onDecChange = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const normalized = e.target.value.replace(/,/g, '.');
    setter(normalized);
  };
  const onDecBlur = (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => {
    const v = parseDecimalInput(e.target.value);
    if (v !== null) {
      const s = String(v);
      setter(s);
    }
  };

  const delPiso = (id: string | number) => projectCtx.setPisos((prev: any[]) => prev.filter(p => p.id !== id));

  const addPiso = () => projectCtx.setPisos((prev: any[]) => {
    const pisosPOS = prev.filter(p => p.tipo === 'piso').sort((a, b) => b.n - a.n);
    const maxN = pisosPOS.length ? Math.max(...pisosPOS.map(p => p.n)) : 0;
    const hPis = parseFloat(altPiso) || 0;
    const lastNpt = pisosPOS.length ? parseFloat(pisosPOS[0].npt) || 0 : 0;
    const newNpt = lastNpt > 0 ? +((lastNpt + hPis).toFixed(2)) : '';
    const newPiso = { id: Date.now(), n: maxN + 1, npt: newNpt, ok: false, tipo: 'piso' };
    const cubIx = prev.findIndex(p => p.tipo === 'cubierta');
    const insertAt = cubIx >= 0 ? cubIx + 1 : 0;
    const copy = [...prev];
    copy.splice(insertAt, 0, newPiso);
    return copy;
  });

  const addSotano = () => projectCtx.setPisos((prev: any[]) => {
    const pisoNEG = prev.filter(p => p.tipo === 'sotano').sort((a, b) => a.n - b.n);
    const minN = pisoNEG.length ? Math.min(...pisoNEG.map(p => p.n)) : 0;
    const hSot = parseFloat(altSotano) || 0;
    const lastNpt = pisoNEG.length ? parseFloat(pisoNEG[0].npt) || 0 : 0;
    const newNpt = lastNpt < 0 ? +((lastNpt - hSot).toFixed(2)) : '';
    const newSotano = { id: Date.now(), n: minN - 1, npt: newNpt, ok: false, tipo: 'sotano' };
    return [...prev, newSotano];
  });

  useEffect(() => {
    REDES.forEach(r => {
      const saved = loadFromStorage('net_' + r.id, null);
      if (saved && typeof saved === 'string') {
        document.documentElement.style.setProperty('--' + r.id, saved);
        try {
          const nets = NETS;
          const net = nets.find((n: any) => n.id === r.id);
          if (net) net.col = saved;
        } catch (e) { console.error(e); }
      }
    });
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      const url = URL.createObjectURL(selectedPlan.file);
      setSelectedPlanUrl(url);
      return () => { URL.revokeObjectURL(url); setSelectedPlanUrl(null) };
    } else {
      setSelectedPlanUrl(null);
    }
  }, [selectedPlan]);

  useEffect(() => {
    if (plansCtx.plans.length > 0 && !plansCtx.plans.some((p: any) => p.id === selectedPlanId)) {
      setSelectedPlanId(plansCtx.plans[0].id);
    } else if (plansCtx.plans.length === 0) {
      setSelectedPlanId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansCtx.plans.length]);

  const fileRef = useRef<HTMLInputElement>(null);

  return {
    ...tramosCtx,
    ...projectCtx,
    ...apparatusCtx,
    ...plansCtx,

    tab, setTab,
    redes, setRedes,
    redesActivas,
    redActiva, setRedActiva,
    sanPage, setSanPage,
    llPage, setLlPage,
    afPage, setAfPage,
    acPage, setAcPage,
    bomPage, setBomPage,
    gasPage, setGasPage,
    netColors, setNetColors,
    planDrag, setPlanDrag,
    selectedPlanId, setSelectedPlanId,
    selectedPlan,
    selectedPlanUrl, setSelectedPlanUrl,
    pendingPlanos,
    confirmedPlanos,
    nSotanos, setNSotanos,
    nPisos, setNPisos,
    altPiso, setAltPiso,
    altSotano, setAltSotano,
    nptPiso1, setNptPiso1,
    conCubierta, setConCubierta,
    generarPisos,
    onIntChange, onIntBlur, onDecChange, onDecBlur,
    delPiso, addPiso, addSotano,
    fileRef,
  };
}
