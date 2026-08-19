import React, { useEffect, useRef, useState } from 'react';

const GAlertDialog_S1: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1e222b 0%, #15181f 100%)',
  padding: '24px',
  borderRadius: '12px',
  minWidth: 320,
  maxWidth: 420,
  border: '1px solid rgba(245, 166, 35, 0.25)',
  boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 15px rgba(245, 166, 35, 0.05)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  color: '#e2e2e8',
  margin: 'auto',
};
const GAlertDialog_S2: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#F5A623',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  paddingBottom: 10,
};
const GAlertDialog_S3: React.CSSProperties = {
  padding: '8px 18px',
  background: 'linear-gradient(135deg, #F5A623 0%, #d48b11 100%)',
  border: 'none',
  borderRadius: 6,
  color: '#111317',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12,
  fontFamily: "'Geist', monospace",
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  boxShadow: '0 4px 12px rgba(245, 166, 35, 0.25)',
  transition: 'all 0.15s ease',
};

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
}

const CLOSED: AlertState = { isOpen: false, title: '', message: '' };

/**
 * Monta un único AlertDialog de la app en la raíz y escucha los eventos de ventana
 * `civilflow_diametro_validation` (y cualquier otra validación personalizada). Sin este provider
 * en la raíz, las páginas de tabla de diseño que disparan ese evento cuando el visor PDF NO está
 * montado (ambos viven en rutas distintas, /civilflowareatrabajo vs /civilflowvisor) perderían
 * la alerta en silencio — el usuario jamás vería el rechazo.
 *
 * Ítem (rev 2026-08): las alertas genéricas SON estáticas y SÍ difuminan el plano (showModal +
 * ::backdrop con blur). La ÚNICA excepción sin blur y movible es el modal "Cambio de dirección
 * de flujo" (UcMoveModal), que el usuario necesita operar viendo el dibujo.
 */
export function GlobalAlertDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>(CLOSED);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onDiamValidation = (e: Event) => {
      const detail = (e as CustomEvent<{ title: string; message: string }>).detail;
      if (!detail) return;
      setState({ isOpen: true, title: detail.title, message: detail.message });
    };
    window.addEventListener('civilflow_diametro_validation', onDiamValidation);
    return () => window.removeEventListener('civilflow_diametro_validation', onDiamValidation);
  }, []);

  useEffect(() => {
    if (state.isOpen && dialogRef.current) {
      if (!dialogRef.current.open) dialogRef.current.showModal();
    }
  }, [state.isOpen]);

  const handleClose = () => setState(CLOSED);

  return (
    <>
      {children}
      {state.isOpen && (
        <dialog
          ref={dialogRef}
          onCancel={(e) => {
            e.preventDefault();
            handleClose();
          }}
          onClose={handleClose}
          role="alertdialog"
          aria-labelledby="global-alert-title"
          style={GAlertDialog_S1}
        >
          <style>{`
            dialog::backdrop {
              background: rgba(10, 11, 14, 0.75);
              backdrop-filter: blur(8px);
            }
          `}</style>
          <div id="global-alert-title" style={GAlertDialog_S2}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span> {state.title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#a9b8bd',
              lineHeight: 1.6,
              fontFamily: "'Geist', sans-serif",
              margin: '4px 0 16px',
            }}
          >
            {state.message}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleClose} style={GAlertDialog_S3}>
              Aceptar
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
