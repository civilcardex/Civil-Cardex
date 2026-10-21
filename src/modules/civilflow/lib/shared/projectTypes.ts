/** Tipos de dominio civilflow sin imports (rompe ciclos entre contexts y servicios). */

/** Piso del proyecto (nivel con npt (nivel de piso topografico) y tipo). */
export interface Piso {
  id: string | number;
  n: number;
  npt: number | string;
  ok: boolean;
  tipo: string;
  h: string;
}

/** Metadatos persistidos de un plano (sin el archivo — a diferencia de PlanItem). */
export interface PlanMeta {
  id: number;
  name: string;
  nivel: number | null;
  scale: number;
  status: string;
  origen?: { x_px: number; y_px: number } | null;
  factorX?: number | null;
  factorY?: number | null;
  calGlobal?: boolean | null;
  definedScale?: number | null;
}
