import { useState, createContext, useContext, type ReactNode } from "react";

const RainwaterContext = createContext<any>(null);

export function RainwaterProvider({ children }: { children: ReactNode }) {

const [bajantesLl, setBajantesLl] = useState([
{id:'BLL-1',bajante:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,R:'',manning:0,diamPropuesto:0},
{id:'BLL-2',bajante:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,R:'',manning:0,diamPropuesto:0},
]);

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
id:`BLL-${p.length+1}`,bajante:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,R:'',manning:0,diamPropuesto:0,
}]);
const delBajanteLL = (id: string) => setBajantesLl(p => p.filter(t => t.id !== id));
const updBajanteLL = (id: string, field: string, val: any) => setBajantesLl(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

return (
<RainwaterContext.Provider value={{
bajantesLl, addBajanteLL, delBajanteLL, updBajanteLL,
canalesLl, addCanalLL, delCanalLL, updCanalLL,
}}>
{children}
</RainwaterContext.Provider>
);
}

export function useRainwater() {
  const ctx = useContext(RainwaterContext);
  if (!ctx) throw new Error("useRainwater must be used within <RainwaterProvider>");
  return ctx;
}
