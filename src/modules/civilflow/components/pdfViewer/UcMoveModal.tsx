import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
const UcMoveModal_S1: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1e222b 0%, #15181f 100%)',
  padding: '24px',
  borderRadius: '12px',
  minWidth: 420,
  maxWidth: 540,
  border: '1px solid rgba(245, 166, 35, 0.3)',
  boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 15px rgba(245, 166, 35, 0.1)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  color: '#e2e2e8',
  // Portaleado a body + fixed con inset 0 y margin auto: centrado en el viewport SIEMPRE,
  // sin depender del ancestro (antes vivía dentro del div fijo del menú contextual y el
  // dialog no-modal quedaba pegado arriba del contenedor — "mitad cortada" e inmovible).
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  margin: 'auto',
};
const UcMoveModal_S2: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#F5A623',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  paddingBottom: 10,
};
const UcMoveModal_S3: React.CSSProperties = {
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
const UcMoveModal_S4: React.CSSProperties = {
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
const UcMoveModal_S5: React.CSSProperties = {
  padding: '8px 18px',
  border: 'none',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 12,
  fontFamily: "'Geist', monospace",
  textTransform: 'uppercase',
  transition: 'all 0.15s ease',
};

export interface UcMoveOption {
  id: string;
  label: string;
}

export interface UcMoveModalState {
  isOpen: boolean;
  sourceLabel: string;
  options: UcMoveOption[];
  /** Id del ramal cuya dirección se va a invertir — lo usa el raíz del menú contextual para
   *  ejecutar el doble cambio aunque el menú ya se haya cerrado (el modal vive fuera de él). */
  ramalId?: string;
}

interface UcMoveModalProps {
  state: UcMoveModalState;
  onConfirm: (targetId: string) => void;
  onCancel: () => void;
}

export default function UcMoveModal({ state, onConfirm, onCancel }: UcMoveModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(state.isOpen);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Reiniciar la selección al REABRIR el modal: ajuste de estado durante el render (patrón
  // oficial de React para sincronizar estado con un prop que cambia), sin effect — evita el
  // render en cascada que lint rechaza (react-hooks/set-state-in-effect).
  if (prevOpen !== state.isOpen) {
    setPrevOpen(state.isOpen);
    if (state.isOpen) setSelectedId(null);
  }

  useEffect(() => {
    if (state.isOpen && dialogRef.current) {
      // show() en vez de showModal(): el modal NO bloquea el plano ni lo difumina — el usuario
      // necesita ver y poder interactuar con el dibujo para elegir bien la red que recibe las
      // UCs. Sin showModal no hay ::backdrop (ni dim ni blur).
      if (!dialogRef.current.open) dialogRef.current.show();
    }
  }, [state.isOpen]);

  if (!state.isOpen) return null;

  const handleConfirm = () => {
    if (selectedId) {
      onConfirm(selectedId);
      onCancel();
    }
  };

  // Arrastre del modal por su cabecera — listeners en window para no perder el drag si el
  // puntero sale rápido del elemento.
  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const rect = dlg.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    const capture = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      setPos({ x: ev.clientX - dragRef.current.dx, y: ev.clientY - dragRef.current.dy });
    };
    const release = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', capture);
      window.removeEventListener('pointerup', release);
    };
    window.addEventListener('pointermove', capture);
    window.addEventListener('pointerup', release);
  };

  const dlgStyle: React.CSSProperties = pos
    ? {
        ...UcMoveModal_S1,
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        right: 'auto',
        bottom: 'auto',
        margin: 0,
      }
    : UcMoveModal_S1;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label="Reasignar unidades de consumo"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
      style={dlgStyle}
    >
      <div
        style={{ ...UcMoveModal_S2, cursor: 'grab', userSelect: 'none' }}
        onPointerDown={onHeaderPointerDown}
      >
        <span style={{ fontSize: 22 }}>⚠️</span> Cambio de dirección de flujo
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#a9b8bd',
          lineHeight: 1.5,
          fontFamily: "'Geist', sans-serif",
        }}
      >
        Invertir la dirección de flujo implica un cambio doble: se invierten{' '}
        <strong style={{ color: '#fff' }}>ambos ramales</strong> —{' '}
        <strong style={{ color: '#fff' }}>{state.sourceLabel}</strong> y el ramal seleccionado —
        quedando uno como entrada y el otro como salida en la conexión.
        <div style={{ marginTop: 8 }}>
          Selecciona el ramal de la conexión que recibirá las unidades de consumo de{' '}
          <strong style={{ color: '#fff' }}>{state.sourceLabel}</strong>:
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {state.options.map((o) => {
          const isSelected = selectedId === o.id;
          return (
            <button
              type="button"
              key={o.id}
              onClick={() => setSelectedId(o.id)}
              style={{
                ...UcMoveModal_S4,
                background: isSelected ? 'rgba(245, 166, 35, 0.12)' : '#1e2024',
                border: isSelected ? '1px solid #F5A623' : '1px solid #3a494a',
                color: isSelected ? '#F5A623' : '#e2e2e8',
                boxShadow: isSelected ? '0 0 8px rgba(245, 166, 35, 0.2)' : 'none',
              }}
            >
              <span style={{ fontSize: 14 }}>{isSelected ? '◉' : '○'}</span>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={onCancel} style={UcMoveModal_S3}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={handleConfirm}
          style={{
            ...UcMoveModal_S5,
            background: selectedId ? '#F5A623' : 'rgba(245, 166, 35, 0.15)',
            color: selectedId ? '#0f1115' : '#a9b8bd66',
            cursor: selectedId ? 'pointer' : 'not-allowed',
          }}
        >
          Confirmar
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
