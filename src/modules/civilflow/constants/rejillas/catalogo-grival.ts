/** Rejillas Grival del catálogo base de rejillas NTC (Norma Técnica Colombiana) 3631: 3 referencias nacionales SIN área efectiva (aef = 0, sin dato de ficha) — el cálculo no las sugiere. Ej: la 937310001 de 30×30 cm. */
import type { RejRef } from './types.ts';

export const CATALOGO_GRIVAL: RejRef[] = [
  {
    marca: 'Grival',
    ref: '937010001',
    tipo: 'Sencilla',
    ext: '20×20',
    w: 20,
    h: 20,
    aef: 0,
    uso: 'ambos',
    origen: 'nacional',
  },
  {
    marca: 'Grival',
    ref: '937000001',
    tipo: 'Persiana',
    ext: '20×20',
    w: 20,
    h: 20,
    aef: 0,
    uso: 'ambos',
    origen: 'nacional',
  },
  {
    marca: 'Grival',
    ref: '937310001',
    tipo: 'Corriente',
    ext: '30×30',
    w: 30,
    h: 30,
    aef: 0,
    uso: 'ambos',
    origen: 'nacional',
  },
];
