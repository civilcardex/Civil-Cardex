// Funciones puras de matching (alineación entre láminas y adopción de diámetro) de la
// asociación entre pisos: mismas reglas 0.5 px que el resto del módulo, sin tocar storage.
// Ej: dos extremos caen en el mismo punto del edificio aunque sus láminas estén corridas.
import { origenDePlan } from '../crossFloorStorage.ts';
import type { AssocEndpoint } from './types.ts';

/** ¿Dos extremos caen en el MISMO punto del edificio? Se compara restando el origen de calibración de cada lámina (si no, hojas corridas darían falsos positivos); tolerancia 0.5 px de plano. */
export function isAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  // Alineación FÍSICA (misma regla 0.5 px): px crudos de láminas distintas NO significan el
  // mismo punto del edificio cuando las hojas están corridas — se compara origen-relativo
  // (misma resta que hace la isometría). Sin origen en alguna lámina, fallback crudo
  // (comportamiento legacy: hojas asumidas alineadas).
  const oa = origenDePlan(a.planId);
  const ob = origenDePlan(b.planId);
  const ax = oa && ob ? a.x - oa.x_px : a.x;
  const ay = oa && ob ? a.y - oa.y_px : a.y;
  const bx = oa && ob ? b.x - ob.x_px : b.x;
  const by = oa && ob ? b.y - ob.y_px : b.y;
  return Math.abs(ax - bx) < 0.5 && Math.abs(ay - by) < 0.5;
}

/** Igual que isAligned pero exportada para pruebas (misma comparación origen-relativa, sin duplicarla). */
export function areEndpointsAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  return isAligned(a, b);
}

/** Diámetro entre pisos (ped. usuario): el asociado toma el dNominal del SUPERIOR en cada pase — no solo al asociar. Devuelve true si cambió. */
export function adoptarDiametroDelSuperior(
  asociado: { dNominal?: string },
  superior?: { dNominal?: string } | null,
): boolean {
  if (!superior?.dNominal || asociado.dNominal === superior.dNominal) return false;
  asociado.dNominal = superior.dNominal;
  return true;
}
