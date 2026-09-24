// Verifica contra la API de Wompi que la transacción de una referencia esté
// APPROVED y que el monto coincida; si es así activa las suscripciones.
// Idempotente: activar_suscripciones no re-extiende un pago ya aprobado.
import {
  json,
  preflight,
  supabaseAdmin,
  suscripcionesHabilitadas,
  usuarioDelRequest,
  wompiGet,
} from '../_shared/wompi.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const admin = supabaseAdmin();
  const uid = await usuarioDelRequest(admin, req);
  if (!uid) return json(401, { error: 'no_autenticado' });
  if (!(await suscripcionesHabilitadas(admin))) {
    return json(403, { error: 'suscripciones_deshabilitadas' });
  }

  let body: { referencia?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'json_invalido' });
  }
  const referencia = typeof body.referencia === 'string' ? body.referencia : '';
  if (!referencia) return json(400, { error: 'referencia_requerida' });

  // El pago debe existir y pertenecer al usuario que pregunta.
  const { data: pago, error: errPago } = await admin
    .from('cf_pagos')
    .select('id, monto_centavos, estado')
    .eq('referencia', referencia)
    .eq('user_id', uid)
    .single();
  if (errPago || !pago) return json(404, { error: 'pago_no_encontrado' });
  if (pago.estado === 'aprobado') {
    return json(200, { aprobado: true });
  }

  // Busca por referencia (el widget no siempre entrega el id de transacción).
  let tx: Record<string, unknown> | null = null;
  try {
    const resp = await wompiGet(`/v1/transactions?reference=${encodeURIComponent(referencia)}`);
    const lista = Array.isArray(resp.data) ? (resp.data as Record<string, unknown>[]) : [];
    tx = lista.find((t) => t.status === 'APPROVED') ?? null;
  } catch (e) {
    if ((e as Error).message === 'wompi_no_configurado') {
      return json(503, { error: 'wompi_no_configurado' });
    }
    return json(502, { error: 'wompi_no_disponible' });
  }
  if (!tx) return json(200, { aprobado: false });

  const montoTx = Number(tx.amount_in_cents);
  if (montoTx !== Number(pago.monto_centavos)) {
    return json(409, { error: 'monto_no_coincide' });
  }

  const { error: errRpc } = await admin.rpc('activar_suscripciones', {
    p_referencia: referencia,
    p_txn_id: String(tx.id ?? ''),
  });
  if (errRpc) return json(500, { error: 'no_se_pudo_activar' });
  return json(200, { aprobado: true });
});
