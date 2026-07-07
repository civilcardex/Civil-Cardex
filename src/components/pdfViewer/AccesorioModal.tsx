import { useEffect, useRef, useState } from 'react';
import { ACCESORIOS_HIDRO } from '../../constants';

interface AccesorioModalState {
  isOpen: boolean;
  ramalId: string;
  angleDeg: number;
  junctionIndex: number;
  net: string;
  isTee?: boolean;
}

interface AccesorioModalProps {
  modalState: AccesorioModalState;
  onClose: () => void;
  onSelect: (ramalId: string, junctionIndex: number, net: string, accId: string) => void;
}

export default function AccesorioModal({ modalState, onClose, onSelect }: AccesorioModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null);

  useEffect(() => {
    if (modalState.isOpen && dialogRef.current) {
      if (!dialogRef.current.open) dialogRef.current.showModal();
    }
  }, [modalState.isOpen]);

  useEffect(() => {
    if (modalState.isOpen) {
      setSelectedAccId(null);
    }
  }, [modalState.isOpen]);

  if (!modalState.isOpen) return null;

  const angle = modalState.angleDeg;
  const is45 = Math.abs(angle - 45) < 15;
  const is90 = Math.abs(angle - 90) < 15;
  
  const codos45 = ACCESORIOS_HIDRO.filter(a => a.cat === 'Codos' && a.id === 'codo45rc');
  const codos90 = ACCESORIOS_HIDRO.filter(a => a.cat === 'Codos' && a.id.startsWith('codo90'));
  const tees = ACCESORIOS_HIDRO.filter(a => a.cat === 'Tees' && a.id !== 'teeBilateral');
  
  const showCodos = modalState.isTee ? [] : (is45 ? codos45 : is90 ? codos90 : []);
  const showTees = modalState.isTee ? tees : [];
  const showAll = [...showCodos, ...showTees];

  const handleConfirm = () => {
    if (selectedAccId) {
      onSelect(modalState.ramalId, modalState.junctionIndex, modalState.net, selectedAccId);
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClose={onClose}
      style={{
        background: 'linear-gradient(135deg, #1e222b 0%, #15181f 100%)',
        padding: '24px',
        borderRadius: '12px',
        minWidth: 420,
        maxWidth: 520,
        border: '1px solid rgba(99, 165, 255, 0.3)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 15px rgba(99, 165, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        color: '#e2e2e8',
        margin: 'auto',
      }}
    >
      <style>{`
        dialog::backdrop {
          background: rgba(10, 11, 14, 0.75);
          backdrop-filter: blur(8px);
        }
      `}</style>
      <div style={{
        fontSize: 16, fontWeight: 700, color: '#63A5FF',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 10
      }}>
        <span style={{ fontSize: 22 }}>{modalState.isTee ? '🔧' : '📐'}</span> {modalState.isTee ? 'Conexión tipo Tee detectada' : `Cambio de dirección detectado (${modalState.angleDeg}°)`}
      </div>
      <div style={{ fontSize: 13, color: '#a9b8bd', lineHeight: 1.5, fontFamily: "'Geist', sans-serif" }}>
        {modalState.isTee ? (
          <>Se detectó una conexión con otro ramal. Selecciona el tipo de Tee a colocar:</>
        ) : (
          <>
            Se detectó un cambio de dirección de <strong style={{color:'#fff'}}>{modalState.angleDeg}°</strong> en el ramal.
            <div style={{ marginTop: 8 }}>
              Selecciona el accesorio:
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {showAll.map(t => {
          const isSelected = selectedAccId === t.id;
          return (
            <button key={t.id} onClick={() => setSelectedAccId(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: isSelected ? 'rgba(99, 165, 255, 0.12)' : '#1e2024',
                border: isSelected ? '1px solid #63A5FF' : '1px solid #3a494a',
                borderRadius: 4,
                color: isSelected ? '#63A5FF' : '#e2e2e8',
                cursor: 'pointer',
                fontFamily: "'Geist', monospace",
                fontSize: 12,
                textAlign: 'left',
                boxShadow: isSelected ? '0 0 8px rgba(99, 165, 255, 0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}>
              <img src={t.icono} alt={t.nombre} width={24} height={24} style={{ objectFit: 'contain' }} />
              <span>{t.nombre}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button onClick={onClose}
          style={{
            padding: '8px 18px', background: 'transparent',
            border: '1px solid #3a494a', borderRadius: 6,
            color: '#a9b8bd', cursor: 'pointer',
            fontWeight: 600, fontSize: 12, fontFamily: "'Geist', monospace",
            textTransform: 'uppercase'
          }}>
          Cancelar
        </button>
        <button
          disabled={!selectedAccId}
          onClick={handleConfirm}
          style={{
            padding: '8px 18px',
            background: selectedAccId ? '#63A5FF' : 'rgba(99, 165, 255, 0.15)',
            border: 'none',
            borderRadius: 6,
            color: selectedAccId ? '#0f1115' : '#a9b8bd66',
            cursor: selectedAccId ? 'pointer' : 'not-allowed',
            fontWeight: 700,
            fontSize: 12,
            fontFamily: "'Geist', monospace",
            textTransform: 'uppercase',
            transition: 'all 0.15s ease'
          }}>
          Confirmar
        </button>
      </div>
    </dialog>
  );
}
