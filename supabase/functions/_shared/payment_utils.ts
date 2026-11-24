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

/** Cabeceras CORS para llamadas desde el navegador: supabase-js (functions.invoke) envía
 *  Authorization + apikey + Content-Type (no safelisted) ⇒ el navegador exige preflight
 *  OPTIONS y cabeceras en CADA respuesta. Origin restringido al sitio que las llama
 *  (SITE_URL): paddle-webhook es server-to-server y las
 *  recibe igual (el navegador no participa). */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  Vary: 'Origin',
};

/** Respuesta a un preflight OPTIONS (204 sin cuerpo). */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Respuesta JSON estándar (con CORS — el navegador la necesita también en errores). */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS },
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
