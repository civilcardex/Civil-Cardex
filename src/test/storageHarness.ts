// Arnés de storage para tests: UNA forma de sembrar y leer los documentos del proyecto,
// SIEMPRE con las constantes de storage-keys (los literales 'aparatos_by_tramo_v2' en tests
// rev-ables eran la mayor fuente de fragilidad). Se apoya en el MemStorage global de
// vitest.setup.ts; `resetStorage()` deja cada test con estado limpio.
import {
  APARATOS_BY_TRAMO_KEY,
  TRAZOS_PREFIX,
} from '../modules/civilflow/constants/storage-keys.ts';

/** Borra TODO el storage mock — llamar en beforeEach. */
export function resetStorage(): void {
  localStorage.clear();
  sessionStorage.clear();
}

/** Documento de trazos de un piso: doc crudo bajo `civilflow_trazos_<planoId>`. */
export function seedTrazos(planoId: string | number, doc: Record<string, unknown>): void {
  localStorage.setItem(`civilflow_${TRAZOS_PREFIX}${planoId}`, JSON.stringify(doc));
}

/** Lee el doc de trazos sembrado/escrito por la lógica bajo prueba. */
export function trazosDe(planoId: string | number): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(`civilflow_${TRAZOS_PREFIX}${planoId}`) || '{}');
}

/** Mapa de aparatos por tramo bajo `civilflow_aparatos_by_tramo_v2`. */
export function seedAparatos(mapa: Record<string, Record<string, number>>): void {
  localStorage.setItem(`civilflow_${APARATOS_BY_TRAMO_KEY}`, JSON.stringify(mapa));
}

export function aparatos(): Record<string, Record<string, number>> {
  return JSON.parse(localStorage.getItem(`civilflow_${APARATOS_BY_TRAMO_KEY}`) || '{}');
}
