import { AGUA_CALIENTE, VENTILACION } from '../pages/catalog/catalogData';
import { diamPulgFromLabel } from '../utils/diamPulgFromLabel';

const MATS_RAW = {
  af: ['PVC-PR', 'CPVC', 'Cobre rígido', 'Polipropileno PP-R'],
  ac: ['PVC-PR', 'CPVC', 'Cobre rígido', 'Polipropileno PP-R', 'PEX'],
  san: ['PVC-S', 'Novatec', 'Hierro fundido', 'Concreto'],
  ll: ['PVC-S', 'Novatec', 'Hierro fundido', 'Concreto', 'Gres cerámico'],
  vent: ['PVC-V'],
  gas: ['PE al PE', 'Cobre rígido', 'A.C.', 'Acero HG', 'Polipropileno PP-R'],
  rci: ['A.C. SCH 40', 'A.C. SCH 10', 'Acero HG', 'CPVC CPVC-CI', 'PVC C900 RDE 14'],
};
export const MATS_DEFAULT = Object.fromEntries(
  Object.entries(MATS_RAW).map(([k, v]) => [k, v.map((o, i) => ({ id: k + i, val: o }))]),
);

export const MAT_LONGFORM = {
  'PVC-PR': 'PVC Presión',
  'PVC-S': 'PVC Sanitario',
  'PVC C900 RDE 14': 'PVC C900 RDE 14',
  'PVC C900 RDE 18': 'PVC C900 RDE 18',
  CPVC: 'CPVC (cloruro de polivinilo clorado)',
  'CPVC CPVC-CI': 'CPVC contra incendio',
  'Cobre rígido': 'Cobre rígido',
  'Cobre flexible': 'Cobre flexible',
  'Polipropileno PP-R': 'Polipropileno PP-R (PP-R)',
  PEX: 'PEX (polietileno reticulado)',
  'PE al PE': 'Polietileno (PE)',
  Polietileno: 'Polietileno (PE)',
  PEAD: 'Polietileno alta densidad (PEAD)',
  'A.C.': 'Acero al carbono',
  'A.C. SCH 10': 'Acero al carbono SCH 10',
  'A.C. SCH 40': 'Acero al carbono SCH 40',
  'Acero HG': 'Acero galvanizado (HG)',
  Novatec: 'Novatec (PVC Novafort)',
  'Hierro fundido': 'Hierro fundido',
  Concreto: 'Concreto',
  'Gres cerámico': 'Gres cerámico',
};

export function matLongName(short: string) {
  if (!short) return '—';
  return (MAT_LONGFORM as Record<string, string>)[short] || short;
}

/** Reverse lookup: "PVC Sanitario" → "PVC-S". Si no encuentra, devuelve el input tal cual. */
const MAT_SHORT_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MAT_LONGFORM).map(([k, v]) => [v, k]),
);
export function matShortKey(longName: string): string {
  if (!longName) return '';
  return MAT_SHORT_REVERSE[longName] || longName;
}

export const MAT_MANNING = {
  'PVC-S': 0.009,
  'PVC-V': 0.009,
  'PVC-PR': 0.009,
  'PVC C900 RDE 14': 0.009,
  'PVC C900 RDE 18': 0.009,
  Novatec: 0.009,
  CPVC: 0.009,
  'Hierro fundido': 0.013,
  Concreto: 0.013,
  'Gres cerámico': 0.013,
  'Cobre rígido': 0.011,
  'Cobre flexible': 0.011,
  'Polipropileno PP-R': 0.009,
  PEX: 0.009,
  'PE al PE': 0.009,
  Polietileno: 0.009,
  PEAD: 0.009,
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
  Novatec: 150,
  CPVC: 150,
  'CPVC CPVC-CI': 150,
  'Hierro fundido': 100,
  Concreto: 100,
  'Gres cerámico': 100,
  'Cobre rígido': 140,
  'Cobre flexible': 130,
  'Polipropileno PP-R': 140,
  PEX: 140,
  'PE al PE': 150,
  Polietileno: 150,
  PEAD: 150,
  'A.C.': 120,
  'A.C. SCH 10': 120,
  'A.C. SCH 40': 120,
  'Acero HG': 120,
};

export function matHazenC(short: string): number | null {
  if (!short) return null;
  return (MAT_HAZEN_C as Record<string, number>)[short] ?? null;
}

export const DIAM_BAN = [
  { pulg: 1.5, mm: 42.68, nom: '1-1/2"' },
  { pulg: 2, mm: 54.48, nom: '2"' },
  { pulg: 3, mm: 76.2, nom: '3"' },
  { pulg: 4, mm: 107.7, nom: '4"' },
  { pulg: 6, mm: 160.04, nom: '6"' },
];

export const DIAM_OPTIONS = DIAM_BAN.map((d) => ({ pulg: d.pulg, label: d.nom, mm: d.mm }));

// Bajantes sanitarios: se excluye 1-1/2" (orig. usuario #6) — los bajantes san no ofrecen esa
// opción de diámetro. El resto de redes (af/ac/vent) conservan DIAM_BAN completo.
export const DIAM_BAN_SAN = DIAM_BAN.filter((d) => d.pulg !== 1.5);

// Bajantes/colectores de lluvias (ll): sin 1-1/2" en todo lado (pedido usuario).
// ponytail: deriva de DIAM_BAN para no duplicar la lista. Los lookups de valores ya
// guardados siguen usando DIAM_BAN/DIAM_OPTIONS completos (legacy resuelve igual).
export const DIAM_BAN_LL = DIAM_BAN.filter((d) => d.pulg !== 1.5);

// Colectores/ramales sanitarios: sin 1-1/2" en toda la red san (pedido usuario).
// ponytail: deriva de DIAM_BAN_SAN para no duplicar la lista.
export const DIAM_OPTIONS_SAN = DIAM_BAN_SAN.map((d) => ({
  pulg: d.pulg,
  label: d.nom,
  mm: d.mm,
}));

// Colectores/ramales de lluvias (ll): sin 1-1/2" en los desplegables (pedido usuario).
// ponytail: deriva de DIAM_BAN_LL para no duplicar la lista.
export const DIAM_OPTIONS_LL = DIAM_BAN_LL.map((d) => ({
  pulg: d.pulg,
  label: d.nom,
  mm: d.mm,
}));

export const DIAM_VENT = (VENTILACION[0]?.rows || []).map((r) => ({
  pulg: diamPulgFromLabel(r.dn),
  mm: r.d,
  nom: r.dn,
}));

export const DIAM_BY_MAT: Record<string, Array<{ n: string }>> = {
  'PVC-S': [{ n: '2"' }, { n: '3"' }, { n: '4"' }, { n: '6"' }],
  'PVC-PR': [
    { n: '1/2" RDE 9' },
    { n: '1/2" RDE 13.5' },
    { n: '3/4" RDE 11' },
    { n: '3/4" RDE 21' },
    { n: '1" RDE 13.5' },
    { n: '1" RDE 21' },
    { n: '1-1/4" RDE 21' },
    { n: '1-1/2" RDE 21' },
    { n: '2" RDE 21' },
    { n: '2-1/2" RDE 21' },
    { n: '3" RDE 21' },
    { n: '4" RDE 21' },
    { n: '6" RDE 21' },
  ],
  CPVC: AGUA_CALIENTE[0].rows.map((r) => {
    const match = r.dn.match(/^(.+?)\s*\((.+?)\)$/);
    if (!match) return { n: r.dn };
    const specFixed = match[2].replace('CPVC ', '');
    return { n: `${match[1]}" ${specFixed}` };
  }),
  'Cobre rígido': [
    { n: '1/2"' },
    { n: '3/4"' },
    { n: '1"' },
    { n: '1-1/4"' },
    { n: '1-1/2"' },
    { n: '2"' },
  ],
  'Cobre flexible': [
    { n: '1/2"' },
    { n: '3/4"' },
    { n: '1"' },
    { n: '1-1/4"' },
    { n: '1-1/2"' },
    { n: '2"' },
  ],
  Novatec: [{ n: '4"' }, { n: '6"' }, { n: '8"' }, { n: '10"' }, { n: '12"' }],
  'Hierro fundido': [{ n: '2"' }, { n: '3"' }, { n: '4"' }, { n: '6"' }],
  Concreto: [{ n: '6"' }, { n: '8"' }, { n: '10"' }, { n: '12"' }],
  'Gres cerámico': [{ n: '4"' }, { n: '6"' }],
  'Polipropileno PP-R': [
    { n: '1/2"' },
    { n: '3/4"' },
    { n: '1"' },
    { n: '1-1/4"' },
    { n: '1-1/2"' },
    { n: '2"' },
  ],
  PEX: [{ n: '1/2"' }, { n: '3/4"' }, { n: '1"' }],
  'A.C. SCH 40': [
    { n: '1/2"' },
    { n: '3/4"' },
    { n: '1"' },
    { n: '1-1/4"' },
    { n: '1-1/2"' },
    { n: '2"' },
    { n: '2-1/2"' },
    { n: '3"' },
    { n: '4"' },
    { n: '6"' },
    { n: '8"' },
  ],
  'A.C. SCH 10': [{ n: '2"' }, { n: '2-1/2"' }, { n: '3"' }, { n: '4"' }, { n: '6"' }, { n: '8"' }],
  'Acero HG': [
    { n: '1/2"' },
    { n: '3/4"' },
    { n: '1"' },
    { n: '1-1/4"' },
    { n: '1-1/2"' },
    { n: '2"' },
    { n: '2-1/2"' },
    { n: '3"' },
    { n: '4"' },
  ],
  'CPVC CPVC-CI': [
    { n: '3/4"' },
    { n: '1"' },
    { n: '1-1/4"' },
    { n: '1-1/2"' },
    { n: '2"' },
    { n: '2-1/2"' },
    { n: '3"' },
  ],
  'PVC C900 RDE 14': [{ n: '4"' }, { n: '6"' }, { n: '8"' }, { n: '10"' }, { n: '12"' }],
  'PE al PE': [
    { n: '1/2"' },
    { n: '3/4"' },
    { n: '1"' },
    { n: '1-1/4"' },
    { n: '1-1/2"' },
    { n: '2"' },
    { n: '2-1/2"' },
    { n: '3"' },
    { n: '4"' },
    { n: '6"' },
  ],
};

// ── Materiales de CUBIERTA y de CANAL (aguas lluvias) — port del Excel Chequeo_canales_cubierta ──
// El VALUE que se persiste es el nombre COMPLETO; la tabla muestra la abreviatura con
// title=nombre completo (hover). Coeficientes de escorrentía C y Manning n: port literal de
// las tablas "COEFICIENTE DE ESCORRENTÍA POR MATERIAL DE CUBIERTA" y "COEFICIENTE DE MANNING
// POR MATERIAL" de la hoja Parametros (sin la columna de referencia; el catálogo maestro las
// muestra desde estas constantes).

export interface MaterialCubiertaLL {
  nombre: string;
  abrev: string;
  C: number;
}

export const MATERIALES_CUBIERTA_LL: MaterialCubiertaLL[] = [
  { nombre: 'Lámina metálica (zinc, galvanizada, termoacústica)', abrev: 'Metal', C: 0.95 },
  { nombre: 'Vidrio', abrev: 'Vidrio', C: 0.95 },
  { nombre: 'Policarbonato / acrílico', abrev: 'Policarbonato', C: 0.95 },
  { nombre: 'Teja PVC / UPVC', abrev: 'Teja PVC', C: 0.95 },
  { nombre: 'Losa impermeabilizada (manto / membrana)', abrev: 'Losa imperm.', C: 0.95 },
  { nombre: 'Losa de concreto sin impermeabilizar', abrev: 'Losa concreto', C: 0.9 },
  { nombre: 'Fibrocemento', abrev: 'Fibrocemento', C: 0.9 },
  { nombre: 'Teja asfáltica', abrev: 'Teja asfált.', C: 0.9 },
  { nombre: 'Teja de concreto', abrev: 'Teja concreto', C: 0.9 },
  { nombre: 'Pizarra', abrev: 'Pizarra', C: 0.9 },
  { nombre: 'Teja de barro', abrev: 'Teja barro', C: 0.85 },
  { nombre: 'Madera', abrev: 'Madera', C: 0.8 },
  { nombre: 'Cubierta plana con grava', abrev: 'Plana c/ grava', C: 0.7 },
  { nombre: 'Cubierta verde extensiva (sustrato < 10 cm)', abrev: 'Verde ext. <10', C: 0.5 },
  { nombre: 'Cubierta verde extensiva (sustrato ≥ 10 cm)', abrev: 'Verde ext. ≥10', C: 0.4 },
  { nombre: 'Cubierta verde intensiva (sustrato ≥ 30 cm)', abrev: 'Verde intensiva ≥30', C: 0.2 },
  { nombre: 'Paja / palma', abrev: 'Paja/palma', C: 0.6 },
];

/** Coeficiente de escorrentía C por material de cubierta; null si el material no está. */
export function cDeCubierta(nombre: string): number | null {
  if (!nombre) return null;
  const hit = MATERIALES_CUBIERTA_LL.find((m) => m.nombre === nombre);
  return hit ? hit.C : null;
}

/** C efectivo para cálculo: derivado del material; fallback 1.0 (criterio conservador NTC
 *  1500 — y el comportamiento que el app tenía para filas sin material elegido). */
export function cEfectivoCubierta(nombre: string | undefined): number {
  return cDeCubierta(nombre ?? '') ?? 1;
}

/** Abreviatura de un material de cubierta (para celdas/options con title del nombre largo). */
export function abrevCubierta(nombre: string): string {
  if (!nombre) return '—';
  const hit = MATERIALES_CUBIERTA_LL.find((m) => m.nombre === nombre);
  return hit ? hit.abrev : nombre;
}

export interface MaterialCanalLL {
  nombre: string;
  abrev: string;
  n: number;
}

export const MATERIALES_CANAL_LL: MaterialCanalLL[] = [
  { nombre: 'PVC', abrev: 'PVC', n: 0.01 },
  { nombre: 'Aluminio', abrev: 'Aluminio', n: 0.011 },
  { nombre: 'Cobre', abrev: 'Cobre', n: 0.011 },
  { nombre: 'Acero inoxidable', abrev: 'Acero inox.', n: 0.011 },
  { nombre: 'Lámina galvanizada', abrev: 'Lámina galv.', n: 0.012 },
  { nombre: 'Fibrocemento', abrev: 'Fibrocemento', n: 0.012 },
  { nombre: 'Concreto esmaltado', abrev: 'Concreto esm.', n: 0.013 },
  { nombre: 'Manto asfáltico', abrev: 'Manto asfált.', n: 0.014 },
  { nombre: 'Concreto sin acabado', abrev: 'Concreto s/acabado', n: 0.015 },
];

/** Manning n por material de canal; null si el material no está. */
export function nDeCanal(nombre: string): number | null {
  if (!nombre) return null;
  const hit = MATERIALES_CANAL_LL.find((m) => m.nombre === nombre);
  return hit ? hit.n : null;
}

/** Abreviatura de un material de canal (celdas/options con title del nombre largo). */
export function abrevCanal(nombre: string): string {
  if (!nombre) return '—';
  const hit = MATERIALES_CANAL_LL.find((m) => m.nombre === nombre);
  return hit ? hit.abrev : nombre;
}
