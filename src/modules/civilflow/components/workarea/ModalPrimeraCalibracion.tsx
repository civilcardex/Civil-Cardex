import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalPrimeraCalibracionProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const ModalPrimeraCalibracion_S1: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r2)',
  maxWidth: 440,
  width: '90%',
  boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
};

const ModalPrimeraCalibracion_S2: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--line)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--bg)',
};

const ModalPrimeraCalibracion_S3: React.CSSProperties = {
  padding: '7px 24px',
  background: 'var(--acc)',
  border: 'none',
  borderRadius: 'var(--r)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

const ModalPrimeraCalibracion_S4: React.CSSProperties = {
  padding: '7px 24px',
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  color: '#b9caca',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

export default function ModalPrimeraCalibracion({
  onConfirm,
  onCancel,
}: ModalPrimeraCalibracionProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const prevActiveEl = useRef<Element | null>(null);

  useEffect(() => {
    prevActiveEl.current = document.activeElement;
    if (modalRef.current) {
      const first = modalRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      (prevActiveEl.current as HTMLElement)?.focus?.();
    };
  }, [onCancel]);

  const modalContent = (
    <div
      ref={modalRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="modal-primera-calibracion-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div style={ModalPrimeraCalibracion_S1} onClick={(e) => e.stopPropagation()}>
        <div style={ModalPrimeraCalibracion_S2}>
          <span style={{ fontSize: 18 }}>📐</span>
          <span
            id="modal-primera-calibracion-title"
            style={{ fontSize: 15, fontWeight: 700, color: '#e2e2e8' }}
          >
            Calibración base del proyecto
          </span>
        </div>
        <div style={{ padding: '16px 18px', fontSize: 13, color: '#b0b8b9', lineHeight: 1.6 }}>
          Esta es la <strong style={{ color: '#e2e2e8' }}>primera calibración</strong> del proyecto.
          Se usará como base para <strong style={{ color: '#e2e2e8' }}>todos los planos</strong>:
          los planos nuevos tomarán esta escala automáticamente.
          <div style={{ marginTop: 8 }}>¿Desea guardarla?</div>
        </div>
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button type="button" onClick={onCancel} style={ModalPrimeraCalibracion_S4}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} style={ModalPrimeraCalibracion_S3}>
            Guardar calibración
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
