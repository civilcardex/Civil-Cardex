import { ModalShell } from '../shared/ModalShell.tsx';
import React from 'react';
import { Link } from 'react-router-dom';

/** Código de proyecto: prefijo del módulo + fecha compacta (CF-20250930-1430).
 *  `toLocaleString('sv')` da "YYYY-MM-DD HH:MM" — el ISO ordenable que Intl no expone
 *  como locale aparte (truco estándar para fecha local sin aritmética a mano). */
export function codigoProyecto(prefix: 'CF' | 'CM'): string {
  const loc = new Date().toLocaleString('sv');
  return `${prefix}-${loc.slice(0, 10).replaceAll('-', '')}-${loc.slice(11, 16).replaceAll(':', '')}`;
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
    <ModalShell>
      {' '}
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
    </ModalShell>
  );
}
