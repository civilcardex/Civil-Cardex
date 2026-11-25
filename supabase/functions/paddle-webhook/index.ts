// paddle-webhook — edge function Paddle Billing (Supabase Edge).
//
// Webhook server-to-server de Paddle. POSTea SIN Authorization header ⇒ desplegar con
// verify_jwt = false (supabase/config.toml: [functions.paddle-webhook]).
//
// Contrato con Paddle: POST JSON con header
//   Paddle-Signature: ts=1671552777;h1=<hex HMAC-SHA256("{ts}:{rawBody}")>
// (clave PADDLE_WEBHOOK_SECRET, el "webhook secret" del endpoint — NO la API key).
// Eventos manejados (ambos pasan por confirmar_pago_paddle, que vincula el cliente
// y usa activar_suscripciones una sola vez por transacción):
//   · transaction.paid      → valida firma + monto contra app_pagos y activa.
//   · transaction.completed → idem (backup: si paid se pierde, completed activa).
//   · transaction.payment_failed → programa un aviso si la orden sigue pendiente.
// Los eventos de cliente y suscripción actualizan el espejo de facturación.
// Otros eventos (transaction.created, adjustment.*, …) se reconocen sin acción.
// Confirma la entrega después de procesarla; 401 con firma inválida.

import {
  clienteAdmin,
  json,
  PADDLE_WEBHOOK_SECRET,
  usuarioPaddlePermitido,
} from '../_shared/payment_utils.ts';
import { entornoPaddle, EventName, paddle, type EventEntity } from '../_shared/paddleSdk.ts';
import { processPaymentEvent } from './paymentEvent.ts';
import { sincronizarEvento } from './syncEvent.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405, req);

  if (!paddle || !PADDLE_WEBHOOK_SECRET) {
    console.error('paddle-webhook: configuración de Paddle incompleta');
    return json({ error: 'webhook_no_configurado' }, 500, req);
  }

  let event: EventEntity;
  try {
    event = await paddle.webhooks.unmarshal(
      await req.text(),
      PADDLE_WEBHOOK_SECRET,
      req.headers.get('Paddle-Signature') ?? '',
    );
  } catch {
    return json({ error: 'evento_no_verificado' }, 401, req);
  }

  const admin = clienteAdmin();
  try {
    if (event.eventType === EventName.TransactionPaymentFailed) {
      const { referencia, user_id } = event.data.customData ?? {};
      if (
        event.data.subscriptionId ||
        typeof referencia !== 'string' ||
        !referencia ||
        typeof user_id !== 'string' ||
        !usuarioPaddlePermitido(user_id)
      )
        return json({ ok: true }, undefined, req);

      const { data, error } = await admin.rpc('encolar_correo_pago_fallido', {
        p_referencia: referencia,
        p_user_id: user_id,
        p_txn_id: event.data.id,
        p_entorno: entornoPaddle,
      });
      if (error) throw new Error('encolar_pago_fallido');
      if (data === 'sin_vincular') return json({ error: 'pago_no_vinculado' }, 503, req);
      return json({ ok: true }, undefined, req);
    }
    if (
      event.eventType !== EventName.TransactionPaid &&
      event.eventType !== EventName.TransactionCompleted
    ) {
      await sincronizarEvento(event, admin);
      return json({ ok: true }, undefined, req);
    }
    if (!usuarioPaddlePermitido(event.data.customData?.user_id))
      return json({ ok: true }, undefined, req);
    const result = await processPaymentEvent(event, {
      load: async (reference) => {
        const { data, error } = await admin
          .from('app_pagos')
          .select('id, estado, monto_centavos, moneda, user_id, txn_id, paddle_customer_id')
          .eq('referencia', reference)
          .maybeSingle();
        if (error) throw new Error('lectura_pago');
        return data;
      },
      review: async (id) => {
        const { error } = await admin
          .from('app_pagos')
          .update({ estado: 'revision' })
          .eq('id', id)
          .eq('estado', 'pendiente');
        if (error) throw new Error('actualizacion_pago');
      },
      activate: async (reference, transactionId, customerId) => {
        const { error } = await admin.rpc('confirmar_pago_paddle', {
          p_referencia: reference,
          p_txn_id: transactionId,
          p_customer_id: customerId,
        });
        if (error) throw new Error('activacion_pago');
      },
    });
    if (result === 'unbound') {
      console.error('paddle-webhook: orden de Paddle pendiente de vincular');
      return json({ error: 'pago_no_vinculado' }, 503, req);
    }
    if (result === 'invalid') {
      // El mismo cuerpo firmado no cambia al reintentarlo. Dejar la orden pendiente
      // para revisión y reconocer la entrega; otro evento válido aún puede activarla.
      console.error('paddle-webhook: campos de cobro inválidos; no se activó la orden');
    }
    return json({ ok: true }, undefined, req);
  } catch {
    console.error('paddle-webhook: persistencia fallida; entrega reintentable');
    return json({ error: 'error_interno' }, 503, req);
  }
});
