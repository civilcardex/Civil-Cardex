/** Número es-CO (miles con punto, decimales con coma) a `d` decimales; "—" si no es finito.
 *  El formato del HTML de referencia RCI: 1066.2 → "1.066,20" (toFixed daría "1066.20").
 *  Ej: fmtEs(37.704) === "37,70"; fmtEs(NaN) === "—". */
export const fmtEs = (x: unknown, d = 2): string =>
  typeof x === 'number' && isFinite(x)
    ? x.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';
