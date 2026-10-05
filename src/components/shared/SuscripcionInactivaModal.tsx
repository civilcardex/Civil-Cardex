import React from 'react';
import { Link } from 'react-router-dom';

/** Código de proyecto: prefijo del módulo + fecha compacta (CF-20250930-1430). */
export function codigoProyecto(prefix: 'CF' | 'CM'): string {
  const now = new Date();
  return (
    prefix +
    '-' +
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    '-' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0')
  );
}

/** Modal de bloqueo por suscripción vencida al crear proyecto: overlay + card con
 *  mensaje del módulo, botón Cerrar y link a Precios. Único en ambos módulos. */
export default function SuscripcionInactivaModal({
  modulo,
  onClose,
}: {
  modulo: 'CivilFlow' | 'CivilManager';
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          background: 'var(--surface-container, #1e1e24)',
          border: '1px solid var(--outline-variant, #3a3a44)',
          borderRadius: 8,
          padding: 24,
          minWidth: 360,
          maxWidth: 420,
          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--on-surface, #e2e2e8)',
            margin: '0 0 4px',
          }}
        >
          Suscripción {modulo} inactiva
        </h3>
        <p
          style={{
            fontSize: 12,
            color: 'var(--on-surface-variant, #9ba8aa)',
            margin: '0 0 16px',
          }}
        >
          Tu suscripción de {modulo} está vencida o no existe. Adquiere o renueva el plan para crear
          proyectos.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              border: '1px solid var(--outline-variant, #3a3a44)',
              borderRadius: 4,
              color: 'var(--on-surface, #e2e2e8)',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
          <Link
            to="/pricing"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--primary, #4D8FF7)',
              border: 'none',
              borderRadius: 4,
              color: 'var(--on-primary, #fff)',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Ver planes
          </Link>
        </div>
      </div>
    </div>
  );
}
