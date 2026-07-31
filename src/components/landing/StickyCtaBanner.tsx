import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface StickyCtaBannerProps {
  heroId: string;
  ctaId: string;
}

export default function StickyCtaBanner({ heroId, ctaId }: StickyCtaBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (isDismissed) return;

    const heroEl = document.getElementById(heroId);
    const ctaEl = document.getElementById(ctaId);

    if (!heroEl || !ctaEl) return;

    let isPastHero = false;
    let isCtaVisible = false;

    const updateVisibility = () => {
      setIsVisible(isPastHero && !isCtaVisible);
    };

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        // If hero is NOT intersecting, we are past it (assuming we scroll down)
        // More accurately, check bounding client rect top
        isPastHero = entry.boundingClientRect.bottom < 0;
        updateVisibility();
      },
      { threshold: 0 }, // Trigger as soon as 1px is off screen
    );

    const ctaObserver = new IntersectionObserver(
      ([entry]) => {
        isCtaVisible = entry.isIntersecting;
        updateVisibility();
      },
      { threshold: 0 },
    );

    heroObserver.observe(heroEl);
    ctaObserver.observe(ctaEl);

    return () => {
      heroObserver.disconnect();
      ctaObserver.disconnect();
    };
  }, [heroId, ctaId, isDismissed]);

  if (isDismissed) return null;

  const style: React.CSSProperties = {
    background: 'rgba(10, 14, 20, 0.85)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(245,214,104,0.2)',
    boxShadow: '0 -10px 30px rgba(0,0,0,0.5)',
    transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
    transition: prefersReducedMotion ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div
      className="hidden md:flex fixed bottom-0 left-0 right-0 z-50 py-4 px-6 lg:px-8 items-center justify-between"
      style={style}
    >
      <div className="flex items-center gap-4">
        <img
          src="/logos/civilCardexlogo.webp"
          alt="CivilCardex"
          className="w-8 h-8 object-contain"
        />
        <span
          className="text-sm font-bold uppercase"
          style={{ color: '#f0f4f8', fontFamily: 'Hanken Grotesk, sans-serif' }}
        >
          Lleve sus diseños al siguiente nivel
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Link
          to="/civilflowareatrabajo"
          className="bg-primary text-on-primary px-8 py-3 uppercase text-[11px] tracking-[0.1em] font-bold hover:bg-primary-container transition-all"
          style={{ fontFamily: 'Geist, monospace', boxShadow: '0 0 15px rgba(245,214,104,0.2)' }}
        >
          EMPEZAR AHORA
        </Link>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-outline-variant text-outline hover:text-on-surface hover:border-primary transition-colors"
          aria-label="Cerrar banner"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
}
