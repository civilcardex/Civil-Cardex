/** Modal de primera calibración: al abrir un plano sin escala known, guía al usuario a fijar
 *  scaleM (escala metros por pixel). Ej: medir una puerta de 0.9 m -> todo el dibujo queda en m. */
import { ModalOverlay } from '../../../../components/shared/ModalShell.tsx';

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
  // ModalOverlay (dialog nativo): foco atrapado, Escape y click-fuera -> onCancel; el foco
  // vuelve al opener al desmontar — todo lo daba este componente a mano y ahora es gratis.
  return (
    <ModalOverlay onClose={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-primera-calibracion-title"
        style={ModalPrimeraCalibracion_S1}
      >
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
    </ModalOverlay>
  );
}
