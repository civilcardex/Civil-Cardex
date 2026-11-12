/**
 * Helpers compartidos de la asociación ENTRE PISOS de bajantes/montantes: punteros plan|id, alineación, anillo de desplazamientos del fantasma (XFG, el marcador entrepisos), cierre del árbol origen (collectSourceAgg) y registro del LDesvio (ramal desvío entrepisos) — la verdad común de apply/clear/heal/espejos.
 * Ej: asociar el montante MAC1 del piso 2 con el del piso 1 escribe el grupo de aparatos en el libro del piso de abajo sin pisar trazos recientes.
 *
 * Fachada (des-monolitización 2026-11-12): la implementación vive en bajanteAssoc/ —
 * tipos.ts (formas del doc/pool), puras.ts (matching de distancia), grafo.ts (cierre de
 * ramales y agregado de herencia) y storage.ts (IO de docs). Re-exporta TODO con los mismos
 * nombres: los consumidores siguen importando de aquí.
 */
export * from './bajanteAssoc/index.ts';
