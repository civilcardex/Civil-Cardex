import { FunctionsHttpError } from '@supabase/supabase-js';
import { useState } from 'react';
import { abrirPortalFacturacion } from '../../lib/subscriptions/subscriptionsService.ts';
import { marcarNavInterna } from '../../utils/internalNavigation.ts';

const erroresPortal: Record<string, string> = {
  sin_facturacion: 'El historial estará disponible después de una compra vinculada a tu cuenta.',
  correo_no_verificado: 'Verifica el correo de tu cuenta para abrir la facturación.',
  correo_facturacion_distinto:
    'El correo de tu cuenta debe coincidir con el de tu compra en Paddle.',
};

export default function BillingPortalButton() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function abrir() {
    setCargando(true);
    setError('');
    const errorGenerico = 'No se pudo abrir la facturación. Intenta de nuevo más tarde.';
    try {
      const respuesta = await abrirPortalFacturacion();
      if (respuesta.error instanceof FunctionsHttpError) {
        const body = (await respuesta.error.context.json()) as { error?: string };
        setError(erroresPortal[body.error ?? ''] ?? errorGenerico);
        return;
      }
      const url = new URL(respuesta.data?.url ?? '');
      if (
        url.origin !== 'https://customer-portal.paddle.com' &&
        url.origin !== 'https://sandbox-customer-portal.paddle.com'
      ) {
        throw new Error('URL de facturación inválida');
      }
      marcarNavInterna();
      window.location.assign(url.href);
    } catch {
      setError(errorGenerico);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mt-6 border-t border-outline-variant pt-4">
      <button
        type="button"
        onClick={() => void abrir()}
        disabled={cargando}
        className="border border-outline-variant px-3 py-2 text-sm font-medium text-primary hover:border-primary disabled:opacity-60"
      >
        {cargando ? 'Abriendo facturación…' : 'Ver pagos y facturas'}
      </button>
      <p role="alert" className={error ? 'mt-2 text-sm text-error' : 'sr-only'}>
        {error}
      </p>
    </div>
  );
}
