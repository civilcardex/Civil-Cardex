// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderEnJsdom } from '../../../../test/render.tsx';
import { RainDownpipesHeader } from '../../components/rainDownpipesHeader';
import {
  buildCanalDeBaj,
  buildRamalesByBajante,
  buildUppersByBajante,
} from '../rainDownpipesDerived';

/** Header extraído y derivaciones puras del chequeo de bajantes ll. */
describe('rainDownpipesDerivados', () => {
  it('el header pinta los 3 grupos y la mención a Wyly-Eaton', async () => {
    const { container } = await renderEnJsdom(
      <table>
        <RainDownpipesHeader />
        <tbody />
      </table>,
    );
    const html = container.innerHTML;
    for (const grupo of ['ÁREA (m²)', 'CAUDAL DE DISEÑO', 'CAPACIDAD DEL TUBO (Wyly-Eaton)'])
      expect(html).toContain(grupo);
  });

  it('buildCanalDeBaj invierte canalAlimIds (primera etiqueta gana)', () => {
    const inv = buildCanalDeBaj(
      [
        { drawId: '7', sector: 'CNL1', id: 'c1' },
        { drawId: '', sector: 'CNL2', id: 'c2' },
      ],
      { 7: ['7|BALL1'] },
    );
    expect(inv.get('7|BALL1')).toBe('CNL1');
  });

  it('buildUppersByBajante agrupa descargas del superior por clave plan|id del inferior', () => {
    const fakeDoc = {
      bajantes: [
        {
          net: 'll',
          tipo: 'bajante',
          id: 'BALL9',
          code: 'BALL9',
          descargaEnId: '1|BALL1',
        },
      ],
    };
    // Storage real (leerDocDePlan lee localStorage — sin él devuelve null y el mapa queda vacío).
    localStorage.setItem('civilflow_trazos_2', JSON.stringify(fakeDoc));
    const uppers = buildUppersByBajante([{ id: 2, nivel: 1 }]);
    expect(uppers['1|BALL1']).toEqual(['BALL9-P1']);
    localStorage.removeItem('civilflow_trazos_2');
  });

  it('buildRamalesByBajante etiqueta con piso y excluye Ldesvio y ramal de canal', () => {
    const map = buildRamalesByBajante(
      { 'RS1-2': ['BALL1'], 'LD_X-2': ['BALL1'], 'RCNL-2': ['BALL1'] },
      new Set(['RCNL-2']),
      [{ esBajante: true, code: 'BALL1', id: 'BALL1', planId: 2, _key: 'BALL1-2' }],
      [{ id: 2, nivel: 1 }],
    );
    expect(map['BALL1-2']).toEqual(['RS1-P1']);
  });
});
