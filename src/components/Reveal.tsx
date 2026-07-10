import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  delay?: number; // delay in ms
  duration?: number; // duration in ms
  threshold?: number;
  className?: string;
  direction?: 'up' | 'none';
}

export default function Reveal({
  children,
  delay = 0,
  duration = 600,
  threshold = 0.1,
  className = '',
  direction = 'up',
}: RevealProps) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  // Lazy-initialized from the media query directly instead of an effect + setState on mount —
  // the render path below never reads isIntersecting when reduced motion is on, so there's
  // nothing else to synchronize for the initial value.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Listen to changes in preference
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
      if (event.matches) setIsIntersecting(true);
    };

    mediaQuery.addEventListener('change', listener);
    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [threshold, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const style: React.CSSProperties = {
    opacity: isIntersecting ? 1 : 0,
    transform: isIntersecting
      ? 'translateY(0)'
      : direction === 'up'
      ? 'translateY(24px)'
      : 'none',
    transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  };

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
}
