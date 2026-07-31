import type { PlanoBajante } from './PlanoState';

// First step of the strangler-fig migration of PlanoEngine's flat state arrays into an owned
// model: bajantes only, as the pilot — the smallest array, and the one behind this session's
// label-drag and tee-marker-cleanup bugs. PlanoEngine exposes `bajantes` as a get/set accessor
// backed by this class (see PlanoEngine.ts), so none of the ~50 existing call sites that read or
// mutate `engine.bajantes` need to change. Future data-shape work (real association objects
// instead of loose recibeDeIds/alimentaIds string arrays) lands here, one array at a time.
export class PlanoNetworkModel {
  bajantes: PlanoBajante[] = [];
}
