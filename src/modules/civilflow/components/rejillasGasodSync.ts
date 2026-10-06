import { getActiveProyectoId, loadFromStorage, saveToStorage } from '../services/storageService';
import { loadRejillasProyecto, saveRejillasProyecto } from '../services/projectDataService';
import { APARATOS_BY_TRAMO_KEY } from '../constants/storage-keys';
import { devError } from '../../../utils/devError';

/** Sincronía BD de los conteos de gasodomésticos de áreas rejillas (claves gas_AR…), VIVA
 *  aunque la tabla de Rejillas esté cerrada:
 *  - startRejillasGasodSync(): cada 'aparatos-clear' (panel del visor, tabla, GC) re-empuja
 *    el blob con lo que hay en disco — sin esto borrar/asignar desde el PANEL dejaba el
 *    blob viejo y la hidratación resucitaba lo borrado.
 *  - hidratarRejillasGasod(): fill-missing del blob al disco — sin esto el panel derecho
 *    arrancaba vacío hasta que el usuario entrara a la tabla (única hidratación existente).
 *  Idempotente y seguro fuera de sesión (sin proyecto activo no-op). */

const OVERRIDES_KEY = 'rejillas_overrides_v1';
const GAS_KEY = 'rejillas_gas';
const PUSH_DEBOUNCE_MS = 800;

/** Claves gas_AR… del mapa de aparatos con contenido (los gasodomésticos por sector). */
function leerGasod(): Record<string, Record<string, number>> {
  const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const out: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(disk)) {
    if (/^gas_AR/.test(k) && v && Object.keys(v).length) out[k] = v;
  }
  return out;
}

let pushTimer: number | null = null;
/** Pid de la última hidratación completada: el disco ya contiene (o BD no tenía) las
 *  claves gas_AR DE ESE proyecto. Al cambiar de proyecto vuelve a "no hidratado" — sin
 *  esto el push del proyecto nuevo re-enviaría el gasod (local, mezclado) de otro. */
let hidratadoPid = '';

/** Push del blob rejillas. Merge, no overwrite: overrides y gas SOLO se envían si el
 *  disco local los tiene; si no, se conservan los del blob en BD (el panel cerrado no
 *  puede reconstruirlos — pisarlos con defaults los borraba entre dispositivos).
 *  gasod igual, pero solo cuenta como fuente tras la primera hidratación (`hidratado`). */
async function pushBlobAhora(): Promise<void> {
  pushTimer = null;
  const pid = getActiveProyectoId();
  if (!pid) return;
  // '{}' del loader NO es fuente (un dispositivo fresco lo pisaría sobre BD): sin
  // claves en disco mandan los overrides del blob — igual criterio que el gasod.
  const ovrDisk = loadFromStorage<Record<string, unknown> | null>(OVERRIDES_KEY, null) ?? {};
  const gasDisk = loadFromStorage<'natural' | 'glp' | null>(GAS_KEY, null);
  const prev = (await loadRejillasProyecto(pid).catch(() => null)) as {
    overrides?: Record<string, unknown>;
    gas?: 'natural' | 'glp';
    gasod?: Record<string, Record<string, number>>;
  } | null;
  void saveRejillasProyecto(pid, {
    overrides: Object.keys(ovrDisk).length ? ovrDisk : (prev?.overrides ?? {}),
    gas: gasDisk ?? prev?.gas ?? 'natural',
    // Antes de la primera hidratación DEL PROYECTO ACTIVO el disco no es fuente
    // confiable (dispositivo fresco: le faltan las claves gas_AR de BD) — se
    // re-envía el gasod de BD intacto.
    gasod: hidratadoPid === pid ? leerGasod() : (prev?.gasod ?? {}),
    ts: Date.now(),
  }).catch((e) => devError('rejillasGasodSync push:', e));
}

let started = false;
/** Timestamp (Date.now) del último 'aparatos-clear' LOCAL (del usuario): la frescura de hidratarRejillasGasod. */
let ultimoCambioLocal = 0;
export function startRejillasGasodSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('aparatos-clear', (e) => {
    // El fill de hidratación dispara el evento programáticamente: NO es edición del
    // usuario — no marca frescura ni agenda push (empujaría estado default sobre BD).
    if ((e as CustomEvent).detail?.origen === 'hidratacion') return;
    ultimoCambioLocal = Date.now();
    // Pid capturado AL AGENDAR: si el proyecto activo cambió durante el debounce, el
    // push disparado escribiría el blob del proyecto viejo sobre el nuevo (mismo
    // guard del pushBd de RejillasVentilación).
    const pidAgendado = getActiveProyectoId();
    if (pushTimer !== null) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => {
      if (getActiveProyectoId() === pidAgendado) void pushBlobAhora();
    }, PUSH_DEBOUNCE_MS);
  });
}

/** Fill-missing del blob BD → disco (solo claves ausentes; nunca pisa lo local).
 *  Guard de frescura: si hubo edición local ('aparatos-clear') durante el fetch, el
 *  blob puede ser previo al borrado — se aborta para no resucitar conteos. */
export async function hidratarRejillasGasod(): Promise<void> {
  try {
    const pid = getActiveProyectoId();
    if (!pid) return;
    const cambioAlIniciar = ultimoCambioLocal;
    const blob = (await loadRejillasProyecto(pid)) as {
      gasod?: Record<string, Record<string, number>>;
    } | null;
    if (ultimoCambioLocal !== cambioAlIniciar) return;
    if (!blob?.gasod || typeof blob.gasod !== 'object') {
      // BD sin gasod: el fill terminó sin nada que completar — el disco local ya es
      // fuente confiable para el push (sin esto el primer dispositivo nunca sincronizaría).
      hidratadoPid = pid;
      return;
    }
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    let changed = false;
    for (const [k, v] of Object.entries(blob.gasod)) {
      if (k.startsWith('gas_') && v && typeof v === 'object' && !disk[k]) {
        disk[k] = v;
        changed = true;
      }
    }
    // ANTES del dispatch: el 'aparatos-clear' de abajo agenda un push que debe ver
    // el disco ya completado (si no, re-enviaría el gasod de BD y anularía el fill).
    hidratadoPid = pid;
    if (changed) {
      saveToStorage(APARATOS_BY_TRAMO_KEY, disk);
      // detail.origen = 'hidratacion': el fill es PROGRAMÁTICO — los listeners que
      // distinguen usuario de máquina (editadoRef del tab, Frescura del push) NO deben
      // tratarlo como edición ni agenda push con estado default (pisaba la hidratación).
      window.dispatchEvent(
        new CustomEvent('aparatos-clear', { detail: { origen: 'hidratacion' } }),
      );
    }
  } catch (e) {
    devError('rejillasGasodSync hidratar:', e);
  }
}
