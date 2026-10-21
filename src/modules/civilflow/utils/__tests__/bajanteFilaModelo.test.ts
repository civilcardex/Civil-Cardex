import { describe, expect, it } from 'vitest';
import { calculaFilaBajante, type ContextoBajanteRow } from '../bajanteFilaModelo.ts';
import type { Tramo } from '../../context/tramosReducer';

/**
 * Caracterización del modelo de fila de la tabla de bajantes (utils/bajanteRowModel.ts).
 *
 * Antes la cuenta vivía dentro del JSX del componente, con búsquedas lineales por fila.
 * Estos tests fijan la cuenta: qué se muestra y qué se avisa.
 */

function tramoBajante(extra: Partial<Tramo> = {}): Tramo {
  return {
    id: 'B1',
    planId: 1,
    piso: 1,
    esBajante: true,
    net: 'san',
    _key: 'B1-1',
    ...extra,
  } as Tramo;
}

function ctx(over: Partial<ContextoBajanteRow> = {}): ContextoBajanteRow {
  const t = tramoBajante();
  return {
    tramosSan: [t],
    plans: [{ id: 1, nivel: 1, status: 'confirmed' } as never],
    pisos: [{ n: 1 }],
    tramoPorClave: new Map([['B1-1', t]]),
    tramoPorClaveExacta: new Map([['B1-1', t]]),
    storageByPlan: {},
    components: [['B1-1']],
    ventToSanMap: new Map(),
    ventRamalDiamMap: {},
    geoAsocByBaj: {},
    udPorBajante: new Map([['B1-1', 6]]),
    udBase: [],
    ...over,
  };
}

describe('calculaFilaBajante — lo que la fila muestra', () => {
  it('sin diámetro propuesto el cálculo se queda en el mínimo del catálogo', () => {
    const fila = calculaFilaBajante(tramoBajante(), ctx());
    // Sin diámetro propuesto el cálculo usa el mínimo del catálogo (1.24"), y como no hay
    // diámetro con el que comparar, el chequeo queda en "No cumple".
    expect(fila.DcalcPulg).toBeGreaterThan(0);
    expect(fila.resolvedSanDprop).toBe(0);
    expect(fila.chequeo).toBe('No cumple');
  });

  it('el relleno del tubo se muestra como fracción ("7/24" o "1/4")', () => {
    expect(calculaFilaBajante(tramoBajante({ bajR: 7 / 24 }), ctx()).rStr).toBe('7/24');
    expect(calculaFilaBajante(tramoBajante({ bajR: 0.25 }), ctx()).rStr).toBe('1/4');
    expect(calculaFilaBajante(tramoBajante(), ctx()).rStr).toBe(null);
  });

  it('las unidades de descarga propias y las totales vienen del contexto', () => {
    const fila = calculaFilaBajante(tramoBajante(), ctx({ udPorBajante: new Map([['B1-1', 9]]) }));
    expect(fila.totalUD).toBe(9);
    expect(fila.ramalesUD).toBe(9 - fila.propiasUD);
  });

  it('los ramales asociados llevan el piso: "RS1-P1"', () => {
    const t = tramoBajante({ recibeDeIds: ['RS1'] });
    const conRamal = { ...t, id: 'RS1', esBajante: false };
    const fila = calculaFilaBajante(
      t,
      ctx({
        tramosSan: [t, conRamal],
        tramoPorClave: new Map([
          ['B1-1', t],
          ['RS1-1', conRamal],
        ]),
        tramoPorClaveExacta: new Map([
          ['B1-1', t],
          ['RS1-1', conRamal],
        ]),
      }),
    );
    expect(fila.ramalesAsoc).toEqual(['RS1-P1']);
  });

  it('el respaldo geométrico agrega los ramales que no están en recibeDeIds', () => {
    const t = tramoBajante();
    const fila = calculaFilaBajante(t, ctx({ geoAsocByBaj: { 'B1-1': ['RS9'] } }));
    expect(fila.ramalesAsoc).toEqual(['RS9-P1']);
  });
});

describe('calculaFilaBajante — los avisos de diámetro', () => {
  it('el diámetro propuesto menor que el de sus ramales AVISA (no se puede reducir)', () => {
    // El ramal conectado tiene 4" (100 mm) y el bajante propone 2" (50 mm).
    const t = tramoBajante({ bajDprop: 50, recibeDeIds: ['RS1'] });
    const storage = {
      '1': {
        ramales: [{ id: 'RS1', net: 'san', diamPulg: 100 }],
      },
    } as never;
    const fila = calculaFilaBajante(t, ctx({ storageByPlan: storage }));
    expect(fila.maxSanConectDiam).toBe(100);
    expect(fila.sanDiamWarn).toBe(true);
  });

  it('el diámetro propuesto mayor o igual que el de sus ramales NO avisa', () => {
    const t = tramoBajante({ bajDprop: 100, recibeDeIds: ['RS1'] });
    const storage = {
      '1': {
        ramales: [{ id: 'RS1', net: 'san', diamPulg: 100 }],
      },
    } as never;
    const fila = calculaFilaBajante(t, ctx({ storageByPlan: storage }));
    expect(fila.sanDiamWarn).toBe(false);
  });
});
