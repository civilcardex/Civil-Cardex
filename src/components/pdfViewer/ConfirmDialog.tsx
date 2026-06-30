import React, { useEffect, useRef } from 'react';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface ConfirmDialogProps {
  confirmState: ConfirmState;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;
}

export default function ConfirmDialog({ confirmState, setConfirmState }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (confirmState.isOpen && dialogRef.current) {
      if (!dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    }
  }, [confirmState.isOpen]);

  if (!confirmState.isOpen) return null;

  const handleClose = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
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
      aria-labelledby="confirm-dialog-title"
      style={{
        background: 'var(--bg2)',
        padding: '20px',
        borderRadius: 'var(--r)',
        minWidth: 320,
        maxWidth: 400,
        border: '1px solid var(--line)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        color: 'var(--txt)',
        margin: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        dialog::backdrop {
          background: rgba(0,0,0,0.6);
        }
      `}</style>
      <div id="confirm-dialog-title" style={{ fontSize: 16, fontWeight: 700, color: '#ef5350', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 20 }}>⚠</span> {confirmState.title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 20, lineHeight: 1.5 }}>
        {confirmState.message}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={handleClose} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--txt)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Cancelar</button>
        <button autoFocus onClick={() => { confirmState.onConfirm(); handleClose(); }} style={{ padding: '6px 12px', background: '#ef5350', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Eliminar</button>
      </div>
    </dialog>
  );
}