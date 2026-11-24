import { timingSafeEqual } from 'node:crypto';
import { clienteAdmin, json, PADDLE_API_BASE } from '../_shared/payment_utils.ts';

interface Correo {
  clave: string;
  tipo: 'pago' | 'vencimiento';
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

function mensaje(correo: Correo) {
  const modulos = correo.modulos
    .map((m) => (m === 'flow' ? 'Civil Flow' : 'Civil Manager'))
    .join(' y ');
  if (correo.tipo === 'vencimiento' && correo.fecha_fin) {
    return {
      subject: `Tu acceso a ${modulos} vence pronto`,
      text: `Tu acceso a ${modulos} vence el ${vencimiento.format(new Date(correo.fecha_fin))} (hora de Bogotá). Si quieres seguir usando el módulo, puedes renovar en https://civilcardex.com/pricing. La renovación es manual.`,
    };
  }
  return {
    subject: `Pago confirmado para ${modulos}`,
    text: `Confirmamos tu pago para ${modulos}. Referencia: ${correo.referencia}. Puedes acceder a tus módulos en https://civilcardex.com/perfil.`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);
  const token = encoder.encode(req.headers.get('X-Subscription-Email-Secret') ?? '');
  const esperado = encoder.encode(cronSecret ?? '');
  if (!cronSecret || token.length !== esperado.length || !timingSafeEqual(token, esperado)) {
    return json({ error: 'no_autorizado' }, 401);
  }
  if (!apiKey || !remitente || !entorno || (entorno === 'sandbox' && !usuarioPrueba)) {
    return json({ error: 'correo_no_configurado' }, 503);
  }
  const admin = clienteAdmin();
  const { data, error } = await admin.rpc('reclamar_correos_suscripcion', {
    p_entorno: entorno,
    p_usuario_prueba: entorno === 'sandbox' ? usuarioPrueba : null,
  });
  if (error) {
    console.error('subscription-emails: no se pudo reservar el lote', error.code);
    return json({ error: 'lectura_correos' }, 503);
  }

  let enviados = 0;
  let fallidos = 0;
  for (const correo of (data ?? []) as Correo[]) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `civilcardex/${entorno}/${correo.clave}`,
        },
        body: JSON.stringify({ ...mensaje(correo), from: remitente, to: [correo.email] }),
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
  return json({ enviados, fallidos }, fallidos > 0 ? 503 : 200);
});
