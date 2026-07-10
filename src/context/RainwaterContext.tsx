import { useState, useMemo, useEffect, createContext, useContext, type ReactNode } from "react";
import { useTramos } from "./TramosContext";
import { usePlans } from "./PlansContext";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";

interface BajanteLL { id: string; bajante: string; areaParcial: number; areaAcumulada: number; intensidad: number; coeficienteC: number; R: string; manning: number; diamPropuesto: number }
interface CanalLL { id: string; sector: string; areaParcial: number; areaAcumulada: number; intensidad: number; coeficienteC: number; manning: number; pendiente: number; b: number; h: number; bl: number }
interface RecolectoraData { b: number; h: number; pendiente: number }
interface RainwaterContextValue {
  bajantesLl: BajanteLL[];
  addBajanteLL: () => void; delBajanteLL: (id: string) => void; updBajanteLL: (id: string, field: string, val: any) => void;
  canalesLl: CanalLL[];
  addCanalLL: () => void; delCanalLL: (id: string) => void; updCanalLL: (id: string, field: string, val: any) => void;
  conRecolectora: boolean; setConRecolectora: (v: boolean) => void;
  recolectora: RecolectoraData; updRecolectora: (field: keyof RecolectoraData, val: number) => void;
}

const RainwaterContext = createContext<RainwaterContextValue | null>(null);

export function RainwaterProvider({ children }: { children?: ReactNode }) {

const { tramosLl } = useTramos();
const { plans } = usePlans();

const [bajantesLl, setBajantesLl] = useState<BajanteLL[]>([]);

const [canalesLl, setCanalesLl] = useState<CanalLL[]>([]);

const [conRecolectora, setConRecolectora] = useState<boolean>(() => {
  try {
    const saved = loadFromStorage<string[]>('active_nets', [] as unknown as string[]);
    if (saved && Array.isArray(saved)) return saved.includes('recolectora');
  } catch { /* ignore */ }
  return false;
});
const [recolectora, setRecolectora] = useState<RecolectoraData>({ b: 0, h: 0, pendiente: 0 });
const updRecolectora = (field: keyof RecolectoraData, val: number) => setRecolectora(p => ({ ...p, [field]: val }));

useEffect(() => {
  const handler = (e: Event) => {
    const nets = (e as CustomEvent).detail;
    if (Array.isArray(nets)) setConRecolectora(nets.includes('recolectora'));
  };
  window.addEventListener('civilflow_nets_changed', handler);
  return () => window.removeEventListener('civilflow_nets_changed', handler);
}, []);

const addCanalLL = () => setCanalesLl(p => [...p, {
  id:`CLL-${p.length+1}`,sector:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,manning:0,pendiente:0,b:0,h:0,bl:0,
}]);
const delCanalLL = (id: string) => setCanalesLl(p => p.filter(t => t.id !== id));
const updCanalLL = (id: string, field: string, val: any) => setCanalesLl(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

// Auto-populate canal rows from drawn 'll' ramales (net==='ll', non-bajante), using the
// same floor-area lookup pattern as ChequeoBajantesLluvias, instead of starting from zeros.
const areaAcumMap = useMemo(() => {
  const map: Record<string, number> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw as Record<string, any>;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { continue; } }
    const totalArea = (data.areas || []).reduce((s: number, a: any) => s + (a.areaM2 || 0), 0);
    map[String(plan.nivel)] = totalArea;
  }
  return map;
}, [plans]);

const drawingCanales = useMemo(() => tramosLl.filter((t: any) => !t.esBajante), [tramosLl]);

const canalesLlAuto = useMemo(() => {
  const manualMap = new Map<string, CanalLL>();
  for (const c of canalesLl) manualMap.set(c.sector || c.id, c);
  const usedManual = new Set<string>();
  const out: CanalLL[] = [];

  for (const d of drawingCanales as any[]) {
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
      bl: manual?.bl ?? 0,
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
const updBajanteLL = (id: string, field: string, val: any) => setBajantesLl(p => {
  const exists = p.some(t => t.id === id || (t.bajante && t.bajante === id));
  if (!exists && id) {
    return [...p, {
      id: `BLL-${p.length + 1}`,
      bajante: id,
      areaParcial: 0,
      areaAcumulada: 0,
      intensidad: field === 'intensidad' ? val : 100,
      coeficienteC: 0.0278,
      R: field === 'R' ? val : '',
      manning: field === 'manning' ? val : 0,
      diamPropuesto: field === 'diamPropuesto' ? val : 0,
    }];
  }
  return p.map(t => (t.id === id || (t.bajante && t.bajante === id)) ? { ...t, [field]: val } : t);
});

const value = useMemo(() => ({
  bajantesLl, addBajanteLL, delBajanteLL, updBajanteLL,
  canalesLl: canalesLlAuto, addCanalLL, delCanalLL, updCanalLL,
  conRecolectora, setConRecolectora,
  recolectora, updRecolectora,
}), [bajantesLl, canalesLlAuto, conRecolectora, recolectora]);

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
