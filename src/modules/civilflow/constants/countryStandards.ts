/** Perfiles normativos por país: cada país usa SUS propios valores y SU norma citada con
 *  artículo + URL + fecha. Nada se hereda en silencio: donde la norma fija método pero no el
 *  valor numérico del chequeo, el valor se declara como criterio de verificación de la app con
 *  su referencia técnica. Ej: Perú separa 10 en red (OS.050 §4.8) de 2 en aparato (IS.010 §2.3.d).
 *  Fuentes: investigación 2026-10. */

export interface FuenteNorma {
  /** Cita exacta por red: artículo + URL + fecha de consulta, o 'criterio de verificación de la
   *  app' cuando la norma fija el método pero no el valor numérico. Ej: 'RNE IS.010 §2.3.d (gob.pe, 2026-10-16)'. */
  af: string;
  san: string;
  ll: string;
  gas: string;
  rci: string;
}

export interface PerfNormas {
  id: string;
  nombre: string;
  /** Agua fría/caliente (tabla de diseño): velocidad mín/máx (m/s), presión mínima de RED (red pública en entrega, m.c.a. (metros de columna de agua)), presión mínima en APARATO (punto más desfavorable, m.c.a.) y presión máxima del sistema (m.c.a.). Ej: Perú separa 10 en red (OS.050) de 2 en aparato (IS.010 §2.3.d). */
  af: {
    vMin: number;
    vMax: number;
    pMinRed: number;
    pMinAparato: number;
    pMax: number;
  };
  /** Sanitaria y lluvias por gravedad: velocidad (m/s), llenado máximo y/D, fuerza tractiva mínima (kg/m²). */
  san: { vMin: number; vMax: number; ydMax: number; ftMin: number };
  /** Gas: pérdida de presión máxima (mbar) y velocidad máxima (m/s). */
  gas: { dpMax: number; vMax: number };
  /** La norma que se le muestra al usuario para cada red. */
  norma: { af: string; san: string; ll: string; gas: string; rci: string };
  /** Etiqueta de referencia que cita la memoria del equipo de presión para pmin/pmax. Ej: 'NTC 1500 Tab.3'. */
  refPmin: string;
  refPmax: string;
  /** Fuente verificable por red (artículo + URL + fecha). 'pendiente' = valor heredado sin artículo. */
  fuente: FuenteNorma;
  /** true = matriz incompleta (algún parámetro sin artículo nacional): los valores pendientes
   *  se declaran como criterio de verificación de la app en 'fuente', nunca se copian en
   *  silencio. Solo Colombia tiene matriz completa. */
  ref?: boolean;
}

const CO: PerfNormas = {
  id: 'CO',
  nombre: 'Colombia',
  af: { vMin: 0.5, vMax: 2.5, pMinRed: 5, pMinAparato: 3, pMax: 50 },
  san: { vMin: 0.45, vMax: 4.0, ydMax: 0.75, ftMin: 0.15 },
  gas: { dpMax: 9.81, vMax: 10 },
  norma: {
    af: 'NTC 1500 / RAS 2000',
    san: 'RAS 2000 · NTC 1500',
    ll: 'RAS 2000 · NTC 1500',
    gas: 'NTC 3728',
    rci: 'NFPA 13 · NSR-10 J',
  },
  refPmin: 'NTC 1500 Tab.3',
  refPmax: 'NSR-10 H.4.2 — límite 500 kPa',
  fuente: {
    af: 'NTC 1500 / RAS 2000 (artículo pendiente de cita exacta)',
    san: 'RAS 2000 (artículo pendiente de cita exacta)',
    ll: 'RAS 2000 (artículo pendiente de cita exacta)',
    gas: 'NTC 3728 (artículo pendiente de cita exacta)',
    rci: 'NFPA 13 + NSR-10 Título J',
  },
};

export const NORMAS_PAIS: PerfNormas[] = [
  CO,
  {
    ...CO,
    id: 'PE',
    nombre: 'Perú',
    ref: true,
    af: { vMin: 0.6, vMax: 3.0, pMinRed: 10, pMinAparato: 2, pMax: 50 },
    norma: {
      af: 'RNE IS.010',
      san: 'RNE IS.010',
      ll: 'RNE OS.050',
      gas: 'RNE EM.040 (RM 341-2018)',
      rci: 'NFPA 13 (ref.)',
    },
    refPmin: 'RNE IS.010 §2.3.d — 2 m.c.a. en aparato',
    refPmax: 'RNE IS.010 §2.3.c — estática máx 50 m.c.a.',
    fuente: {
      af: 'IS.010 §2.3.f (v 0,60 + tabla por diámetro hasta 3,0) y §2.3.c/d (estática máx 50; aparato mín 2); pMinRed 10 de OS.050 §4.8 (dinámica mín a demanda máx. horaria). Todo DIGESA/MINSA + gob.pe, 2026-10-16.',
      san: 'IS.010 §6 (método UD + pendientes 1% ≥100mm / 1,5% ≤75mm + ventilación Art.24); límites Manning de verificación: criterio de la app (referencia técnica RAS 2000).',
      ll: 'RNE OS.050 (artículo pendiente)',
      gas: 'RNE EM.040 Instalaciones de Gas (RM 341-2018; grupo de actualización 2026) + NTP 111.011/321.121; dpMax/vMax: criterio de verificación de la app.',
      rci: 'NFPA 13 (int.)',
    },
  },
  {
    ...CO,
    id: 'EC',
    nombre: 'Ecuador',
    ref: true,
    af: { vMin: 0.6, vMax: 2.5, pMinRed: 15, pMinAparato: 5, pMax: 50 },
    norma: {
      af: 'NEC-11 Cap.16 NHE Agua',
      san: 'NEC (cap. desagüe pendiente)',
      ll: 'NEC (cap. desagüe pendiente)',
      gas: 'NEC-SB-IG · NTE INEN 2295',
      rci: 'NFPA 13 (ref.)',
    },
    refPmin: 'NEC-11 Cap.16 Tabla 16.1 por aparato (2–15 m.c.a.)',
    refPmax: 'NEC-11 Cap.16 §17.b — máx 50 m.c.a. en nudo de consumo',
    fuente: {
      af: 'NEC-11 Cap.16 §17: v 0,6–2,5 (óptimo 1,2) y acometida 1,5; p nudo ≤50; hidroneumático obligatorio si PminA<15 (umbral de red). pMinAparato 5: criterio operativo único (Tabla 16.1 da 2–15 por aparato).',
      san: 'Capítulo de desagüe NEC pendiente de identificación; práctica: pendiente mín 1%, inodoro Ø4". Límites Manning: criterio de la app.',
      ll: 'NEC (pendiente)',
      gas: 'NEC-SB-IG Instalaciones de gases combustibles + NTE INEN 2295; dpMax/vMax: criterio de verificación de la app.',
      rci: 'NFPA 13 (int.)',
    },
  },
  {
    ...CO,
    id: 'CL',
    nombre: 'Chile',
    ref: true,
    af: { vMin: 0.6, vMax: 2.5, pMinRed: 15, pMinAparato: 14, pMax: 45 },
    norma: {
      af: 'OGUC 4.1.5 · SISS · NCh 2485',
      san: 'RIDAA · OGUC 4.4',
      ll: 'RIDAA · OGUC 4.4',
      gas: 'DS 66/2007 · SEC',
      rci: 'NFPA 13 (ref.)',
    },
    refPmin: 'NCh 2485 vía RIDAA Art.52.f — 14 m.c.a. tras medidor',
    refPmax: 'pendiente (45 operativo; NCh 691 §8.5.2 fija 70 solo para red pública)',
    fuente: {
      af: 'RIDAA Dto.50 Art.52: v ≤2,5 ext./principal y ≤2,0 interior (envolvente 2,5); pmin según NCh 2485; prestador garantiza 14 tras medidor. NCh 691 §8.5: red pública 15 mín/70 máx — BCN LeyChile, 2026-10-16. vMin 0,6: criterio de la app.',
      san: 'RIDAA: UEH para dimensionar + desagüe gravitacional Art.37 + ventilación/descompresión; OGUC Título 5 Cap.9. Límites Manning: criterio de la app.',
      ll: 'RIDAA · OGUC 4.4 (artículo pendiente)',
      gas: 'DS 66/2007 Reglamento Instalaciones Interiores y Medidores de Gas, SEC (BCN idNorma=263058; mod. DS 13/2026); dpMax/vMax: criterio de verificación de la app.',
      rci: 'NFPA 13 (int.)',
    },
  },
  {
    ...CO,
    id: 'AR',
    nombre: 'Argentina',
    ref: true,
    af: { vMin: 1.0, vMax: 3.0, pMinRed: 10, pMinAparato: 10, pMax: 40 },
    norma: {
      af: 'Guía ERAS/AySA Res. 641/2023',
      san: 'OSN / Guía ERAS (pendiente de artículo)',
      ll: 'OSN / Guía ERAS (pendiente de artículo)',
      gas: 'NAG-200 ENARGAS (2019, mod. 2025)',
      rci: 'NFPA 13 (ref.)',
    },
    refPmin: 'Guía ERAS §2.9.1.4 (valor pendiente de extracción)',
    refPmax: 'pendiente (40 operativo)',
    fuente: {
      af: 'Guía ERAS/AySA Res. 641/2023 §2.12.1: Ve 1–3 m/s (cañerías 13–60 mm); pmin sobre artefactos §2.9.1.4 pendiente. Antes citaba ENRE por error (ENRE es electricidad).',
      san: 'OSN clásico (pendientes 1:20–1:100, inodoro Ø100) + Guía ERAS; artículos pendientes. Límites Manning: criterio de la app.',
      ll: 'OSN / Guía ERAS (pendiente de artículo)',
      gas: 'NAG-200 ENARGAS: Renouard + caída máx 10 mm c.a. ≈ 0,98 mbar (§5.2.8c ed. 1982; confirmar redacción NAG-200 2025 Cap.5). vMax: criterio de la app.',
      rci: 'NFPA 13 (int.)',
    },
    gas: { dpMax: 0.98, vMax: 10 },
  },
  {
    ...CO,
    id: 'BO',
    nombre: 'Bolivia',
    ref: true,
    af: { vMin: 0.6, vMax: 2.0, pMinRed: 10, pMinAparato: 10, pMax: 45 },
    norma: {
      af: 'RENISDA · NB 689',
      san: 'RENISDA · NB 688',
      ll: 'RENISDA',
      gas: 'NB 1069',
      rci: 'NFPA 13 (ref.)',
    },
    refPmin: 'NB 689: bandas 5/10/13 m.c.a. por población (valor 10 = banda media)',
    refPmax: 'pendiente (45 operativo; NB 689 fija 70 solo para red pública)',
    fuente: {
      af: 'RENISDA Reglamento Nacional de Instalaciones Sanitarias Domiciliarias (agua + desagüe + pluvial) + NB 689 §9.5.5/9.5.6 (redes: v 0,3–2,0; presiones 5/10/13 por población; estática máx 70). Interior: vMin y pMax operativos pendientes.',
      san: 'RENISDA + NB 688 alcantarillado (artículos pendientes). Límites Manning: criterio de la app.',
      ll: 'RENISDA (artículo pendiente)',
      gas: 'NB 1069 (pendiente de contenido)',
      rci: 'NFPA 13 (int.)',
    },
  },
];

/** Países eliminados del desplegable por no tener norma nacional verificable (ni valores propios
 *  ni artículos): sus proyectos existentes caen en Colombia por el fallback de perfilDe, sin
 *  migrar el texto guardado. Si un país vuelve con matriz verificada, se re-agrega su bloque.
 *  Ej: un proyecto guardado con pais='México' sigue mostrando '—' y calcula con CO. */
export const PAISES_ELIMINADOS = [
  'MX',
  'VE',
  'PY',
  'UY',
  'GT',
  'HN',
  'SV',
  'NI',
  'CR',
  'PA',
  'CU',
  'DO',
];

/** Perfil del país del proyecto; si no se reconoce, cae en Colombia. Ej: 'CL' → los rangos de Chile. */
export function perfilDe(pais: string | undefined): PerfNormas {
  const n = (pais || '').trim().toLowerCase();
  if (!n) return CO;
  return NORMAS_PAIS.find((p) => p.nombre.toLowerCase() === n || p.id.toLowerCase() === n) ?? CO;
}

/** Cita de la norma con marca de referencia: si el país no tiene matriz verificada, el tooltip
 *  lo dice en vez de fingir norma local. Ej: Perú → '(ref. RNE IS.010 — norma en verificación)'. */
function cita(p: PerfNormas, norma: string): string {
  return p.ref ? `(ref. ${norma} — norma en verificación)` : `(${norma})`;
}

/** Velocidad permitida en af (Agua Fria)/ac (Agua Caliente) con la cita del país, para los tooltips. Ej: Colombia → '0,5 – 2,5 m/s (NTC 1500 / RAS 2000)'. */
export function rangoAfTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.af.vMin.toFixed(2).replace('.', ',')}–${p.af.vMax.toFixed(2).replace('.', ',')} m/s ${cita(p, p.norma.af)}`;
}

/** Rango de velocidad sanitaria + cita normativa del país — para tooltips. Ej: '0,45 – 4 m/s (RAS 2000 · NTC 1500)'. */
export function rangoSanTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.san.vMin.toFixed(2).replace('.', ',')}–${p.san.vMax.toFixed(2).replace('.', ',')} m/s ${cita(p, p.norma.san)}`;
}

/** Fuerza tractiva mínima en sanitaria (kg/m²): si el agua llega con menos, los sólidos se estancan. Ej: '0,15 kg/m² (RAS 2000 · NTC 1500)'. */
export function ftTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `${p.san.ftMin.toFixed(2).replace('.', ',')} kg/m² ${cita(p, p.norma.san)}`;
}

/** Límites de gas del país (velocidad y pérdida de presión acumulada) + la norma local. Ej: 'V ≤ 10 m/s · ΔP acumulada ≤ 9,81 mbar (NTC 3728)'. */
export function gasTxt(pais: string | undefined): string {
  const p = perfilDe(pais);
  return `V ≤ ${p.gas.vMax} m/s · ΔP acumulada ≤ ${String(p.gas.dpMax).replace('.', ',')} mbar ${cita(p, p.norma.gas)}`;
}
