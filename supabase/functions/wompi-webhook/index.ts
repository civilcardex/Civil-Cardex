// Webhook de eventos de Wompi (canal de respaldo de wompi-verify). Sin auth de
// usuario: la autenticidad la da el checksum SHA256 de la firma del evento, y el
// despliegue requiere verify_jwt = false (supabase/config.toml) porque Wompi POSTea
// sin Authorization. Además del estado APPROVED valida MONTO y MONEDA contra la
// intención registrada (un payment link manual con la misma referencia y monto menor
// no puede activar el paquete) — misma regla que wompi-verify. activar_suscripciones
// es idempotente (FOR UPDATE + rowcount), así que verify + webhook pueden llegar en
// cualquier orden sin duplicar vigencias.
import { json, preflight, supabaseAdmin, verificarFirmaEventos } from '../_shared/wompi.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'json_invalido' });
  }

  if (!(await verificarFirmaEventos(body))) {
    return json(401, { error: 'firma_invalida' });
  }
  if (body.event !== 'transaction.updated') {
    return json(200, { ignorado: true });
  }

  const tx = (body.data as Record<string, unknown> | undefined)?.transaction as
    | Record<string, unknown>
    | undefined;
  const referencia = typeof tx?.reference === 'string' ? tx.reference : '';
  if (!referencia || tx?.status !== 'APPROVED') {
    return json(200, { ignorado: true });
  }

  const admin = supabaseAdmin();
  // Monto/moneda contra la INTENCIÓN: el canal de menor confianza es el que MENOS debe
  // asumir (verify ya hace esta comparación con la API como fuente).
  const { data: pago } = await admin
    .from('cf_pagos')
    .select('monto_centavos, moneda')
    .eq('referencia', referencia)
    .maybeSingle();
  if (!pago) return json(200, { ignorado: true });
  if (
    Number(tx.amount_in_cents) !== Number(pago.monto_centavos) ||
    String(tx.currency ?? '') !== String(pago.moneda ?? 'COP')
  ) {
    return json(409, { error: 'monto_no_coincide' });
  }

  const { error } = await admin.rpc('activar_suscripciones', {
    p_referencia: referencia,
    // null (no '') cuando Wompi no trae id: la columna es unique y dos '' colisionan.
    p_txn_id: tx.id != null ? String(tx.id) : null,
  });
  if (error && error.message !== 'pago_no_encontrado') {
    return json(500, { error: 'no_se_pudo_activar' });
  }
  return json(200, { ok: true });
});
