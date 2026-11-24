import { clienteAdmin, clienteUsuario, json, preflight } from '../_shared/payment_utils.ts';
import { ApiError, entornoPaddle, paddle } from '../_shared/paddleSdk.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  const {
    data: { user },
  } = await clienteUsuario(req).auth.getUser();
  if (!user) return json({ error: 'no_autenticado' }, 401);
  if (!user.email || !user.email_confirmed_at) return json({ error: 'correo_no_verificado' }, 403);
  if (!paddle) return json({ error: 'portal_no_configurado' }, 503);

  try {
    const admin = clienteAdmin();
    const email = user.email.trim().toLowerCase();
    const { data: espejo, error: errorCliente } = await admin
      .from('app_paddle_customers')
      .select('customer_id')
      .eq('entorno', entornoPaddle)
      .eq('email', email)
      .maybeSingle();
    if (errorCliente) throw errorCliente;

    const { data: pago, error } = espejo
      ? { data: null, error: null }
      : await admin
          .from('app_pagos')
          .select('paddle_customer_id')
          .eq('user_id', user.id)
          .eq('estado', 'aprobado')
          .not('paddle_customer_id', 'is', null)
          .order('aprobado_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
    if (error) throw error;
    const customerId = espejo?.customer_id ?? pago?.paddle_customer_id;
    if (typeof customerId !== 'string' || !/^ctm_[a-z0-9]{26}$/.test(customerId)) {
      return json({ error: 'sin_facturacion' }, 404);
    }

    const cliente = await paddle.customers.get(customerId);
    // El checkout permite otro correo de facturación. Solo el correo confirmado
    // del usuario autoriza abrir el historial que incluye compras anteriores.
    if (cliente.id !== customerId || cliente.email.trim().toLowerCase() !== email) {
      return json({ error: 'correo_facturacion_distinto' }, 403);
    }

    const { data: suscripciones, error: errorSubs } = await admin
      .from('app_paddle_subscriptions')
      .select('subscription_id')
      .eq('customer_id', customerId)
      .eq('entorno', entornoPaddle)
      .in('estado', ['active', 'trialing', 'paused', 'past_due'])
      .order('ultimo_evento_en', { ascending: false })
      .limit(25);
    if (errorSubs) throw errorSubs;
    const sesion = await paddle.customerPortalSessions.create(
      customerId,
      suscripciones?.map(({ subscription_id }) => subscription_id),
    );
    const url = new URL(sesion.urls.general.overview ?? '');
    const host =
      entornoPaddle === 'sandbox'
        ? 'sandbox-customer-portal.paddle.com'
        : 'customer-portal.paddle.com';
    if (
      sesion.customerId !== customerId ||
      url.origin !== `https://${host}` ||
      url.username ||
      url.password
    ) {
      throw new Error('URL de portal inválida');
    }
    return json({ url: url.href });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return json({ error: 'sin_facturacion' }, 404);
    }
    console.error(
      'paddle-portal:',
      error instanceof Error ? error.message : 'error de facturación',
    );
    return json({ error: 'portal_no_disponible' }, 502);
  }
});
