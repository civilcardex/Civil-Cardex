// Helpers compartidos de las 3 funciones de pago (Paddle Billing).
// Deno: import con ruta relativa '../_shared/payment_utils.ts'.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export const PADDLE_API_KEY = Deno.env.get('PADDLE_API_KEY') ?? '';
export const PADDLE_WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? '';
// Elegir el entorno explícitamente junto con la clave y el secreto de ese entorno.
export const PADDLE_API_BASE = Deno.env.get('PADDLE_API_BASE');
const PADDLE_SANDBOX_USER_ID = Deno.env.get('PADDLE_SANDBOX_USER_ID');

/** En sandbox, restringe los pagos que dan acceso al usuario de pruebas configurado. */
export function usuarioPaddlePermitido(userId: unknown): boolean {
  return (
    PADDLE_API_BASE === 'https://api.paddle.com' ||
    (PADDLE_API_BASE === 'https://sandbox-api.paddle.com' &&
      typeof userId === 'string' &&
      userId !== '' &&
      userId === PADDLE_SANDBOX_USER_ID)
  );
}

/** Acepta solo una clave del entorno configurado. Ej: sandbox requiere pdl_sdbx_apikey_. */
export function paddleConfigurado(): boolean {
  return (
    (PADDLE_API_BASE === 'https://sandbox-api.paddle.com' &&
      PADDLE_API_KEY.startsWith('pdl_sdbx_apikey_')) ||
    (PADDLE_API_BASE === 'https://api.paddle.com' && PADDLE_API_KEY.startsWith('pdl_live_apikey_'))
  );
}

/** URL base del sitio para el redirect del checkout (setear como secret SITE_URL). */
export const SITE_URL =
  Deno.env.get('SITE_URL') ?? Deno.env.get('VITE_SITE_URL') ?? 'https://civilcardex.com';

/** Orígenes de DESARROLLO permitidos además de SITE_URL (secret opcional CORS_DEV_ORIGINS,
 *  separados por coma). Ej: `http://localhost:5173,http://localhost:5174`. Sin el secret solo
 *  SITE_URL pasa — en producción la lista queda vacía. */
const DEV_ORIGINS = (Deno.env.get('CORS_DEV_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const ORIGENES_PERMITIDOS = new Set([SITE_URL, ...DEV_ORIGINS]);

/** Cabeceras CORS para llamadas desde el navegador: supabase-js (functions.invoke) envía
 *  Authorization + apikey + Content-Type (no safelisted) ⇒ el navegador exige preflight
 *  OPTIONS y cabeceras en CADA respuesta. Origin RESTRINGIDO a una lista (SITE_URL + los de
 *  desarrollo del secret): se refleja el de la petición solo si está en la lista; si no, se
 *  responde con SITE_URL y el navegador bloquea la lectura. Sin reflejar a ciegas ni '*'
 *  (cualquier sitio llamaría crear-checkout con la sesión de un usuario logueado). Las
 *  funciones server-to-server (paddle-webhook, subscription-emails) no reciben Origin y
 *  reciben SITE_URL — inofensivo, el navegador no participa. */
export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGENES_PERMITIDOS.has(origin) ? origin : SITE_URL,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
}

/** Respuesta a un preflight OPTIONS (204 sin cuerpo). */
export function preflight(req?: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Respuesta JSON estándar (con CORS — el navegador la necesita también en errores). */
export function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(req),
    },
  });
}

/** Cliente con la identidad del caller (para auth.getUser y lecturas RLS). */
export function clienteUsuario(req: Request): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
}

/** Cliente service-role: inserta app_pagos y llama RPCs con candados propios. */
export function clienteAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}
