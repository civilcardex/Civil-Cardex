/**
 * Checkout con el widget de Wompi: crea la intención de pago (edge function),
 * abre el widget con la firma de integridad y al volver verifica la
 * transacción antes de dar el éxito. El script del widget se carga solo al
 * abrir este modal (dormant mientras las suscripciones estén apagadas).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { supabase } from '../../lib/supabase';
import {
  calcularTotalCentavos,
  formatCOP,
  type ModuloId,
  type Periodo,
} from '../../lib/suscripciones/catalogo';
import { dispararRefetchSuscripciones } from '../../lib/suscripciones/suscripcionesService';
import { devError } from '../../utils/devError';

interface Props {
  open: boolean;
  onClose: () => void;
  modulos: ModuloId[];
  periodo: Periodo;
  /** Llamado cuando el pago quedó aprobado y activado en BD. */
  onAprobado?: () => void;
}

interface WompiWidgetOptions {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
  redirectUrl?: string;
}

interface WompiWidget {
  open(cb: (result: { transaction?: { id?: string; status?: string } }) => void): void;
}

declare global {
  interface Window {
    WidgetCheckout?: new (opts: WompiWidgetOptions) => WompiWidget;
  }
}

interface IntencionPago {
  referencia: string;
  montoCentavos: number;
  firmaIntegridad: string;
  publicKey: string | null;
}

type Estado = 'preparando' | 'listo' | 'verificando' | 'aprobado' | 'error';

type WompiWidgetConstructor = NonNullable<Window['WidgetCheckout']>;

function cargarWidget(): Promise<WompiWidgetConstructor> {
  const actual = window.WidgetCheckout;
  if (actual) return Promise.resolve(actual);
  return new Promise((resolve, reject) => {
    const existente = document.getElementById('wompi-widget-js');
    if (existente) {
      existente.addEventListener('load', () => {
        if (window.WidgetCheckout) resolve(window.WidgetCheckout);
        else reject(new Error('widget_no_cargado'));
      });
      existente.addEventListener('error', () => reject(new Error('widget_no_cargado')));
      return;
    }
    const s = document.createElement('script');
    s.id = 'wompi-widget-js';
    s.src = 'https://checkout.wompi.co/widget.js';
    s.async = true;
    s.onload = () => {
      if (window.WidgetCheckout) resolve(window.WidgetCheckout);
      else reject(new Error('widget_no_cargado'));
    };
    s.onerror = () => reject(new Error('widget_no_cargado'));
    document.head.appendChild(s);
  });
}

export default function WompiCheckoutModal({ open, onClose, modulos, periodo, onAprobado }: Props) {
  const [estado, setEstado] = useState<Estado>('preparando');
  const [mensaje, setMensaje] = useState('');
  const intencion = useRef<IntencionPago | null>(null);
  // Props espejadas en refs (escritas en effects): mantienen estables las
  // callbacks y el efecto de apertura, y evitan re-crear la intención de pago
  // si el padre re-renderiza con el modal abierto.
  const onAprobadoRef = useRef(onAprobado);
  useEffect(() => {
    onAprobadoRef.current = onAprobado;
  });
  const modulosRef = useRef(modulos);
  useEffect(() => {
    modulosRef.current = modulos;
  });
  const modulosKey = [...modulos].sort().join(',');
  const total = calcularTotalCentavos(modulos, periodo);

  // Reset al (re)abrir — patrón de ajuste de estado durante render (react-hooks).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEstado('preparando');
      setMensaje('');
    }
  }

  const verificar = useCallback(async () => {
    const ref = intencion.current?.referencia;
    if (!ref) return;
    setEstado('verificando');
    setMensaje('');
    const { data, error } = await supabase.functions.invoke('wompi-verify', {
      body: { referencia: ref },
    });
    if (error) {
      devError('wompi-verify:', error.message);
      setEstado('error');
      setMensaje('No se pudo verificar el pago. Intenta de nuevo en unos segundos.');
      return;
    }
    if (data?.aprobado) {
      setEstado('aprobado');
      dispararRefetchSuscripciones();
      onAprobadoRef.current?.();
    } else {
      setEstado('listo');
      setMensaje(
        'Aún no registramos tu pago. Si ya pagaste, espera unos segundos y verifica de nuevo.',
      );
    }
  }, []);

  const abrirWidget = useCallback(async () => {
    const intent = intencion.current;
    if (!intent) return;
    try {
      const Widget = await cargarWidget();
      const publicKey = intent.publicKey || import.meta.env.VITE_WOMPI_PUBLICO;
      if (!publicKey) throw new Error('wompi_no_configurado');
      const widget = new Widget({
        currency: 'COP',
        amountInCents: intent.montoCentavos,
        reference: intent.referencia,
        publicKey,
        signature: { integrity: intent.firmaIntegridad },
        redirectUrl: `${window.location.origin}/pricing`,
      });
      widget.open((result) => {
        if (result.transaction?.status === 'APPROVED') {
          void verificar();
        }
      });
    } catch (e) {
      devError('abrirWidget:', e);
      setEstado('error');
      setMensaje(
        (e as Error).message === 'wompi_no_configurado'
          ? 'La pasarela de pago no está configurada aún.'
          : 'No se pudo abrir la pasarela de pago.',
      );
    }
  }, [verificar]);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    void (async () => {
      intencion.current = null;
      const { data, error } = await supabase.functions.invoke('crear-intencion-pago', {
        body: { modulos: modulosRef.current, periodo },
      });
      if (cancelado) return;
      if (error || !data?.referencia) {
        devError('crear-intencion-pago:', error?.message ?? data);
        setEstado('error');
        setMensaje(
          data?.error === 'wompi_no_configurado'
            ? 'La pasarela de pago no está configurada aún.'
            : 'No se pudo iniciar el pago. Intenta de nuevo.',
        );
        return;
      }
      intencion.current = data as IntencionPago;
      setEstado('listo');
      await abrirWidget();
    })();
    return () => {
      cancelado = true;
    };
  }, [open, periodo, modulosKey, abrirWidget]);

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
        aria-label="Pago con Wompi"
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
          Pagar con Wompi
        </h3>
        <p
          style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)', margin: '0 0 16px' }}
        >
          {estado === 'aprobado'
            ? '¡Pago aprobado! Tu suscripción ya está activa.'
            : `Total a pagar: ${formatCOP(total)} — suscripción ${periodo}.`}
        </p>

        {estado === 'preparando' && (
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)' }}>
            Preparando el pago...
          </p>
        )}
        {estado === 'verificando' && (
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)' }}>
            Verificando tu pago...
          </p>
        )}
        {mensaje && (
          <p
            style={{
              fontSize: 12,
              color: estado === 'error' ? '#f28b82' : 'var(--on-surface-variant, #9ba8aa)',
            }}
          >
            {mensaje}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {estado === 'listo' && (
            <button type="button" onClick={() => void verificar()} style={BTN}>
              Ya pagué — verificar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              ...BTN,
              background: estado === 'aprobado' ? 'var(--primary, #4D8FF7)' : 'transparent',
              color:
                estado === 'aprobado' ? 'var(--on-primary, #fff)' : 'var(--on-surface, #e2e2e8)',
              border: estado === 'aprobado' ? 'none' : '1px solid var(--outline-variant, #3a3a44)',
            }}
          >
            {estado === 'aprobado' ? 'Listo' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const BTN: CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 4,
  cursor: 'pointer',
};
