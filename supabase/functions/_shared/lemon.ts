// COPIA server-side del catálogo de venta (Lemon Squeezy). El servidor NUNCA
// confía en precios del cliente. El test de paridad
// (src/lib/subscriptions/__tests__/catalogParity.test.ts) compara este archivo
// con src/lib/subscriptions/catalog.ts — cambiar un precio = editar AMBOS
// (y UPDATE en app_precios, la verdad en BD).
export type ModuloId = 'flow' | 'manage';
export type Periodo = 'mensual' | 'semestral' | 'anual';

export interface ModuloVenta {
  id: ModuloId;
  precioMensualCentavos: number;
  precioSemestralCentavos: number;
  precioAnualCentavos: number;
}

// Centavos USD — espejo EXACTO de catalog.ts.
export const CATALOGO: Record<ModuloId, ModuloVenta> = {
  flow: {
    id: 'flow',
    precioMensualCentavos: 2500,
    precioSemestralCentavos: 15000,
    precioAnualCentavos: 30000,
  },
  manage: {
    id: 'manage',
    precioMensualCentavos: 2500,
    precioSemestralCentavos: 15000,
    precioAnualCentavos: 30000,
  },
};

export const DESCUENTO_BASE: Record<Periodo, number> = { mensual: 0, semestral: 0.1, anual: 0.15 };

export const DESCUENTO_POR_MODULO = 0.1;

const DESCUENTO_POR_PUESTOS: { min: number; max: number; pct: number }[] = [
  { min: 2, max: 4, pct: 0.1 },
  { min: 5, max: 9, pct: 0.15 },
  { min: 10, max: 24, pct: 0.2 },
];

const PUESTOS_TOPE_AUTOMATICO = 24;

/** Puestos licenciados del módulo `id`: sanea el valor del cliente
 *  (ausente, no finito o <1 → 1, el mínimo vendible; decimales → piso). */
export function puestosDe(puestos: Record<string, number> | undefined, id: ModuloId): number {
  const n = puestos?.[id];
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Descuento por volumen de puestos: pct del tramo que cubre el total
 *  (0 si el total es inválido o <1; null si ≥25 = excede el tope automático → venta manual). */
export function descuentoPorPuestos(totalPuestos: number): number | null {
  if (!Number.isFinite(totalPuestos) || totalPuestos < 1) return 0;
  if (totalPuestos >= 25) return null;
  const tramo = DESCUENTO_POR_PUESTOS.find((t) => totalPuestos >= t.min && totalPuestos <= t.max);
  return tramo ? tramo.pct : 0;
}

/** Precios vigentes de un módulo leídos de app_precios (la verdad en BD). Ausente o
 *  incompleto en un campo = ese periodo cae al literal de CATALOGO (fallback bootstrap). */
export interface PreciosBd {
  mensual: number;
  semestral: number;
  anual: number;
}

export function calcularTotalCentavos(
  modulos: ModuloId[],
  periodo: Periodo,
  puestos?: Record<string, number>,
  preciosBd?: Partial<Record<ModuloId, PreciosBd>>,
): number {
  const unicos = [...new Set(modulos)];
  const bruto = unicos.reduce((s, id) => {
    const m = CATALOGO[id];
    const pb = preciosBd?.[id];
    const lista =
      periodo === 'anual'
        ? pb && pb.anual > 0
          ? pb.anual
          : m.precioAnualCentavos
        : periodo === 'semestral'
          ? pb && pb.semestral > 0
            ? pb.semestral
            : m.precioSemestralCentavos
          : pb && pb.mensual > 0
            ? pb.mensual
            : m.precioMensualCentavos;
    return s + lista * puestosDe(puestos, id);
  }, 0);
  const n = unicos.length;
  const dtoBase = Math.min(1, DESCUENTO_BASE[periodo] + Math.max(0, n - 1) * DESCUENTO_POR_MODULO);
  const totalPuestos = unicos.reduce((s, id) => s + puestosDe(puestos, id), 0);
  const dtoVolumen = descuentoPorPuestos(totalPuestos) ?? 0;
  return Math.round(bruto * (1 - dtoBase) * (1 - dtoVolumen));
}
