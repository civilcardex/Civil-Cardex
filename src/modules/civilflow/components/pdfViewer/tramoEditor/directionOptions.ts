/** Las 3 direcciones que puede tomar un bajante entre pisos: cada entrada es [valor interno, etiqueta del botón]. Ej: ['sube', '↑ Sube'] guarda 'sube' y pinta el botón «↑ Sube». */
export const DIRECCIONES: Array<readonly ['sube' | 'baja' | 'continua', string]> = [
  ['sube', '↑ Sube'],
  ['baja', '↓ Baja'],
  ['continua', '➜ Continua'],
] as const;
