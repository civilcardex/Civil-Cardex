// Helpers compartidos de las 3 funciones de pago (Paddle Billing).
// Deno: import con ruta relativa '../_shared/payment_utils.ts'.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export const PADDLE_API_KEY = Deno.env.get('PADDLE_API_KEY') ?? '';
export const PADDLE_WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? '';
// Sandbox = https://sandbox-api.paddle.com con SU propia API key y webhook secret.
export const PADDLE_API_BASE = Deno.env.get('PADDLE_API_BASE') ?? 'https://api.paddle.com';

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
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
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

/** HMAC-SHA256 (hex) del mensaje con la clave dada — WebCrypto, disponible en Edge. */
export async function hmacHex(clave: string, mensaje: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(clave),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', k, enc.encode(mensaje));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparación en tiempo constante de dos strings hex. */
export function comparacionConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifica el header Paddle-Signature ("ts=…;h1=…") sobre el body CRUDO:
 *  firma = HMAC-SHA256("{ts}:{raw}", PADDLE_WEBHOOK_SECRET). Rechaza timestamps
 *  con más de 5 minutos (anti-replay). Ej: "ts=1671552777;h1=0b3c…". */
export async function verificarFirmaPaddle(header: string, raw: string): Promise<boolean> {
  const partes = Object.fromEntries(header.split(';').map((p) => p.trim().split('='))) as {
    ts?: string;
    h1?: string;
  };
  const { ts, h1 } = partes;
  if (!ts || !h1) return false;
  const edad = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(edad) || edad > 300) return false;
  const firma = await hmacHex(PADDLE_WEBHOOK_SECRET, `${ts}:${raw}`);
  return comparacionConstante(firma, h1);
}
