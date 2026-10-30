import { ModalShell } from '../shared/ModalShell.tsx';
import { useEffect, useRef, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { ModuloId, Periodo, PuestosPorModulo } from '../../lib/subscriptions/catalog.ts';
import { edgePagoNoDesplegada } from '../../lib/subscriptions/subscriptionsService.ts';
import { devError } from '../../utils/devError.ts';
import { marcarNavInterna } from '../../utils/internalNavigation.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  modulos: ModuloId[];
  periodo: Periodo;
  /** Puestos por módulo (empresarial); ausente = 1 puesto por módulo. */
  puestos?: PuestosPorModulo;
}

/** Checkout Lemon Squeezy: pide la URL a la edge function `crear-checkout` y redirige al checkout hosteado (sin iframes — no toca CSP). Ej: puestos {flow:3} con periodo anual -> total con descuentos server-side. */
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
        // Allowlist: la URL de la edge function no se asigna a ciegas — un proxy/deploys
        // confusos no deben poder redirigir el pago a un clon con el modal abierto.
        // try/catch OBLIGATORIO: un throw aquí es un unhandled rejection (IIFE void) —
        // el modal quedaba clavado en «Redirigiendo…» sin feedback y pedidoRef bloqueado.
        try {
          const url = new URL(data.checkoutUrl as string);
          if (!/(^|\.)lemonsqueezy\.com$/.test(url.hostname))
            throw new Error('checkout_url_invalida');
          marcarNavInterna();
          window.location.assign(url.toString());
        } catch (e) {
          devError('crear-checkout: url inválida:', e);
          setError(true);
          setMensaje('La pasarela devolvió una URL de pago inválida. Inténtalo más tarde.');
        }
        return;
      }
      devError('crear-checkout:', err?.message ?? data);
      // Edges Lemon pendientes de deploy (AGENTS.md ACTIVACIÓN paso 3): mientras falten,
      // el guard evita el error crudo del relay ("Function not found" / 404).
      setError(true);
      if (edgePagoNoDesplegada(err)) {
        setMensaje('Los pagos en línea aún no están disponibles. Inténtalo más tarde.');
      } else {
        // Con respuesta ≠2xx supabase-js devuelve data=null: el body del error vive en
        // err.context (FunctionsHttpError) — de ahí salen los mensajes específicos.
        let especifico = '';
        if (err instanceof FunctionsHttpError) {
          try {
            const body = (await err.context.json()) as { error?: string };
            if (body?.error === 'suscripciones_deshabilitadas') {
              especifico = 'Las suscripciones no están activadas aún.';
            } else if (body?.error === 'demasiados_intentos') {
              especifico = 'Demasiados intentos en la última hora. Espera unos minutos.';
            } else if (body?.error === 'venta_manual') {
              especifico = 'Para 25 o más puestos la venta es directa: contáctanos.';
            }
          } catch {
            // body no-JSON (proxy/HTML): mensaje genérico
          }
        }
        setMensaje(
          especifico ||
            'La pasarela de pago no está configurada aún o rechazó la compra. Inténtalo más tarde.',
        );
      }
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
    <ModalShell ariaLabel="Checkout de pago">
      {' '}
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
      <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)', margin: '0 0 16px' }}>
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
    </ModalShell>
  );
}
