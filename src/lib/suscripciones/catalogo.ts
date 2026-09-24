/**
 * Catálogo de venta por módulo + cálculo de totales con descuento de paquete.
 * Única fuente de precios del cliente; el servidor mantiene una COPIA en
 * supabase/functions/_shared/wompi.ts (mantener ambas en sinconía).
 */
import { devError } from '../../utils/devError';

export type ModuloId = 'flow' | 'manage';
export type Periodo = 'mensual' | 'anual';

export interface ModuloVenta {
  id: ModuloId;
  nombre: string;
  descripcion: string;
  workarea: string;
  precioMensualCentavos: number;
  precioAnualCentavos: number;
}

// Montos en centavos COP (Wompi solo cobra en COP). Precios placeholder:
// ajustar aquí (y en _shared/wompi.ts) antes de activar.
export const CATALOGO: ModuloVenta[] = [
  {
    id: 'flow',
    nombre: 'CivilFlow',
    descripcion:
      'Diseño hidrosanitario completo: agua potable, sanitaria, gas, lluvias y ventilación con memorias de cálculo.',
    workarea: '/civilflowareatrabajo',
    precioMensualCentavos: 1_990_000, // $19.900
    precioAnualCentavos: 19_900_000, // $199.000 (equivalente a ~10 meses)
  },
  {
    id: 'manage',
    nombre: 'CivilManager',
    descripcion:
      'Presupuestos y administración de obra: APU, insumos, factores prestacionales y control de costos.',
    workarea: '/civilmanagerareatrabajo',
    precioMensualCentavos: 1_990_000, // $19.900
    precioAnualCentavos: 19_900_000, // $199.000
  },
];

export const DESCUENTO_PAQUETE = 0.15; // al comprar los 2 módulos

/** Interruptor global del sistema de suscripciones. OFF = app como siempre. */
export const SUSCRIPCIONES_ACTIVAS = import.meta.env.VITE_SUSCRIPCIONES === 'true';

export function moduloVenta(id: ModuloId): ModuloVenta {
  const m = CATALOGO.find((x) => x.id === id);
  if (!m) devError('moduloVenta: id desconocido:', id);
  return m ?? CATALOGO[0];
}

/** Total en centavos; descuento de paquete al llevar 2 módulos. Deduplica. */
export function calcularTotalCentavos(modulos: ModuloId[], periodo: Periodo): number {
  const unicos = [...new Set(modulos)];
  const bruto = unicos.reduce((s, id) => {
    const m = moduloVenta(id);
    return s + (periodo === 'anual' ? m.precioAnualCentavos : m.precioMensualCentavos);
  }, 0);
  return Math.round(unicos.length >= 2 ? bruto * (1 - DESCUENTO_PAQUETE) : bruto);
}

/** Centavos COP → "$19.900" (sin decimales, separador de miles). */
export function formatCOP(centavos: number): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(centavos / 100);
  } catch (e) {
    devError('formatCOP:', e);
    return `$${Math.round(centavos / 100).toLocaleString('es-CO')}`;
  }
}
