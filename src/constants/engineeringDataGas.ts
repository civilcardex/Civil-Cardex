export const GAS = [
  { mat: 'Acero galvanizado', K: 57.50, rows: [
    { dn: '⅜"', d: 9.50 }, { dn: '½"', d: 12.70 }, { dn: '¾"', d: 19.00 },
    { dn: '1"', d: 25.40 }, { dn: '2"', d: 50.80 },
  ]},
  { mat: 'Acero al carbono', K: 57.50, rows: [
    { dn: '⅜"', d: 10.00 }, { dn: '½"', d: 13.40 }, { dn: '¾"', d: 19.50 },
    { dn: '1"', d: 26.00 }, { dn: '2"', d: 52.00 },
  ]},
  { mat: 'Cobre rígido', K: 54.20, rows: [
    { dn: '⅜"', d: 8.70 }, { dn: '½"', d: 10.90 }, { dn: '¾"', d: 17.40 },
  ]},
  { mat: 'Cobre flexible', K: 54.20, rows: [
    { dn: '⅜"', d: 9.00 }, { dn: '½"', d: 11.20 },
  ]},
  { mat: 'PE al PE', K: 49.00, rows: [
    { dn: '⅜"', d: 12.00 }, { dn: '½"', d: 16.00 },
    { dn: '¾"', d: 20.00 }, { dn: '1"', d: 25.00 },
  ]},
  { mat: 'Polietileno', K: 50.60, rows: [
    { dn: '½"', d: 14.50 }, { dn: '¾"', d: 21.50 }, { dn: '1"', d: 27.80 },
  ]},
];

export const GAS_DN_LABELS: string[] = [];
for (const g of GAS) for (const r of g.rows) if (!GAS_DN_LABELS.includes(r.dn)) GAS_DN_LABELS.push(r.dn);

export const CAT_GAS = [
  { id: 'pisc',   n: 'Calentador de piscina',     s: 'Cpisc',   q: 6.08 },
  { id: 'cal6',   n: 'Calentador P.D. Cap. 6 LPM',s: 'Cal 6LPM',q: 1.11 },
  { id: 'cal11',  n: 'Calentador P.D. Cap. 11 LPM',s:'Cal 11LPM',q: 1.88 },
  { id: 'cal21',  n: 'Calentador P.D. Cap. 21 LPM',s:'Cal 21LPM',q: 4.35 },
  { id: 'jac',    n: 'Jacuzzi',                   s: 'Jac',     q: 3.38 },
  { id: 'est2',   n: 'Estufa de 2 quemadores',    s: 'Est 2Q',  q: 0.68 },
  { id: 'est4',   n: 'Estufa de 4 quemadores',    s: 'Est 4Q',  q: 1.35 },
  { id: 'bt',     n: 'Baño turco',                s: 'BT',      q: 1.35 },
  { id: 'bs',     n: 'Baño sauna',                s: 'BS',      q: 1.08 },
  { id: 'hor_p',  n: 'Horno pequeño',             s: 'HP',      q: 0.54 },
  { id: 'hor_m',  n: 'Horno mediano',             s: 'HM',      q: 0.81 },
  { id: 'hor_g',  n: 'Horno grande',              s: 'HG',      q: 1.15 },
  { id: 'srp',    n: 'Secadora de ropa pequeña',  s: 'SRP',     q: 0.54 },
  { id: 'srg',    n: 'Secadora de ropa grande',   s: 'SRG',     q: 0.81 },
];
