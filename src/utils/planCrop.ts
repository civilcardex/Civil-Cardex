import { PLAN_CROP_KEY } from '../constants/storage-keys';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../services/storageService';

export interface PlanCrop { x: number; y: number; w: number; h: number }

export function loadPlanCrop(): PlanCrop | null {
  return loadFromStorage<PlanCrop | null>(PLAN_CROP_KEY, null);
}

export function savePlanCrop(crop: PlanCrop | null): void {
  if (!crop) { removeFromStorage(PLAN_CROP_KEY); return; }
  saveToStorage(PLAN_CROP_KEY, crop);
}
