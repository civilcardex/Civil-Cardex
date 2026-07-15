import { AGUA_CALIENTE, VENTILACION } from '../pages/catalog/catalogData';
import { diamPulgFromLabel } from '../utils/diamPulgFromLabel';

const MATS_RAW = {
  af: ['PVC-PR','CPVC','Cobre rígido','Polipropileno PP-R'],
  ac: ['PVC-PR','CPVC','Cobre rígido','Polipropileno PP-R','PEX'],
  san: ['PVC-S','Novatec','Hierro fundido','Concreto'],
  ll: ['PVC-S','Novatec','Hierro fundido','Concreto','Gres cerámico'],
  vent: ['PVC-V'],
  gas: ['PE al PE','Cobre rígido','A.C.','Acero HG','Polipropileno PP-R'],
  rci: ['A.C. SCH 40','A.C. SCH 10','Acero HG','CPVC CPVC-CI','PVC C900 RDE 14'],
};
export const MATS_DEFAULT = Object.fromEntries(Object.entries(MATS_RAW).map(([k,v])=>[k,v.map((o,i)=>({id:k+i,val:o}))]));

export const MAT_LONGFORM = {
  'PVC-PR': 'PVC Presión',
  'PVC-S': 'PVC Sanitario',
  'PVC C900 RDE 14': 'PVC C900 RDE 14',
  'PVC C900 RDE 18': 'PVC C900 RDE 18',
  'CPVC': 'CPVC (cloruro de polivinilo clorado)',
  'CPVC CPVC-CI': 'CPVC contra incendio',
  'Cobre rígido': 'Cobre rígido',
  'Cobre flexible': 'Cobre flexible',
  'Polipropileno PP-R': 'Polipropileno PP-R (PP-R)',
  'PEX': 'PEX (polietileno reticulado)',
  'PE al PE': 'Polietileno (PE)',
  'Polietileno': 'Polietileno (PE)',
  'PEAD': 'Polietileno alta densidad (PEAD)',
  'A.C.': 'Acero al carbono',
  'A.C. SCH 10': 'Acero al carbono SCH 10',
  'A.C. SCH 40': 'Acero al carbono SCH 40',
  'Acero HG': 'Acero galvanizado (HG)',
  'Novatec': 'Novatec (PVC Novafort)',
  'Hierro fundido': 'Hierro fundido',
  'Concreto': 'Concreto',
  'Gres cerámico': 'Gres cerámico',
};

export function matLongName(short: string) {
  if (!short) return '—';
  return (MAT_LONGFORM as Record<string, string>)[short] || short;
}

export const MAT_MANNING = {
  'PVC-S': 0.009,
  'PVC-V': 0.009,
  'PVC-PR': 0.009,
  'PVC C900 RDE 14': 0.009,
  'PVC C900 RDE 18': 0.009,
  'Novatec': 0.009,
  'CPVC': 0.009,
  'Hierro fundido': 0.013,
  'Concreto': 0.013,
  'Gres cerámico': 0.013,
  'Cobre rígido': 0.011,
  'Cobre flexible': 0.011,
  'Polipropileno PP-R': 0.009,
  'PEX': 0.009,
  'PE al PE': 0.009,
  'Polietileno': 0.009,
  'PEAD': 0.009,
  'A.C.': 0.015,
  'A.C. SCH 10': 0.012,
  'A.C. SCH 40': 0.012,
  'Acero HG': 0.015,
};

export function matManning(short: string) {
  if (!short) return null;
  return (MAT_MANNING as Record<string, number>)[short] ?? null;
}

export const MAT_HAZEN_C: Record<string, number> = {
  'PVC-S': 150,
  'PVC-V': 150,
  'PVC-PR': 150,
  'PVC C900 RDE 14': 150,
  'PVC C900 RDE 18': 150,
  'Novatec': 150,
  'CPVC': 150,
  'CPVC CPVC-CI': 150,
  'Hierro fundido': 100,
  'Concreto': 100,
  'Gres cerámico': 100,
  'Cobre rígido': 140,
  'Cobre flexible': 130,
  'Polipropileno PP-R': 140,
  'PEX': 140,
  'PE al PE': 150,
  'Polietileno': 150,
  'PEAD': 150,
  'A.C.': 120,
  'A.C. SCH 10': 120,
  'A.C. SCH 40': 120,
  'Acero HG': 120,
};

export function matHazenC(short: string): number | null {
  if (!short) return null;
  return (MAT_HAZEN_C as Record<string, number>)[short] ?? null;
}

export const DIAM_BAN=[
  {pulg:1.5, mm:42.68, nom:'1-1/2"'},
  {pulg:2, mm:54.48, nom:'2"'},
  {pulg:3, mm:76.20, nom:'3"'},
  {pulg:4, mm:107.70, nom:'4"'},
  {pulg:6, mm:160.04, nom:'6"'},
];

export const DIAM_OPTIONS = DIAM_BAN.map(d => ({pulg: d.pulg, label: d.nom, mm: d.mm}));

export const DIAM_VENT = (VENTILACION[0]?.rows || []).map((r: any) => ({
  pulg: diamPulgFromLabel(r.dn),
  mm: r.d,
  nom: r.dn
}));

export const DIAM_BY_MAT: Record<string, Array<{ n: string }>> = {
  'PVC-S': [
    { n: '1-1/2" — 42.7 mm' }, { n: '2" — 54.5 mm' }, { n: '3" — 76.2 mm' },
    { n: '4" — 107.7 mm' }, { n: '6" — 160.0 mm' },
  ],
  'PVC-PR': [
    { n: '1/2" RDE 9 — 16.6 mm' }, { n: '1/2" RDE 13.5 — 18.18 mm' },
    { n: '3/4" RDE 11 — 21.81 mm' }, { n: '3/4" RDE 21 — 23.63 mm' },
    { n: '1" RDE 13.5 — 28.48 mm' }, { n: '1" RDE 21 — 30.20 mm' },
    { n: '1-1/4" RDE 21 — 38.14 mm' }, { n: '1-1/2" RDE 21 — 43.68 mm' },
    { n: '2" RDE 21 — 54.58 mm' }, { n: '2-1/2" RDE 21 — 66.07 mm' },
    { n: '3" RDE 21 — 80.42 mm' }, { n: '4" RDE 21 — 103.42 mm' },
    { n: '6" RDE 21 — 152.22 mm' },
  ],
  'CPVC': AGUA_CALIENTE[0].rows.map(r => {
    const match = r.dn.match(/^(.+?)\s*\((.+?)\)$/);
    if (!match) return { n: r.dn };
    const specFixed = match[2].replace('CPVC ', '');
    return { n: `${match[1]}" ${specFixed} — ${r.d.toFixed(1)} mm` };
  }),
  'Cobre rígido': [
    { n: '1/2" — 12.7 mm' }, { n: '3/4" — 19.1 mm' }, { n: '1" — 25.4 mm' },
    { n: '1-1/4" — 31.8 mm' }, { n: '1-1/2" — 38.1 mm' }, { n: '2" — 50.8 mm' },
  ],
  'Cobre flexible': [
    { n: '1/2" — 12.7 mm' }, { n: '3/4" — 19.1 mm' }, { n: '1" — 25.4 mm' },
    { n: '1-1/4" — 31.8 mm' }, { n: '1-1/2" — 38.1 mm' }, { n: '2" — 50.8 mm' },
  ],
  'Novatec': [
    { n: '4" — 110.0 mm' }, { n: '6" — 160.0 mm' }, { n: '8" — 200.0 mm' },
    { n: '10" — 250.0 mm' }, { n: '12" — 315.0 mm' },
  ],
  'Hierro fundido': [
    { n: '2" — 50.0 mm' }, { n: '3" — 80.0 mm' }, { n: '4" — 100.0 mm' },
    { n: '6" — 150.0 mm' },
  ],
  'Concreto': [
    { n: '6" — 150.0 mm' }, { n: '8" — 200.0 mm' }, { n: '10" — 250.0 mm' },
    { n: '12" — 300.0 mm' },
  ],
  'Gres cerámico': [
    { n: '4" — 100.0 mm' }, { n: '6" — 150.0 mm' },
  ],
  'Polipropileno PP-R': [
    { n: '1/2" — 20.0 mm' }, { n: '3/4" — 25.0 mm' }, { n: '1" — 32.0 mm' },
    { n: '1-1/4" — 40.0 mm' }, { n: '1-1/2" — 50.0 mm' }, { n: '2" — 63.0 mm' },
  ],
  'PEX': [
    { n: '1/2" — 16.0 mm' }, { n: '3/4" — 20.0 mm' }, { n: '1" — 25.0 mm' },
  ],
  'A.C. SCH 40': [
    { n: '1/2" — 15.8 mm' }, { n: '3/4" — 21.0 mm' }, { n: '1" — 26.6 mm' },
    { n: '1-1/4" — 35.1 mm' }, { n: '1-1/2" — 40.9 mm' }, { n: '2" — 52.5 mm' },
    { n: '2-1/2" — 62.7 mm' }, { n: '3" — 77.9 mm' }, { n: '4" — 102.3 mm' },
    { n: '6" — 154.1 mm' }, { n: '8" — 202.7 mm' },
  ],
  'A.C. SCH 10': [
    { n: '2" — 56.0 mm' }, { n: '2-1/2" — 68.8 mm' }, { n: '3" — 85.4 mm' },
    { n: '4" — 109.0 mm' }, { n: '6" — 163.8 mm' }, { n: '8" — 210.9 mm' },
  ],
  'Acero HG': [
    { n: '1/2" — 15.8 mm' }, { n: '3/4" — 21.0 mm' }, { n: '1" — 26.6 mm' },
    { n: '1-1/4" — 35.1 mm' }, { n: '1-1/2" — 40.9 mm' }, { n: '2" — 52.5 mm' },
    { n: '2-1/2" — 62.7 mm' }, { n: '3" — 77.9 mm' }, { n: '4" — 102.3 mm' },
  ],
  'CPVC CPVC-CI': [
    { n: '3/4" — 22.2 mm' }, { n: '1" — 28.6 mm' }, { n: '1-1/4" — 34.9 mm' },
    { n: '1-1/2" — 41.3 mm' }, { n: '2" — 54.0 mm' }, { n: '2-1/2" — 66.7 mm' },
    { n: '3" — 79.4 mm' },
  ],
  'PVC C900 RDE 14': [
    { n: '4" — 114.3 mm' }, { n: '6" — 168.3 mm' }, { n: '8" — 218.4 mm' },
    { n: '10" — 272.8 mm' }, { n: '12" — 323.9 mm' },
  ],
  'PE al PE': [
    { n: '1/2" — 16.0 mm' }, { n: '3/4" — 20.0 mm' }, { n: '1" — 25.0 mm' },
    { n: '1-1/4" — 32.0 mm' }, { n: '1-1/2" — 40.0 mm' }, { n: '2" — 50.0 mm' },
    { n: '2-1/2" — 63.0 mm' }, { n: '3" — 75.0 mm' }, { n: '4" — 90.0 mm' },
    { n: '6" — 110.0 mm' },
  ],
};
