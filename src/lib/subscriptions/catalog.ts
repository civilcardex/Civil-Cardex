/**
 * Catálogo de venta por módulo + cálculo de totales con descuentos.
 * Única fuente de precios del cliente; el servidor mantiene una COPIA en
 * supabase/functions/_shared/lemon.ts (test de paridad vigila el sync) y la
 * VERDAD está en app_precios (BD — sincronizarPreciosBd pisa estos literales).
 */
import { devError } from '../../utils/devError';

export type ModuloId = 'flow' | 'manage';
export type Periodo = 'mensual' | 'semestral' | 'anual';

export interface ModuloVenta {
  id: ModuloId;
  nombre: string;
  descripcion: string;
  workarea: string;
  precioMensualCentavos: number;
  precioSemestralCentavos: number;
  precioAnualCentavos: number;
}

// Montos en centavos USD (pasarela Lemon Squeezy, cobra USD). La verdad es
// app_precios en BD (sincronizarPreciosBd los pisa); cambiar precio = UPDATE en SQL Editor.
export const CATALOGO: ModuloVenta[] = [
  {
    id: 'flow',
    nombre: 'Civil Flow',
    descripcion:
      'Diseño hidrosanitario completo: agua potable, sanitaria, gas, lluvias y ventilación con memorias de cálculo.',
    workarea: '/civilflowareatrabajo',
    precioMensualCentavos: 2500, // $25.00
    precioSemestralCentavos: 15000, // $150.00 (6× mensual; −10% base → $135)
    precioAnualCentavos: 30000, // $300.00 (12× mensual; −15% base → $255)
  },
  {
    id: 'manage',
    nombre: 'Civil Manager',
    descripcion:
      'Presupuestos y administración de obra: APU, insumos, factores prestacionales y control de costos.',
    workarea: '/civilmanagerareatrabajo',
    precioMensualCentavos: 2500, // $25.00
    precioSemestralCentavos: 15000, // $150.00
    precioAnualCentavos: 30000, // $300.00
  },
];

/** Descuento BASE por periodo — aplica desde el PRIMER módulo. */
export const DESCUENTO_BASE: Record<Periodo, number> = { mensual: 0, semestral: 0.1, anual: 0.15 };

/** Extra acumulativo por cada módulo adicional (n−1): 2 módulos → +10%, 3 → +20%… */
export const DESCUENTO_POR_MODULO = 0.1;

/** Tramos de descuento por VOLUMEN (puestos totales de la compra). 25+ = negociado directo. */
export const DESCUENTO_POR_PUESTOS: { min: number; max: number; pct: number }[] = [
  { min: 2, max: 4, pct: 0.1 },
  { min: 5, max: 9, pct: 0.15 },
  { min: 10, max: 24, pct: 0.2 },
];

/** Por encima de este total de puestos el precio se negocia directo (CTA Contáctenos). */
export const PUESTOS_TOPE_AUTOMATICO = 24;

/** Puestos por módulo en el carrito (lo que falta vale 1). */
export type PuestosPorModulo = Partial<Record<ModuloId, number>>;

/** Puestos efectivos de un módulo (mínimo 1). */
function puestosDe(puestos: PuestosPorModulo | undefined, id: ModuloId): number {
  const n = puestos?.[id];
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** 1→0% · 2-4→10% · 5-9→15% · 10-24→20% · 25+→null (negociado directo con CivilCardex). */
export function descuentoPorPuestos(totalPuestos: number): number | null {
  if (!Number.isFinite(totalPuestos) || totalPuestos < 1) return 0;
  if (totalPuestos >= 25) return null;
  const tramo = DESCUENTO_POR_PUESTOS.find((t) => totalPuestos >= t.min && totalPuestos <= t.max);
  return tramo ? tramo.pct : 0;
}

/** Interruptor global del sistema de suscripciones. OFF = app como siempre. */
export const SUSCRIPCIONES_ACTIVAS = import.meta.env.VITE_SUSCRIPCIONES === 'true';

/** Busca un módulo del catálogo. Devuelve null (NO un fallback silencioso) si el id no
 *  existe — un typo aquí cobraba/mostraba otro módulo. */
function moduloVenta(id: ModuloId): ModuloVenta | null {
  return CATALOGO.find((x) => x.id === id) ?? null;
}

/** Precio de un módulo para el periodo elegido. */
export function precioDePeriodo(m: ModuloVenta, p: Periodo): number {
  return p === 'anual'
    ? m.precioAnualCentavos
    : p === 'semestral'
      ? m.precioSemestralCentavos
      : m.precioMensualCentavos;
}

/** Fracción descontada: base del periodo + 10% por cada módulo adicional (tope 100%). */
export function descuentoAplicado(modulos: ModuloId[], periodo: Periodo): number {
  const n = new Set(modulos).size;
  return Math.min(1, DESCUENTO_BASE[periodo] + Math.max(0, n - 1) * DESCUENTO_POR_MODULO);
}

/** Total en centavos: Σ(precio×puestos) × (1 − dto base/acumulativo) × (1 − dto por volumen).
 *  Deduplica módulos. Sin puestos = 1 por módulo (compatible con llamadas viejas). */
export function calcularTotalCentavos(
  modulos: ModuloId[],
  periodo: Periodo,
  puestos?: PuestosPorModulo,
): number {
  const unicos = [...new Set(modulos)];
  const bruto = unicos.reduce((s, id) => {
    const m = moduloVenta(id);
    if (!m) {
      devError('calcularTotalCentavos: id desconocido:', id);
      return s;
    }
    return s + precioDePeriodo(m, periodo) * puestosDe(puestos, id);
  }, 0);
  const totalPuestos = unicos.reduce((s, id) => s + puestosDe(puestos, id), 0);
  const dtoVolumen = descuentoPorPuestos(totalPuestos) ?? 0;
  return Math.round(bruto * (1 - descuentoAplicado(unicos, periodo)) * (1 - dtoVolumen));
}

/** Centavos USD → "$25.00" / "$42.50". */
export function formatUSD(centavos: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(centavos / 100);
  } catch (e) {
    devError('formatUSD:', e);
    return `$${(centavos / 100).toFixed(2)}`;
  }
}

import { supabase } from '../supabase';

/** FUENTE ÚNICA de precios (deuda #4): pisa los literales de CATALOGO con app_precios (BD).
 *  El servidor cobra con la MISMA tabla — sin deploy, cambiar precio = UPDATE en SQL Editor.
 *  Fallback silencioso si la migración no está aplicada (RPC 404): literales siguen viviendo.
 *  Llamar una vez al montar el sistema de suscripciones (useSuscripciones). */
export async function sincronizarPreciosBd(): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('obtener_catalogo');
    if (error || !data) return;
    for (const m of CATALOGO) {
      const bd = data[m.id] as
        | {
            precioMensualCentavos?: number;
            precioSemestralCentavos?: number;
            precioAnualCentavos?: number;
          }
        | undefined;
      if (bd?.precioMensualCentavos) m.precioMensualCentavos = bd.precioMensualCentavos;
      if (bd?.precioSemestralCentavos) m.precioSemestralCentavos = bd.precioSemestralCentavos;
      if (bd?.precioAnualCentavos) m.precioAnualCentavos = bd.precioAnualCentavos;
    }
  } catch {
    /* sin BD accesible: literales */
  }
}
