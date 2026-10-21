import { useEffect, useState } from 'react';
import { useLayoutEffect } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefiereReducidoMovimiento.ts';

interface Props {
  text: string;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TypewriterText({ text, delay = 800, className, style }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // usePrefersReducedMotion is already accurate on the first render (its own lazy useState
  // init), so the reduced-motion case can be seeded here instead of set in an effect.
  // SEO: el HTML servido (prerender) trae el TEXTO COMPLETO — crawlers sin JS lo leen.
  // En cliente, useLayoutEffect lo vacía ANTES del primer paint y la animación teclea
  // desde cero (el usuario nunca ve el texto completo salvo reduced-motion).
  const [displayedText, setDisplayedText] = useState(text);
  const [showCursor, setShowCursor] = useState(false);

  useLayoutEffect(() => {
    if (prefersReducedMotion) return;
    // Vaciado pre-paint: tras el mount (texto ya en el HTML) y antes del paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- necesario por diseño SEO
    setDisplayedText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vaciado ÚNICO de montaje
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let typeInterval: number;

    const timeoutId = setTimeout(() => {
      setShowCursor(true);
      let i = 0;
      typeInterval = window.setInterval(() => {
        setDisplayedText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(typeInterval);
          setTimeout(() => setShowCursor(false), 1500); // Cursor stays for 1.5s after finishing
        }
      }, 50); // Speed of typing
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(typeInterval);
    };
  }, [text, delay, prefersReducedMotion]);

  return (
    <p className={className} style={style}>
      {displayedText}
      <span
        style={{
          opacity: showCursor && !prefersReducedMotion ? 1 : 0,
          transition: 'opacity 0.2s',
          animation: showCursor ? 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      >
        |
      </span>
    </p>
  );
}
