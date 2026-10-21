import { useEffect, type DependencyList } from 'react';

/** Corre `cb` con debounce tras cada cambio de `deps` (cleanup cancela el timer pendiente). */
export function useDebouncedEffect(cb: () => void, delay: number, deps: DependencyList) {
  useEffect(() => {
    const timer = setTimeout(cb, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
