import { useState, useMemo, createContext, useContext, type ReactNode } from "react";

interface BajanteLL { id: string; bajante: string; areaParcial: number; areaAcumulada: number; intensidad: number; coeficienteC: number; R: string; manning: number; diamPropuesto: number }
interface CanalLL { id: string; sector: string; areaParcial: number; areaAcumulada: number; intensidad: number; coeficienteC: number; manning: number; pendiente: number; b: number; h: number; bl: number }
interface RainwaterContextValue {
  bajantesLl: BajanteLL[];
  addBajanteLL: () => void; delBajanteLL: (id: string) => void; updBajanteLL: (id: string, field: string, val: any) => void;
  canalesLl: CanalLL[];
  addCanalLL: () => void; delCanalLL: (id: string) => void; updCanalLL: (id: string, field: string, val: any) => void;
}

const RainwaterContext = createContext<RainwaterContextValue | null>(null);

export function RainwaterProvider({ children }: { children?: ReactNode }) {

const [bajantesLl, setBajantesLl] = useState<BajanteLL[]>([]);

const [canalesLl, setCanalesLl] = useState([
  {id:'CLL-1',sector:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,manning:0,pendiente:0,b:0,h:0,bl:0},
  {id:'CLL-2',sector:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,manning:0,pendiente:0,b:0,h:0,bl:0},
]);

const addCanalLL = () => setCanalesLl(p => [...p, {
  id:`CLL-${p.length+1}`,sector:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,manning:0,pendiente:0,b:0,h:0,bl:0,
}]);
const delCanalLL = (id: string) => setCanalesLl(p => p.filter(t => t.id !== id));
const updCanalLL = (id: string, field: string, val: any) => setCanalesLl(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

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
  canalesLl, addCanalLL, delCanalLL, updCanalLL,
}), [bajantesLl, canalesLl]);

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
