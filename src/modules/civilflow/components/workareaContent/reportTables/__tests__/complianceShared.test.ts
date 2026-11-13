import { describe, it, expect } from 'vitest';

/**
 * Caracterización de los chequeos de cumplimiento del Informe (extraídos verbatim de
 * useReportTables): fija el comportamiento EXACTO que el resumen usa para decidir
 * '✗ Revisar' vs '✓ OK'. Ej: filaFalla con chequeoD en MAYÚSCULAS ('NO CUMPLE') NO es fallo
 * — el chequeo de diámetro de lluvias se compara title-case y con datos completos.
 */
import { etiq, filaEnRangoSanLl, filaFalla, fallosDeTabla, noTrib } from '../complianceShared.ts';
import {
  useSanCumple,
  useLlCumple,
  usePresionAfAc,
  useGasInforme,
  useEquiposInforme,
} from '../index.ts';
import { perfilDe } from '../../../../constants/countryStandards.ts';

// Rangos reales del perfil CO (san: vMin 0.45, vMax 4.0, ydMax 0.75) — los mismos que
// aplica el resumen del Informe para san/ll.
const perfil = perfilDe('CO');

describe('etiq (etiqueta de chip de fallo)', () => {
  it('id corto + piso → `${id}-${pisoCorto}`', () => {
    expect(etiq('BAN1', 2)).toBe('BAN1-P2');
    expect(etiq('MAC1', -1)).toBe('MAC1-S1');
    expect(etiq('MAC1', 99)).toBe('MAC1-C');
  });

  it('id largo (>10) se trunca a 4 caracteres + elipsis', () => {
    expect(etiq('BAN-123456789', 2)).toBe('BAN-…-P2');
  });

  it('id/piso nulos caen a "?" y piso 0', () => {
    expect(etiq(null, undefined)).toBe('?-P0');
  });
});

describe('filaEnRangoSanLl (rangos san/ll del país, en fresco)', () => {
  const ok = { Vreal: 1.0, Yc: 0.3, Yn: 0.3, DintMm: 100, qqo: 0.5 };

  it('fila dentro de rangos CO cumple', () => {
    expect(filaEnRangoSanLl(ok, perfil)).toBe(true);
  });

  it('velocidad fuera de [vMin, vMax] no cumple', () => {
    expect(filaEnRangoSanLl({ ...ok, Vreal: 0.3 }, perfil)).toBe(false);
    expect(filaEnRangoSanLl({ ...ok, Vreal: 4.5 }, perfil)).toBe(false);
  });

  it('sin diámetro (DintMm 0) no cumple', () => {
    expect(filaEnRangoSanLl({ ...ok, DintMm: 0 }, perfil)).toBe(false);
  });

  it('el tiro de DISEÑO manda: max(Yc, Yn)/D > ydMax no cumple', () => {
    expect(filaEnRangoSanLl({ ...ok, Yc: 80, Yn: 0.3 }, perfil)).toBe(false);
    expect(filaEnRangoSanLl({ ...ok, Yc: 0.3, Yn: 80 }, perfil)).toBe(false);
    expect(filaEnRangoSanLl({ ...ok, Yc: 60, Yn: 40 }, perfil)).toBe(true);
  });

  it('q/Q0 sobre 1.0 no cumple; exactamente 1.0 sí (<=)', () => {
    expect(filaEnRangoSanLl({ ...ok, qqo: 1.2 }, perfil)).toBe(false);
    expect(filaEnRangoSanLl({ ...ok, qqo: 1.0 }, perfil)).toBe(true);
  });
});

describe('filaFalla (chequeos de tabla → fallo)', () => {
  it('chequeos en guion ("—") son filas sin datos, NO fallos', () => {
    expect(filaFalla({ chequeoV: '—', chequeoYn: '—', chequeoFT: '—' })).toBe(false);
  });

  it('cualquier chequeo en "NO CUMPLE" (mayúsculas) es fallo', () => {
    expect(filaFalla({ chequeoV: 'NO CUMPLE', chequeoYn: '—', chequeoFT: '—' })).toBe(true);
    expect(filaFalla({ chequeoV: '—', chequeoYn: 'NO CUMPLE', chequeoFT: '—' })).toBe(true);
    expect(filaFalla({ chequeoV: '—', chequeoYn: '—', chequeoFT: 'NO CUMPLE' })).toBe(true);
  });

  it('diámetro lluvias "No cumple" SOLO con Q, Dcalc y Ddis > 0', () => {
    expect(
      filaFalla({
        chequeoV: '—',
        chequeoYn: '—',
        chequeoFT: '—',
        chequeoD: 'No cumple',
        Q: 5,
        DcalcPulg: 3,
        DdisPulg: 3,
      }),
    ).toBe(true);
    expect(
      filaFalla({
        chequeoV: '—',
        chequeoYn: '—',
        chequeoFT: '—',
        chequeoD: 'No cumple',
        Q: 0,
        DcalcPulg: 3,
        DdisPulg: 3,
      }),
    ).toBe(false);
    expect(
      filaFalla({
        chequeoV: '—',
        chequeoYn: '—',
        chequeoFT: '—',
        chequeoD: 'No cumple',
        Q: 5,
        DcalcPulg: 0,
        DdisPulg: 3,
      }),
    ).toBe(false);
  });

  it('chequeoD en MAYÚSCULAS no cuenta (comparación title-case exacta)', () => {
    expect(
      filaFalla({
        chequeoV: '—',
        chequeoYn: '—',
        chequeoFT: '—',
        chequeoD: 'NO CUMPLE',
        Q: 5,
        DcalcPulg: 3,
        DdisPulg: 3,
      }),
    ).toBe(false);
  });
});

describe('fallosDeTabla (filas "No cumple" de una MemoriaTable)', () => {
  const tbl = {
    title: 'Bajantes',
    headers: ['Bajante', 'Nivel', 'Chequeo'],
    rows: [
      ['BAN1', 'P2', 'No cumple'],
      ['BAN2', 'P2', 'CUMPLE'],
      ['BAN3', '—', 'No cumple'],
      ['BAN4', 'P1', 'NO CUMPLE'],
    ],
  };

  it('null → sin fallos', () => {
    expect(fallosDeTabla(null)).toEqual([]);
  });

  it('tabla sin columna /chequeo/i → sin fallos', () => {
    expect(fallosDeTabla({ title: 'X', headers: ['Tramo', 'Nivel'], rows: [['A', 'P1']] })).toEqual(
      [],
    );
  });

  it('con sufijoDe: `${row[0]}-${sufijo}` y filas con sufijo vacío quedan sin guion', () => {
    const sufijoDe = (row: unknown[]) => (row[1] && row[1] !== '—' ? String(row[1]) : '');
    expect(fallosDeTabla(tbl, sufijoDe)).toEqual(['BAN1-P2', 'BAN3', 'BAN4-P1']);
  });

  it('sin sufijoDe: solo el id de la primera columna', () => {
    expect(fallosDeTabla(tbl)).toEqual(['BAN1', 'BAN3', 'BAN4']);
  });
});

describe('noTrib (el semáforo juzga solo ramales, sin tributarios)', () => {
  it('tributario se excluye, ramal y sin tipo se quedan', () => {
    expect(noTrib({ tipo: 'tributario' })).toBe(false);
    expect(noTrib({ tipo: 'ramal' })).toBe(true);
    expect(noTrib({})).toBe(true);
  });
});

describe('hooks por red del Informe (mismo patrón que useSanTables/useLlTables/...)', () => {
  it('cada red de cumplimiento tiene su hook', () => {
    expect(typeof useSanCumple).toBe('function');
    expect(typeof useLlCumple).toBe('function');
    expect(typeof usePresionAfAc).toBe('function');
    expect(typeof useGasInforme).toBe('function');
    expect(typeof useEquiposInforme).toBe('function');
  });
});
