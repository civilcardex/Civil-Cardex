import { describe, it, expect, beforeEach } from 'vitest';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { nextRamalLabel } from '../associateBajanteAcrossFloors';
import { healLdesvioLabels, sweepMisplacedLdesvios } from '../assocLayoutMigration';

// Varios Ldesvios nacían con el mismo label (RS1, RS1...): nextRamalLabel miraba
// `(r.id || r.label)` y como todo ramal tiene id, el label del LD jamás ocupaba número.

beforeEach(() => {
  localStorage.clear();
});

describe('nextRamalLabel ve labels de LD', () => {
  it('un LD con RS2 ocupa el número: el siguiente es RS3', () => {
    expect(
      nextRamalLabel('san', [
        { id: 'RS1', label: 'RS1' },
        { id: 'LD_A', label: 'RS2' },
        { id: 'LD_B', label: 'RS2' },
      ]),
    ).toBe('RS3');
  });

  it('sin LDs no cambia (RS1 → RS2)', () => {
    expect(nextRamalLabel('san', [{ id: 'RS1', label: 'RS1' }])).toBe('RS2');
  });

  it('labels crudos LD_ no aportan número', () => {
    expect(nextRamalLabel('san', [{ id: 'LD_A', label: 'LD_A' }])).toBe('RS1');
  });
});

describe('healLdesvioLabels', () => {
  it('duplicados y choques se re-etiquetan; reales e ids intactos; idempotente', () => {
    const data: { ramales: { id: string; net: string; label: string }[] } = {
      ramales: [
        { id: 'RS1', net: 'san', label: 'RS1' },
        { id: 'LD_A', net: 'san', label: 'RS1' },
        { id: 'LD_B', net: 'san', label: 'RS2' },
        { id: 'LD_C', net: 'san', label: 'RS2' },
      ],
    };
    expect(healLdesvioLabels(data as never)).toBe(true);
    const labels = data.ramales.map((r) => r.label);
    // Únicos, reales intactos, ids intactos
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels[0]).toBe('RS1');
    expect(data.ramales.map((r) => r.id)).toEqual(['RS1', 'LD_A', 'LD_B', 'LD_C']);
    expect(healLdesvioLabels(data as never)).toBe(false);
  });

  it('sin LDs no toca nada', () => {
    const data: { ramales: { id: string; net: string; label: string }[] } = {
      ramales: [{ id: 'RS1', net: 'san', label: 'RS1' }],
    };
    expect(healLdesvioLabels(data as never)).toBe(false);
  });
});

describe('sweepMisplacedLdesvios sanea labels al cargar', () => {
  it('persiste LDs con labels únicos y consecutivos', () => {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        ramales: [
          { id: 'RS1', net: 'san', label: 'RS1' },
          { id: 'LD_A', net: 'san', label: 'RS1' },
          { id: 'LD_B', net: 'san', label: 'RS1' },
        ],
        bajantes: [
          { id: 'BAN1', net: 'san', desplazamientos: { P1: { dx: 1, dy: 1, Ldesvio: 'LD_A' } } },
          { id: 'BAN2', net: 'san', desplazamientos: { P1: { dx: 2, dy: 2, Ldesvio: 'LD_B' } } },
        ],
      }),
    );
    sweepMisplacedLdesvios();
    const after = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '1') || '{}');
    const labels = (after.ramales as { id: string; label: string }[])
      .filter((r) => r.id.startsWith('LD_'))
      .map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('RS2');
    expect(labels).toContain('RS3');
  });
});
