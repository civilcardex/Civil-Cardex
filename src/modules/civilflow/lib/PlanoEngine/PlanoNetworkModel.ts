import type { PlanoBajante } from './PlanoState';

// Primer paso de la migración "strangler-fig" de los arrays de estado plano de PlanoEngine hacia
// un modelo propio: solo bajantes, como piloto — el array más pequeño y el que está detrás de los
// bugs de esta sesión (label-drag y limpieza de marcadores de tee). PlanoEngine expone `bajantes`
// como accessor get/set respaldado por esta clase (ver PlanoEngine.ts), así que ninguno de los
// ~50 call sites existentes que leen o mutan `engine.bajantes` necesita cambiar. El trabajo
// futuro de forma de datos (objetos de asociación reales en vez de los arrays sueltos de
// recibeDeIds/alimentaIds) aterriza aquí, un array a la vez.
export class PlanoNetworkModel {
  bajantes: PlanoBajante[] = [];
}
