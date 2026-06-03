import { useState, useCallback } from 'react';

export function useFloorGenerator(pisos, setPisos) {
  const [nSotanos, setNSotanos] = useState('');
  const [nPisos, setNPisos] = useState('');
  const [altPiso, setAltPiso] = useState(0);
  const [altSotano, setAltSotano] = useState(0);
  const [nptPiso1, setNptPiso1] = useState(0);
  const [conCubierta, setConCubierta] = useState(false);

  const generarPisos = useCallback(() => {
    const nSot = Number(nSotanos) || 0;
    const nPis = Number(nPisos) || 0;
    const hPis = Number(altPiso) || 0;
    const hSot = Number(altSotano) || 0;
    const npt1 = Number(nptPiso1) || 0;
    const l = [];
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
    const newPiso = { id: Date.now(), n: maxN + 1, npt: newNpt, ok: false, tipo: 'piso' };
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
    return [...prev, { id: Date.now(), n: minN - 1, npt: newNpt, ok: false, tipo: 'sotano' }];
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
