import { loadFromStorage } from '../../services/almacenamientoServicio.ts';
import {
  APARATOS_HEREDADOS_KEY,
  APARATOS_HEREDADOS_TRIB_KEY,
  BAJADAS_RECEPTORAS_KEY,
} from '../../constants/almacenamientoClaves.ts';
import { leerPiezas, calcularCargaBajantes } from './reading';
import { detectarDownTrib } from './tributaries';
import { calcularAristas } from './aristas.ts';
import { calcularUpMonte } from './arribaMontante.ts';
import { calcularPlegado } from './folding';
import { calcularTotales } from './dfs';
import { refrescarMontantes } from './accesorios.ts';
import { escribirDelta } from './writing';
import { setUltimaDiag } from './books';
import type { Cnt, Ctx } from './conteo.ts';

// La API pública vive en `libros` (los lectores) — se re-exporta aquí para que la fachada
// `../aparatosPresion` siga exponiendo exactamente lo mismo que antes.
export {
  esRedAparatosPresion,
  esReceptorPropagacion,
  leerHeredadosPresion,
  leerFoldTribPresion,
  leerLibrosPresion,
  udPropiaDe,
  diagUltimaPropagacion,
} from './books';

const APARATOS_KEY = 'aparatos_by_tramo_v2';
const HEREDADOS_KEY = APARATOS_HEREDADOS_KEY;
const HEREDADOS_TRIB_KEY = APARATOS_HEREDADOS_TRIB_KEY;

/**
 * Propagación PERSISTENTE de aparatos en redes de presión (af/ac, orig. usuario): los aparatos
 * "fluyen" con el agua - cada ramal RECIBE ESCRITO en su clave de conteos lo que hereda de
 * aguas arriba: montantes (con su carga heredada del piso inferior vía ucAplicado) y ramales
 * cuyas uniones de extremos lo alimentan (regla usuario RAF3 = montante-vía-RAF1 + lavamanos
 * de RAF2). Todo el cómputo se particiona POR PLANO (los ids se repiten entre pisos y las
 * copias bit-exactas comparten coordenadas: sin partición habría herencia fantasma cross-piso).
 * Patrón libro + delta de los bajantes sanitarios, con DOS libros: `aparatos_heredados_v1`
 * (herencia de uniones/montantes) y `aparatos_heredados_trib_v1` (plegado de tributarios).
 * manual = actual − libroHer − libroTrib → re-correr es idempotente y quitar un aparato
 * arriba baja solo abajo, sin re-sumarse nunca.
 *
 * Las fases viven en módulos propios (lectura, tributarios, aristas, upMonte, plegado, dfs,
 * montantes, escritura): este módulo solo las encadena.
 */
export function propagarAparatosPresion(net: 'af' | 'ac' | 'gas'): void {
  const disk = loadFromStorage<Record<string, Cnt>>(APARATOS_KEY, {}) || {};
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {};
  const bajadasLibro = loadFromStorage<Record<string, number>>(BAJADAS_RECEPTORAS_KEY, {}) || {};
  const librosTrib = loadFromStorage<Record<string, Cnt>>(HEREDADOS_TRIB_KEY, {}) || {};
  const diag: Record<string, unknown> = { net };

  // 1-2) Recolección por piso y carga de cada bajante/montante.
  const piezas = leerPiezas(net, disk, libros, bajadasLibro, diag);
  if (!piezas) return;
  const { ramales, bajes } = piezas;
  const cargaBaj = calcularCargaBajantes(net, disk, bajes);

  // 3) Aristas por clústeres de extremos + down-tribs (tributarios verticales abajo).
  const { downTrib, padresDeDown, ramalesPorPlano } = detectarDownTrib(ramales);
  const cadenaTrib = new Set<string>();
  const transferencias = new Map<string, string>();
  const { aristas, aristasPorDestino } = calcularAristas(
    ramales,
    downTrib,
    ramalesPorPlano,
    cadenaTrib,
    transferencias,
    bajadasLibro,
    disk,
    libros,
    librosTrib,
  );

  // 3b) Montantes/bajantes que alimentan cada ramal.
  const upMonte = calcularUpMonte(ramales, bajes, cargaBaj);

  const ctx: Ctx = {
    net,
    disk,
    libros,
    librosTrib,
    bajadasLibro,
    diag,
    ramales,
    bajes,
    cargaBaj,
    downTrib,
    padresDeDown,
    ramalesPorPlano,
    aristas,
    aristasPorDestino,
    cadenaTrib,
    transferencias,
    upMonte,
    manualCrudoDe: new Map(),
    heredadoAsocDe: new Map(),
    foldDe: new Map(),
    manualDe: new Map(),
    bajadasDown: new Set(),
    foldNDe: new Map(),
    totalDe: new Map(),
    heredadoDe: new Map(),
    tribFoldDe: new Map(),
    porKey: new Map(),
  };

  // 4-6) Manual + plegado, DFS de totales, refresco de montantes y escritura idempotente.
  calcularPlegado(ctx);
  calcularTotales(ctx);
  refrescarMontantes(ctx);
  escribirDelta(ctx);
  setUltimaDiag(diag);
}
