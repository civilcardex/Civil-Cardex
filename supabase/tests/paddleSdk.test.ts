import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Environment, EventName, Paddle } from 'npm:@paddle/paddle-node-sdk@3.12.0';
import { sincronizarEvento } from '../functions/paddle-webhook/syncEvent.ts';

const sdk = new Paddle('pdl_sdbx_apikey_fixture', { environment: Environment.sandbox });
const secreto = 'secreto-de-firma-de-prueba';
const fecha = '2026-11-24T18:11:05.000Z';

function firmar(raw: string, ts = Math.floor(Date.now() / 1000)) {
  return `ts=${ts};h1=${createHmac('sha256', secreto).update(`${ts}:${raw}`).digest('hex')}`;
}

Deno.test('el SDK verifica el cuerpo crudo con el secreto del destino', async () => {
  const raw = '{ "event_type": "customer.created", "data": {"email": "paddle@example.com"}}';
  const firma = firmar(raw);
  const event = await sdk.webhooks.unmarshal(raw, secreto, firma);
  assert.equal(event.eventType, EventName.CustomerCreated);
  await assert.rejects(sdk.webhooks.unmarshal(JSON.stringify(JSON.parse(raw)), secreto, firma));
  await assert.rejects(sdk.webhooks.unmarshal(raw, 'clave-distinta', firma));
  await assert.rejects(sdk.webhooks.unmarshal(raw, secreto, firmar(raw, 1)));
});

Deno.test('enruta clientes y suscripciones con la fecha emitida por Paddle', async () => {
  const llamadas: { nombre: string; args: Record<string, unknown> }[] = [];
  const admin = {
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      llamadas.push({ nombre, args });
      return { error: null };
    },
  } as unknown as Parameters<typeof sincronizarEvento>[1];
  const customerId = 'ctm_11111111111111111111111111';
  for (const [event_type, data] of [
    ['customer.updated', { id: customerId, email: 'paddle@example.com' }],
    [
      'subscription.updated',
      {
        id: 'sub_11111111111111111111111111',
        customer_id: customerId,
        status: 'active',
        billing_cycle: { interval: 'month', frequency: 1 },
        items: [],
        scheduled_change: { action: 'cancel', effective_at: fecha },
      },
    ],
    ['paddle.future_event', {}],
  ] as const) {
    const raw = JSON.stringify({ event_type, data, occurred_at: fecha });
    const event = await sdk.webhooks.unmarshal(raw, secreto, firmar(raw));
    await sincronizarEvento(event, admin);
  }
  assert.deepEqual(
    llamadas.map(({ nombre }) => nombre),
    ['sincronizar_paddle_cliente', 'sincronizar_paddle_suscripcion'],
  );
  assert.equal(llamadas[0].args.p_evento_en, fecha);
  assert.equal(llamadas[1].args.p_estado, 'active');
  assert.equal(llamadas[1].args.p_cambio_programado, 'cancel');
  assert.equal(llamadas[1].args.p_cambio_en, fecha);
});
