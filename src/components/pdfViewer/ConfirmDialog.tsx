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
  if (!confirmState.isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onKeyDown={e => { if (e.key === 'Escape') setConfirmState(prev => ({ ...prev, isOpen: false })); }}
        style={{ background: 'var(--bg2)', padding: '20px', borderRadius: 'var(--r)', minWidth: 320, maxWidth: 400, border: '1px solid var(--line)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <div id="confirm-dialog-title" style={{ fontSize: 16, fontWeight: 700, color: '#ef5350', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 20 }}>⚠</span> {confirmState.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 20, lineHeight: 1.5 }}>
          {confirmState.message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--txt)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Cancelar</button>
          <button autoFocus onClick={confirmState.onConfirm} style={{ padding: '6px 12px', background: '#ef5350', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}