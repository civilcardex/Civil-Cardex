// crear-checkout — edge function Lemon Squeezy (Supabase Edge).
//
// Contrato con el cliente (CheckoutModal.tsx):
//   body:  { modulos: ('flow'|'manage')[], periodo: 'mensual'|'semestral'|'anual',
//            puestosPorModulo?: Record<modulo, number> }
//   200:   { checkoutUrl, referencia }
//   error: { error: 'suscripciones_deshabilitadas' | 'pasarela_no_configurada' |
//                    'venta_manual' | 'demasiados_intentos' | 'parametros_invalidos' }
//
// Flujo: JWT del caller → gate suscripciones_habilitadas → precio SIEMPRE server-side
// (app_precios, la verdad en BD; _shared/lemon.ts como fallback — jamás del cliente) →
// fila app_pagos 'pendiente' (service-role vía RPC atómica; la tabla rechaza INSERT de
// clientes) → checkout hosteado LS con custom_price y checkout_data.custom =
// { referencia, user_id } (el webhook lo recibe de vuelta). Preflight CORS + cabeceras
// en toda respuesta (functions.invoke manda Authorization/apikey).

import {
  calcularTotalCentavos,
  descuentoPorPuestos,
  puestosDe,
  type ModuloId,
  type Periodo,
  type PreciosBd,
} from '../_shared/lemon.ts';
import {
  clienteAdmin,
  clienteUsuario,
  json,
  LS_API_KEY,
  LS_STORE,
  preflight,
  SITE_URL,
} from '../_shared/pago_utils.ts';

Deno.serve(async (req: Request) => {
  // Preflight CORS: functions.invoke manda Authorization/apikey ⇒ el navegador
  // exige OPTIONS antes del POST real (sin esto toda llamada browser muere aquí).
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  // 1 · Identidad del caller.
  const supaUser = clienteUsuario(req);
  const {
    data: { user },
  } = await supaUser.auth.getUser();
  if (!user) return json({ error: 'no_autenticado' }, 401);

  // 2 · Gate global de suscripciones (app_config → RPC). Apagado = nadie compra.
  //     El error del RPC NO se traga: sin EXECUTE de service_role (o caída) es un
  //     500 explícito, no un falso "suscripciones_deshabilitadas" indetectable.
  const admin = clienteAdmin();
  const { data: habilitadas, error: errHab } = await admin.rpc('suscripciones_habilitadas');
  if (errHab) {
    console.error('crear-checkout: gate suscripciones_habilitadas:', errHab.message);
    return json({ error: 'error_interno' }, 500);
  }
  if (habilitadas !== true) return json({ error: 'suscripciones_deshabilitadas' }, 400);

  // 3 · Secrets de la pasarela.
  if (LS_API_KEY === '' || LS_STORE === '') return json({ error: 'pasarela_no_configurada' }, 400);

  // 4 · Payload saneado.
  let body: { modulos?: unknown; periodo?: unknown; puestosPorModulo?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'parametros_invalidos' }, 400);
  }
  const modulosRaw = Array.isArray(body.modulos) ? body.modulos : [];
  const modulos = [...new Set(modulosRaw)].filter(
    (m): m is ModuloId => m === 'flow' || m === 'manage',
  );
  const periodo: Periodo =
    body.periodo === 'anual' || body.periodo === 'semestral' || body.periodo === 'mensual'
      ? body.periodo
      : ('' as Periodo);
  if (modulos.length === 0 || !periodo) return json({ error: 'parametros_invalidos' }, 400);

  const puestos =
    body.puestosPorModulo && typeof body.puestosPorModulo === 'object'
      ? (body.puestosPorModulo as Record<string, number>)
      : undefined;

  // 5 · Precio SIEMPRE server-side, desde app_precios (la verdad en BD — cambiar precio
  //     = UPDATE en SQL Editor, sin deploy); lemon.ts queda como fallback si la fila del
  //     módulo falta o trae un valor no positivo. ≥25 puestos = venta manual (negociado).
  const { data: preciosRows } = await admin
    .from('app_precios')
    .select('modulo, precio_mensual_centavos, precio_semestral_centavos, precio_anual_centavos');
  const preciosBd: Partial<Record<ModuloId, PreciosBd>> = {};
  for (const r of preciosRows ?? []) {
    if (r.modulo !== 'flow' && r.modulo !== 'manage') continue;
    const mensual = Number(r.precio_mensual_centavos);
    const semestral = Number(r.precio_semestral_centavos);
    const anual = Number(r.precio_anual_centavos);
    if ([mensual, semestral, anual].every((n) => Number.isFinite(n) && n > 0)) {
      preciosBd[r.modulo] = { mensual, semestral, anual };
    }
  }
  const total = calcularTotalCentavos(modulos, periodo, puestos, preciosBd);
  const totalPuestos = modulos.reduce((s, m) => s + puestosDe(puestos, m), 0);
  if (descuentoPorPuestos(totalPuestos) === null) return json({ error: 'venta_manual' }, 400);
  if (!Number.isFinite(total) || total <= 0) return json({ error: 'parametros_invalidos' }, 400);

  // 6+7 · Fila de pago pendiente vía RPC atómica: advisory lock por usuario + cap
  //     de 5 intenciones/h + insert en UNA transacción (el check-then-insert en TS
  //     tenía TOCTOI: N requests paralelas pasaban todas el cap). puestos por módulo
  //     SOLO de los módulos pedidos, saneado ≥1.
  const referencia = crypto.randomUUID();
  const puestosPorModulo: Record<string, number> = {};
  for (const m of modulos) puestosPorModulo[m] = puestosDe(puestos, m);
  const { data: agendado, error: errPago } = await admin.rpc('registrar_intencion_pago', {
    p_uid: user.id,
    p_referencia: referencia,
    p_modulos: modulos,
    p_periodo: periodo,
    p_monto: total,
    p_puestos: puestosPorModulo,
  });
  if (errPago) {
    console.error('crear-checkout: registrar_intencion_pago:', errPago.message);
    return json({ error: 'error_interno' }, 500);
  }
  if (agendado === false) return json({ error: 'demasiados_intentos' }, 429);

  // 8 · Checkout hosteado LS (precio custom: la venta es multi-módulo con descuentos
  //     compuestos — no hay producto/variante por combinación).
  const descripcion = `CivilCardex ${modulos.join(' + ')} (${periodo})`;
  let checkoutUrl = '';
  // Sin checkout no hay acuerdo posible: la fila pendiente se elimina (el check de
  // estado de app_pagos no tiene 'fallida', y dejarla contaba contra el cap anti-spam
  // del usuario por fallos de la pasarela que no le pertenecen). Con await: el runtime
  // puede congelar el isolate al devolver la Response y matar un delete en vuelo.
  const cancelarPago = async (): Promise<void> => {
    await admin.from('app_pagos').delete().eq('referencia', referencia);
  };
  try {
    const resp = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LS_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            custom_price: { amount: total, currency: 'USD' },
            product_options: {
              name: 'CivilCardex',
              description: descripcion,
              redirect_url: `${SITE_URL}/pricing?ref=${referencia}`,
              receipt_button_text: 'Volver a CivilCardex',
            },
            checkout_options: { embed: false, dark: true },
            checkout_data: {
              email: user.email ?? undefined,
              custom: { referencia, user_id: user.id },
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: LS_STORE } },
          },
        },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('crear-checkout: LS', resp.status, JSON.stringify(data).slice(0, 400));
      await cancelarPago();
      return json({ error: 'pasarela_no_configurada' }, 502);
    }
    checkoutUrl = data?.data?.attributes?.url ?? '';
  } catch (e) {
    console.error('crear-checkout: fetch LS:', e instanceof Error ? e.message : e);
    await cancelarPago();
    return json({ error: 'pasarela_no_configurada' }, 502);
  }
  if (!checkoutUrl) {
    await cancelarPago();
    return json({ error: 'pasarela_no_configurada' }, 502);
  }

  return json({ checkoutUrl, referencia });
});
