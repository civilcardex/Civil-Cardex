import { useEffect, useRef, useState } from 'react';

interface CursorSpotlightProps {
  containerRef: React.RefObject<HTMLElement>;
}

export default function CursorSpotlight({ containerRef }: CursorSpotlightProps) {
  const spotlightRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  // Lazy-initialized from the media query directly instead of an effect + setState on mount.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Listen to changes in preference
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    // Disable on touch devices or if reduced motion is preferred
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (isTouchDevice || prefersReducedMotion) return;

    const container = containerRef.current;
    const spotlight = spotlightRef.current;
    
    if (!container || !spotlight) return;

    let rect = container.getBoundingClientRect();
    const updateRect = () => {
      rect = container.getBoundingClientRect();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      spotlight.style.setProperty('--mx', `${x}px`);
      spotlight.style.setProperty('--my', `${y}px`);
      
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    container.addEventListener('mouseenter', updateRect);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseenter', updateRect);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, isVisible, prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <div
      ref={spotlightRef}
      className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-500 ease-in-out"
      style={{
        opacity: isVisible ? 1 : 0,
        background: 'radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(0,220,229,0.06), transparent 40%)'
      }}
    />
  );
}
