/** Perfiles normativos hidrosanitarios por país (ped. usuario): según el país de
 *  IDENTIFICACIÓN DEL PROYECTO, los chequeos de las tablas usan los rangos del país y
 *  las normas visibles citan la normativa local.
 *
 *  FUENTES principales (investigación 2026-10):
 *  - CO: NTC 1500 / RAS 2000 (Res. 1096) / NTC 3728 — valores actuales de la app.
 *  - PE: RNE OS.050 (red: V 0.60–3.0 m/s, P 10–50 m.c.a.) e IS.010 (edificaciones).
 *  - CL: SISS/OGUC (P mín 15 m.c.a. consumo máx. horario; NCh 2485 ~7 m.c.a. punto desfavorable).
 *  - EC: NEC Cap.16 / NTE INEN 1108 (P ~5 m.c.a. punto desfavorable; V ≤ 3).
 *  - BO: RENISDA (V mín 0.60; máx 2.5 interiores).
 *  - AR: Reglamentos de prestadoras (ENRE Res.1055/13: V ≤ 2.0, P máx 40 m.c.a.).
 *  - Centroamérica y resto: normativa nacional de instalaciones sanitarias; sin dato
 *    verificado → hereda CO con nota 'ref.' (mismo criterio regional).
 *  Marco regional común: V interior 2.0–2.5, V red 0.6–3.0, P máx 40–50 m.c.a. */

export interface PerfNormas {
  id: string;
  nombre: string;
  /** Agua fría/ caliente (tabla de diseño): velocidades m/s y presiones m.c.a. */
  af: { vMin: number; vMax: number; pMin: number; pMax: number };
  /** Sanitaria/lluvias por gravedad: V m/s, llenado y/D, fuerza tractiva kg/m². */
  san: { vMin: number; vMax: number; ydMax: number; ftMin: number };
  /** Gas (NTC 3728 local o equivalente): ΔP máx mbar y V máx m/s. */
  gas: { dpMax: number; vMax: number };
  /** Cita normativa visible por red. */
  norma: { af: string; san: string; ll: string; gas: string; rci: string };
  /** true = perfil de referencia (sin norma nacional verificada): hereda criterios CO. */
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

/** Base de referencia (criterios regionales) para países sin norma nacional verificada. */
export const REF = (nombre: string, id: string, nota: string): PerfNormas => ({
  ...CO,
  id,
  nombre,
  ref: true,
  norma: {
    af: `${nota} (ref. NTC 1500)`,
    san: `${nota} (ref. RAS/NTC 1500)`,
    ll: `${nota} (ref. RAS/NTC 1500)`,
    gas: `${nota} (ref. NTC 3728)`,
    rci: `${nota} (ref. NFPA 13)`,
  },
});

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

/** Perfil por el nombre/valor de país del proyecto (compara normalizado). Falla → Colombia. */
export function perfilDe(pais: string | undefined): PerfNormas {
  const n = (pais || '').trim().toLowerCase();
  if (!n) return CO;
  return NORMAS_PAIS.find((p) => p.nombre.toLowerCase() === n || p.id.toLowerCase() === n) ?? CO;
}

/** Cita normativa de una red según el país del proyecto. */
export function normaDe(
  pais: string | undefined,
  net: 'af' | 'san' | 'll' | 'gas' | 'rci',
): string {
  return perfilDe(pais).norma[net];
}

/** Rango de velocidad AF/AC formateado con la cita normativa del país — para tooltips. */
export function rangoAfTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.af.vMin.toFixed(2).replace('.', ',')}–${p.af.vMax.toFixed(2).replace('.', ',')} m/s (${p.norma.af})`;
}

/** Rango de velocidad sanitaria + cita — para tooltips. */
export function rangoSanTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.san.vMin.toFixed(2).replace('.', ',')}–${p.san.vMax.toFixed(2).replace('.', ',')} m/s (${p.norma.san})`;
}

/** Fuerza tractiva mínima + cita. */
export function ftTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.san.ftMin.toFixed(2).replace('.', ',')} kg/m² (${p.norma.san})`;
}

/** Gas: V máx y ΔP máx + cita. */
export function gasTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `V ≤ ${p.gas.vMax} m/s · ΔP acumulada ≤ ${String(p.gas.dpMax).replace('.', ',')} mbar (${p.norma.gas})`;
}
