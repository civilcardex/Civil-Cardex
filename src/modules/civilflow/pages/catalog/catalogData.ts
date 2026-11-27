/**
 * Catálogos dimensionales por red y material: etiqueta de diámetro -> diámetro
 * interno real en mm (sanitaria, ventilación, RCI, agua fría/caliente), caudal
 * de referencia de contadores y coeficientes de fricción. La búsqueda de
 * diámetro del motor se apoya en estas tablas.
 */

import { MAT_MANNING } from '../../constants/manningByMaterial.ts';
import { PIPES, RCI_PIPE_CATALOG } from '../../lib/rci/tables.ts';

/** Diámetros internos del PVC-S sanitario: 2" = 54.48 mm ... 6" = 160.04 mm. */
export const SANITARIAS = [
  {
    mat: 'PVC-S',
    rows: [
      // 1 ½" retirado por pedido del usuario — la red sanitaria arranca en 2".
      { dn: '2"', d: 54.48 },
      { dn: '3"', d: 76.2 },
      { dn: '4"', d: 107.7 },
      { dn: '6"', d: 160.04 },
    ],
  },
];

/** Diámetros internos del PVC-V de ventilación sanitaria: 2"-4". La ventilación (método Wyly-Eaton) usa el diámetro interno real. */
export const VENTILACION = [
  {
    mat: 'PVC-V',
    rows: [
      // 1 ½" retirado por pedido del usuario — la red de ventilación arranca en 2".
      { dn: '2"', d: 56.76 },
      { dn: '3"', d: 79.0 },
      { dn: '4"', d: 110.08 },
    ],
  },
];

/** Diámetros de la red contra incendio: la geometría comercial viene del catálogo del motor. */
export const RCI = [
  ...['Acero SCH 10', 'Acero SCH 40', 'PVC C900 RDE 14', 'PVC C900 RDE 18', 'CPVC SDR 13,5'].map(
    (mat) => ({
      mat,
      rows: Object.entries(PIPES[mat]).map(([dn, pipe]) => ({ dn, d: pipe.id })),
    }),
  ),
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

/** Diámetros internos del PVC-PR por serie RDE (Relación Dimensión-Espesor): ½ (RDE 9) = 16.6 mm ... 6 (RDE 21) = 152.22 mm. */
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

/** Diámetros internos del CPVC: RDE 11 de ½" a 3" más las series gruesas SCH 80 de 2" a 3". */
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

/** Diámetro y caudal de referencia (l/s) de contadores; la pérdida se calcula como (Q/q)². Ej: 3/4" -> q = 1.4 l/s. */
export const CONTADORES = [
  { dn: '1/2', q: 0.84 },
  { dn: '3/4', q: 1.4 },
  { dn: '1', q: 1.96 },
  { dn: '1 1/2', q: 5.6 },
  { dn: '2', q: 8.4 },
];

/** Materiales de cada red: mat único (sanitaria PVC-S...) o mats[] cuando la red ofrece varios (gas, RCI). */
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
  { red: 'Contra incendio', mats: Object.keys(PIPES) },
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
/** Ids de red con más de un material en el catálogo canónico -> el campo material del ramal muestra selector en vez de texto fijo. */
export const NETS_WITH_MULTIPLE_MATERIALS = new Set(
  MATERIALES_POR_RED.filter((r) => (r.mats?.length ?? 0) > 1)
    .map((r) => RED_LABEL_TO_NET[r.red])
    .filter((id): id is string => !!id),
);

interface FrictionRow {
  tipo: string;
  desc: string;
  sis: string;
  mat: string;
  n: number | null;
  cUso?: number;
  cHumedo: number;
  cSeco?: number | null;
  e: number;
  pn: string | null;
}

const SERIES_RCI = ['PVC C900 RDE 18', 'PVC C900 RDE 14', 'CPVC SDR 13,5'] as const;

/** Coeficientes de fricción de consulta; Hazen-Williams corresponde al flujo de agua, no al de gas.
 * Ej.: cobre → C húmedo de 130 como referencia del material en agua. */
export const COEF_FRICCION: FrictionRow[] = [
  {
    tipo: 'PVC-S',
    desc: 'PVC Sanitario',
    sis: 'Sanitaria',
    mat: 'PVC',
    n: MAT_MANNING['PVC-S'],
    cHumedo: 150,
    cUso: 145,
    e: 0.0015,
    pn: null,
  },
  {
    tipo: 'PVC-S',
    desc: 'PVC Sanitario',
    sis: 'Aguas lluvias',
    mat: 'PVC',
    n: MAT_MANNING['PVC-S'],
    cHumedo: 150,
    cUso: 145,
    e: 0.0015,
    pn: null,
  },
  {
    tipo: 'PVC-Pr',
    desc: 'PVC Presión',
    sis: 'Agua fría',
    mat: 'PVC',
    n: MAT_MANNING['PVC-PR'],
    cHumedo: 150,
    cUso: 145,
    e: 0.0015,
    pn: 'Según RDE',
  },
  {
    tipo: 'CPVC',
    desc: 'CPVC Agua caliente',
    sis: 'Agua caliente',
    mat: 'CPVC',
    n: MAT_MANNING.CPVC,
    cHumedo: 150,
    cUso: 145,
    e: 0.0015,
    pn: 'Según SDR',
  },
  {
    tipo: 'Acero galvanizado',
    desc: 'Acero galvanizado',
    sis: 'Gas',
    mat: 'Acero',
    n: MAT_MANNING['Acero HG'],
    cHumedo: 120,
    cUso: 100,
    e: 0.15,
    pn: 'Según cédula',
  },
  {
    tipo: 'Cobre rígido',
    desc: 'Cobre Tipo L/K',
    sis: 'Gas',
    mat: 'Cobre',
    n: MAT_MANNING['Cobre rígido'],
    cHumedo: 130,
    cUso: 120,
    e: 0.0015,
    pn: 'Según tipo',
  },
  {
    tipo: 'Cobre flexible',
    desc: 'Cobre flexible',
    sis: 'Gas',
    mat: 'Cobre',
    n: MAT_MANNING['Cobre flexible'],
    cHumedo: 130,
    cUso: 120,
    e: 0.0015,
    pn: 'Según tipo',
  },
  {
    tipo: 'PE al PE',
    desc: 'PE Baja Densidad',
    sis: 'Gas',
    mat: 'PE',
    n: MAT_MANNING['PE al PE'],
    cHumedo: 150,
    cUso: 145,
    e: 0.0015,
    pn: 'Según SDR',
  },
  {
    tipo: 'Polietileno PEAD',
    desc: 'Polietileno alta densidad',
    sis: 'Gas',
    mat: 'PEAD',
    n: MAT_MANNING.PEAD,
    cHumedo: 150,
    cUso: 145,
    e: 0.0015,
    pn: 'PE80/PE100',
  },
  {
    tipo: 'Acero al carbono',
    desc: 'Acero negro',
    sis: 'Contra incendio',
    mat: 'Acero',
    n: MAT_MANNING['A.C. SCH 40'],
    cHumedo: RCI_PIPE_CATALOG['Acero SCH 40'].humedo,
    cSeco: RCI_PIPE_CATALOG['Acero SCH 40'].seco,
    cUso: 100,
    e: 0.045,
    pn: 'Según cédula',
  },
  {
    tipo: 'Acero galvanizado',
    desc: 'Acero galvanizado',
    sis: 'Contra incendio',
    mat: 'Acero',
    n: MAT_MANNING['Acero HG'],
    // Tabla de Hazen-Williams del capítulo 28 de la norma de rociadores de la NFPA (National Fire Protection Association).
    cHumedo: 120,
    cSeco: 100,
    cUso: 100,
    e: 0.15,
    pn: 'Según cédula',
  },
  ...SERIES_RCI.map((tipo) => {
    const ficha = RCI_PIPE_CATALOG[tipo];
    return {
      tipo,
      desc: ficha.familia === 'PVC' ? 'PVC para red enterrada' : 'CPVC para rociadores',
      sis: 'Contra incendio',
      mat: ficha.familia,
      n: tipo === 'CPVC SDR 13,5' ? null : MAT_MANNING[tipo],
      cHumedo: ficha.humedo,
      cSeco: ficha.seco,
      cUso: 145,
      e: ficha.rugosidad,
      pn: ficha.presion,
    };
  }),
];
