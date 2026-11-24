// crear-checkout — edge function Paddle Billing (Supabase Edge).
//
// Contrato con el cliente (CheckoutModal.tsx):
//   body:  { modulos: ('flow'|'manage')[], periodo: 'mensual'|'semestral'|'anual',
//            puestosPorModulo?: Record<modulo, number> }
//   200:   { transactionId, checkoutUrl, referencia }
//   error: { error: 'suscripciones_deshabilitadas' | 'pasarela_no_configurada' |
//                    'venta_manual' | 'demasiados_intentos' | 'parametros_invalidos' }
//
// Flujo: JWT del caller → autorización de compra → precio SIEMPRE server-side
// (app_precios, la verdad en BD; _shared/pricing.ts como fallback — jamás del cliente) →
// fila app_pagos 'pendiente' (service-role vía RPC atómica; la tabla rechaza INSERT de
// clientes) → transacción Paddle con ÍTEM NO-CATÁLOGO (precio inline: la venta es
// multi-módulo con descuentos compuestos — no hay producto por combinación) y
// custom_data = { referencia, user_id } (el webhook lo recibe de vuelta). El checkout
// se abre en Paddle.js con el ID de la transacción. Preflight CORS + cabeceras
// en toda respuesta (functions.invoke manda Authorization/apikey).

import {
  calcularTotalCentavos,
  descuentoPorPuestos,
  puestosDe,
  type ModuloId,
  type Periodo,
  type PreciosBd,
} from '../_shared/pricing.ts';
import {
  clienteAdmin,
  clienteUsuario,
  json,
  paddleConfigurado,
  usuarioPaddlePermitido,
  PADDLE_API_BASE,
  PADDLE_API_KEY,
  preflight,
} from '../_shared/payment_utils.ts';

/** Rol del payload de un JWT de Supabase (los 3 segmentos son base64url: alfabeto '-'/'_' sin
 *  padding — atob() lanza con esos caracteres, hay que convertir a base64 estándar antes).
 *  @param authHeader cabecera Authorization completa ('Bearer eyJ...'); @returns 'authenticated' | 'anon' | undefined. */
export function rolDeJwt(authHeader: string): string | undefined {
  const seg = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const payloadSeg = seg.split('.')[1];
  if (!payloadSeg) return undefined;
  try {
    const b64 = payloadSeg.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as {
      role?: string;
    };
    return payload.role;
  } catch {
    return undefined;
  }
}

Deno.serve(async (req: Request) => {
  // Preflight CORS: functions.invoke manda Authorization/apikey ⇒ el navegador
  // exige OPTIONS antes del POST real (sin esto toda llamada browser muere aquí).
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  // 1 · Identidad del caller. La ANON KEY es un JWT válido (rol 'anon'): sin este check
  //     un atacante sin cuenta quema invocaciones edge + getUser() por request hasta el 401.
  const rolJwt = rolDeJwt(req.headers.get('Authorization') ?? '');
  if (rolJwt !== 'authenticated') return json({ error: 'no_autenticado' }, 401);
  const supaUser = clienteUsuario(req);
  const {
    data: { user },
  } = await supaUser.auth.getUser();
  if (!user) return json({ error: 'no_autenticado' }, 401);

  // 2 · Valida el entorno y, en sandbox, el usuario de prueba configurado.
  if (!paddleConfigurado()) {
    console.error(
      'crear-checkout: PADDLE_API_BASE y PADDLE_API_KEY deben corresponder al mismo entorno',
    );
    return json({ error: 'pasarela_no_configurada' }, 500);
  }
  if (!usuarioPaddlePermitido(user.id)) return json({ error: 'sandbox_restringido' }, 403);

  // 3 · Las ventas reales requieren activar suscripciones. El usuario de sandbox
  // puede probar un pago sin cambiar el acceso del resto de usuarios.
  const admin = clienteAdmin();
  if (PADDLE_API_BASE === 'https://api.paddle.com') {
    const { data: habilitadas, error: errHab } = await admin.rpc('suscripciones_habilitadas');
    if (errHab) {
      console.error('crear-checkout: gate suscripciones_habilitadas:', errHab.message);
      return json({ error: 'error_interno' }, 500);
    }
    if (habilitadas !== true) return json({ error: 'suscripciones_deshabilitadas' }, 400);
  }

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
  //     = UPDATE en SQL Editor, sin deploy); pricing.ts queda como fallback si la fila del
  //     módulo falta o trae un valor no positivo. ≥25 puestos = venta manual (negociado).
  // FAIL-CLOSED: si la lectura de la verdad (app_precios) falla, NO se cobra con
  // literales viejos — el cliente podría estar mostrando precios de BD distintos.
  const { data: preciosRows, error: errPrecios } = await admin
    .from('app_precios')
    .select('modulo, precio_mensual_centavos, precio_semestral_centavos, precio_anual_centavos');
  if (errPrecios) {
    console.error('crear-checkout: app_precios ilegible:', errPrecios.message);
    return json({ error: 'error_interno' }, 500);
  }
  const preciosBd: Partial<Record<ModuloId, PreciosBd>> = {};
  for (const r of preciosRows ?? []) {
    const modulo: unknown = r.modulo;
    if (modulo !== 'flow' && modulo !== 'manage') continue;
    const mensual = Number(r.precio_mensual_centavos);
    const semestral = Number(r.precio_semestral_centavos);
    const anual = Number(r.precio_anual_centavos);
    if ([mensual, semestral, anual].every((n) => Number.isFinite(n) && n > 0)) {
      preciosBd[modulo] = { mensual, semestral, anual };
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

  // 8 · Transacción Paddle con ítem NO-CATÁLOGO (precio inline: la venta es multi-módulo
  //     con descuentos compuestos — no hay producto por combinación). tax_mode 'internal':
  //     el impuesto va INCLUIDO en el precio anunciado (el usuario paga exactamente el
  //     total de /pricing). unit_price.amount = STRING en centavos (formato Paddle).
  const descripcion = `CivilCardex ${modulos.join(' + ')} (${periodo})`;
  let checkoutUrl = '';
  let transactionId = '';
  try {
    const resp = await fetch(`${PADDLE_API_BASE}/transactions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PADDLE_API_KEY}`,
      },
      body: JSON.stringify({
        currency_code: 'USD',
        items: [
          {
            quantity: 1,
            price: {
              description: `Suscripción ${descripcion}`,
              name: descripcion,
              unit_price: { amount: String(total), currency_code: 'USD' },
              quantity: { minimum: 1, maximum: 1 },
              tax_mode: 'internal',
              product: {
                name: 'CivilCardex',
                tax_category: 'standard',
                description: 'Suscripción por módulo al suite de ingeniería CivilCardex.',
              },
            },
          },
        ],
        custom_data: { referencia, user_id: user.id },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('crear-checkout: Paddle', resp.status, JSON.stringify(data).slice(0, 400));
      return json({ error: 'pasarela_no_configurada' }, 502);
    }
    checkoutUrl = data?.data?.checkout?.url ?? '';
    transactionId = data?.data?.id ?? '';
  } catch (e) {
    console.error('crear-checkout: fetch Paddle:', e instanceof Error ? e.message : e);
    return json({ error: 'pasarela_no_configurada' }, 502);
  }
  if (!/^txn_[a-z0-9]{26}$/.test(transactionId)) {
    return json({ error: 'pasarela_no_configurada' }, 502);
  }

  const { error: errVinculo } = await admin
    .from('app_pagos')
    .update({
      txn_id: transactionId,
      paddle_entorno:
        PADDLE_API_BASE === 'https://sandbox-api.paddle.com' ? 'sandbox' : 'production',
    })
    .eq('referencia', referencia)
    .eq('estado', 'pendiente')
    .is('txn_id', null)
    .select('id')
    .single();
  if (errVinculo) {
    console.error('crear-checkout: no se pudo vincular la orden:', errVinculo.message);
    return json({ error: 'error_interno' }, 500);
  }
  return json({ transactionId, checkoutUrl, referencia });
});
