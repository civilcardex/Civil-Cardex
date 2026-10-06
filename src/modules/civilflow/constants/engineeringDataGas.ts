export const GAS = [
  {
    mat: 'Acero galvanizado',
    K: 57.5,
    rows: [
      { dn: '3/8"', d: 9.5 },
      { dn: '1/2"', d: 12.7 },
      { dn: '3/4"', d: 19.0 },
      { dn: '1"', d: 25.4 },
      { dn: '2"', d: 50.8 },
    ],
  },
  {
    mat: 'Acero al carbono',
    K: 57.5,
    rows: [
      { dn: '3/8"', d: 10.0 },
      { dn: '1/2"', d: 13.4 },
      { dn: '3/4"', d: 19.5 },
      { dn: '1"', d: 26.0 },
      { dn: '2"', d: 52.0 },
    ],
  },
  {
    mat: 'Cobre rígido',
    K: 54.2,
    rows: [
      { dn: '3/8"', d: 8.7 },
      { dn: '1/2"', d: 10.9 },
      { dn: '3/4"', d: 17.4 },
    ],
  },
  {
    mat: 'Cobre flexible',
    K: 54.2,
    rows: [
      { dn: '3/8"', d: 9.0 },
      { dn: '1/2"', d: 11.2 },
    ],
  },
  {
    mat: 'PE al PE',
    K: 49.0,
    rows: [
      { dn: '3/8"', d: 12.0 },
      { dn: '1/2"', d: 16.0 },
      { dn: '3/4"', d: 20.0 },
      { dn: '1"', d: 25.0 },
    ],
  },
  {
    mat: 'Polietileno',
    K: 50.6,
    rows: [
      { dn: '1/2"', d: 14.5 },
      { dn: '3/4"', d: 21.5 },
      { dn: '1"', d: 27.8 },
    ],
  },
];

export const GAS_DN_LABELS: string[] = [];
for (const g of GAS)
  for (const r of g.rows) if (!GAS_DN_LABELS.includes(r.dn)) GAS_DN_LABELS.push(r.dn);

// Catálogo de gasodomésticos — fuente: tabla NTC 3728. La potencia depende del tipo de
// tabla: kw = tabla gas natural, kwglp = tabla GLP; q/qglp son los consumos (m³/h).
/** Entrada del catálogo NTC 3728 (null = valor pendiente de la tabla completa). */
export interface CatGasItem {
  id: string;
  n: string;
  s: string;
  /** Consumo gas natural (m³/h). */
  q: number;
  /** Potencia según la tabla gas natural (kW); null = pendiente. */
  kw: number | null;
  /** Consumo GLP (m³/h); null = pendiente. */
  qglp: number | null;
  /** Potencia según la tabla GLP (kW); null = pendiente. */
  kwglp: number | null;
}

export const CAT_GAS: CatGasItem[] = [
  {
    id: 'pisc',
    n: 'Calentador de piscina',
    s: 'Cpisc',
    q: 6.08,
    kw: 62.93,
    qglp: 2.44,
    kwglp: 156.86,
  },
  {
    id: 'cal6',
    n: 'Calentador P.D. Cap. 6 LPM',
    s: 'Cal 6LPM',
    q: 1.11,
    kw: 11.49,
    qglp: 0.45,
    kwglp: 28.64,
  },
  {
    id: 'cal11',
    n: 'Calentador P.D. Cap. 11 LPM',
    s: 'Cal 11LPM',
    q: 1.88,
    kw: 19.46,
    qglp: 0.75,
    kwglp: 48.5,
  },
  {
    id: 'cal21',
    n: 'Calentador P.D. Cap. 21 LPM',
    s: 'Cal 21LPM',
    q: 4.35,
    kw: 45.02,
    qglp: 1.75,
    kwglp: 112.23,
  },
  { id: 'jac', n: 'Jacuzzi', s: 'Jac', q: 3.38, kw: 34.98, qglp: 1.36, kwglp: 87.2 },
  {
    id: 'est2',
    n: 'Estufa de 2 quemadores',
    s: 'Est 2Q',
    q: 0.68,
    kw: 7.04,
    qglp: 0.27,
    kwglp: 17.54,
  },
  {
    id: 'est4',
    n: 'Estufa de 4 quemadores',
    s: 'EST4',
    q: 1.35,
    kw: 13.97,
    qglp: 0.54,
    kwglp: 34.83,
  },
  { id: 'bt', n: 'Baño turco', s: 'BT', q: 1.35, kw: 13.97, qglp: 0.54, kwglp: 34.83 },
  { id: 'bs', n: 'Baño sauna', s: 'BS', q: 1.08, kw: 11.18, qglp: 0.43, kwglp: 27.86 },
  { id: 'hor_p', n: 'Horno pequeño', s: 'HP', q: 0.54, kw: 5.59, qglp: 0.22, kwglp: 13.93 },
  { id: 'hor_m', n: 'Horno mediano', s: 'HM', q: 0.81, kw: 8.38, qglp: 0.32, kwglp: 20.9 },
  { id: 'hor_g', n: 'Horno grande', s: 'HG', q: 1.15, kw: 11.9, qglp: 0.46, kwglp: 29.67 },
  {
    id: 'srp',
    n: 'Secadora de ropa pequeña',
    s: 'SRP',
    q: 0.54,
    kw: 5.59,
    qglp: 0.22,
    kwglp: 13.93,
  },
  { id: 'srg', n: 'Secadora de ropa grande', s: 'SRG', q: 0.81, kw: 8.38, qglp: 0.32, kwglp: 20.9 },
];
