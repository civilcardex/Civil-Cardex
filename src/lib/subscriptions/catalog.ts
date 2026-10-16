/** Precios y descuentos de venta por módulo. AVISO: estos números son solo el respaldo — el precio real vive en la tabla app_precios (BD) y se baja con sincronizarPreciosBd; cambiarlo en SQL no necesita deploy. */
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

/** Descuento por pagar de una vez: 10 % a los 6 meses, 15 % al año (desde el primer módulo). */
export const DESCUENTO_BASE: Record<Periodo, number> = { mensual: 0, semestral: 0.1, anual: 0.15 };

/** 10 % extra por cada módulo adicional al primero (2 módulos → +10 %, 3 → +20 %…). */
export const DESCUENTO_POR_MODULO = 0.1;

/** Descuento por comprar VARIOS puestos (asientos) a la vez. Desde 25 puestos no se vende online: se contactan con CivilCardex. */
export const DESCUENTO_POR_PUESTOS: { min: number; max: number; pct: number }[] = [
  { min: 2, max: 4, pct: 0.1 },
  { min: 5, max: 9, pct: 0.15 },
  { min: 10, max: 24, pct: 0.2 },
];

/** A partir de estos puestos el precio se negocia con la empresa (la UI ofrece contactar a ventas). */
export const PUESTOS_TOPE_AUTOMATICO = 24;

/** Cuántos puestos (asientos de equipo) se pidieron por módulo; lo que no se llena vale 1. */
export type PuestosPorModulo = Partial<Record<ModuloId, number>>;

/** Puestos efectivos de un módulo (mínimo 1). */
function puestosDe(puestos: PuestosPorModulo | undefined, id: ModuloId): number {
  const n = puestos?.[id];
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Descuento por volumen según los puestos TOTALES de la compra: 1 → 0 % · 2-4 → 10 % · 5-9 → 15 % · 10-24 → 20 % · 25+ → null (se habla con ventas). */
export function descuentoPorPuestos(totalPuestos: number): number | null {
  if (!Number.isFinite(totalPuestos) || totalPuestos < 1) return 0;
  if (totalPuestos >= 25) return null;
  const tramo = DESCUENTO_POR_PUESTOS.find((t) => totalPuestos >= t.min && totalPuestos <= t.max);
  return tramo ? tramo.pct : 0;
}

/** Interruptor global del sistema de suscripciones. OFF = app como siempre. */
export const SUSCRIPCIONES_ACTIVAS = import.meta.env.VITE_SUSCRIPCIONES === 'true';

/** Busca un módulo en el catálogo. Devuelve null a propósito si el id no existe (antes un error de tipeo cobraba/mostraba otro módulo sin avisar). */
function moduloVenta(id: ModuloId): ModuloVenta | null {
  return CATALOGO.find((x) => x.id === id) ?? null;
}

/** Cuánto cuesta el módulo en el periodo elegido (en centavos de dólar). */
export function precioDePeriodo(m: ModuloVenta, p: Periodo): number {
  return p === 'anual'
    ? m.precioAnualCentavos
    : p === 'semestral'
      ? m.precioSemestralCentavos
      : m.precioMensualCentavos;
}

/** Descuento total en fracción: el del periodo + 10 % por cada módulo extra (nunca más del 100 %). */
export function descuentoAplicado(modulos: ModuloId[], periodo: Periodo): number {
  const n = new Set(modulos).size;
  return Math.min(1, DESCUENTO_BASE[periodo] + Math.max(0, n - 1) * DESCUENTO_POR_MODULO);
}

/** Total a cobrar en centavos: Σ(precio×puestos) × (1 − descuento por periodo/módulos) × (1 − descuento por puestos).
 *  Sin puestos se cobra 1 por módulo (compatible con los llamados viejos). */
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

/** Centavos de USD a texto: "US$25.00". Lleva el prefijo US$ a propósito — en países con peso (CO, MX, AR…) cobrar con "$" suelto se lee como la moneda local. */
export function formatUSD(centavos: number): string {
  try {
    return `US$${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(centavos / 100)}`;
  } catch (e) {
    devError('formatUSD:', e);
    return `US$${(centavos / 100).toFixed(2)}`;
  }
}

import { supabase } from '../supabase';

/** Baja los precios reales desde la tabla app_precios (BD) y pisa estos literales, así el precio se cambia con un UPDATE en SQL sin tocar código. Se llama una vez al abrir la app. */
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
