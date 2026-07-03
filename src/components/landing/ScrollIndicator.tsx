import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

export default function ScrollIndicator() {
  const [opacity, setOpacity] = useState(1);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newOpacity = Math.max(0, 1 - scrollY / 150); // Fade out over 150px
      setOpacity(newOpacity);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion || opacity === 0) return null;

  return (
    <div 
      className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-opacity duration-200 z-20"
      style={{ opacity }}
    >
      <span className="text-[9px] uppercase tracking-widest text-[#8AB4D6] mb-1" style={{ fontFamily: 'Geist, monospace' }}>
        Descubra
      </span>
      <span className="material-symbols-outlined text-[#00dce5]" style={{ animation: 'bounce 2s infinite' }}>
        keyboard_arrow_down
      </span>
    </div>
  );
}
