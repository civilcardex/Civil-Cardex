/**
 * Checkout Lemon Squeezy: pide la URL de checkout a la edge function
 * `crear-checkout` y redirige al checkout hosteado (sin iframes — no toca CSP).
 * Al volver desde la pasarela (/pricing?ref=X), PricingPage llama
 * `verificar-pago` y refresca. Las funciones se escriben cuando exista la
 * cuenta LS (checklist en AGENTS.md); sin deploy, el guard detecta el 404 y el
 * modal avisa que los pagos aún no están disponibles (sin error crudo).
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ModuloId, Periodo, PuestosPorModulo } from '../../lib/subscriptions/catalog';
import { edgePagoNoDesplegada } from '../../lib/subscriptions/subscriptionsService';
import { devError } from '../../utils/devError';

interface Props {
  open: boolean;
  onClose: () => void;
  modulos: ModuloId[];
  periodo: Periodo;
  /** Puestos por módulo (empresarial); ausente = 1 puesto por módulo. */
  puestos?: PuestosPorModulo;
}

export default function CheckoutModal({ open, onClose, modulos, periodo, puestos }: Props) {
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);
  // Evita pedir dos checkouts si el padre re-renderiza con el modal abierto.
  const pedidoRef = useRef(false);

  useEffect(() => {
    // Al cerrar libera el guard; al abrir pide el checkout UNA sola vez.
    if (!open) {
      pedidoRef.current = false;
      return;
    }
    if (pedidoRef.current) return;
    pedidoRef.current = true;
    void (async () => {
      const { data, error: err } = await supabase.functions.invoke('crear-checkout', {
        body: { modulos, periodo, puestosPorModulo: puestos ?? {} },
      });
      if (data?.checkoutUrl) {
        window.location.assign(data.checkoutUrl as string);
        return;
      }
      devError('crear-checkout:', err?.message ?? data);
      // Edges Lemon pendientes de deploy (AGENTS.md ACTIVACIÓN paso 3): mientras falten,
      // el guard evita el error crudo del relay ("Function not found" / 404).
      setError(true);
      setMensaje(
        edgePagoNoDesplegada(err)
          ? 'Los pagos en línea aún no están disponibles. Inténtalo más tarde.'
          : data?.error === 'pasarela_no_configurada' ||
              data?.error === 'suscripciones_deshabilitadas'
            ? 'La pasarela de pago no está configurada aún.'
            : 'No se pudo iniciar el pago. Intenta de nuevo en unos minutos.',
      );
    })();
  }, [open, modulos, periodo, puestos]);

  // Reset del aviso al (re)abrir — patrón de ajuste de estado durante render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMensaje('');
      setError(false);
    }
  }

  if (!open) return null;

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
        role="dialog"
        aria-modal="true"
        aria-label="Checkout de pago"
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
          Finalizar compra
        </h3>
        <p
          style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)', margin: '0 0 16px' }}
        >
          {error ? mensaje : 'Redirigiendo a la pasarela de pago (Lemon Squeezy)...'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
        </div>
      </div>
    </div>
  );
}
