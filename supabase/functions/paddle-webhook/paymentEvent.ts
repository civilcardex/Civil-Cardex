interface PaymentOrder {
  id: number;
  estado: string;
  monto_centavos: number;
  moneda: string;
  user_id: string;
}

interface PaymentStore {
  load: (reference: string) => Promise<PaymentOrder | null>;
  review: (id: number) => Promise<void>;
  activate: (reference: string, transactionId: string) => Promise<void>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function cents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
}

/** Procesa un evento ya autenticado. Un fallo de persistencia debe rechazar la entrega. */
export async function processPaymentEvent(value: unknown, store: PaymentStore) {
  const event = record(value);
  if (event.event_type !== 'transaction.paid' && event.event_type !== 'transaction.completed') {
    return 'ignored';
  }
  const data = record(event.data);
  const custom = record(data.custom_data);
  const reference = custom.referencia;
  if (typeof reference !== 'string' || !reference) return 'ignored';

  const order = await store.load(reference);
  if (!order || order.estado !== 'pendiente' || custom.user_id !== order.user_id) return 'ignored';
  const totals = record(record(data.details).totals);
  const amount = cents(totals.grand_total);
  const balance = cents(totals.balance);
  if (
    typeof data.id !== 'string' ||
    !data.id.startsWith('txn_') ||
    amount === null ||
    balance === null ||
    typeof totals.currency_code !== 'string'
  ) {
    return 'invalid';
  }
  if (balance !== 0 || totals.currency_code !== order.moneda || amount < order.monto_centavos) {
    await store.review(order.id);
    return 'review';
  }
  await store.activate(reference, data.id);
  return 'activated';
}
