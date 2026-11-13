/**
 * Remapeo de las claves de conteos en storage al copiar entre pisos: aparatos, datos hidro y
 * accesorios de gas viajan con la clave `net_id_plan` del piso destino (solo si no existe ya).
 * Ej: RS1 del Piso 1 con 2 lavamanos → al copiar al Piso 2 nace af_RS2_2 con esos 2 lavamanos.
 */
import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../../constants/storage-keys.ts';

/** Par old→new de ids de una copia (el remapeo de claves y conteos lo consume entero). */
export interface ParCopia {
  oldId: string;
  newId: string;
}

// Copia total (orig. usuario): los datos hidráulicos SÍ viajan — diámetros, materiales,
// accesorios, aparatos, fixtures y conteos (remapeados a los ids nuevos del piso destino).
// Solo se descartan cachés de render/fantasmas y punteros entre pisos (descargaEnId/origenId),
// que referencian otro piso y ya no significan nada en el destino.
export function copyStoreKeys(
  pairs: ParCopia[],
  netId: string,
  srcPid: string,
  dstPid: string,
): void {
  if (pairs.length === 0) return;
  const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
    APARATOS_BY_TRAMO_KEY,
    {},
  );
  const hidro = loadFromStorage<
    Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
  >(HYDRO_DATA_STORAGE_KEY, {});
  const gas = loadFromStorage<Record<string, Record<string, number>>>(GAS_ACC_KEY, {});
  let aC = false;
  let hC = false;
  let gC = false;
  for (const { oldId, newId } of pairs) {
    const from = `${netId}_${oldId}_${srcPid}`;
    const to = `${netId}_${newId}_${dstPid}`;
    if (aparatos[from] && !aparatos[to]) {
      aparatos[to] = { ...aparatos[from] };
      aC = true;
    }
    if (hidro[from] && !hidro[to]) {
      hidro[to] = { ...hidro[from], accesorios: { ...(hidro[from].accesorios || {}) } };
      hC = true;
    }
    // Gas vive como `gas_<id>_<plan>` (y legado `gas_<id>` sin plan, compartido — ese no
    // se toca: copiarlo duplicaría el conteo en el piso origen).
    const gFrom = `gas_${oldId}_${srcPid}`;
    const gTo = `gas_${newId}_${dstPid}`;
    const gVal = gas[gFrom] ?? gas[`gas_${oldId}`];
    if (gVal && !gas[gTo]) {
      gas[gTo] = { ...gVal };
      gC = true;
    }
  }
  if (aC) saveToStorage(APARATOS_BY_TRAMO_KEY, aparatos);
  if (hC) saveToStorage(HYDRO_DATA_STORAGE_KEY, hidro);
  if (gC) saveToStorage(GAS_ACC_KEY, gas);
}

/** Borra claves de conteos de copias retiradas en modo solo-fantasmas (UD (Unidades de Desague) huérfanas). */
export function purgarClavesDeCopias(pairs: ParCopia[], netId: string, dstPid: string): void {
  if (pairs.length === 0) return;
  const aparatos = loadFromStorage<Record<string, unknown>>(APARATOS_BY_TRAMO_KEY, {});
  const hidro = loadFromStorage<Record<string, unknown>>(HYDRO_DATA_STORAGE_KEY, {});
  const gas = loadFromStorage<Record<string, unknown>>(GAS_ACC_KEY, {});
  let cambio = false;
  for (const { newId } of pairs) {
    for (const [store, key] of [
      [aparatos, `${netId}_${newId}_${dstPid}`],
      [hidro, `${netId}_${newId}_${dstPid}`],
      [gas, `gas_${newId}_${dstPid}`],
    ] as const) {
      if (key in store) {
        delete store[key];
        cambio = true;
      }
    }
  }
  if (cambio) {
    saveToStorage(APARATOS_BY_TRAMO_KEY, aparatos);
    saveToStorage(HYDRO_DATA_STORAGE_KEY, hidro);
    saveToStorage(GAS_ACC_KEY, gas);
  }
}
