import { describe, it, expect } from 'vitest';
import { nextFreeRamalId } from '../PlanoState';

// Ida y vuelta ramal↔tributario: el id heredado del ramal previo NO debe bloquear la
// numeración — RS2 convertido a tributario deja RS2 libre y la vuelta recupera RS2
// (orig. usuario: "sigue contando desde el ramal previo", salía RS3).
const r = (id: string, label?: string) => ({ id, label: label ?? id });

describe('nextFreeRamalId', () => {
  it('round trip: el propio elemento no bloquea su número original', () => {
    const ramales = [r('RS1'), r('RS2', 'T1RS2'), r('RS3')];
    expect(nextFreeRamalId(ramales, 'RS', 'RS2')).toBe('RS2');
  });

  it('sin excluir, el id heredado empuja al siguiente (comportamiento viejo, contraste)', () => {
    const ramales = [r('RS1'), r('RS2', 'T1RS2'), r('RS3')];
    expect(nextFreeRamalId(ramales, 'RS')).toBe('RS4');
  });

  it('si OTRO ramal tomó el número libre, salta al siguiente sin chocar', () => {
    // Tributario con id uniq (T1788) mientras otro ramal ocupó RS2: la vuelta no choca.
    const ramales = [r('RS1'), { id: 'T1788', label: 'T1RS2' }, r('RS3'), r('RS2')];
    expect(nextFreeRamalId(ramales, 'RS', 'T1788')).toBe('RS4');
  });

  it('colisiones por etiqueta también cuentan (id ≠ label)', () => {
    // Otro elemento (id RX9) lleva la ETIQUETA RS2: el número está ocupado igualmente.
    const ramales = [
      r('RS1'),
      { id: 'T1788', label: 'T1RS1' },
      { id: 'RX9', label: 'RS2' },
      r('RS3'),
    ];
    expect(nextFreeRamalId(ramales, 'RS', 'T1788')).toBe('RS4');
  });

  it('red sin prefijo estándar usa el pfx dado', () => {
    expect(nextFreeRamalId([r('RAF1')], 'RAF', undefined)).toBe('RAF2');
  });
});
