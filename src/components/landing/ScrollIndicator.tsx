import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts';

/** Flecha "desplázate" del hero: rebota y se desvanece en los primeros 150 px de scroll (desaparece con reduced-motion). */
export default function ScrollIndicator() {
  const [opacity, setOpacity] = useState(1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newOpacity = Math.max(0, 1 - scrollY / 150); // Fade out over 150px
      setOpacity(newOpacity);
      // Imperativo (CSSOM): no deja style="" en el HTML prerenderizado.
      if (wrapperRef.current) wrapperRef.current.style.opacity = String(newOpacity);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion || opacity === 0) return null;

  return (
    <div
      ref={wrapperRef}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-opacity duration-200 z-20"
    >
      <span className="scroll-indicator-icon material-symbols-outlined">keyboard_arrow_down</span>
    </div>
  );
}
