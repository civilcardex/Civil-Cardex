import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';

interface Piso {
  id: string | number;
  n: number;
  npt: number | string;
  ok: boolean;
  tipo: 'piso' | 'sotano' | 'cubierta';
}

export function useFloorGenerator(pisos: Piso[], setPisos: Dispatch<SetStateAction<Piso[]>>) {
  const [nSotanos, setNSotanos] = useState<string>('');
  const [nPisos, setNPisos] = useState<string>('');
  const [altPiso, setAltPiso] = useState<number>(0);
  const [altSotano, setAltSotano] = useState<number>(0);
  const [nptPiso1, setNptPiso1] = useState<number>(0);
  const [conCubierta, setConCubierta] = useState<boolean>(false);

  const generarPisos = useCallback(() => {
    const nSot = Number(nSotanos) || 0;
    const nPis = Number(nPisos) || 0;
    const hPis = Number(altPiso) || 0;
    const hSot = Number(altSotano) || 0;
    const npt1 = Number(nptPiso1) || 0;
    const l: Piso[] = [];
    for (let i = nSot; i >= 1; i--)
      l.push({ id: 's' + i, n: -i, npt: +((npt1 - (i * hSot)).toFixed(2)), ok: false, tipo: 'sotano' });
    for (let i = 1; i <= nPis; i++)
      l.push({ id: 'p' + i, n: i, npt: +((npt1 + ((i - 1) * hPis)).toFixed(2)), ok: false, tipo: 'piso' });
    if (conCubierta)
      l.push({ id: 'cub', n: 99, npt: +((npt1 + (nPis * hPis)).toFixed(2)), ok: false, tipo: 'cubierta' });
    setPisos(l);
  }, [nSotanos, nPisos, altPiso, altSotano, nptPiso1, conCubierta, setPisos]);

  const addPiso = useCallback(() => setPisos(prev => {
    const pisosPOS = prev.filter(p => p.tipo === 'piso').sort((a, b) => b.n - a.n);
    const maxN = pisosPOS.length ? Math.max(...pisosPOS.map(p => p.n)) : 0;
    const hPis = Number(altPiso) || 0;
    const lastNpt = pisosPOS.length ? Number(pisosPOS[0].npt) || 0 : 0;
    const newNpt = lastNpt > 0 ? +((lastNpt + hPis).toFixed(2)) : '';
    const newPiso: Piso = { id: crypto.randomUUID(), n: maxN + 1, npt: newNpt, ok: false, tipo: 'piso' };
    const cubIx = prev.findIndex(p => p.tipo === 'cubierta');
    const insertAt = cubIx >= 0 ? cubIx + 1 : 0;
    const copy = [...prev];
    copy.splice(insertAt, 0, newPiso);
    return copy;
  }), [setPisos, altPiso]);

  const addSotano = useCallback(() => setPisos(prev => {
    const pisoNEG = prev.filter(p => p.tipo === 'sotano').sort((a, b) => a.n - b.n);
    const minN = pisoNEG.length ? Math.min(...pisoNEG.map(p => p.n)) : 0;
    const hSot = Number(altSotano) || 0;
    const lastNpt = pisoNEG.length ? Number(pisoNEG[0].npt) || 0 : 0;
    const newNpt = lastNpt < 0 ? +((lastNpt - hSot).toFixed(2)) : '';
    return [...prev, { id: crypto.randomUUID(), n: minN - 1, npt: newNpt, ok: false, tipo: 'sotano' } as Piso];
  }), [setPisos, altSotano]);

  return {
    nSotanos, setNSotanos,
    nPisos, setNPisos,
    altPiso, setAltPiso,
    altSotano, setAltSotano,
    nptPiso1, setNptPiso1,
    conCubierta, setConCubierta,
    generarPisos, addPiso, addSotano
  };
}
