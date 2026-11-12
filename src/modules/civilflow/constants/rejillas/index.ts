/** Catálogo de rejillas NTC (Norma Técnica Colombiana) 3631 para dimensionar ventilación de
 *  recintos con aparatos a gas: constantes normativas, soluciones de ventilación, presets de
 *  gasodomésticos y rejillas comerciales con su área efectiva (aef).
 *  Ej: una cocina con calentador de 24 kW en recinto confinado exige aberturas superior
 *  e inferior con Σ cm²/kW del numeral 4.2.1. */
import type { RejRef } from './types.ts';
import { CATALOGO_SILPLAS } from './catalogo-silplas.ts';
import { CATALOGO_GRIVAL } from './catalogo-grival.ts';
import { CATALOGO_LAMINAIRE } from './catalogo-laminaire.ts';
import { CATALOGO_KOOLAIR } from './catalogo-koolair.ts';
import { CATALOGO_TROX } from './catalogo-trox.ts';

export * from './types.ts';
export * from './ntc3631.ts';
export * from './comerciales.ts';

/** Catálogo base (79 refs): Silplas 10, Grival 3 (sin aef), Laminaire L-OL-4 24,
 *  Laminaire L-DGD 17, Koolair 13, TROX 12. Fuentes: fichas del fabricante /
 *  catálogo HVAC 2025 (Laminaire, ft²×929 redondeado abajo) / catálogos españoles.
 *  El orden de la concatenación ES el orden histórico del catálogo (no cambiar). */
export const CATALOGO_BASE: RejRef[] = [
  ...CATALOGO_SILPLAS,
  ...CATALOGO_GRIVAL,
  ...CATALOGO_LAMINAIRE,
  ...CATALOGO_KOOLAIR,
  ...CATALOGO_TROX,
];
