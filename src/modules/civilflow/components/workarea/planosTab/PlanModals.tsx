import { pisoLbl } from '../../../constants';
import type { PlanItem } from '../../../context/PlansContext.tsx';

/**
 * Modales de carga de planos: asignar un piso libre y avisar que una lámina necesita su propio origen.
 * Ej: plano sin piso -> modal con los pisos libres; plano con piso pero sin origen -> aviso "Marcar origen".
 */

export interface ModalNivelPisoProps {
  /** Planos ya cargados: un piso no puede repetirse entre planos confirmados. */
  plans: PlanItem[];
  pisos: { n: number }[];
  /** Plan al que se le asigna el piso (null = modal cerrado). */
  planId: number | null;
  onSelect: (planId: number, nivel: number) => void;
  onClose: () => void;
}

/** Piso libre para un plano: nadie más lo tiene confirmado. */
function pisosLibres(props: ModalNivelPisoProps): number[] {
  const { plans, pisos, planId } = props;
  return pisos
    .filter(
      (s) => !plans.some((x) => x.id !== planId && x.status === 'confirmed' && x.nivel === s.n),
    )
    .map((s) => s.n);
}

/** Modal para asignar un piso libre a un plano. Ej: pisos 1 y 3 ocupados -> solo ofrece piso 2. */
export function ModalNivelPiso(props: ModalNivelPisoProps) {
  const { planId, onSelect, onClose } = props;
  if (planId === null) return null;
  const libres = pisosLibres(props);
  return (
    // Backdrop con cierre por click-fuera: patrón estándar de modal.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r)',
          padding: 16,
          minWidth: 220,
          maxWidth: 300,
          boxShadow: '0 8px 32px rgba(0,0,0,.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--txt)' }}>
          Asignar piso al plano
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {libres.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSelect(planId, n)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--line)',
                background: 'var(--bg3)',
                color: 'var(--txt)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(14,204,122,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg3)';
              }}
            >
              {pisoLbl(n)}
            </button>
          ))}
          {libres.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--txt4)',
                padding: '8px 0',
                textAlign: 'center',
              }}
            >
              Todos los pisos ya tienen un plano asociado
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '5px 0',
            borderRadius: 'var(--r)',
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--txt3)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export interface ModalOrigenPlanProps {
  /** Plan al que hay que marcarle su propio origen (null = modal cerrado). */
  planId: number | null;
  /** Nombre del plano, para el texto del aviso. */
  planNombre: string;
  onConfirmar: (planId: number) => void;
  onClose: () => void;
}

/** Aviso de que la lámina necesita su propio origen. Ej: confirmar -> abre el modo de marcado. */
export function ModalOrigenPlan(props: ModalOrigenPlanProps) {
  const { planId, planNombre, onConfirmar, onClose } = props;
  if (planId === null) return null;
  return (
    // Modal de flujo: "esta lámina necesita SU propio origen". Al confirmar, el
    // configurador abre directo en modo marcado de origen.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        role="dialog"
        aria-label="Definir origen de la lámina"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r)',
          padding: 16,
          minWidth: 260,
          maxWidth: 360,
          boxShadow: '0 8px 32px rgba(0,0,0,.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--txt)' }}>
          📍 Define el origen de este plano
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>
          Piso asignado a <b>{planNombre}</b>. La escala del proyecto ya está aplicada, pero a cada
          plano se le debe definir su propio origen.
        </div>
        <button
          type="button"
          onClick={() => onConfirmar(planId)}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '7px 0',
            borderRadius: 'var(--r)',
            border: '1px solid rgba(14,204,122,0.3)',
            background: 'rgba(14,204,122,0.1)',
            color: '#0ECC7A',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          📍 Marcar origen
        </button>
      </div>
    </div>
  );
}
