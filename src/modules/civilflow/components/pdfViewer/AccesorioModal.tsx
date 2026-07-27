import { useEffect, useRef, useState } from 'react';
import { ACCESORIOS_HIDRO, ACCESORIOS_YEE, GAS_ACCESORIOS, SAN_ACCESORIOS } from '../../constants';
const AccesorioModal_S1: React.CSSProperties = {
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
};
const AccesorioModal_S2: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#63A5FF',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  paddingBottom: 10,
};
const AccesorioModal_S3: React.CSSProperties = {
  padding: '8px 18px',
  background: 'transparent',
  border: '1px solid #3a494a',
  borderRadius: 6,
  color: '#a9b8bd',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 12,
  fontFamily: "'Geist', monospace",
  textTransform: 'uppercase',
};
const AccesorioModal_S4: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: "'Geist', monospace",
  fontSize: 12,
  textAlign: 'left',
  transition: 'all 0.15s ease',
};
const AccesorioModal_S5: React.CSSProperties = {
  padding: '8px 18px',
  border: 'none',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 12,
  fontFamily: "'Geist', monospace",
  textTransform: 'uppercase',
  transition: 'all 0.15s ease',
};

interface AccesorioModalState {
  isOpen: boolean;
  ramalId: string;
  angleDeg: number;
  junctionIndex: number;
  point: number[];
  net: string;
  isTee?: boolean;
  isBilateral?: boolean;
}

interface AccesorioModalProps {
  modalState: AccesorioModalState;
  onClose: () => void;
  onSelect: (ramalId: string, point: number[], net: string, accId: string) => void;
}

export default function AccesorioModal({ modalState, onClose, onSelect }: AccesorioModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null);
  const prevIsOpenRef = useRef(modalState.isOpen);
  if (modalState.isOpen !== prevIsOpenRef.current) {
    prevIsOpenRef.current = modalState.isOpen;
    if (modalState.isOpen) setSelectedAccId(null);
  }

  useEffect(() => {
    if (modalState.isOpen && dialogRef.current) {
      if (!dialogRef.current.open) dialogRef.current.showModal();
    }
  }, [modalState.isOpen]);

  if (!modalState.isOpen) return null;

  const angle = modalState.angleDeg;
  const is45 = Math.abs(angle - 45) < 15;
  const is90 = Math.abs(angle - 90) < 15;
  const isGas = modalState.net === 'gas';
  const isSanLlVent =
    modalState.net === 'san' || modalState.net === 'll' || modalState.net === 'vent';

  // Gas has its own accessory catalog (GAS_ACCESORIOS) — different ids entirely from
  // ACCESORIOS_HIDRO, so it needs its own choice list rather than sharing AF/AC's.
  const gasCodos = GAS_ACCESORIOS.filter((a) => a.cat === 'Codos');
  const gasTees = GAS_ACCESORIOS.filter((a) => a.cat === 'Tees');

  // San/ll/vent use SAN_ACCESORIOS (coders, reventilado, sifón, yees)
  const sanCodos = SAN_ACCESORIOS.filter((a) => a.cat === 'Codos');
  const sanTees = SAN_ACCESORIOS.filter((a) => a.cat === 'Tees');

  const codos45 = isSanLlVent
    ? sanCodos
    : ACCESORIOS_HIDRO.filter((a) => a.cat === 'Codos' && a.id === 'codo45rc');
  const codos90 = isSanLlVent
    ? []
    : ACCESORIOS_HIDRO.filter((a) => a.cat === 'Codos' && a.id.startsWith('codo90'));
  // teeDirecto/teeSube/teeBaja excluded — those only get created automatically (montante en
  // cuerpo de ramal, o unión T/Y entre dos ramales), never chosen by hand here. teeTapon/
  // teeLlaveTerminal are only offered from the mid-body accessory dropdown (sidebar/menú
  // contextual), not from this junction-detection modal. Reducción/lado stay, those genuinely
  // are a manual choice.
  // For AF/AC: only teeReduccion and teeLado — teeBilateral has its own detection flow.
  const afAcTees = ACCESORIOS_HIDRO.filter(
    (a) => a.cat === 'Tees' && ['teeReduccion', 'teeLado'].includes(a.id),
  );
  // Tee bilateral trigger: only the teeBilateral option (user confirms the crossing)
  const bilateralTees = modalState.isBilateral
    ? ACCESORIOS_HIDRO.filter((a) => a.cat === 'Tees' && a.id === 'teeBilateral')
    : [];
  const tees = isSanLlVent ? sanTees : afAcTees;
  // Yee simple/doble are 45° tee variants — include them when a 45° tee is detected.
  const yees = isSanLlVent ? [] : is45 ? ACCESORIOS_YEE : [];

  const showCodos = modalState.isTee
    ? []
    : isGas
      ? gasCodos
      : isSanLlVent
        ? sanCodos
        : is45
          ? codos45
          : is90
            ? codos90
            : [];
  const showTees = modalState.isBilateral
    ? bilateralTees
    : modalState.isTee
      ? isGas
        ? gasTees
        : isSanLlVent
          ? sanTees
          : [...tees, ...yees]
      : [];
  const showAll = [...showCodos, ...showTees];

  const handleConfirm = () => {
    if (selectedAccId) {
      onSelect(modalState.ramalId, modalState.point, modalState.net, selectedAccId);
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={
        modalState.isBilateral
          ? 'Tee salida bilateral detectada'
          : modalState.isTee
            ? 'Conexión tipo Tee detectada'
            : `Cambio de dirección detectado (${modalState.angleDeg}°)`
      }
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      style={AccesorioModal_S1}
    >
      <style>{`
        dialog::backdrop {
          background: rgba(10, 11, 14, 0.75);
          backdrop-filter: blur(8px);
        }
      `}</style>
      <div style={AccesorioModal_S2}>
        <span style={{ fontSize: 22 }}>
          {modalState.isBilateral ? '⊕' : modalState.isTee ? '🔧' : '📐'}
        </span>{' '}
        {modalState.isBilateral
          ? 'Tee salida bilateral detectada'
          : modalState.isTee
            ? 'Conexión tipo Tee detectada'
            : `Cambio de dirección detectado (${modalState.angleDeg}°)`}
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#a9b8bd',
          lineHeight: 1.5,
          fontFamily: "'Geist', sans-serif",
        }}
      >
        {modalState.isBilateral ? (
          <>
            Se detectó un cruce perpendicular. Se sumará{' '}
            <strong style={{ color: '#fff' }}>+1</strong> Tee salida bilateral al ramal{' '}
            <strong style={{ color: '#fff' }}>{modalState.ramalId}</strong> (el existente).
          </>
        ) : modalState.isTee ? (
          <>Se detectó una conexión con otro ramal. Selecciona el tipo de Tee a colocar:</>
        ) : (
          <>
            Se detectó un cambio de dirección de{' '}
            <strong style={{ color: '#fff' }}>{modalState.angleDeg}°</strong> en el ramal.
            <div style={{ marginTop: 8 }}>Selecciona el accesorio:</div>
          </>
        )}
        <div style={{ marginTop: 8, fontSize: 12, color: '#8AB4D6' }}>
          Este accesorio se agregará al ramal{' '}
          <strong style={{ color: '#fff' }}>{modalState.ramalId}</strong> (el ramal existente que
          recibe la conexión), no al ramal que estás dibujando.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {showAll.map((t) => {
          const isSelected = selectedAccId === t.id;
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => setSelectedAccId(t.id)}
              style={{
                ...AccesorioModal_S4,
                background: isSelected ? 'rgba(99, 165, 255, 0.12)' : '#1e2024',
                border: isSelected ? '1px solid #63A5FF' : '1px solid #3a494a',
                color: isSelected ? '#63A5FF' : '#e2e2e8',
                boxShadow: isSelected ? '0 0 8px rgba(99, 165, 255, 0.2)' : 'none',
              }}
            >
              <img
                src={t.icono}
                alt={t.nombre}
                width={24}
                height={24}
                style={{ objectFit: 'contain' }}
              />
              <span>{t.nombre}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={onClose} style={AccesorioModal_S3}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!selectedAccId}
          onClick={handleConfirm}
          style={{
            ...AccesorioModal_S5,
            background: selectedAccId ? '#63A5FF' : 'rgba(99, 165, 255, 0.15)',
            color: selectedAccId ? '#0f1115' : '#a9b8bd66',
            cursor: selectedAccId ? 'pointer' : 'not-allowed',
          }}
        >
          Confirmar
        </button>
      </div>
    </dialog>
  );
}
