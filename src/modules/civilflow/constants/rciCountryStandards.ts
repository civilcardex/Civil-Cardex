/** Normativa local de protección contra incendios por país (RCI): el marco LEGAL que cada
 *  país impone alrededor del diseño con NFPA 13/14 (código local, artículos típicos que
 *  exigen rociadores/montantes, adopción nacional, norma eléctrica y bloque sísmico).
 *  Los RANGOS numéricos (S/L/Dmuro…) son NFPA 13 en los 6 países — nadie diverge hoy; el
 *  campo `hz` queda cableado para un override futuro.
 *  Ej: perfilRciDe('Colombia').codLocal = 'NSR-10 Título J · NTC 1500'. */
import { NORMAS_PAIS } from './countryStandards.ts';

/** Perfil RCI de un país: textos de referencia predecibles y editables (siPrev del merge
 *  respeta lo que el usuario digite). Los países sin regla RCI sísmica verificable dejan el
 *  bloque sísmico vacío (BO). */
export interface NormaRciPais {
  /** Código de edificación aplicable (fila «Código local» de Normativa local). */
  codLocal: string;
  /** ¿El código exige rociadores? + artículo típico (referencia, editable). */
  exigeRoc: 'Sí' | 'No';
  refRoc: string;
  /** ¿Exige montantes/gabinetes? + artículo típico. */
  exigeSP: 'Sí' | 'No';
  refSP: string;
  /** Cómo adopta el país a NFPA 13 (obligatorio por reglamento vs referencial). */
  adopNac: string;
  /** Norma eléctrica local. */
  normElec: string;
  /** Bloque sísmico (vacío = sin regla RCI verificable): norma, nombre del parámetro de
   *  referencia y zona típica. Ej: CO → NSR-10 A con Aa/Av. */
  reqSismo?: 'Sí';
  normSis?: string;
  parLabel?: string;
  zonaAuto?: string;
  /** Cita corta para checks y ayudas: la norma de diseño con su marco legal. */
  citaRci: string;
  /** ponytail: override futuro de la tabla HZ (rangos S/L por riesgo) si un país diverge de
   *  NFPA 13. Hoy nadie diverge — vacío en los 6. */
  hz?: never;
}

const CO: NormaRciPais = {
  codLocal: 'NSR-10 Título J · NTC 1500',
  exigeRoc: 'Sí',
  refRoc: 'NSR-10 J.1 (según uso y altura) · NTC 1500 cap. 9',
  exigeSP: 'Sí',
  refSP: 'NSR-10 J.2 (edificios ≥ 24 m)',
  adopNac: 'NSR-10 J.1.2 — NFPA 13 obligatorio',
  normElec: 'NTC 2050',
  reqSismo: 'Sí',
  normSis: 'NSR-10 A.4 / NFPA 13 cap. 18',
  parLabel: 'Aa / Av (NSR-10 apéndice A-4)',
  zonaAuto: 'Derivada de Aa/Av (Baja · Intermedia · Alta)',
  citaRci: 'NFPA 13-2025 (NSR-10 J)',
};

const PE: NormaRciPais = {
  codLocal: 'RNE A.130 · NTP 350.043-1',
  exigeRoc: 'Sí',
  refRoc: 'RNE A.130-6 (riesgo según uso)',
  exigeSP: 'Sí',
  refSP: 'RNE A.130-7 · NTP 350.043-1',
  adopNac: 'NTP 350.043-1 adopta NFPA (referencial)',
  normElec: 'RNE EM.010',
  reqSismo: 'Sí',
  normSis: 'RNE E.030 / NFPA 13 cap. 18',
  parLabel: 'Z (RNE E.030, 0 < Z ≤ 0,45)',
  zonaAuto: 'Según zona sísmica E.030 (1–4)',
  citaRci: 'NFPA 13-2025 (RNE A.130)',
};

const EC: NormaRciPais = {
  codLocal: 'NEC-11 Sección 17',
  exigeRoc: 'Sí',
  refRoc: 'NEC-17.1 (riesgo según uso y altura)',
  exigeSP: 'Sí',
  refSP: 'NEC-17.2',
  adopNac: 'NEC-11 remite a NFPA (referencial)',
  normElec: 'NEC-10',
  reqSismo: 'Sí',
  normSis: 'NEC-11 Peligro sísmico / NFPA 13 cap. 18',
  parLabel: 'Z (NEC-11, espectro de peligro)',
  zonaAuto: 'Según zona sísmica NEC-11',
  citaRci: 'NFPA 13-2025 (NEC-11)',
};

const CL: NormaRciPais = {
  codLocal: 'DS 44/2022 · OGUC 4.2',
  exigeRoc: 'Sí',
  refRoc: 'OGUC 4.2 (según uso y altura)',
  exigeSP: 'Sí',
  refSP: 'DS 44/2022 art. 4.x',
  adopNac: 'DS 44/2022 obliga proyecto según NFPA/NCh',
  normElec: 'NCh Elec. 4/2003',
  reqSismo: 'Sí',
  normSis: 'NCh433/DS61 / NFPA 13 cap. 18',
  parLabel: 'Zona sísmica (NCh433 Of.1996 mod. DS61: 1–3)',
  zonaAuto: 'Según zona NCh433 (1–3)',
  citaRci: 'NFPA 13-2025 (DS 44)',
};

const AR: NormaRciPais = {
  codLocal: 'IRAM 3517 · legislación provincial',
  exigeRoc: 'Sí',
  refRoc: 'IRAM 3517-1 (según riesgo)',
  exigeSP: 'Sí',
  refSP: 'IRAM 3517-2',
  adopNac: 'IRAM adapta NFPA (referencial)',
  normElec: 'AEA 90364',
  reqSismo: 'Sí',
  normSis: 'INPRES-CRESPEC / NFPA 13 cap. 18',
  parLabel: 'Zona INPRES (0–4)',
  zonaAuto: 'Según zona INPRES',
  citaRci: 'NFPA 13-2025 (IRAM 3517)',
};

const BO: NormaRciPais = {
  codLocal: 'NFPA 13 (referencia)',
  exigeRoc: 'No',
  refRoc: '',
  exigeSP: 'No',
  refSP: '',
  adopNac: 'NFPA 13 referencial (sin adopción nacional RCI verificable)',
  normElec: 'NB 777',
  // Sin bloque sísmico: sin regla RCI sísmica boliviana verificable — se deja al criterio.
  citaRci: 'NFPA 13-2025 (ref.)',
};

/** Perfil RCI por id de país (los 6 activos de NORMAS_PAIS). */
export const NORMAS_RCI_PAIS: Record<string, NormaRciPais> = {
  CO,
  PE,
  EC,
  CL,
  AR,
  BO,
};

/** Perfil RCI por NOMBRE de país (el que guarda el proyecto). Fallback Colombia — también
 *  para los países eliminados (MX/VE/…), igual que perfilDe(). Ej: perfilRciDe('Perú'). */
export function perfilRciDe(nombrePais: string | undefined | null): NormaRciPais {
  const id = idDeNombre(nombrePais);
  return NORMAS_RCI_PAIS[id] || CO;
}

/** Cita corta de la norma RCI del país (para checks y ayudas). Ej: rciTxt('Chile') → 'NFPA 13-2025 (DS 44)'. */
export function rciTxt(nombrePais: string | undefined | null): string {
  return perfilRciDe(nombrePais).citaRci;
}

/* Reutiliza el índice de NORMAS_PAIS (nombre→id, eliminados → CO) sin duplicarlo. */
function idDeNombre(nombre: string | undefined | null): string {
  const n = (nombre || '').trim().toLowerCase();
  if (!n) return 'CO';
  const activo = NORMAS_PAIS.find((p) => p.nombre.toLowerCase() === n);
  if (activo) return activo.id;
  const porId = NORMAS_PAIS.find((p) => p.id.toLowerCase() === n);
  return porId ? porId.id : 'CO';
}
