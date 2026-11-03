import { describe, it, expect } from 'vitest';
import { construirInformeRci, type RciInforme } from '../rciReport.ts';
import { ejemploVerificacion } from '../../../lib/rci/index.ts';

// El bloque RCI del Informe corre el motor sobre el estado guardado y lo aplana a una tabla
// Concepto/Valor. Con el ejemplo de verificación (edificio completo, todo calculable) debe
// salir la tabla completa: tipologías, derivación, bomba, tanque y el conteo de verificaciones.
// Con un estado degenerado NO debe tirar la pestaña Informe: null y listo.

describe('construirInformeRci', () => {
  it('ejemplo de verificación: tabla completa con tipología, bomba y verificaciones', () => {
    const inf = construirInformeRci(ejemploVerificacion());
    expect(inf).not.toBeNull();
    expect(inf!.tabla.title).toBe('Red contra incendio (RCI)');
    expect(inf!.tabla.headers).toEqual(['Concepto', 'Valor']);
    for (const fila of inf!.tabla.rows) expect(fila).toHaveLength(2);

    const valor = (concepto: string): string => {
      const f = inf!.tabla.rows.find((r) => r[0] === concepto);
      expect(f, `fila ${concepto} presente`).toBeTruthy();
      return String(f![1]);
    };
    // Resumen por tipología: T1 agrupa los 3 pisos del ejemplo (misma planta/riesgo).
    expect(valor('Proyecto')).toContain('Ejemplo de verificación');
    expect(valor('Normativa')).toContain('NFPA 101');
    expect(inf!.tabla.rows.some((r) => String(r[0]).startsWith('Tipología T1'))).toBe(true);
    expect(valor('Bomba')).toMatch(/500 gpm @ .* psi · Motor .* HP/);
    expect(valor('Tanque')).toMatch(/m³$/);
    expect(valor('Verificaciones')).toMatch(/^\d+ de \d+ CUMPLE$/);
  });

  it('estado degenerado (sin pisos): no lanza — y sin nombres de piso inventados', () => {
    const roto = { ...ejemploVerificacion(), pisos: { ...ejemploVerificacion().pisos, rows: [] } };
    // Caja mutable: TS no sigue asignaciones dentro de callbacks (una `let` local quedaría
    // estrechada a null y el acceso posterior saldría `never`).
    const caja: { informe: RciInforme | null } = { informe: null };
    expect(() => {
      caja.informe = construirInformeRci(roto);
    }).not.toThrow();
    // El motor arma la tipología implícita de Entradas: si queda fila de tipología, sus pisos
    // (índices sin row en el estado roto) salen '—' — jamás un nombre inventado.
    for (const r of caja.informe?.tabla.rows ?? [])
      if (String(r[0]).startsWith('Tipología')) expect(String(r[0])).not.toMatch(/P\d/);
  });
});
