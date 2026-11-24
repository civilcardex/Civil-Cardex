interface PaymentOrder {
  id: number;
  estado: string;
  monto_centavos: number;
  moneda: string;
  user_id: string;
  txn_id: string | null;
  paddle_customer_id: string | null;
}

interface PaymentStore {
  load: (reference: string) => Promise<PaymentOrder | null>;
  review: (id: number) => Promise<void>;
  activate: (reference: string, transactionId: string, customerId: string) => Promise<void>;
}

interface PaymentEvent {
  eventType: string;
  data?: {
    id: string;
    customerId: string | null;
    subscriptionId?: string | null;
    customData: Record<string, unknown> | null;
    details: {
      totals: { grandTotal: string; balance: string | null; currencyCode: string } | null;
    } | null;
  };
}

function cents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
}

/** Procesa un evento ya autenticado. Un fallo de persistencia debe rechazar la entrega. */
export async function processPaymentEvent({ eventType, data }: PaymentEvent, store: PaymentStore) {
  if (
    !data ||
    data.subscriptionId ||
    (eventType !== 'transaction.paid' && eventType !== 'transaction.completed')
  ) {
    return 'ignored';
  }
  const custom = data.customData;
  const reference = custom?.referencia;
  if (typeof reference !== 'string' || !reference) return 'ignored';

  const order = await store.load(reference);
  if (
    !order ||
    custom?.user_id !== order.user_id ||
    (order.estado !== 'pendiente' &&
      (order.estado !== 'aprobado' || order.paddle_customer_id !== null))
  ) {
    return 'ignored';
  }
  if (!order.txn_id) return 'unbound';
  if (data.id !== order.txn_id) return 'ignored';
  const totals = data.details?.totals;
  const amount = cents(totals?.grandTotal);
  const balance = cents(totals?.balance);
  if (
    !/^txn_[a-z0-9]{26}$/.test(order.txn_id) ||
    typeof data.customerId !== 'string' ||
    !/^ctm_[a-z0-9]{26}$/.test(data.customerId) ||
    amount === null ||
    balance === null ||
    typeof totals?.currencyCode !== 'string'
  ) {
    return 'invalid';
  }
  if (balance !== 0) return 'invalid';
  if (totals.currencyCode !== order.moneda || amount < order.monto_centavos) {
    if (order.estado === 'pendiente') await store.review(order.id);
    return 'review';
  }
  await store.activate(reference, order.txn_id, data.customerId);
  return 'activated';
}
