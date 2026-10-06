// Helpers compartidos de las 3 funciones de pago (Lemon Squeezy).
// Deno: import con ruta relativa '../_shared/pago_utils.ts'.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export const LS_API_KEY = Deno.env.get('LS_API_KEY') ?? '';
export const LS_STORE = Deno.env.get('LS_STORE') ?? '';
export const LS_WEBHOOK_KEY = Deno.env.get('LS_WEBHOOK_KEY') ?? '';

/** URL base del sitio para el redirect del checkout (setear como secret SITE_URL). */
export const SITE_URL =
  Deno.env.get('SITE_URL') ?? Deno.env.get('VITE_SITE_URL') ?? 'https://civilcardex.com';

/** Cabeceras CORS para llamadas desde el navegador: supabase-js (functions.invoke) envía
 *  Authorization + apikey + Content-Type (no safelisted) ⇒ el navegador exige preflight
 *  OPTIONS y cabeceras en CADA respuesta. Sin cookies ⇒ '*' seguro. ls-webhook es
 *  server-to-server: se las manda igual, inofensivas. */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
