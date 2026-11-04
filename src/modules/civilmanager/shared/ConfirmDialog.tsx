import { useEffect, useRef, useState } from 'react';

type ResolveFn = (v: boolean) => void;
let _showConfirm: ((msg: string) => Promise<boolean>) | null = null;

/** Pregunta sí/no como Promise, usable con await desde cualquier sitio del módulo. Ej: `if (!(await askConfirm('¿Eliminar?'))) return;` Sin diálogo montado cae a window.confirm. */
export function askConfirm(msg: string): Promise<boolean> {
  if (_showConfirm) return _showConfirm(msg);
  return Promise.resolve(window.confirm(msg));
}

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

/** Diálogo modal que atiende askConfirm: foco contenido (WCAG 2.4.3), Escape y click-fuera cancelan. */
export function ConfirmDialog() {
  const [req, setReq] = useState<string | null>(null);
  const resolveRef = useRef<ResolveFn | null>(null);
  // Foco contenido dentro del diálogo + Tab que cicla dentro (WCAG 2.4.3).
  const dialogoRef = useFocoEnDialogo<HTMLDivElement>(req != null);

  useEffect(() => {
    _showConfirm = (msg) =>
      new Promise<boolean>((res) => {
        resolveRef.current = res;
        setReq(msg);
      });
    return () => {
      _showConfirm = null;
    };
  }, []);

  if (!req) return null;

  function answer(v: boolean) {
    setReq(null);
    if (resolveRef.current) {
      resolveRef.current(v);
      resolveRef.current = null;
    }
  }

  return (
    // Backdrop con cierre por click-fuera Y por Escape (WCAG 2.1.1 / 2.4.3).
    <div
      className="cm-modal-overlay"
      role="presentation"
      onClick={() => answer(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') answer(false);
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="cm-modal-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cm-confirm-title"
        onClick={(e) => e.stopPropagation()}
        ref={dialogoRef}
      >
        <div id="cm-confirm-title" className="cm-modal-head">
          CivilManager pregunta:
        </div>
        <div className="cm-modal-body">{req}</div>
        <div className="cm-modal-actions">
          <button type="button" className="cm-btn cm-btn-primary" onClick={() => answer(true)}>
            Aceptar
          </button>
          <button type="button" className="cm-btn" onClick={() => answer(false)}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
