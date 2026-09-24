// Helpers compartidos de Wompi para las edge functions (Deno).
// El catálogo es COPIA del del cliente (src/lib/suscripciones/catalogo.ts):
// mantener ambos en sinconía — el servidor nunca confía en precios del cliente.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: CORS_HEADERS });
}

export function supabaseAdmin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** Autentica al usuario por el bearer token del request; null si no es válido. */
export async function usuarioDelRequest(
  admin: SupabaseClient,
  req: Request,
): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

/** El flag de BD (cf_app_config) es el único interruptor server-side. */
export async function suscripcionesHabilitadas(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.rpc('suscripciones_habilitadas');
  return data === true;
}

// ---------------------------------------------------------------------------
// Catálogo de venta (copiar cambios desde src/lib/suscripciones/catalogo.ts).
// Montos en centavos COP.
// ---------------------------------------------------------------------------
export type ModuloId = 'flow' | 'manage';
export type Periodo = 'mensual' | 'anual';

export interface ModuloVenta {
  id: ModuloId;
  precioMensualCentavos: number;
  precioAnualCentavos: number;
}

export const CATALOGO: Record<ModuloId, ModuloVenta> = {
  flow: { id: 'flow', precioMensualCentavos: 1_990_000, precioAnualCentavos: 19_900_000 },
  manage: { id: 'manage', precioMensualCentavos: 1_990_000, precioAnualCentavos: 19_900_000 },
};

export const DESCUENTO_PAQUETE = 0.15; // al comprar los 2 módulos

export function calcularTotalCentavos(modulos: ModuloId[], periodo: Periodo): number {
  const unicos = [...new Set(modulos)];
  const bruto = unicos.reduce(
    (s, m) =>
      s +
      (periodo === 'anual' ? CATALOGO[m].precioAnualCentavos : CATALOGO[m].precioMensualCentavos),
    0,
  );
  return Math.round(unicos.length >= 2 ? bruto * (1 - DESCUENTO_PAQUETE) : bruto);
}

// ---------------------------------------------------------------------------
// Criptografía Wompi (Web Crypto, disponible en el runtime Deno de Supabase).
// ---------------------------------------------------------------------------
export async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Firma de integridad del checkout: SHA256(referencia + monto + moneda + llave).
 * Se calcula aquí porque la llave de integridad jamás llega al cliente.
 */
export async function firmaIntegridad(
  referencia: string,
  montoCentavos: number,
  moneda: string,
): Promise<string> {
  const llave = Deno.env.get('WOMPI_INTEGRIDAD');
  if (!llave) throw new Error('wompi_no_configurado');
  return sha256Hex(`${referencia}${montoCentavos}${moneda}${llave}`);
}

function valorPorRuta(data: unknown, ruta: string): string {
  let actual: unknown = data;
  for (const parte of ruta.split('.')) {
    if (actual && typeof actual === 'object' && parte in (actual as Record<string, unknown>)) {
      actual = (actual as Record<string, unknown>)[parte];
    } else {
      return '';
    }
  }
  return actual == null ? '' : String(actual);
}

/**
 * Checksum de eventos: SHA256(valores de signature.properties concatenados
 * + timestamp + llave de eventos). Props se resuelven como rutas sobre data.
 */
export async function verificarFirmaEventos(body: Record<string, unknown>): Promise<boolean> {
  const llave = Deno.env.get('WOMPI_EVENTOS');
  const sig = body.signature as
    | { checksum?: string; properties?: string[]; timestamp?: string | number }
    | undefined;
  if (!llave || !sig?.checksum || !sig.properties || sig.timestamp == null) return false;
  const base =
    sig.properties.map((r) => valorPorRuta(body.data, r)).join('') + String(sig.timestamp) + llave;
  return (await sha256Hex(base)) === sig.checksum;
}

/** GET a la API Wompi autenticado con la llave privada. */
export async function wompiGet(ruta: string): Promise<Record<string, unknown>> {
  const base = Deno.env.get('WOMPI_BASE') ?? 'https://production.wompi.co';
  const priv = Deno.env.get('WOMPI_PRIVADO');
  if (!priv) throw new Error('wompi_no_configurado');
  const resp = await fetch(`${base}${ruta}`, {
    headers: { Authorization: `Bearer ${priv}` },
  });
  if (!resp.ok) throw new Error(`wompi_http_${resp.status}`);
  return (await resp.json()) as Record<string, unknown>;
}
