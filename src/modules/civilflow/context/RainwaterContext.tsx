import { useState, useMemo, useEffect, createContext, useContext, type ReactNode } from "react";
import { useTramos } from "./TramosContext";
import { usePlans } from "./PlansContext";
import { TRAZOS_PREFIX, ACTIVE_NETS_KEY } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import type { DrawingData } from "../utils/drawingSync";

interface AreaRaw { areaM2?: number }
export interface BajanteLL { id: string; bajante: string; areaParcial: number; areaAcumulada: number; intensidad: number; coeficienteC: number; R: string; manning: number; diamPropuesto: number }
interface CanalLL { id: string; sector: string; areaParcial: number; areaAcumulada: number; intensidad: number; coeficienteC: number; manning: number; pendiente: number; b: number; h: number }
interface RainwaterContextValue {
  bajantesLl: BajanteLL[];
  addBajanteLL: () => void; delBajanteLL: (id: string) => void; updBajanteLL: (id: string, field: string, val: string | number) => void;
  canalesLl: CanalLL[];
  addCanalLL: () => void; delCanalLL: (id: string) => void; updCanalLL: (id: string, field: string, val: string | number) => void;
  conRecolectora: boolean; setConRecolectora: (v: boolean) => void;
}

const RainwaterContext = createContext<RainwaterContextValue | null>(null);

export function RainwaterProvider({ children }: { children?: ReactNode }) {

const { tramosLl } = useTramos();
const { plans } = usePlans();

const [bajantesLl, setBajantesLl] = useState<BajanteLL[]>([]);

const [canalesLl, setCanalesLl] = useState<CanalLL[]>([]);

const [conRecolectora, setConRecolectora] = useState<boolean>(() => {
  try {
    const saved = loadFromStorage<string[]>(ACTIVE_NETS_KEY, [] as unknown as string[]);
    if (saved && Array.isArray(saved)) return saved.includes('recolectora');
  } catch { /* ignore */ }
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

const addCanalLL = () => setCanalesLl(p => [...p, {
  id:`CLL-${p.length+1}`,sector:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,manning:0,pendiente:0,b:0,h:0,
}]);
const delCanalLL = (id: string) => setCanalesLl(p => p.filter(t => t.id !== id));
const updCanalLL = (id: string, field: string, val: string | number) => setCanalesLl(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

// Auto-populate canal rows from drawn 'll' ramales (net==='ll', non-bajante), using the
// same floor-area lookup pattern as ChequeoBajantesLluvias, instead of starting from zeros.
const areaAcumMap = useMemo(() => {
  const map: Record<string, number> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<(DrawingData & { areas?: AreaRaw[] }) | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData & { areas?: AreaRaw[] } = raw as DrawingData & { areas?: AreaRaw[] };
    if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { continue; } }
    const totalArea = (data.areas || []).reduce((s, a) => s + (a.areaM2 || 0), 0);
    map[String(plan.nivel)] = totalArea;
  }
  return map;
}, [plans]);

const drawingCanales = useMemo(() => tramosLl.filter((t) => !t.esBajante), [tramosLl]);

const canalesLlAuto = useMemo(() => {
  const manualMap = new Map<string, CanalLL>();
  for (const c of canalesLl) manualMap.set(c.sector || c.id, c);
  const usedManual = new Set<string>();
  const out: CanalLL[] = [];

  for (const d of drawingCanales) {
    const sector = d.label || d.id;
    const manual = manualMap.get(sector);
    if (manual) usedManual.add(manual.sector || manual.id);
    const areaAcum = areaAcumMap[String(d.piso)] || manual?.areaAcumulada || 0;
    out.push({
      id: 'c_' + (d._key || d.id),
      sector,
      areaParcial: manual?.areaParcial || areaAcum,
      areaAcumulada: areaAcum,
      intensidad: manual?.intensidad ?? 100,
      coeficienteC: manual?.coeficienteC ?? 0.0278,
      manning: manual?.manning ?? 0.011,
      pendiente: manual?.pendiente ?? 0,
      b: manual?.b ?? 0,
      h: manual?.h ?? 0,
    });
  }

  for (const m of canalesLl) {
    const key = m.sector || m.id;
    if (usedManual.has(key)) continue;
    out.push(m);
  }

  return out;
}, [drawingCanales, canalesLl, areaAcumMap]);

const addBajanteLL = () => setBajantesLl(p => [...p, {
  id:`BLL-${p.length+1}`,bajante:'',areaParcial:0,areaAcumulada:0,intensidad:100,coeficienteC:0.0278,R:'',manning:0,diamPropuesto:0,
}]);
const delBajanteLL = (id: string) => setBajantesLl(p => p.filter(t => t.id !== id));
const updBajanteLL = (id: string, field: string, val: string | number) => setBajantesLl(p => {
  const exists = p.some(t => t.id === id || (t.bajante && t.bajante === id));
  if (!exists && id) {
    return [...p, {
      id: `BLL-${p.length + 1}`,
      bajante: id,
      areaParcial: 0,
      areaAcumulada: 0,
      intensidad: field === 'intensidad' ? (val as number) : 100,
      coeficienteC: 0.0278,
      R: field === 'R' ? (val as string) : '',
      manning: field === 'manning' ? (val as number) : 0,
      diamPropuesto: field === 'diamPropuesto' ? (val as number) : 0,
    }];
  }
  return p.map(t => (t.id === id || (t.bajante && t.bajante === id)) ? { ...t, [field]: val } : t);
});

const value = useMemo(() => ({
  bajantesLl, addBajanteLL, delBajanteLL, updBajanteLL,
  canalesLl: canalesLlAuto, addCanalLL, delCanalLL, updCanalLL,
  conRecolectora, setConRecolectora,
}), [bajantesLl, canalesLlAuto, conRecolectora]);

return (
<RainwaterContext.Provider value={value}>
{children}
</RainwaterContext.Provider>
);
}

export function useRainwater() {
  const ctx = useContext(RainwaterContext);
  if (!ctx) throw new Error('useRainwater must be used within RainwaterProvider');
  return ctx;
}
