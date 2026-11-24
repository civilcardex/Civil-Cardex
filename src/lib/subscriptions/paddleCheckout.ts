import type { CheckoutSettings, Paddle } from '@paddle/paddle-js';
import { marcarNavInterna } from '../../utils/internalNavigation.ts';

const ajustesCheckout = {
  displayMode: 'overlay',
  variant: 'one-page',
  locale: 'es',
  showAddDiscounts: false,
} satisfies CheckoutSettings;

let inicializacion: Promise<Paddle> | undefined;

/** Carga Paddle.js una vez al iniciar un pago. Ej: un token test_ solo arranca en sandbox. */
export function cargarPaddle(): Promise<Paddle> {
  inicializacion ??= inicializar().catch((error: unknown) => {
    inicializacion = undefined;
    throw error;
  });
  return inicializacion;
}

async function inicializar(): Promise<Paddle> {
  const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT;
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error('VITE_PADDLE_ENVIRONMENT debe ser sandbox o production.');
  }
  const prefijo = environment === 'sandbox' ? 'test_' : 'live_';
  if (typeof token !== 'string' || !token.startsWith(prefijo) || token.length <= prefijo.length) {
    throw new Error('VITE_PADDLE_CLIENT_TOKEN no corresponde al entorno de Paddle.');
  }

  const { initializePaddle } = await import('@paddle/paddle-js');
  const paddle = await initializePaddle({
    environment,
    token,
    eventCallback: (event) => {
      if (event.name === 'checkout.completed') marcarNavInterna();
    },
    checkout: { settings: { ...ajustesCheckout, successUrl: urlDeBienvenida() } },
  });
  if (!paddle) throw new Error('Paddle.js no pudo inicializarse.');
  return paddle;
}

function urlDeBienvenida(referencia?: string): string {
  const url = new URL('/welcome', window.location.origin);
  if (referencia) url.searchParams.set('ref', referencia);
  return url.href;
}

/** Abre la orden calculada por el servidor y conserva la referencia para consultar el pago. */
export function abrirCheckout(
  paddle: Paddle,
  transactionId: string,
  referencia: string,
  email?: string,
): void {
  paddle.Checkout.open({
    transactionId,
    settings: { ...ajustesCheckout, successUrl: urlDeBienvenida(referencia) },
    ...(email ? { customer: { email } } : {}),
  });
}
