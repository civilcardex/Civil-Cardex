/**
 * Un nivel (piso) ya tiene un plano asignado.
 *
 * La comprobaci\u00f3n estaba repetida 5 veces (la lista de pendientes, la lista de cargados, el
 * modal de asignar piso y el configurador): un solo lugar donde preguntarlo.
 * @param planes - los planos del proyecto.
 * @param nivel - el nivel a comprobar.
 * @param exceptPlanId - plano que se est\u00e1 asignando (no cuenta como ocupado).
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
