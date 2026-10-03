import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO, DESCUENTO_BASE, DESCUENTO_POR_MODULO, calcularTotalCentavos } from '../catalog';

// PARIDAD DE CATÁLOGO cliente↔edge: los precios viven en DOS archivos sin fuente única
// (deuda documentada). El servidor cobra con el del edge; el modal muestra el del cliente —
// un drift haría que la UI dijera $60.000 y se cobrara otro monto. Este test compara los
// literales del edge (leído como texto, sin importar Deno) contra el catálogo cliente.
// Al cambiar un precio: se editan AMBOS archivos y este test falla si quedó desparejo.

const EDGE_SRC = readFileSync(join(process.cwd(), 'supabase/functions/_shared/lemon.ts'), 'utf8');

const num = (s: string | undefined): number => Number((s ?? 'NaN').replace(/_/g, ''));

describe('paridad catálogo cliente vs edge (Lemon Squeezy)', () => {
  it('los 3 precios de cada módulo coinciden EXACTAMENTE con los del cliente', () => {
    for (const m of CATALOGO) {
      const reMen = new RegExp(`id: '${m.id}'[\\s\\S]{0,240}?precioMensualCentavos: ([\\d_]+)`);
      const reSem = new RegExp(`id: '${m.id}'[\\s\\S]{0,240}?precioSemestralCentavos: ([\\d_]+)`);
      const reAnu = new RegExp(`id: '${m.id}'[\\s\\S]{0,240}?precioAnualCentavos: ([\\d_]+)`);
      expect({
        id: m.id,
        menEdge: num(EDGE_SRC.match(reMen)?.[1]),
        semEdge: num(EDGE_SRC.match(reSem)?.[1]),
        anuEdge: num(EDGE_SRC.match(reAnu)?.[1]),
      }).toEqual({
        id: m.id,
        menEdge: m.precioMensualCentavos,
        semEdge: m.precioSemestralCentavos,
        anuEdge: m.precioAnualCentavos,
      });
    }
  });

  it('los descuentos (base por periodo + por módulo) también coinciden', () => {
    const reBase =
      /DESCUENTO_BASE[^=]*= \{ mensual: ([\d.]+), semestral: ([\d.]+), anual: ([\d.]+) \}/;
    const edge = EDGE_SRC.match(reBase);
    expect(edge).toBeTruthy();
    const [men, sem, anu] = [num(edge![1]), num(edge![2]), num(edge![3])];
    expect({ men, sem, anu }).toEqual({
      men: DESCUENTO_BASE.mensual,
      sem: DESCUENTO_BASE.semestral,
      anu: DESCUENTO_BASE.anual,
    });
    expect(num(EDGE_SRC.match(/DESCUENTO_POR_MODULO = ([\d.]+)/)?.[1])).toBe(DESCUENTO_POR_MODULO);
  });

  it('los mismos ids de módulo existen en ambos lados', () => {
    const idsEdge = [...EDGE_SRC.matchAll(/(flow|manage):\s*\{\s*id:/g)].map((mm) => mm[1]);
    expect(new Set(idsEdge).size).toBe(CATALOGO.length);
  });

  it('la fórmula (base + acumulativo) produce el mismo número que el edge', () => {
    // Pines: si un lado cambia la regla, estos números fallan.
    expect(calcularTotalCentavos(['flow', 'manage'], 'mensual')).toBe(4500); // 5000¢ × 0.90
    expect(calcularTotalCentavos(['flow'], 'anual')).toBe(25500); // 30000¢ × 0.85
    expect(calcularTotalCentavos(['flow'], 'semestral')).toBe(13500); // 15000¢ × 0.90
  });
});
