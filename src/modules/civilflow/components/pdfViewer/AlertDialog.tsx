import React, { useEffect, useRef } from 'react';
const AlertDialog_S1: React.CSSProperties = {
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
const AlertDialog_S2: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#F5A623',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  paddingBottom: 10,
};
const AlertDialog_S3: React.CSSProperties = {
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

interface AlertDialogState {
  isOpen: boolean;
  title: string;
  message: string;
}

interface AlertDialogProps {
  alertDialogState: AlertDialogState;
  setAlertDialogState: React.Dispatch<React.SetStateAction<AlertDialogState>>;
}

export default function AlertDialog({ alertDialogState, setAlertDialogState }: AlertDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (alertDialogState.isOpen && dialogRef.current) {
      if (!dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    }
  }, [alertDialogState.isOpen]);

  if (!alertDialogState.isOpen) return null;

  const handleClose = () => {
    setAlertDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClose={handleClose}
      role="alertdialog"
      aria-labelledby="alert-dialog-title"
      style={AlertDialog_S1}
    >
      <style>{`
        dialog::backdrop {
          background: rgba(10, 11, 14, 0.75);
          backdrop-filter: blur(8px);
        }
      `}</style>
      <div id="alert-dialog-title" style={AlertDialog_S2}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span> {alertDialogState.title}
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
        {alertDialogState.message}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={handleClose} style={AlertDialog_S3}>
          Aceptar
        </button>
      </div>
    </dialog>
  );
}
