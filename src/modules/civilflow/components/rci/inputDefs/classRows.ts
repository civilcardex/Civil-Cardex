/** Filas de la ayuda «¿Qué clase elegir?» del RCI (CLASE_HELP del HTML): clase, salida,
 *  usuarios, presión, demanda y cuándo aplica. Ej: la Clase I es solo para bomberos —
 *  100 psi y 500 gpm + 250 por montante adicional. */

/** Filas de la ayuda «¿Qué clase elegir?» (CLASE_HELP del HTML): salidas, usuarios y demanda. */
export const FILAS_CLASE: [string, string, string, string, string, string][] = [
  [
    'I',
    'Válvula de 2½" sin manguera',
    'Bomberos',
    '100 psi',
    '500 gpm el primer montante + 250 por cada adicional',
    'Solo conexiones para el cuerpo de bomberos (edificios altos, escaleras protegidas)',
  ],
  [
    'II',
    'Gabinete con manguera de 1½" y boquilla',
    'Ocupantes o brigada',
    '65 psi',
    '100 gpm',
    'Solo gabinetes con manguera para primera respuesta de los ocupantes',
  ],
  [
    'III',
    'Válvula de 2½" y gabinete con manguera de 1½"',
    'Bomberos y ocupantes',
    '100 psi',
    'Como la Clase I',
    'Las dos cosas: conexión para bomberos y gabinete con manguera',
  ],
];
