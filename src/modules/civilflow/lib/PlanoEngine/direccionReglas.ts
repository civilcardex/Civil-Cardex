// Restricción de dirección 'baja' (orig. usuario pt. 9): el ÚLTIMO nivel inferior del proyecto
// (el de mayor npt — no tiene otro piso debajo) no puede tener un bajante con direccion 'baja',
// porque el flujo no tiene a dónde continuar. Validación de MODELO: se aplica en creación,
// menú, panel, asociación, copia y carga — no solo en la UI.

/**
 * ¿Hay un piso por DEBAJO del bajante? El npt es ELEVACIÓN: el último nivel inferior (sótano,
 * visto de arriba hacia abajo) es el de MENOR npt del proyecto. 'baja' exige un piso con npt
 * aún menor. Sin niveles conocidos no bloquea (comportamiento previo).
 */
export function direccionBajaPermitida(
  engine: {
    nptLevels?: Array<{ npt?: number }> | unknown[];
    nivelActual?: { npt?: number } | null;
  },
  baj: { nptBase?: number | string | null } | null | undefined,
): boolean {
  const npts = ((engine.nptLevels || []) as Array<{ npt?: number }>)
    .map((l) => Number(l.npt))
    .filter((n) => Number.isFinite(n));
  if (npts.length === 0) return true;
  const minNpt = Math.min(...npts);
  const nptBaj = Number(baj?.nptBase ?? engine.nivelActual?.npt ?? NaN);
  if (!Number.isFinite(nptBaj)) return true;
  return nptBaj > minNpt + 0.001;
}

/**
 * Dirección efectiva para escribir: 'baja' prohibida en el último nivel inferior se coerces a
 * 'continua' (orig. usuario pt. 9 — dirección válida alternativa). Otra dirección pasa igual.
 */
export function direccionSegura(
  engine: {
    nptLevels?: Array<{ npt?: number }> | unknown[];
    nivelActual?: { npt?: number } | null;
  },
  baj: { nptBase?: number | string | null } | null | undefined,
  direccion: string | null | undefined,
): string | undefined {
  if (direccion === 'baja' && !direccionBajaPermitida(engine, baj)) return 'continua';
  return direccion || undefined;
}
