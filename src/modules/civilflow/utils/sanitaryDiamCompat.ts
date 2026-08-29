import { diamPulgFromLabel } from './diamPulgFromLabel';

// Ítems 6/7/8: regla central de compatibilidad "aparato sanitario ↔ diámetro de ramal".
// Antes esta regla estaba duplicada (con variantes) en FixturesPanel, SanitaryDesign,
// legacyEditors, ramalMenu y writeDiameterToDrawing — cada copia podía desincronizarse y dejar
// que un camino permitiera un diámetro que otro bloqueaba. Aquí es LA única fuente.

/** Identificador del inodoro en los contadores de aparatos (APARATOS_BY_TRAMO_KEY: `san`). */
export const INODORO_APP_ID = 'san';

/** Diámetro mínimo (pulgadas) que admite un aparato sanitario asignado al ramal.
 *  Solo el inodoro tiene restricción estricta (4" — no puede trabajar con menos); el resto de
 *  aparatos y la ausencia de aparato no restringen el diámetro (el "2\" default" de otros es un
 *  relleno al asignar, no un mínimo bloqueante). */
export function sanMinDiamPulgForApparatus(aparatoId: string | undefined | null): number {
  if (aparatoId === INODORO_APP_ID) return 4;
  return 0;
}

/** ¿El diámetro (en pulgadas) propuesto respeta el mínimo del aparato dado? */
export function sanDiamAllowedForApparatus(newPulg: number, aparatoId?: string | null): boolean {
  if (newPulg <= 0) return true;
  return newPulg >= sanMinDiamPulgForApparatus(aparatoId);
}

/** Igual pero desde la etiqueta completa del diámetro (p. ej. `1/2" — 12.7 mm`). */
export function sanDiamLabelAllowedForApparatus(
  newLabel: string,
  aparatoId?: string | null,
): boolean {
  const pulg = newLabel ? diamPulgFromLabel(newLabel) : 0;
  return sanDiamAllowedForApparatus(pulg, aparatoId);
}

/** Mensaje de alerta canónico para el bloqueo por inodoro. */
export const SAN_INODORO_MIN_MSG =
  'El ramal con inodoro requiere diámetro mínimo de 4". Selecciona un diámetro mayor o igual a 4".';
