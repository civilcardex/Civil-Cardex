import { useEffect, useState } from 'react';
import { useLayoutEffect } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts';
import { useMediaQuery } from '../../hooks/useMediaQuery.ts';

interface Props {
  text: string;
  delay?: number;
  className?: string;
}

/** Texto del hero que se teclea letra a letra (50 ms/letra tras delay). SEO: el HTML prerenderizado trae el texto COMPLETO — el vaciado corre pre-paint en cliente. */
export default function TypewriterText({ text, delay = 800, className }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Móvil/tablet (chica o táctil): el tecleo + vaciado pre-paint PARPADEABA (el HTML
  // prerenderizado pintaba el texto completo, se vaciaba y volvía a teclear, y las GPUs
  // débiles lo mostraban entrecortado). Ahí el texto nace completo y sin cursor.
  const fluido = useMediaQuery('(max-width: 768px), (any-pointer: coarse)');
  const animar = !prefersReducedMotion && !fluido;
  // usePrefersReducedMotion is already accurate on the first render (its own lazy useState
  // init), so the reduced-motion case can be seeded here instead of set in an effect.
  // SEO: el HTML servido (prerender) trae el TEXTO COMPLETO — crawlers sin JS lo leen.
  // En cliente, useLayoutEffect lo vacía ANTES del primer paint y la animación teclea
  // desde cero (el usuario nunca ve el texto completo salvo reduced-motion).
  const [displayedText, setDisplayedText] = useState(text);
  const [showCursor, setShowCursor] = useState(false);

  useLayoutEffect(() => {
    if (!animar) return;
    // Vaciado pre-paint: tras el mount (texto ya en el HTML) y antes del paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- necesario por diseño SEO
    setDisplayedText('');
  }, [animar]);

  useEffect(() => {
    if (!animar) return;

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
  }, [text, delay, animar]);

  return (
    <p className={className}>
      {animar ? displayedText : text}
      <span className={`typewriter-cursor${showCursor && animar ? ' typewriter-cursor-on' : ''}`}>
        |
      </span>
    </p>
  );
}
