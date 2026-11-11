/** Ayuda de las celdas de la tabla de pisos RCI (Red Contra Incendio) — Tipologías. La columna
 *  Planta se retiró (la planta sale del PLANO, no se digita); queda la ayuda de Salidas.
 *  Ej: <th scope="col" title={AYUDA_SALIDA}>Salidas</th>. */

/** Ayuda de la columna salidas: GRIS — la salida nace del dibujo (un gabinete GAB en el piso).
 *  La usa el title del th. */
export const AYUDA_SALIDA =
  'Salidas de manguera del montante en este piso (NFPA 14): la fija el DIBUJO — Sí cuando este piso tiene un gabinete (GAB) dibujado, Ninguna cuando no. Cada salida aporta 250 gpm (100 en Clase II) a la demanda del montante.';
