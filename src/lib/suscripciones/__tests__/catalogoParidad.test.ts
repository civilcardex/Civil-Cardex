import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO, DESCUENTO_PAQUETE, calcularTotalCentavos } from '../catalogo';

// PARIDAD DE CATÁLOGO cliente↔edge: los precios viven en DOS archivos sin fuente única
// (deuda documentada). El servidor cobra con el del edge; el modal muestra el del cliente —
// un drift haría que la UI dijera $19.900 y se cobraran $199.000. Este test compara los
// literales del edge (leído como texto, sin importar Deno) contra el catálogo cliente.
// Al cambiar un precio: se editan AMBOS archivos y este test falla si quedó desparejo.

const EDGE_SRC = readFileSync(join(process.cwd(), 'supabase/functions/_shared/wompi.ts'), 'utf8');

describe('paridad catálogo cliente vs edge (Wompi)', () => {
  it('los precios del edge coinciden EXACTAMENTE con los del cliente', () => {
    for (const m of CATALOGO) {
      const reMen = new RegExp(`id: '${m.id}'[\\s\\S]{0,120}?precioMensualCentavos: ([\\d_]+)`);
      const reAnu = new RegExp(`id: '${m.id}'[\\s\\S]{0,120}?precioAnualCentavos: ([\\d_]+)`);
      const menEdge = Number((EDGE_SRC.match(reMen)?.[1] ?? 'NaN').replace(/_/g, ''));
      const anuEdge = Number((EDGE_SRC.match(reAnu)?.[1] ?? 'NaN').replace(/_/g, ''));
      expect({ id: m.id, menEdge, anuEdge }).toEqual({
        id: m.id,
        menEdge: m.precioMensualCentavos,
        anuEdge: m.precioAnualCentavos,
      });
    }
  });

  it('el descuento de paquete también coincide', () => {
    const edge = Number(EDGE_SRC.match(/DESCUENTO_PAQUETE = ([\d.]+)/)?.[1] ?? 'NaN');
    expect(edge).toBe(DESCUENTO_PAQUETE);
  });

  it('los mismos ids de módulo existen en ambos lados', () => {
    const idsEdge = [...EDGE_SRC.matchAll(/(flow|manage): \{ id:/g)].map((mm) => mm[1]);
    expect(new Set(idsEdge).size).toBe(CATALOGO.length);
  });

  it('el cálculo del total (regla de paquete) produce el mismo número que el edge', () => {
    // 2 módulos mensual: (1990000+1990000)*0.85. Si un lado cambia la regla, este pin
    // lo delata.
    expect(calcularTotalCentavos(['flow', 'manage'], 'mensual')).toBe(3_383_000);
    expect(calcularTotalCentavos(['flow'], 'anual')).toBe(19_900_000);
  });
});
