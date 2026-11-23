import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processPaymentEvent } from '../functions/paddle-webhook/paymentEvent.ts';

// Campos de transaction.paid y transaction.completed de los ejemplos oficiales de Paddle,
// con identificadores y valores de nuestra orden sintética. No son datos de un pago real.
const paid = {
  event_type: 'transaction.paid',
  data: {
    id: 'txn_demo',
    custom_data: { referencia: 'order-1', user_id: 'u1' },
    details: { totals: { grand_total: '2500', balance: '0', currency_code: 'USD' } },
  },
};
const completed = { ...paid, event_type: 'transaction.completed' };

function fixture() {
  const row = { id: 1, estado: 'pendiente', monto_centavos: 2500, moneda: 'USD', user_id: 'u1' };
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
      activate: async (reference, transactionId) => {
        assert.equal(reference, 'order-1');
        assert.equal(transactionId, 'txn_demo');
        if (outage) {
          outage = false;
          throw new Error('temporal');
        }
        row.estado = 'aprobado';
        calls += 1;
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
  event.data.details.totals.grand_total = '12x00';
  assert.equal(await processPaymentEvent(event, f.store), 'invalid');
  assert.equal(f.row.estado, 'pendiente');
  event.data.details.totals.grand_total = '2400';
  assert.equal(await processPaymentEvent(event, f.store), 'review');
  assert.equal(f.row.estado, 'revision');
  assert.equal(f.calls, 0);
});

test('un evento firmado no relacionado con nuestra orden no activa', async () => {
  const f = fixture();
  const event = structuredClone(paid);
  event.data.custom_data.user_id = 'u2';
  assert.equal(await processPaymentEvent(event, f.store), 'ignored');
  assert.equal(
    await processPaymentEvent({ event_type: 'transaction.created' }, f.store),
    'ignored',
  );
  assert.equal(f.calls, 0);
});
