import { loadFromStorage } from '../../services/almacenamientoServicio.ts';
import {
  APARATOS_HEREDADOS_KEY,
  APARATOS_HEREDADOS_TRIB_KEY,
  BAJADAS_RECEPTORAS_KEY,
} from '../../constants/almacenamientoClaves.ts';
import type { Cnt } from './conteo.ts';

const HEREDADOS_KEY = APARATOS_HEREDADOS_KEY;
const HEREDADOS_TRIB_KEY = APARATOS_HEREDADOS_TRIB_KEY;

/** Diagnóstico de la última propagación (orig. usuario: pega este JSON para depurar el
 *  storage real - piezas, libros, bajadas, transferencias y aristas). */
let ultimaDiag: unknown = null;
export function setUltimaDiag(d: unknown): void {
  ultimaDiag = d;
}
export function diagUltimaPropagacion(): unknown {
  return ultimaDiag;
}

/** ¿La red es de presión y por tanto propaga aparatos? Sí para agua fría, caliente y gas (af (Agua Fria)/ac (Agua Caliente)/gas (Gas)). */
export function esRedAparatosPresion(net: string): net is 'af' | 'ac' | 'gas' {
  return net === 'af' || net === 'ac' || net === 'gas';
}

/**
 * ¿La clave es un RECEPTOR (bajada o trib marcado)? Hoy sin lectores en el panel
 * (el bloqueo usa heredados no vacíos) - se conserva como API para el criterio por libro.
 * @param key - clave `net_id_pid` del tramo.
 * @returns true si el libro `bajadas_receptoras_v1` la marca.
 */
export function esReceptorPropagacion(key: string): boolean {
  const libro = loadFromStorage<Record<string, number>>(BAJADAS_RECEPTORAS_KEY, {}) || {};
  return !!libro[key];
}

/** Cuaderno de qué heredó cada tramo (sin contar el plegado de sus tributarios): lo usan el panel y la tabla de UC para mostrar "(+N)". */
export function leerHeredadosPresion(key: string): Cnt {
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {};
  return libros[key] || {};
}

/**
 * Plegado que recibió el tramo de sus tributarios (libro aparatos_heredados_trib_v1). Ej: RAC2 con T1 RAC5 plegado -> {lavamanos: 1}.
 * @param key - clave `net_id_pid` del tramo.
 * @returns mapa aparato->unidades plegadas.
 */
export function leerFoldTribPresion(key: string): Cnt {
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_TRIB_KEY, {}) || {};
  return libros[key] || {};
}

/**
 * Lee los dos libros de la propagación de UNA vez (una sola parseada por store): leerlos
 * por tramo serían N parseadas por render. Ej: con 200 tramos evita 400 JSON.parse.
 * @returns par de mapas (heredados, plegado) tal cual viven en storage.
 */
export function leerLibrosPresion(): {
  her: Record<string, Cnt>;
  fold: Record<string, Cnt>;
} {
  return {
    her: loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {},
    fold: loadFromStorage<Record<string, Cnt>>(HEREDADOS_TRIB_KEY, {}) || {},
  };
}

/**
 * UC (Unidades de Consumo) propias del tramo: lo que sirve él mismo, sin herencia de uniones ni plegado de tributarios. Ej: RAC5 con carga {lavamanos: 1} heredada -> propia {}.
 * @param carga - conteo de la clave (propio + heredado + plegado).
 * @param her - libro aparatos_heredados_v1 (herencia de uniones y montantes).
 * @param fold - libro aparatos_heredados_trib_v1 (plegado de tributarios).
 * @returns mapa aparato->unidades propias (nunca negativo).
 */
export function udPropiaDe(carga: Cnt, her: Cnt, fold: Cnt): Cnt {
  const out: Cnt = {};
  for (const k of new Set([...Object.keys(carga), ...Object.keys(her), ...Object.keys(fold)])) {
    const v = (carga[k] || 0) - (her[k] || 0) - (fold[k] || 0);
    if (v > 0) out[k] = v;
  }
  return out;
}

/** Despacha el evento storage para refrescar tablas/paneles (una sola copia del split). */
export function despacharStorage(): void {
  if (typeof window === 'undefined') return; // node/tests
  window.dispatchEvent(new Event('storage'));
}
