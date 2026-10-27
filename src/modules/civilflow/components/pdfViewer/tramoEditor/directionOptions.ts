// Las 3 direcciones posibles de un bajante entre pisos (valor interno + etiqueta del botón).
export const DIRECCIONES: Array<readonly ['sube' | 'baja' | 'continua', string]> = [
  ['sube', '↑ Sube'],
  ['baja', '↓ Baja'],
  ['continua', '➜ Continua'],
] as const;
