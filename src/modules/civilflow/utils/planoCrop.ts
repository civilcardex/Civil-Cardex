import { PLAN_CROP_KEY } from '../constants/storage-keys.ts';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../services/storageService.ts';

/** Rectángulo de recorte del fondo del plano, en px del lienzo rasterizado (x/y esquina y w/h tamaño). */
export interface PlanCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Recorte guardado del plano (localStorage); null si nunca se recortó. */
export function loadPlanCrop(): PlanCrop | null {
  return loadFromStorage<PlanCrop | null>(PLAN_CROP_KEY, null);
}

/** Guarda el recorte; null lo elimina (el plano vuelve a mostrarse completo). */
export function savePlanCrop(crop: PlanCrop | null): void {
  if (!crop) {
    removeFromStorage(PLAN_CROP_KEY);
    return;
  }
  saveToStorage(PLAN_CROP_KEY, crop);
}
