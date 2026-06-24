

export const COEF_HAZEN: number = 150;

export interface DiametroComercialAF {
  nominal: string;
  pulg: number;
  dInt: number;
  dExt: number;
  rde?: number;
  sch?: number;
  V?: number;
}

// ─── Diametros comerciales agua fria PVC (RDE 11/21) ───
export const DIAMETROS_AF: DiametroComercialAF[] = [
  { nominal: '1/2" RDE 9',   pulg: 0.5,    dInt: 16.60, dExt: 12.70,  rde: 9 },
  { nominal: '1/2" RDE 13.5', pulg: 0.5,   dInt: 18.18, dExt: 12.70,  rde: 13.5 },
  { nominal: '3/4" RDE 11',  pulg: 0.75,   dInt: 21.81, dExt: 19.05,  rde: 11 },
  { nominal: '3/4" RDE 21',  pulg: 0.75,   dInt: 23.63, dExt: 19.05,  rde: 21 },
  { nominal: '1" RDE 13.5',  pulg: 1.0,    dInt: 28.48, dExt: 25.40,  rde: 13.5 },
  { nominal: '1" RDE 21',    pulg: 1.0,    dInt: 30.20, dExt: 25.40,  rde: 21 },
  { nominal: '1-1/4" RDE 21', pulg: 1.25,  dInt: 38.14, dExt: 31.75,  rde: 21 },
  { nominal: '1-1/2" RDE 21', pulg: 1.5,   dInt: 43.68, dExt: 38.10,  rde: 21 },
  { nominal: '2" RDE 21',    pulg: 2.0,    dInt: 54.58, dExt: 50.80,  rde: 21 },
  { nominal: '2-1/2" RDE 21', pulg: 2.5,   dInt: 66.07, dExt: 63.50,  rde: 21 },
  { nominal: '3" RDE 21',    pulg: 3.0,    dInt: 80.42, dExt: 76.20,  rde: 21 },
  { nominal: '4" RDE 21',    pulg: 4.0,    dInt: 103.42, dExt: 101.60, rde: 21 },
  { nominal: '6" RDE 21',    pulg: 6.0,    dInt: 152.22, dExt: 152.40, rde: 21 },
];

import { AGUA_CALIENTE } from '../pages/catalog/catalogData';

// ─── Diametros comerciales Agua caliente CPVC (from Catalog) ───
export const DIAMETROS_AC: DiametroComercialAF[] = AGUA_CALIENTE[0].rows.map(r => {
  const match = r.dn.match(/^(.+?)\s*\((.+?)\)$/);
  if (!match) return { nominal: r.dn, pulg: 0, dInt: r.d, dExt: 0 };
  
  const fracStr = match[1];
  const spec = match[2];
  
  let pulg = 0;
  if (fracStr.includes(' ')) {
    const [w, f] = fracStr.split(' ');
    const [n, d] = f.split('/');
    pulg = parseInt(w) + parseInt(n) / parseInt(d);
  } else if (fracStr.includes('/')) {
    const [n, d] = fracStr.split('/');
    pulg = parseInt(n) / parseInt(d);
  } else {
    pulg = parseFloat(fracStr);
  }
  
  const specFixed = spec.replace('CPVC ', '');
  const nominal = `${fracStr}" ${specFixed}`;
  const isRde = spec.includes('RDE');
  const specVal = parseInt(spec.replace(/\D/g, '')) || 0;
  
  return {
    nominal,
    pulg,
    dInt: r.d,
    dExt: 0,
    ...(isRde ? { rde: specVal } : { sch: specVal })
  };
});


// ─── Contadores ───
export const CONTADORES: { diaPulg: number; qn_lps: number }[] = [
  { diaPulg: 0.5, qn_lps: 0.84 },
  { diaPulg: 0.5, qn_lps: 0.92 },
  { diaPulg: 0.75, qn_lps: 1.40 },
  { diaPulg: 0.75, qn_lps: 1.58 },
  { diaPulg: 1.0, qn_lps: 1.96 },
  { diaPulg: 1.0, qn_lps: 2.70 },
  { diaPulg: 1.0, qn_lps: 2.80 },
  { diaPulg: 1.5, qn_lps: 5.60 },
  { diaPulg: 2.0, qn_lps: 8.40 },
];



