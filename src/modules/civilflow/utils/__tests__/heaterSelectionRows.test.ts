import { describe, it, expect, beforeEach } from 'vitest';
import { computeHeaterSelectionTables } from '../heaterSelectionRows.ts';
import type { Tramo } from '../../context/tramosReducer.ts';

/**
 * La selección de calentador de ac (Agua Caliente): aparatos de los ramales AC → UC
 * → curva de Hunter PURA (0.1163·UC^0.6875 LPS, SIN factor de simultaneidad — doctrina
 * 2026-11) → primer calentador del catálogo cuyo caudal (del id: cal6/cal11/cal21) lo cubre.
 */

beforeEach(() => {
  localStorage.clear();
});

const ramalAparatos: Tramo = {
  id: 'AC-01-r1',
  piso: 1,
  ini: 'RAC1',
  fin: 'AC-01-x',
  fixtures: { lvm: 2, duc: 1 }, // lvm ac 0.5 UC, duc ac 1 UC → total 2 UC
} as unknown as Tramo;

const filaParams = (tabs: ReturnType<typeof computeHeaterSelectionTables>) =>
  tabs[1].rows as unknown[][];

const valor = (tabs: ReturnType<typeof computeHeaterSelectionTables>, k: string) =>
  filaParams(tabs).find((r) => r[0] === k)?.[1];

describe('computeHeaterSelectionTables', () => {
  it('sin tramos el Chequeo muestra la RECOMENDACIÓN (fix: recText alcanzable — antes el "—" mudo lo tapaba)', () => {
    const tabs = computeHeaterSelectionTables([], []);
    expect(tabs).toHaveLength(2);
    expect(valor(tabs, 'Caudal probable (LPS)')).toBe('0.000');
    expect(valor(tabs, 'Caudal de diseño (LPM)')).toBe('0.00');
    expect(valor(tabs, 'Calentador seleccionado')).toBe('Ninguno');
    // Sin equipo seleccionado: la recomendación SÍ sale (antes el '—' la tapaba siempre).
    expect(valor(tabs, 'Chequeo')).toContain('Recomendado');
  });

  it('2 UC → caudal de diseño 11.24 LPM (curva pura, sin factor de simultaneidad)', () => {
    const tabs = computeHeaterSelectionTables([ramalAparatos], []);
    // curva: 0.1163·2^0.6875 lps = 0.187; ×60 s = 11.24 lpm — el K del método viejo ya no multiplica
    expect(valor(tabs, 'Caudal probable (LPS)')).toBe('0.187');
    expect(valor(tabs, 'Caudal de diseño (LPM)')).toBe('11.24');
    expect(valor(tabs, 'Factor de simultaneidad (%)')).toBeUndefined(); // fuera de la tabla
  });

  it('tabla de aparatos: nombre del catálogo APS, cantidad y UC por aparato con fila Total UC', () => {
    const tabs = computeHeaterSelectionTables([ramalAparatos], []);
    const resumen = tabs[0];
    expect(resumen.headers).toEqual(['Aparato', 'Cantidad', 'UC', 'Total UC']);
    expect(resumen.rows[0]).toEqual(['Lavamanos', 2, '0.50', '1.00']);
    expect(resumen.rows[1]).toEqual(['Ducha', 1, '1.00', '1.00']);
    expect(resumen.rows[2]).toEqual(['Total UC', '', '', '2.00']);
  });

  it('aparato fuera del catálogo APS cae al nombre de APARATOS_DEF o al id crudo', () => {
    const raro: Tramo = {
      id: 'AC-01-r2',
      piso: 1,
      ini: 'RAC2',
      fin: 'x',
      fixtures: { sif: 1, desconocidoX: 1 },
    } as unknown as Tramo;
    const tabs = computeHeaterSelectionTables([raro], []);
    const nombres = tabs[0].rows.map((r) => r[0]);
    expect(nombres).toContain('Sifones'); // está en CAT_APS (ac 0 → uc 0)
    expect(nombres).toContain('desconocidoX'); // ni APS ni APARATOS_DEF: id crudo
  });

  it('el factorSim persistido en el bajante CALENTn (método viejo) se IGNORA — doctrina curva pura', () => {
    const calentador: Tramo = {
      id: 'CALt',
      piso: 1,
      planId: 'p1',
      ini: 'M1',
      fin: 'CALENT1',
      calCapacidad: 'cal11',
      fixtures: {},
    } as unknown as Tramo;
    localStorage.setItem(
      'civilflow_trazos_p1',
      JSON.stringify({ bajantes: [{ id: 'CALENT1', net: 'ac', factorSim: 80 }] }),
    );
    const tabs = computeHeaterSelectionTables([calentador, ramalAparatos], []);
    // Con factor 80 del método viejo daría 8.99 LPM; la curva pura da 11.24 (idéntico a sin guardarlo).
    expect(valor(tabs, 'Caudal de diseño (LPM)')).toBe('11.24');
    expect(valor(tabs, 'Calentador seleccionado')).toBe('Calentador P.D. Cap. 11 LPM');
  });

  it('el chequeo compara la capacidad del seleccionado contra el caudal de diseño (curva pura)', () => {
    // cal6 (6 LPM) contra 2 UC → 11.24 LPM: NO CUMPLE y recomienda el primer calentador que sí cubre (cal21)
    const calentador: Tramo = {
      id: 'CALt',
      piso: 1,
      ini: 'M1',
      fin: 'CALENT1',
      calCapacidad: 'cal6',
      fixtures: {},
    } as unknown as Tramo;
    const tabs = computeHeaterSelectionTables([calentador, ramalAparatos], []);
    const chequeo = String(valor(tabs, 'Chequeo'));
    expect(chequeo).toContain('El equipo seleccionado (Calentador P.D. Cap. 6 LPM) NO CUMPLE');
    expect(chequeo).toContain('Recomendado: usar Calentador P.D. Cap. 21 LPM');
  });
});
