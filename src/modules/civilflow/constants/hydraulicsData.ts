import { diamPulgFromLabel } from '../utils/diamInchesFromLabel.ts';
import { AGUA_CALIENTE } from '../pages/catalog/catalogData.ts';

export interface DiametroComercialAF {
  nominal: string;
  pulg: number;
  dInt: number;
  dExt: number;
  rde?: number;
  sch?: number;
  V?: number;
}

export const DIAMETROS_AF: DiametroComercialAF[] = [
  { nominal: '1/2" RDE 9', pulg: 0.5, dInt: 16.6, dExt: 12.7, rde: 9 },
  { nominal: '1/2" RDE 13.5', pulg: 0.5, dInt: 18.18, dExt: 12.7, rde: 13.5 },
  { nominal: '3/4" RDE 11', pulg: 0.75, dInt: 21.81, dExt: 19.05, rde: 11 },
  { nominal: '3/4" RDE 21', pulg: 0.75, dInt: 23.63, dExt: 19.05, rde: 21 },
  { nominal: '1" RDE 13.5', pulg: 1.0, dInt: 28.48, dExt: 25.4, rde: 13.5 },
  { nominal: '1" RDE 21', pulg: 1.0, dInt: 30.2, dExt: 25.4, rde: 21 },
  { nominal: '1-1/4" RDE 21', pulg: 1.25, dInt: 38.14, dExt: 31.75, rde: 21 },
  { nominal: '1-1/2" RDE 21', pulg: 1.5, dInt: 43.68, dExt: 38.1, rde: 21 },
  { nominal: '2" RDE 21', pulg: 2.0, dInt: 54.58, dExt: 50.8, rde: 21 },
  { nominal: '2-1/2" RDE 21', pulg: 2.5, dInt: 66.07, dExt: 63.5, rde: 21 },
  { nominal: '3" RDE 21', pulg: 3.0, dInt: 80.42, dExt: 76.2, rde: 21 },
  { nominal: '4" RDE 21', pulg: 4.0, dInt: 103.42, dExt: 101.6, rde: 21 },
  { nominal: '6" RDE 21', pulg: 6.0, dInt: 152.22, dExt: 152.4, rde: 21 },
];

export const DIAMETROS_AC: DiametroComercialAF[] = AGUA_CALIENTE[0].rows.map((r) => {
  const match = r.dn.match(/^(.+?)\s*\((.+?)\)$/);
  if (!match) return { nominal: r.dn, pulg: 0, dInt: r.d, dExt: 0 };

  const fracStr = match[1];
  const spec = match[2];

  const pulg = diamPulgFromLabel(fracStr);

  const specFixed = spec.replace('CPVC ', '');
  const nominal = `${fracStr}" ${specFixed}`;
  const isRde = spec.includes('RDE');
  const specVal = parseInt(spec.replace(/\D/g, '')) || 0;

  return {
    nominal,
    pulg,
    dInt: r.d,
    dExt: 0,
    ...(isRde ? { rde: specVal } : { sch: specVal }),
  };
});
