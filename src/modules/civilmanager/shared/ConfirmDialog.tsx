import { useEffect, useRef, useState } from 'react';

type ResolveFn = (v: boolean) => void;
let _showConfirm: ((msg: string) => Promise<boolean>) | null = null;

export function askConfirm(msg: string): Promise<boolean> {
  if (_showConfirm) return _showConfirm(msg);
  return Promise.resolve(window.confirm(msg));
}

export function ConfirmDialog() {
  const [req, setReq] = useState<string | null>(null);
  const resolveRef = useRef<ResolveFn | null>(null);

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
    // Backdrop con cierre por click-fuera. Gap conocido: este modal no tiene cierre por Escape ni
    // focus trap — agregar en un pase futuro (ver plan de accesibilidad, sección 1.4).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div className="cm-modal-overlay" role="presentation" onClick={() => answer(false)}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="cm-modal-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cm-confirm-title"
        onClick={(e) => e.stopPropagation()}
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
