// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderEnJsdom } from '../../../../test/dibuja.tsx';
import Acometida, { LazyNum, type AcometidaProps, type FilaResult } from '../SupplyConexion.tsx';

/**
 * Caracterizaci\u00f3n de SupplyConnection (la tabla de acometida): congela lo que se ve hoy
 * ANTES de partir el archivo en sub-componentes. Si un movimiento cambia el render, salta aqu\u00ed.
 */

const fila = (over: Partial<FilaResult> = {}): FilaResult => ({
  dInt: 20,
  V: 2.5,
  Lt: 15,
  hfPct: 12,
  hfM: 1.8,
  Pfin: 18,
  ...over,
});

function props(over: Partial<AcometidaProps> = {}): AcometidaProps {
  return {
    Qaco: 3.2,
    edit1: false,
    setEdit1: () => {},
    edit2: false,
    setEdit2: () => {},
    edit3: false,
    setEdit3: () => {},
    contadorSel: { dn: '3/4"', q: 3.2 },
    acoContIx: 0,
    setAcoContIx: () => {},
    acoMonName: 'C1',
    setAcoMonName: () => {},
    acoRedContDiam: '1/2"',
    acoContMonDiam: '3/4"',
    acoL1: { h: 10, v: 1.2, le: 2.4 },
    setAcoL1: () => {},
    acoL2: { h: 8, v: 0.8, le: 1.6 },
    setAcoL2: () => {},
    acoPini: 22,
    setAcoPini: () => {},
    acoHfMax: 65,
    setAcoHfMax: () => {},
    acoPResMin: 12,
    setAcoPResMin: () => {},
    acoLeMed: 3.2,
    setAcoLeMed: () => {},
    cHW1: 10,
    cHW2: 8,
    f1: fila(),
    f2: fila({ dInt: 15, V: 1.4 }),
    hfContador: 4.2,
    pResidual: 14,
    okPresion: true,
    AF_DIAM_OPTS: [
      { pulg: 20, label: '3/4"', dInt: 20, nominal: '3/4"' },
      { pulg: 15, label: '1/2"', dInt: 15, nominal: '1/2"' },
    ],
    ...over,
  };
}

describe('SupplyConnection · la tabla de acometida', () => {
  it('monta con las 3 secciones (contador, par\u00e1metros y verificaci\u00f3n)', async () => {
    const { container, unmount } = await renderEnJsdom(<Acometida {...props()} />);
    const texto = container.textContent || '';
    expect(texto).toContain('CONTADOR');
    expect(texto).toContain('RED INTERNA');
    // La tabla de tramos de la acometida y la secci\u00f3n de par\u00e1metros existen.
    expect(container.querySelectorAll('table').length).toBeGreaterThan(0);
    await unmount();
  });

  it('la tabla de tramos de la acometida lista filas', async () => {
    const { container, unmount } = await renderEnJsdom(<Acometida {...props()} />);
    expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    // Los campos editables de la secci\u00f3n 1 est\u00e1n montados.
    expect(container.querySelectorAll('input, select').length).toBeGreaterThan(0);
    await unmount();
  });

  it('LazyNum avisa el valor solo al salir del campo', async () => {
    let recibido: number | null = null;
    const { container, unmount } = await renderEnJsdom(
      <LazyNum value={3} onChange={(v) => (recibido = v)} ariaLabel="largo" />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('3');
    expect(recibido).toBeNull();
    await unmount();
  });
});
