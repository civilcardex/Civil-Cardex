import { timingSafeEqual } from 'node:crypto';
import { clienteAdmin, json, PADDLE_API_BASE } from '../_shared/payment_utils.ts';
import { paddle } from '../_shared/paddleSdk.ts';

interface Correo {
  clave: string;
  tipo: 'pago' | 'pago_fallido' | 'vencimiento';
  intentos: number;
  email: string;
  modulos: ('flow' | 'manage')[];
  referencia: string;
  fecha_fin: string | null;
}

const encoder = new TextEncoder();
const cronSecret = Deno.env.get('SUBSCRIPTION_EMAIL_CRON_SECRET');
const apiKey = Deno.env.get('RESEND_API_KEY');
const remitente = Deno.env.get('SUBSCRIPTION_EMAIL_FROM');
const plantillaPago = Deno.env.get('RESEND_PAYMENT_CONFIRMED_TEMPLATE_ID')?.trim();
const plantillaPagoFallido = Deno.env.get('RESEND_PAYMENT_FAILED_TEMPLATE_ID')?.trim();
const usuarioPrueba = Deno.env.get('PADDLE_SANDBOX_USER_ID');
const entorno =
  PADDLE_API_BASE === 'https://api.paddle.com'
    ? 'production'
    : PADDLE_API_BASE === 'https://sandbox-api.paddle.com'
      ? 'sandbox'
      : null;
const vencimiento = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

async function mensaje(correo: Correo, admin: ReturnType<typeof clienteAdmin>) {
  const modulos = correo.modulos
    .map((m) => (m === 'flow' ? 'Civil Flow' : 'Civil Manager'))
    .join(' y ');
  if (correo.tipo === 'vencimiento' && correo.fecha_fin) {
    return {
      subject: `Tu acceso a ${modulos} vence pronto`,
      text: `Tu acceso a ${modulos} vence el ${vencimiento.format(new Date(correo.fecha_fin))} (hora de Bogotá). Si quieres seguir usando el módulo, puedes renovar en https://civilcardex.com/pricing. La renovación es manual.`,
    };
  }
  const plantilla = correo.tipo === 'pago_fallido' ? plantillaPagoFallido : plantillaPago;
  if (correo.tipo === 'pago_fallido' && !plantilla) throw new Error('plantilla_no_configurada');
  if (plantilla && correo.tipo !== 'vencimiento') {
    const { data: registro, error: errorRegistro } = await admin
      .from('app_subscription_emails')
      .select('user_id')
      .eq('clave', correo.clave)
      .single();
    if (errorRegistro) throw new Error('lectura_correo');

    const { data: perfil, error: errorPerfil } = await admin
      .from('cf_perfiles')
      .select('nombre')
      .eq('id', registro.user_id)
      .maybeSingle();
    if (errorPerfil) throw new Error('lectura_perfil');

    return {
      template: {
        id: plantilla,
        variables: {
          NOMBRE: perfil?.nombre?.trim() || 'cliente de CivilCardex',
          MODULOS: modulos,
          REFERENCIA: correo.referencia,
        },
      },
    };
  }
  return {
    subject: `Pago confirmado para ${modulos}`,
    text: `Confirmamos tu pago para ${modulos}. Referencia: ${correo.referencia}. Puedes acceder a tus módulos en https://civilcardex.com/perfil.`,
  };
}

/** El estado LOCAL puede irse detrás del webhook: un pago rechazado y luego capturado
 *  seguiría 'pendiente' aquí. Antes de enviar el aviso se pregunta a Paddle por el txn_id.
 *  true = ya se cobró (no enviar); false = sigue fallido; null = no se pudo confirmar (reintentar). */
async function pagoCapturado(
  correo: Correo,
  admin: ReturnType<typeof clienteAdmin>,
): Promise<boolean | null> {
  if (!paddle || !correo.referencia) return null;
  const { data: pago, error } = await admin
    .from('app_pagos')
    .select('txn_id, paddle_entorno')
    .eq('referencia', correo.referencia)
    .maybeSingle();
  if (error || !pago?.txn_id) return null;
  try {
    const txn = await paddle.transactions.get(pago.txn_id);
    const estado = String((txn as { data?: { status?: string } }).data?.status ?? '').toLowerCase();
    if (['paid', 'completed', 'billed', 'captured'].includes(estado)) return true;
    if (['failed', 'canceled'].includes(estado)) return false;
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405, req);
  const token = encoder.encode(req.headers.get('X-Subscription-Email-Secret') ?? '');
  const esperado = encoder.encode(cronSecret ?? '');
  if (!cronSecret || token.length !== esperado.length || !timingSafeEqual(token, esperado)) {
    return json({ error: 'no_autorizado' }, 401, req);
  }
  if (!apiKey || !remitente || !entorno || (entorno === 'sandbox' && !usuarioPrueba)) {
    return json({ error: 'correo_no_configurado' }, 503, req);
  }
  const admin = clienteAdmin();
  const { data, error } = await admin.rpc('reclamar_correos_suscripcion', {
    p_entorno: entorno,
    p_usuario_prueba: entorno === 'sandbox' ? usuarioPrueba : null,
    ...(plantillaPagoFallido ? { p_incluir_fallidos: true } : {}),
  });
  if (error) {
    console.error('subscription-emails: no se pudo reservar el lote', error.code);
    return json({ error: 'lectura_correos' }, 503, req);
  }

  let enviados = 0;
  let fallidos = 0;
  for (const correo of (data ?? []) as Correo[]) {
    try {
      const contenido = await mensaje(correo, admin);
      if (correo.tipo === 'pago_fallido') {
        const { data: pago, error } = await admin
          .from('app_pagos')
          .select('estado')
          .eq('referencia', correo.referencia)
          .maybeSingle();
        if (error) throw new Error('lectura_pago');
        if (pago?.estado !== 'pendiente') continue;
        const capturado = await pagoCapturado(correo, admin);
        if (capturado === true) {
          // El webhook llegó tarde: cerrar el aviso para no volver a revisarlo cada 5 min.
          await admin
            .from('app_subscription_emails')
            .update({ enviado_en: new Date().toISOString(), proveedor_id: 'paddle_paid' })
            .eq('clave', correo.clave)
            .eq('intentos', correo.intentos);
          continue;
        }
        if (capturado === null) continue; // consulta inconclusa: el reintento lo resuelve
      }
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `civilcardex/${entorno}/${correo.clave}`,
        },
        body: JSON.stringify({ ...contenido, from: remitente, to: [correo.email] }),
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error(`proveedor_http_${response.status}`);
      const { id } = await response.json();
      if (typeof id !== 'string' || !id) throw new Error('respuesta_sin_identificador');
      const { error: persistencia } = await admin
        .from('app_subscription_emails')
        .update({ enviado_en: new Date().toISOString(), proveedor_id: id })
        .eq('clave', correo.clave)
        .eq('intentos', correo.intentos);
      if (persistencia) throw new Error('registro_no_actualizado');
      enviados++;
    } catch (err) {
      fallidos++;
      const codigo = err instanceof Error ? err.message : '';
      console.error(
        'subscription-emails: correo pendiente',
        correo.clave,
        /^proveedor_http_\d{3}$/.test(codigo) ? codigo : 'error_de_envio_o_registro',
      );
    }
  }
  return json({ enviados, fallidos }, fallidos > 0 ? 503 : 200, req);
});
