import { describe, it, expect } from 'vitest';
import { idsSalidasDeBajante } from '../../fixturesStorage';

/**
 * Precedencia 3b para las SALIDAS de un bajante (orig. usuario RS2-P2, 2026-10-22): un
 * ramal que TERMINA en el elemento (fin = su código) o está listado como receptor es
 * ENTRANTE — jamás salida, ni siquiera si `alimentaIds` (lista de una era con roles
 * invertidos) lo dice. Sin el veto, el espejo de salidas escribía el agregado del
 * elemento EN la clave del entrante, y como el agregado camina recibeDeIds (incluyendo
 * esa misma clave), el ramal crecía en cada pase de espejos y la inflación bajaba al
 * Ldesvio del piso inferior por la herencia.
 */

const BAN1 = {
  id: 'BAN1',
  net: 'san',
  code: 'BAN1',
  x: 980,
  y: 320,
  alimentaIds: ['RS2'],
  recibeDeIds: ['RS2'],
};

describe('idsSalidasDeBajante: el entrante jamás es salida', () => {
  it('ramal con fin = código del bajante NO es salida aunque alimentaIds lo liste', () => {
    const out = idsSalidasDeBajante(
      BAN1,
      [
        {
          id: 'RS2',
          net: 'san',
          pts: [
            [690, 320],
            [975, 320],
          ],
          ini: '',
          fin: 'BAN1',
        },
      ],
      1,
    );
    expect([...out]).toEqual([]);
  });

  it('ramal en recibeDeIds sin campo fin tampoco es salida', () => {
    const out = idsSalidasDeBajante(
      BAN1,
      [
        {
          id: 'RS2',
          net: 'san',
          pts: [
            [690, 320],
            [975, 320],
          ],
        },
      ],
      1,
    );
    expect([...out]).toEqual([]);
  });

  it('entrante GEOMÉTRICO (cabeza sobre el bajante, sin campo fin) vence a alimentaIds rancio', () => {
    // El caso RS2-P2 real: sin fin, sin recibeDeIds — solo la geometría dice que descarga
    // ahí. El espejo lo tenía como salida por un alimentaIds de una era vieja.
    const out = idsSalidasDeBajante(
      { id: 'BAN1', net: 'san', code: 'BAN1', x: 980, y: 320, alimentaIds: ['RS2'] },
      [
        {
          id: 'RS2',
          net: 'san',
          pts: [
            [690, 320],
            [977, 320],
          ],
        },
      ],
      1,
    );
    expect([...out]).toEqual([]);
  });

  it('la salida legítima (nace aquí: ini = código) sigue siéndolo aunque esté en recibeDeIds', () => {
    const out = idsSalidasDeBajante(
      BAN1,
      [
        {
          id: 'RS2',
          net: 'san',
          pts: [
            [975, 320],
            [690, 320],
          ],
          ini: 'BAN1',
          fin: 'LAV1',
        },
      ],
      1,
    );
    expect([...out]).toEqual(['RS2']);
  });

  it('la salida geométrica (cola sobre el bajante, sin listas) sigue detectándose', () => {
    const out = idsSalidasDeBajante(
      { id: 'BAN1', net: 'san', code: 'BAN1', x: 0, y: 0 },
      [
        {
          id: 'RS9',
          net: 'san',
          pts: [
            [1, 0],
            [200, 0],
          ],
        },
      ],
      1,
    );
    expect([...out]).toEqual(['RS9']);
  });
});
