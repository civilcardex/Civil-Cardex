import { describe, expect, it } from 'vitest';
// Vía PlanoState (re-export): el contrato público original NO cambia.
import {
  NETS,
  netsSnapLinked,
  allocTributaryNumber,
  nextFreeRamalId,
  rootTributarioLabel,
  initNetCounts,
  allocNetNumber,
} from '../PlanoState';

/** El split PlanoState→planoNets/planoNumbering conserva la API pública (G2) y la
 *  semántica de numeración que usan finishRamal/ramalMenu/networkRenumber. */
describe('planoNets + planoNumbering (vía re-export de PlanoState)', () => {
  it('NETS intacto: 11 redes, af con prefijo RAF y san bajante BAN', () => {
    expect(NETS).toHaveLength(11);
    expect(NETS.find((n) => n.id === 'af')?.lbl).toBe('RAF');
    expect(NETS.find((n) => n.id === 'san')?.bmType).toBe('bajante');
  });

  it('netsSnapLinked: san-vent se imantan, af-vent no', () => {
    expect(netsSnapLinked('san', 'vent')).toBe(true);
    expect(netsSnapLinked('vent', 'san')).toBe(true);
    expect(netsSnapLinked('af', 'vent')).toBe(false);
  });

  it('allocTributaryNumber consecutivo por raíz y nextFreeRamalId con exclude', () => {
    const ramales = [{ label: 'T1RS1' }, { label: 'T3RS1' }];
    expect(allocTributaryNumber({ ramales }, 'RS1')).toBe(2);
    const conIds = [
      { id: 'RS1', label: 'RS1' },
      { id: 'RS3', label: 'RS3' },
    ];
    expect(nextFreeRamalId(conIds, 'RS')).toBe('RS2');
    // El propio elemento convertido no bloquea su id heredado.
    expect(nextFreeRamalId([{ id: 'RS2', label: 'RS2' }], 'RS', 'RS2')).toBe('RS1');
  });

  it('rootTributarioLabel: padre inmediato manda (no mergesFrom del tronco original)', () => {
    const ramales = [
      { id: 'RS1', label: 'RS1', tipo: 'ramal', padre: null },
      { id: 'RS2', label: 'RS2', tipo: 'ramal', padre: null, mergesFrom: ['RS1', 'T0'] },
      { id: 'T1RS2', label: 'T1RS2', tipo: 'tributario', padre: 'RS2' },
    ];
    expect(rootTributarioLabel(ramales as never, 'T1RS2')).toBe('RS2');
    expect(rootTributarioLabel(ramales as never, null)).toBe('');
  });

  it('contadores por red: init a cero y alloc salta ocupados', () => {
    const target = { _netCounts: {} as Record<string, { ramal: number; tributario: number }> };
    initNetCounts(target);
    expect(target._netCounts['af']).toEqual({ ramal: 0, tributario: 0 });
    expect(allocNetNumber(target, 'af', 'ramal', (n) => n === 1)).toBe(2);
  });
});
