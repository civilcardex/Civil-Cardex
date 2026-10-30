import { useEffect, useRef, useState } from 'react';
import { useFocoEnDialogo } from '../../../hooks/useFocusInDialog.ts';

type ResolveFn = (v: boolean) => void;
let _showConfirm: ((msg: string) => Promise<boolean>) | null = null;

/** Pregunta sí/no como Promise, usable con await desde cualquier sitio del módulo. Ej: `if (!(await askConfirm('¿Eliminar?'))) return;` Sin diálogo montado cae a window.confirm. */
export function askConfirm(msg: string): Promise<boolean> {
  if (_showConfirm) return _showConfirm(msg);
  return Promise.resolve(window.confirm(msg));
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
