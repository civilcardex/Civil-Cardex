import { useMediaQuery } from './useMediaQuery.ts';

/** true si el usuario pidió menos animación en el SO. Envuelve useMediaQuery: mismo
 *  comportamiento (SSR-safe por el getter de servidor de useSyncExternalStore). */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
