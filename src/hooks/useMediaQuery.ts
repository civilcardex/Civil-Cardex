import { useSyncExternalStore } from 'react';

// Adaptación responsive por JS (los estilos inline de la app no admiten media queries por
// clase). Un solo hook para toda la app: query Tailwind-like ('(max-width: 767px)').
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Móvil <768px (breakpoint md de Tailwind). Atajo del hook general. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
