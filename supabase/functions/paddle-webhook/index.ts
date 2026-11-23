// paddle-webhook — edge function Paddle Billing (Supabase Edge).
//
// Webhook server-to-server de Paddle. POSTea SIN Authorization header ⇒ desplegar con
// verify_jwt = false (supabase/config.toml: [functions.paddle-webhook]).
//
// Contrato con Paddle: POST JSON con header
//   Paddle-Signature: ts=1671552777;h1=<hex HMAC-SHA256("{ts}:{rawBody}")>
// (clave PADDLE_WEBHOOK_SECRET, el "webhook secret" del endpoint — NO la API key).
// Eventos manejados (ambos llaman activar_suscripciones — idempotente: Paddle puede
// reintentar y paid/completed llegan para la misma transacción):
//   · transaction.paid      → valida firma + monto contra app_pagos y activa.
//   · transaction.completed → idem (backup: si paid se pierde, completed activa).
// Otros eventos (transaction.created, adjustment.*, …): reconocidos con 200 sin acción
// (no hay flujo de reembolso v1).
// Confirma la entrega después de procesarla; 401 con firma inválida.

import {
  clienteAdmin,
  json,
  PADDLE_WEBHOOK_SECRET,
  verificarFirmaPaddle,
} from '../_shared/payment_utils.ts';
import { processPaymentEvent } from './paymentEvent.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  // 1 · Config: sin PADDLE_WEBHOOK_SECRET es un fallo de despliegue (500 visible, no un
  //     crash de WebCrypto por importKey con clave vacía).
  if (!PADDLE_WEBHOOK_SECRET) {
    console.error('paddle-webhook: PADDLE_WEBHOOK_SECRET sin setear');
    return json({ error: 'webhook_no_configurado' }, 500);
  }

  // 2 · Firma HMAC sobre el cuerpo CRUDO (raw) — nunca sobre el JSON re-serializado.
  //     Incluye anti-replay: timestamp con más de 5 minutos se rechaza.
  const raw = await req.text();
  const firmaOk = await verificarFirmaPaddle(req.headers.get('Paddle-Signature') ?? '', raw);
  if (!firmaOk) return json({ error: 'firma_invalida' }, 401);

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'payload_invalido' }, 400);
  }

  const admin = clienteAdmin();
  try {
    const result = await processPaymentEvent(event, {
      load: async (reference) => {
        const { data, error } = await admin
          .from('app_pagos')
          .select('id, estado, monto_centavos, moneda, user_id')
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
      activate: async (reference, transactionId) => {
        const { error } = await admin.rpc('activar_suscripciones', {
          p_referencia: reference,
          p_txn_id: transactionId,
        });
        if (error) throw new Error('activacion_pago');
      },
    });
    if (result === 'invalid') {
      // El mismo cuerpo firmado no cambia al reintentarlo. Dejar la orden pendiente
      // para revisión y reconocer la entrega; otro evento válido aún puede activarla.
      console.error('paddle-webhook: campos de cobro inválidos; no se activó la orden');
    }
    return json({ ok: true });
  } catch {
    console.error('paddle-webhook: persistencia fallida; entrega reintentable');
    return json({ error: 'error_interno' }, 503);
  }
});
