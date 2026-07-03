import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(QUERY);
    const listener = (event: MediaQueryListEvent) => setPrefers(event.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefers;
}
