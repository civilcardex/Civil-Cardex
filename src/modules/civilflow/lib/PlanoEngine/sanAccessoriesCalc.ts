/**
 * Orquestador de los accesorios de los ramales san (Sanitaria)/vent (Ventilación) del piso:
 * detecta uniones (sanJunctionDetect), limpia yees/tapones muertos (sanTaponValidation) y
 * sincroniza los conteos con el storage hidráulico (sanAccessoryCount) para las tablas de
 * accesorios por diámetro. La geometría vive en sanJunctionGeometry (ctx compartido).
 * EJECUTAR LOS PASES EN ESTE ORDEN — las mutaciones son secuenciales con dependencias
 * (el escape de banderas muertas alimenta la limpieza; la limpieza alimenta el conteo).
 * Ej: 2 codos y una tee en RAF1 aparecen en la fila 2" del resumen.
 */
import type { IPlanoEngineCore } from './PlanoState.ts';
import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import { EV_STORAGE } from '../../utils/fixtureEvents.ts';
import { crearCtxSanJunction } from './sanJunctionGeometry.ts';
import { detectarJunctiones } from './sanJunctionDetect.ts';
import { limpiarYeesMuertas, validarTaponesGlobales } from './sanTaponValidation.ts';
import {
  contarAccesoriosPorRamal,
  contarYeesYTees,
  type HidroTramoEntry,
} from './sanAccessoryCount.ts';

// API pública conservada: hydroAccessoriesCalc.ts importa el tipo desde aquí.
export type { HidroTramoEntry } from './sanAccessoryCount.ts';

/** Cuenta los accesorios de los ramales san/vent del piso y escribe su hidráulica
 *  (tramo_hidro_data) para las tablas de accesorios por diámetro. */
export function calcSanitaryAccessories(engine: IPlanoEngineCore): void {
  const planId = engine._loadedPlanId;
  if (!planId) return;

  const sanRamales = engine.ramales.filter((r) => r.net === 'san');
  const ventRamales = engine.ramales.filter((r) => r.net === 'vent');

  const storageKey = 'tramo_hidro_data_v3';
  let hidroData: Record<string, HidroTramoEntry>;
  try {
    hidroData = loadFromStorage(storageKey, {}) as Record<string, HidroTramoEntry>;
  } catch {
    hidroData = {};
  }

  // 1. Geometría compartida (banderas yee persistidas + helpers de consulta).
  const ctx = crearCtxSanJunction(engine, sanRamales);
  // 2. Detección de yees/tees por vértice (puede limpiar banderas muertas — escape).
  const junction = detectarJunctiones(engine, ctx);
  // 3. Conteos yee/tee desde las uniones detectadas (snapshot antes de la limpieza).
  const conteos = contarYeesYTees(ctx, junction);
  // 4. Limpieza de yees muertas + tapones huérfanos (muta ramales y persistedYeePts).
  limpiarYeesMuertas(engine, ctx, junction.junctionPositions);
  // 5. Validación global de tapones en esquinas-L (retira y asigna codo).
  validarTaponesGlobales(engine, ctx);
  // 6. Conteo por ramal + sincronización del storage hidráulico.
  const changed = contarAccesoriosPorRamal(ctx, conteos, ventRamales, String(planId), hidroData);

  if (changed) {
    saveToStorage(storageKey, hidroData);
    try {
      window.dispatchEvent(new Event(EV_STORAGE));
    } catch {
      /* ignorar */
    }
  }
}
