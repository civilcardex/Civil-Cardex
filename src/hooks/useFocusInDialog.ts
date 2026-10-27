import { useEffect, useRef } from 'react';

/** Mantiene el foco dentro de un diálogo abierto y cierra con Escape (WCAG 2.4.3): sin la
 *  trampa, Tab se sale a la página de fondo (los diálogos prometen `aria-modal="true"`). */
export function useFocoEnDialogo<T extends HTMLElement>(activo: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!activo) return;
    const el = ref.current;
    if (!el) return;

    // 1) Foco al abrir: el primer control enfocable del diálogo (o el propio contenedor).
    const seleccionables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const primero = seleccionables[0] ?? el;
    primero.focus();

    // 2) Tab cicla dentro; Escape cierra (lo aplica el callback del caller).
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [activo]);

  return ref;
}
