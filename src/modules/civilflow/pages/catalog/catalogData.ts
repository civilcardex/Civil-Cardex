export const SANITARIAS = [
  {
    mat: 'PVC-S',
    rows: [
      { dn: '1 ½"', d: 42.68 },
      { dn: '2"', d: 54.48 },
      { dn: '3"', d: 76.2 },
      { dn: '4"', d: 107.7 },
      { dn: '6"', d: 160.04 },
    ],
  },
];

export const VENTILACION = [
  {
    mat: 'PVC-V',
    rows: [
      { dn: '1 ½"', d: 45.22 },
      { dn: '2"', d: 56.76 },
      { dn: '3"', d: 79.0 },
      { dn: '4"', d: 110.08 },
    ],
  },
];

export const RCI = [
  {
    mat: 'Acero al carbono SCH 10',
    rows: [
      { dn: '¾"', d: 22.48 },
      { dn: '1"', d: 27.86 },
      { dn: '1¼"', d: 36.66 },
      { dn: '1 ½"', d: 42.76 },
      { dn: '2"', d: 54.76 },
      { dn: '2 ½"', d: 66.9 },
      { dn: '3"', d: 82.8 },
      { dn: '4"', d: 108.2 },
      { dn: '5"', d: 134.5 },
      { dn: '6"', d: 161.5 },
      { dn: '8"', d: 209.54 },
      { dn: '10"', d: 263.44 },
    ],
  },
  {
    mat: 'Acero al carbono SCH 40',
    rows: [
      { dn: '½"', d: 15.76 },
      { dn: '¾"', d: 20.96 },
      { dn: '1"', d: 26.64 },
      { dn: '1¼"', d: 35.08 },
      { dn: '1 ½"', d: 40.94 },
      { dn: '2"', d: 52.48 },
      { dn: '2 ½"', d: 62.68 },
      { dn: '3"', d: 77.92 },
      { dn: '4"', d: 102.26 },
      { dn: '5"', d: 128.2 },
      { dn: '6"', d: 154.08 },
      { dn: '8"', d: 202.74 },
      { dn: '10"', d: 254.46 },
    ],
  },
  {
    mat: 'PVC C900 RDE 14',
    rows: [
      { dn: '4"', d: 104.88 },
      { dn: '6"', d: 150.26 },
      { dn: '8"', d: 197.08 },
      { dn: '10"', d: 241.62 },
      { dn: '12"', d: 287.4 },
    ],
  },
  {
    mat: 'PVC C900 RDE 18',
    rows: [
      { dn: '4"', d: 108.34 },
      { dn: '6"', d: 155.84 },
      { dn: '8"', d: 204.34 },
      { dn: '10"', d: 250.56 },
      { dn: '12"', d: 298.06 },
    ],
  },
  {
    mat: 'Acero galvanizado',
    rows: [
      { dn: '¾"', d: 22.48 },
      { dn: '1"', d: 27.86 },
      { dn: '1¼"', d: 36.66 },
      { dn: '1 ½"', d: 42.76 },
      { dn: '2"', d: 54.76 },
      { dn: '2 ½"', d: 66.9 },
      { dn: '3"', d: 82.8 },
      { dn: '3 ½"', d: 95.5 },
      { dn: '4"', d: 108.2 },
      { dn: '6"', d: 161.5 },
    ],
  },
];

export const AGUA_FRIA = [
  {
    mat: 'PVC-Pr',
    rows: [
      { dn: '½ (RDE 9)', d: 16.6 },
      { dn: '½ (RDE 13.5)', d: 18.18 },
      { dn: '¾ (RDE 11)', d: 21.81 },
      { dn: '¾ (RDE 21)', d: 23.63 },
      { dn: '1 (RDE 13.5)', d: 28.48 },
      { dn: '1 (RDE 21)', d: 30.2 },
      { dn: '1¼ (RDE 21)', d: 38.14 },
      { dn: '1 ½ (RDE 21)', d: 43.68 },
      { dn: '2 (RDE 21)', d: 54.58 },
      { dn: '2 ½ (RDE 21)', d: 66.07 },
      { dn: '3 (RDE 21)', d: 80.42 },
      { dn: '4 (RDE 21)', d: 103.42 },
      { dn: '6 (RDE 21)', d: 152.22 },
    ],
  },
];

export const AGUA_CALIENTE = [
  {
    mat: 'CPVC',
    rows: [
      { dn: '½ (RDE 11)', d: 12.4 },
      { dn: '¾ (RDE 11)', d: 18.2 },
      { dn: '1 (RDE 11)', d: 23.4 },
      { dn: '1¼ (RDE 11)', d: 28.6 },
      { dn: '1 ½ (RDE 11)', d: 33.7 },
      { dn: '2 (RDE 11)', d: 44.2 },
      { dn: '2 (CPVC SCH 80)', d: 49.25 },
      { dn: '2 ½ (CPVC SCH 80)', d: 59.0 },
      { dn: '3 (CPVC SCH 80)', d: 73.66 },
    ],
  },
];

export const CONTADORES = [
  { dn: '1/2', q: 0.84 },
  { dn: '3/4', q: 1.4 },
  { dn: '1', q: 1.96 },
  { dn: '1 1/2', q: 5.6 },
  { dn: '2', q: 8.4 },
];

export const MATERIALES_POR_RED = [
  { red: 'Sanitaria', mat: 'PVC-S' },
  { red: 'Aguas lluvias', mat: 'PVC-S' },
  { red: 'Ventilación', mat: 'PVC-V' },
  { red: 'Agua fría', mat: 'PVC-Pr' },
  { red: 'Agua caliente', mat: 'CPVC' },
  {
    red: 'Gas',
    mats: [
      'Acero galvanizado',
      'Cobre rígido',
      'Cobre flexible',
      'PE al PE',
      'Polietileno PEAD',
      'Acero al carbono',
    ],
  },
  { red: 'Contra incendio', mats: ['Acero galvanizado', 'PVC C900', 'Acero al carbono'] },
];

// Derivación de MATERIALES_POR_RED por id de red — tabla canónica de cuántos materiales
// tiene realmente cada red. Decide si el campo material de un ramal muestra un selector
// o texto estático: solo una red cuyo catálogo canónico liste más de un material debe
// ofrecer elección, sin importar cuántas entradas tenga el catálogo separado
// `mats`/MaterialesContext (engineeringDataMaterials.ts, lista editable más amplia usada en búsquedas de diámetro).
const RED_LABEL_TO_NET: Record<string, string> = {
  Sanitaria: 'san',
  'Aguas lluvias': 'll',
  Ventilación: 'vent',
  'Agua fría': 'af',
  'Agua caliente': 'ac',
  Gas: 'gas',
  'Contra incendio': 'rci',
};
export const NETS_WITH_MULTIPLE_MATERIALS = new Set(
  MATERIALES_POR_RED.filter((r) => (r.mats?.length ?? 0) > 1)
    .map((r) => RED_LABEL_TO_NET[r.red])
    .filter((id): id is string => !!id),
);

export const COEF_FRICCION = [
  {
    tipo: 'PVC-S',
    desc: 'PVC Sanitario',
    sis: 'Sanitaria',
    mat: 'PVC',
    n: 0.009,
    c: 150,
    cu: 145,
    e: 0.0015,
    pn: 'N/A',
  },
  {
    tipo: 'PVC-S',
    desc: 'PVC Sanitario',
    sis: 'Aguas lluvias',
    mat: 'PVC',
    n: 0.009,
    c: 150,
    cu: 145,
    e: 0.0015,
    pn: 'N/A',
  },
  {
    tipo: 'PVC-Pr',
    desc: 'PVC Presión',
    sis: 'Agua fría',
    mat: 'PVC',
    n: 0.009,
    c: 150,
    cu: 145,
    e: 0.0015,
    pn: 'Según RDE',
  },
  {
    tipo: 'CPVC',
    desc: 'CPVC Agua caliente',
    sis: 'Agua caliente',
    mat: 'CPVC',
    n: 0.009,
    c: 150,
    cu: 145,
    e: 0.0015,
    pn: 'Según SDR',
  },
  {
    tipo: 'Acero galvanizado',
    desc: 'Acero galvanizado',
    sis: 'Gas',
    mat: 'Acero',
    n: 0.015,
    c: 120,
    cu: 100,
    e: 0.15,
    pn: 'Según cédula',
  },
  {
    tipo: 'Cobre rígido',
    desc: 'Cobre Tipo L/K',
    sis: 'Gas',
    mat: 'Cobre',
    n: 0.011,
    c: 130,
    cu: 120,
    e: 0.0015,
    pn: 'Según tipo',
  },
  {
    tipo: 'Cobre flexible',
    desc: 'Cobre flexible',
    sis: 'Gas',
    mat: 'Cobre',
    n: 0.011,
    c: 130,
    cu: 120,
    e: 0.0015,
    pn: 'Según tipo',
  },
  {
    tipo: 'PE al PE',
    desc: 'PE Baja Densidad',
    sis: 'Gas',
    mat: 'PE',
    n: 0.009,
    c: 150,
    cu: 145,
    e: 0.0015,
    pn: 'Según SDR',
  },
  {
    tipo: 'Polietileno PEAD',
    desc: 'Polietileno alta densidad',
    sis: 'Gas',
    mat: 'PEAD',
    n: 0.009,
    c: 150,
    cu: 145,
    e: 0.0015,
    pn: 'PE80/PE100',
  },
  {
    tipo: 'Acero al carbono',
    desc: 'Acero negro',
    sis: 'Contra incendio',
    mat: 'Acero',
    n: 0.012,
    c: 120,
    cu: 100,
    e: 0.045,
    pn: 'Según cédula',
  },
  {
    tipo: 'Acero galvanizado',
    desc: 'Acero galvanizado',
    sis: 'Contra incendio',
    mat: 'Acero',
    n: 0.015,
    c: 120,
    cu: 100,
    e: 0.15,
    pn: 'Según cédula',
  },
  {
    tipo: 'PVC C900',
    desc: 'PVC C900',
    sis: 'Contra incendio',
    mat: 'PVC',
    n: 0.009,
    c: 150,
    cu: 145,
    e: 0.0015,
    pn: 'DR 18/25',
  },
];
