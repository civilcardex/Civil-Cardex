/** Perfiles normativos por país: según el país del proyecto, las tablas usan sus rangos de
 *  velocidad/presión y citan su norma local. Ej: Chile pide ≥15 m.c.a. en el peor punto; los
 *  países sin norma verificada heredan Colombia con nota 'ref.'. Fuentes: investigación 2026-10. */

export interface PerfNormas {
  id: string;
  nombre: string;
  /** Agua fría/caliente (tabla de diseño): velocidad mín/máx (m/s) y presión mín/máx en m.c.a. (metros de columna de agua). */
  af: { vMin: number; vMax: number; pMin: number; pMax: number };
  /** Sanitaria y lluvias por gravedad: velocidad (m/s), llenado máximo y/D, fuerza tractiva mínima (kg/m²). */
  san: { vMin: number; vMax: number; ydMax: number; ftMin: number };
  /** Gas: pérdida de presión máxima (mbar) y velocidad máxima (m/s). */
  gas: { dpMax: number; vMax: number };
  /** La norma que se le muestra al usuario para cada red. */
  norma: { af: string; san: string; ll: string; gas: string; rci: string };
  /** true = perfil de referencia (sin norma nacional verificada): aplica los criterios de Colombia. */
  ref?: boolean;
}

const CO: PerfNormas = {
  id: 'CO',
  nombre: 'Colombia',
  af: { vMin: 0.5, vMax: 2.5, pMin: 5, pMax: 50 },
  san: { vMin: 0.45, vMax: 4.0, ydMax: 0.75, ftMin: 0.15 },
  gas: { dpMax: 9.81, vMax: 10 },
  norma: {
    af: 'NTC 1500 / RAS 2000',
    san: 'RAS 2000 · NTC 1500',
    ll: 'RAS 2000 · NTC 1500',
    gas: 'NTC 3728',
    rci: 'NFPA 13 · NSR-10 J',
  },
};

export const NORMAS_PAIS: PerfNormas[] = [
  CO,
  {
    ...CO,
    id: 'PE',
    nombre: 'Perú',
    ref: false,
    af: { vMin: 0.6, vMax: 3.0, pMin: 10, pMax: 50 },
    norma: {
      af: 'RNE IS.010',
      san: 'RNE IS.010',
      ll: 'RNE OS.050',
      gas: 'RNE IS.010 · NTP',
      rci: 'NFPA 13 (ref.)',
    },
  },
  {
    ...CO,
    id: 'EC',
    nombre: 'Ecuador',
    ref: false,
    af: { vMin: 0.6, vMax: 3.0, pMin: 5, pMax: 45 },
    norma: {
      af: 'NEC Cap.16 · NTE INEN 1108',
      san: 'NEC Cap.16',
      ll: 'NEC Cap.16',
      gas: 'NEC · NTE INEN 2295',
      rci: 'NFPA 13 (ref.)',
    },
  },
  {
    ...CO,
    id: 'CL',
    nombre: 'Chile',
    ref: false,
    af: { vMin: 0.6, vMax: 2.5, pMin: 15, pMax: 45 },
    norma: {
      af: 'OGUC 4.1.5 · SISS · NCh 2485',
      san: 'OGUC 4.4',
      ll: 'OGUC 4.4',
      gas: 'NCh 4 entrance · SEC',
      rci: 'NFPA 13 (ref.)',
    },
  },
  {
    ...CO,
    id: 'BO',
    nombre: 'Bolivia',
    ref: false,
    af: { vMin: 0.6, vMax: 2.5, pMin: 10, pMax: 45 },
    norma: {
      af: 'RENISDA · NB 689',
      san: 'RENISDA',
      ll: 'RENISDA',
      gas: 'NB 1069',
      rci: 'NFPA 13 (ref.)',
    },
  },
  {
    ...CO,
    id: 'AR',
    nombre: 'Argentina',
    ref: false,
    af: { vMin: 0.6, vMax: 2.0, pMin: 10, pMax: 40 },
    norma: {
      af: 'Regl. prestadoras (ENRE 1055/13)',
      san: 'Cód. Edificación',
      ll: 'Cód. Edificación',
      gas: 'Regl. ENARGAS',
      rci: 'NFPA 13 (ref.)',
    },
  },
  {
    ...CO,
    id: 'VE',
    nombre: 'Venezuela',
    ref: true,
    norma: { ...CO.norma, af: 'COVENIN (ref. NTC 1500)', san: 'COVENIN (ref. RAS)' },
  },
  {
    ...CO,
    id: 'PY',
    nombre: 'Paraguay',
    ref: true,
    norma: { ...CO.norma, af: 'INTN NP (ref. NTC 1500)' },
  },
  {
    ...CO,
    id: 'UY',
    nombre: 'Uruguay',
    ref: true,
    norma: { ...CO.norma, af: 'Regl. DNSS (ref. NTC 1500)' },
  },
  { ...CO, id: 'GT', nombre: 'Guatemala', ref: true },
  { ...CO, id: 'HN', nombre: 'Honduras', ref: true },
  { ...CO, id: 'SV', nombre: 'El Salvador', ref: true },
  {
    ...CO,
    id: 'NI',
    nombre: 'Nicaragua',
    ref: true,
    norma: { ...CO.norma, af: 'NTON 03 038 (ref. NTC 1500)' },
  },
  {
    ...CO,
    id: 'CR',
    nombre: 'Costa Rica',
    ref: true,
    norma: { ...CO.norma, af: 'Regl. A y A · CFIA (ref. NTC 1500)' },
  },
  {
    ...CO,
    id: 'PA',
    nombre: 'Panamá',
    ref: true,
    norma: { ...CO.norma, af: 'Regl. Inst. Sanitarias IDAAN (ref. NTC 1500)' },
  },
  {
    ...CO,
    id: 'CU',
    nombre: 'Cuba',
    ref: true,
    norma: { ...CO.norma, af: 'NC 60-01 (ref. NTC 1500)' },
  },
  {
    ...CO,
    id: 'DO',
    nombre: 'Rep. Dominicana',
    ref: true,
    norma: { ...CO.norma, af: 'N.T. 001-98 INDRHI (ref. NTC 1500)' },
  },
];

/** Perfil del país del proyecto; si no se reconoce, cae en Colombia. Ej: 'CL' → los rangos de Chile. */
export function perfilDe(pais: string | undefined): PerfNormas {
  const n = (pais || '').trim().toLowerCase();
  if (!n) return CO;
  return NORMAS_PAIS.find((p) => p.nombre.toLowerCase() === n || p.id.toLowerCase() === n) ?? CO;
}

/** Velocidad permitida en af (Agua Fria)/ac (Agua Caliente) con la cita del país, para los tooltips. Ej: Colombia → '0,5 – 2,5 m/s (NTC 1500 / RAS 2000)'. */
export function rangoAfTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.af.vMin.toFixed(2).replace('.', ',')}–${p.af.vMax.toFixed(2).replace('.', ',')} m/s (${p.norma.af})`;
}

/** Rango de velocidad sanitaria + cita normativa del país — para tooltips. Ej: '0,45 – 4 m/s (RAS 2000 · NTC 1500)'. */
export function rangoSanTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.san.vMin.toFixed(2).replace('.', ',')}–${p.san.vMax.toFixed(2).replace('.', ',')} m/s (${p.norma.san})`;
}

/** Fuerza tractiva mínima en sanitaria (kg/m²): si el agua llega con menos, los sólidos se estancan. Ej: '0,15 kg/m² (RAS 2000 · NTC 1500)'. */
export function ftTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.san.ftMin.toFixed(2).replace('.', ',')} kg/m² (${p.norma.san})`;
}

/** Límites de gas del país (velocidad y pérdida de presión acumulada) + la norma local. Ej: 'V ≤ 10 m/s · ΔP acumulada ≤ 9,81 mbar (NTC 3728)'. */
export function gasTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `V ≤ ${p.gas.vMax} m/s · ΔP acumulada ≤ ${String(p.gas.dpMax).replace('.', ',')} mbar (${p.norma.gas})`;
}
