export const SANITARIAS = [
  { mat: 'PVC-S', rows: [
    { dn: '1 1/2"', d: 42.68 }, { dn: '2"', d: 54.48 },
    { dn: '3"', d: 76.20 }, { dn: '4"', d: 107.70 }, { dn: '6"', d: 160.04 },
  ]},
];

export const VENTILACION = [
  { mat: 'PVC-V', rows: [
    { dn: '1 1/2"', d: 45.22 }, { dn: '2"', d: 56.76 },
    { dn: '3"', d: 79.00 }, { dn: '4"', d: 110.08 },
  ]},
];

export const RCI = [
  { mat: 'Acero al carbono SCH 10', rows: [
    { dn: '3/4"', d: 22.48 }, { dn: '1"', d: 27.86 }, { dn: '1 1/4"', d: 36.66 },
    { dn: '1 1/2"', d: 42.76 }, { dn: '2"', d: 54.76 }, { dn: '2 1/2"', d: 66.9 },
    { dn: '3"', d: 82.8 }, { dn: '4"', d: 108.2 }, { dn: '5"', d: 134.5 },
    { dn: '6"', d: 161.5 }, { dn: '8"', d: 209.54 }, { dn: '10"', d: 263.44 },
  ]},
  { mat: 'Acero al carbono SCH 40', rows: [
    { dn: '1/2"', d: 15.76 }, { dn: '3/4"', d: 20.96 }, { dn: '1"', d: 26.64 },
    { dn: '1 1/4"', d: 35.08 }, { dn: '1 1/2"', d: 40.94 }, { dn: '2"', d: 52.48 },
    { dn: '2 1/2"', d: 62.68 }, { dn: '3"', d: 77.92 }, { dn: '4"', d: 102.26 },
    { dn: '5"', d: 128.2 }, { dn: '6"', d: 154.08 }, { dn: '8"', d: 202.74 },
    { dn: '10"', d: 254.46 },
  ]},
  { mat: 'PVC C900 RDE 14', rows: [
    { dn: '4"', d: 104.88 }, { dn: '6"', d: 150.26 }, { dn: '8"', d: 197.08 },
    { dn: '10"', d: 241.62 }, { dn: '12"', d: 287.40 },
  ]},
  { mat: 'PVC C900 RDE 18', rows: [
    { dn: '4"', d: 108.34 }, { dn: '6"', d: 155.84 }, { dn: '8"', d: 204.34 },
    { dn: '10"', d: 250.56 }, { dn: '12"', d: 298.06 },
  ]},
  { mat: 'Acero galvanizado', rows: [
    { dn: '3/4"', d: 22.48 }, { dn: '1"', d: 27.86 }, { dn: '1 1/4"', d: 36.66 },
    { dn: '1 1/2"', d: 42.76 }, { dn: '2"', d: 54.76 }, { dn: '2 1/2"', d: 66.90 },
    { dn: '3"', d: 82.80 }, { dn: '3 1/2"', d: 95.50 }, { dn: '4"', d: 108.20 },
    { dn: '6"', d: 161.50 },
  ]},
];

export const AGUA_FRIA = [
  { mat: 'PVC-Pr', rows: [
    { dn: '1/2 (RDE 9)', d: 16.60 }, { dn: '1/2 (RDE 13.5)', d: 18.18 },
    { dn: '3/4 (RDE 11)', d: 21.81 }, { dn: '3/4 (RDE 21)', d: 23.63 },
    { dn: '1 (RDE 13.5)', d: 28.48 }, { dn: '1 (RDE 21)', d: 30.20 },
    { dn: '1 1/4 (RDE 21)', d: 38.14 }, { dn: '1 1/2 (RDE 21)', d: 43.68 },
    { dn: '2 (RDE 21)', d: 54.58 }, { dn: '2 1/2 (RDE 21)', d: 66.07 },
    { dn: '3 (RDE 21)', d: 80.42 }, { dn: '4 (RDE 21)', d: 103.42 },
    { dn: '6 (RDE 21)', d: 152.22 },
  ]},
];

export const AGUA_CALIENTE = [
  { mat: 'CPVC', rows: [
    { dn: '1/2 (RDE 11)', d: 12.40 }, { dn: '3/4 (RDE 11)', d: 18.20 },
    { dn: '1 (RDE 11)', d: 23.40 }, { dn: '1 1/4 (RDE 11)', d: 28.60 },
    { dn: '1 1/2 (RDE 11)', d: 33.70 }, { dn: '2 (RDE 11)', d: 44.20 },
    { dn: '2 (CPVC SCH 80)', d: 49.25 },
    { dn: '2 1/2 (CPVC SCH 80)', d: 59.00 },
    { dn: '3 (CPVC SCH 80)', d: 73.66 },
  ]},
];

export const CONTADORES = [
  { dn: '1/2', q: 0.84 }, { dn: '3/4', q: 1.40 },
  { dn: '1', q: 1.96 }, { dn: '1 1/2', q: 5.60 }, { dn: '2', q: 8.40 },
];

export const MATERIALES_POR_RED = [
  { red: 'Sanitaria', mat: 'PVC-S' },
  { red: 'Aguas lluvias', mat: 'PVC-S' },
  { red: 'Ventilación', mat: 'PVC-V' },
  { red: 'Agua fría', mat: 'PVC-Pr' },
  { red: 'Agua caliente', mat: 'CPVC' },
  { red: 'Gas', mats: ['Acero galvanizado', 'Cobre rígido', 'Cobre flexible', 'PE al PE', 'Polietileno PEAD', 'Acero al carbono'] },
  { red: 'Contra incendio', mats: ['Acero galvanizado', 'PVC C900', 'Acero al carbono'] },
];

export const COEF_FRICCION = [
  { tipo: 'PVC-S', desc: 'PVC Sanitario', sis: 'Sanitaria', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'N/A' },
  { tipo: 'PVC-S', desc: 'PVC Sanitario', sis: 'Aguas lluvias', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'N/A' },
  { tipo: 'PVC-Pr', desc: 'PVC Presión', sis: 'Agua fría', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'Según RDE' },
  { tipo: 'CPVC', desc: 'CPVC Agua caliente', sis: 'Agua caliente', mat: 'CPVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'Según SDR' },
  { tipo: 'Acero galvanizado', desc: 'Acero galvanizado', sis: 'Gas', mat: 'Acero', n: 0.015, c: 120, cu: 100, e: 0.15, pn: 'Según cédula' },
  { tipo: 'Cobre rígido', desc: 'Cobre Tipo L/K', sis: 'Gas', mat: 'Cobre', n: 0.011, c: 130, cu: 120, e: 0.0015, pn: 'Según tipo' },
  { tipo: 'Cobre flexible', desc: 'Cobre flexible', sis: 'Gas', mat: 'Cobre', n: 0.011, c: 130, cu: 120, e: 0.0015, pn: 'Según tipo' },
  { tipo: 'PE al PE', desc: 'PE Baja Densidad', sis: 'Gas', mat: 'PE', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'Según SDR' },
  { tipo: 'Polietileno PEAD', desc: 'Polietileno alta densidad', sis: 'Gas', mat: 'PEAD', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'PE80/PE100' },
  { tipo: 'Acero al carbono', desc: 'Acero negro', sis: 'Contra incendio', mat: 'Acero', n: 0.012, c: 120, cu: 100, e: 0.045, pn: 'Según cédula' },
  { tipo: 'Acero galvanizado', desc: 'Acero galvanizado', sis: 'Contra incendio', mat: 'Acero', n: 0.015, c: 120, cu: 100, e: 0.15, pn: 'Según cédula' },
  { tipo: 'PVC C900', desc: 'PVC C900', sis: 'Contra incendio', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'DR 18/25' },
];
