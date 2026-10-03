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

export function calcularTotalCentavos(modulos: ModuloId[], periodo: Periodo): number {
  const unicos = [...new Set(modulos)];
  const bruto = unicos.reduce((s, id) => {
    const m = CATALOGO[id];
    const lista =
      periodo === 'anual'
        ? m.precioAnualCentavos
        : periodo === 'semestral'
          ? m.precioSemestralCentavos
          : m.precioMensualCentavos;
    return s + lista;
  }, 0);
  const n = unicos.length;
  const dto = Math.min(1, DESCUENTO_BASE[periodo] + Math.max(0, n - 1) * DESCUENTO_POR_MODULO);
  return Math.round(bruto * (1 - dto));
}
