/**
 * ¿Un nivel (piso) ya tiene un plano asignado? Ej: planos con nivel 1 y 2 -> pisoOcupadoPor(planes, 3) = false.
 * @param planes los planos del proyecto.
 * @param nivel el nivel a comprobar.
 * @param exceptPlanId plano que se está asignando (no cuenta como ocupado).
 */
export function pisoOcupadoPor(
  planes: Array<{ id?: string | number; nivel?: number | string | null }>,
  nivel: number | string,
  exceptPlanId?: string | number | null,
): boolean {
  return planes.some(
    (p) =>
      p.nivel != null &&
      String(p.nivel) === String(nivel) &&
      (exceptPlanId == null || String(p.id) !== String(exceptPlanId)),
  );
}
