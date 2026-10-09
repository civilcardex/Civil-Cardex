// ls-webhook — edge function Lemon Squeezy (Supabase Edge).
//
// Webhook server-to-server de LS. POSTea SIN Authorization header ⇒ desplegar con
// verify_jwt = false (supabase/config.toml: [functions.ls-webhook]).
//
// Contrato con LS: POST JSON con header X-Signature = HMAC-SHA256 hex del RAW body
// (clave LS_WEBHOOK_KEY). Eventos manejados:
//   · order_created  → valida firma + monto contra app_pagos y llama
//                      activar_suscripciones(referencia, txn_id) (idempotente: verify
//                      y webhook pueden llegar en cualquier orden).
//   · order_refunded → v1: reconocido sin acción (no hay flujo de reembolso).
// Responde 200 tras validar firma (LS reintenta si no); 401 con firma inválida.

import {
  hmacHex,
  comparacionConstante,
  clienteAdmin,
  json,
  LS_WEBHOOK_KEY,
} from '../_shared/pago_utils.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  // 1 · Config: sin LS_WEBHOOK_KEY es un fallo de despliegue (500 visible, no un
  //     crash de WebCrypto por importKey con clave vacía).
  if (!LS_WEBHOOK_KEY) {
    console.error('ls-webhook: LS_WEBHOOK_KEY sin setear');
    return json({ error: 'webhook_no_configurado' }, 500);
  }

  // 2 · Firma HMAC sobre el cuerpo CRUDO (raw) — nunca sobre el JSON re-serializado.
  const raw = await req.text();
  const firmaEsperada = await hmacHex(LS_WEBHOOK_KEY, raw);
  const firmaRecibida = req.headers.get('X-Signature') ?? '';
  if (!comparacionConstante(firmaEsperada, firmaRecibida)) {
    return json({ error: 'firma_invalida' }, 401);
  }

  // 3 · Payload.
  let evento: {
    meta?: { event_name?: string };
    data?: { attributes?: Record<string, unknown> };
  };
  try {
    evento = JSON.parse(raw);
  } catch {
    return json({ error: 'payload_invalido' }, 400);
  }
  const nombre = evento.meta?.event_name ?? '';

  // Reembolsos v1: reconocidos sin acción.
  if (nombre === 'order_refunded') return json({ ok: true });

  if (nombre !== 'order_created') return json({ ok: true });

  // Orden de PRUEBA del store (tarjeta de test): dinero ficticio — jamás activa.
  const attrs = evento.data?.attributes ?? {};
  if (attrs.test_mode === true) {
    console.error('ls-webhook: order_created en test_mode ignorado');
    return json({ ok: true });
  }

  // 4 · custom data del checkout: { referencia, user_id } (viaja en la orden).
  const custom = (attrs.checkout_data as Record<string, unknown> | undefined)?.custom as
    | Record<string, unknown>
    | undefined;
  const referencia = typeof custom?.referencia === 'string' ? custom.referencia : '';
  if (!referencia) {
    // Orden de LS sin nuestra marca (otro producto de la tienda): reconocida, sin acción.
    return json({ ok: true });
  }

  const admin = clienteAdmin();

  // 4 · La fila debe existir y estar pendiente (la creó crear-checkout).
  const { data: pago, error: errPago } = await admin
    .from('app_pagos')
    .select('id, estado, monto_centavos, user_id')
    .eq('referencia', referencia)
    .single();
  if (errPago || !pago) {
    // Referencia desconocida: no activar nada. 200 para que LS no reintente eternamente.
    console.error('ls-webhook: referencia desconocida:', referencia);
    return json({ ok: true });
  }

  // 5 · Monto pagado = monto acordado (total en centavos). FAIL-CLOSED: sin total
  //     numérico válido NO se activa. Coerción previa: un string numérico ("4500")
  //     se acepta — rechazarlo devolvía 200 y LS no reintenta jamás (pago bueno
  //     quedaba cobrado sin activarse, auditoría A-2).
  const rawTotal: unknown = attrs.total;
  // String numérico se acepta con coma de miles fuera ("4,500" → 4500); basura sigue fallando.
  const totalPagado = typeof rawTotal === 'string' ? Number(rawTotal.replace(/,/g, '')) : rawTotal;
  if (typeof totalPagado !== 'number' || !Number.isFinite(totalPagado)) {
    console.error('ls-webhook: order_created sin total numérico:', referencia, typeof rawTotal);
    return json({ ok: true });
  }
  if (totalPagado < Number(pago.monto_centavos)) {
    console.error(
      'ls-webhook: monto insuficiente para',
      referencia,
      totalPagado,
      '<',
      pago.monto_centavos,
    );
    return json({ ok: true });
  }

  // 6 · Activación idempotente: marca aprobado (txn_id = identificador de la orden LS)
  //     y extiende/crea las suscripciones. Reintento de LS → early-return sin efecto.
  const txnId = String(evento.data?.attributes?.identifier ?? referencia);
  const { error: errActivar } = await admin.rpc('activar_suscripciones', {
    p_referencia: referencia,
    p_txn_id: txnId,
  });
  if (errActivar) {
    console.error('ls-webhook: activar_suscripciones:', referencia, errActivar.message);
    // 500 → LS reintenta con backoff (la activación es idempotente).
    return json({ error: 'error_interno' }, 500);
  }
  return json({ ok: true });
});
