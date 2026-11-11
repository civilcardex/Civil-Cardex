import { useEffect, useRef, useState } from 'react';
import { ModalOverlay } from '../../../components/shared/ModalShell.tsx';

type ResolveFn = (v: boolean) => void;
let _showConfirm: ((msg: string) => Promise<boolean>) | null = null;

/** Pregunta sí/no como Promise, usable con await desde cualquier sitio del módulo. Ej: `if (!(await askConfirm('¿Eliminar?'))) return;` Sin diálogo montado cae a window.confirm. */
export function askConfirm(msg: string): Promise<boolean> {
  if (_showConfirm) return _showConfirm(msg);
  return Promise.resolve(window.confirm(msg));
}

/** Diálogo modal que atiende askConfirm: foco atrapado, Escape y click-fuera cancelan
 *  (WCAG 2.4.3 — lo resuelve el dialog nativo de ModalOverlay, sin trampa a mano). */
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
    <ModalOverlay onClose={() => answer(false)}>
      <div
        className="cm-modal-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cm-confirm-title"
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
    </ModalOverlay>
  );
}
