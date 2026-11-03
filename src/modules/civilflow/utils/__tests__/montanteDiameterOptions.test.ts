/**
 * Tests del memo de opcionesDiametroElemento: la lista de diámetros de un montante depende del
 * CONTENIDO de civilflow_mats — cambiar el catálogo debe recalcular (antes el WeakMap dejaba
 * pegada la primera lista que vio cada elemento). Ej: af con 'PVC-S' (2"-6") → cambio a
 * 'Cobre rígido' (1/2"-2") → el MISMO elemento ve la lista nueva.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { opcionesDiametroElemento } from '../montanteDiameterOptions.ts';
import { loadFromStorage } from '../../services/storage/localStorage.ts';

/** localStorage mínimo (entorno node): el token del memo lee la cadena cruda del catálogo. */
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
});

/** Catálogo de materiales de una red con UN material activo (la forma de civilflow_mats). */
const mats = (red: string, val: string): string => JSON.stringify({ [red]: [{ val }] });

describe('opcionesDiametroElemento — memo invalidada por el catálogo civilflow_mats', () => {
  beforeEach(() => store.clear());

  it('la clave cruda del token y la de loadFromStorage son la MISMA (prefijo civilflow_)', () => {
    store.set('civilflow_civilflow_mats', mats('af', 'PVC-S'));
    expect(
      loadFromStorage<Record<string, Array<{ val: string }>> | null>('civilflow_mats', null),
    ).toEqual({ af: [{ val: 'PVC-S' }] });
  });

  it('mismo elemento: catálogo igual → hit del memo; catálogo cambiado → lista recalculada', () => {
    store.set('civilflow_civilflow_mats', mats('af', 'PVC-S'));
    const el = { tipo: 'montante', net: 'af' };
    const primera = opcionesDiametroElemento(el);
    expect(primera.map((d) => d.nom)).toEqual(['2"', '3"', '4"', '6"']);
    expect(opcionesDiametroElemento(el)).toBe(primera); // hit: mismo token

    store.set('civilflow_civilflow_mats', mats('af', 'Cobre rígido'));
    const segunda = opcionesDiametroElemento(el);
    expect(segunda).not.toBe(primera);
    expect(segunda.map((d) => d.nom)).toEqual(['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"']);
    /* Un elemento NUEVO bajo el catálogo nuevo ve lo mismo (la lectura viene del storage). */
    expect(segunda).toEqual(opcionesDiametroElemento({ tipo: 'montante', net: 'af' }));
  });
});
