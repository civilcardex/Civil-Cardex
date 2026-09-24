// Webhook de eventos de Wompi (canal de respaldo de wompi-verify). Sin auth de
// usuario: la autenticidad la da el checksum SHA256 de la firma del evento.
// activar_suscripciones es idempotente, así que verify + webhook pueden llegar
// en cualquier orden sin duplicar vigencias.
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
  const { error } = await admin.rpc('activar_suscripciones', {
    p_referencia: referencia,
    p_txn_id: String(tx.id ?? ''),
  });
  if (error && error.message !== 'pago_no_encontrado') {
    return json(500, { error: 'no_se_pudo_activar' });
  }
  return json(200, { ok: true });
});
