/**
 * Tipos de dominio del módulo civilflow compartidos entre contexts, servicios y componentes.
 * Viven en su propio archivo SIN imports (solo tipos primitivos) para romper los ciclos de
 * import que se formaban cuando Piso vivía en useWorkAreaState y PlanMeta en PlansContext —
 * proyectoDataService y los contexts de proyecto los importaban de ida y vuelta.
 */

/** Piso de un proyecto (nivel con su cota y tipo). */
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
