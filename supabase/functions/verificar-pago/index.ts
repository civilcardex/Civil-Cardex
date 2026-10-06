// verificar-pago — edge function Lemon Squeezy (Supabase Edge).
//
// Contrato con el cliente (PricingPage.tsx, vuelta del checkout ?ref=X):
//   body:  { referencia: string }
//   200:   { aprobado: boolean }
//   error: { error: 'no_autenticado' | 'parametros_invalidos' } (401/400)
//
// La VERDAD de activación es ls-webhook (order_created → activar_suscripciones).
// Esta función es la consulta idempotente del cliente: mira la fila app_pagos
// PROPIA (referencia + user_id — defensa IDOR) y reporta su estado. Si el
// webhook aún no llegó, responde { aprobado: false } y el cliente muestra
// "verificación pendiente".

import { clienteAdmin, clienteUsuario, json, preflight } from '../_shared/pago_utils.ts';

Deno.serve(async (req: Request) => {
  // Preflight CORS (functions.invoke manda Authorization/apikey).
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  const supaUser = clienteUsuario(req);
  const {
    data: { user },
  } = await supaUser.auth.getUser();
  if (!user) return json({ error: 'no_autenticado' }, 401);

  let body: { referencia?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'parametros_invalidos' }, 400);
  }
  const referencia = typeof body.referencia === 'string' ? body.referencia.trim() : '';
  if (!referencia || referencia.length > 100) {
    return json({ error: 'parametros_invalidos' }, 400);
  }

  const admin = clienteAdmin();
  const { data: pago, error } = await admin
    .from('app_pagos')
    .select('estado, user_id')
    .eq('referencia', referencia)
    .single();
  if (error || !pago) return json({ aprobado: false });

  // Defensa IDOR: la referencia debe ser del caller.
  if (pago.user_id !== user.id) return json({ aprobado: false });

  return json({ aprobado: pago.estado === 'aprobado' });
});
