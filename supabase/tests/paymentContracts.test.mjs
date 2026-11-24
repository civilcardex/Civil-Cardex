import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processPaymentEvent } from '../functions/paddle-webhook/paymentEvent.ts';

// Campos de transaction.paid y transaction.completed de los ejemplos oficiales de Paddle,
// con identificadores y valores de nuestra orden sintética. No son datos de un pago real.
const paid = {
  eventType: 'transaction.paid',
  data: {
    id: 'txn_01m87kb8may8jn1z4yvbh4gpps',
    customerId: 'ctm_01m87kb8may8jn1z4yvbh4gpps',
    customData: { referencia: 'order-1', user_id: 'u1' },
    details: { totals: { grandTotal: '2500', balance: '0', currencyCode: 'USD' } },
  },
};
const completed = { ...paid, eventType: 'transaction.completed' };

function fixture() {
  const row = {
    id: 1,
    estado: 'pendiente',
    monto_centavos: 2500,
    moneda: 'USD',
    user_id: 'u1',
    txn_id: paid.data.id,
    paddle_customer_id: null,
  };
  let outage = false;
  let calls = 0;
  return {
    row,
    get calls() {
      return calls;
    },
    failNext() {
      outage = true;
    },
    store: {
      load: async (ref) => (ref === 'order-1' ? row : null),
      review: async () => {
        row.estado = 'revision';
      },
      activate: async (reference, transactionId, customerId) => {
        assert.equal(reference, 'order-1');
        assert.equal(transactionId, paid.data.id);
        assert.equal(customerId, paid.data.customerId);
        if (outage) {
          outage = false;
          throw new Error('temporal');
        }
        if (row.estado === 'pendiente') {
          row.estado = 'aprobado';
          calls += 1;
        }
        row.paddle_customer_id = customerId;
      },
    },
  };
}

test('un fallo transitorio se propaga; completed puede reintentar; duplicados no activan dos veces', async () => {
  const f = fixture();
  f.failNext();
  await assert.rejects(processPaymentEvent(paid, f.store), /temporal/);
  assert.equal(f.row.estado, 'pendiente');
  assert.equal(await processPaymentEvent(completed, f.store), 'activated');
  assert.equal(await processPaymentEvent(paid, f.store), 'ignored');
  assert.equal(f.calls, 1);
});

test('un pago menor al esperado pasa a revisión y un total no numérico nunca activa', async () => {
  const f = fixture();
  const event = structuredClone(completed);
  event.data.details.totals.grandTotal = '12x00';
  assert.equal(await processPaymentEvent(event, f.store), 'invalid');
  assert.equal(f.row.estado, 'pendiente');
  event.data.details.totals.grandTotal = '2400';
  assert.equal(await processPaymentEvent(event, f.store), 'review');
  assert.equal(f.row.estado, 'revision');
  assert.equal(f.calls, 0);
});

test('la referencia de una orden no permite activar otra transacción de Paddle', async () => {
  const f = fixture();
  const otra = structuredClone(completed);
  otra.data.id = 'txn_00000000000000000000000000';
  assert.equal(await processPaymentEvent(otra, f.store), 'ignored');
  f.row.txn_id = null;
  assert.equal(await processPaymentEvent(completed, f.store), 'unbound');
  assert.equal(f.calls, 0);
});

test('una orden histórica aprobada puede vincular la facturación sin renovar el acceso', async () => {
  const f = fixture();
  f.row.estado = 'aprobado';
  assert.equal(await processPaymentEvent(completed, f.store), 'activated');
  assert.equal(f.row.paddle_customer_id, paid.data.customerId);
  assert.equal(f.calls, 0);
});

test('un evento firmado no relacionado con nuestra orden no activa', async () => {
  const f = fixture();
  const event = structuredClone(paid);
  event.data.customData.user_id = 'u2';
  assert.equal(await processPaymentEvent(event, f.store), 'ignored');
  assert.equal(await processPaymentEvent({ eventType: 'transaction.created' }, f.store), 'ignored');
  assert.equal(f.calls, 0);
});
