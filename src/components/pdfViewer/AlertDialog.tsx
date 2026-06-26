import React, { useEffect } from 'react';

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAlertDialogState(prev => ({ ...prev, isOpen: false }));
    };
    if (alertDialogState.isOpen) {
      window.addEventListener('keydown', onKey);
    }
    return () => window.removeEventListener('keydown', onKey);
  }, [alertDialogState.isOpen, setAlertDialogState]);

  if (!alertDialogState.isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 11, 14, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        style={{
          background: 'linear-gradient(135deg, #1e222b 0%, #15181f 100%)',
          padding: '24px',
          borderRadius: '12px',
          minWidth: 320,
          maxWidth: 420,
          border: '1px solid rgba(245, 166, 35, 0.25)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 15px rgba(245, 166, 35, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div id="alert-dialog-title" style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#F5A623',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 10
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span> {alertDialogState.title}
        </div>
        <div style={{
          fontSize: 13,
          color: '#a9b8bd',
          lineHeight: 1.6,
          fontFamily: "'Geist', sans-serif",
          margin: '4px 0 16px'
        }}>
          {alertDialogState.message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            autoFocus
            onClick={() => setAlertDialogState(prev => ({ ...prev, isOpen: false }))}
            style={{
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
              transition: 'all 0.15s ease'
            }}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
