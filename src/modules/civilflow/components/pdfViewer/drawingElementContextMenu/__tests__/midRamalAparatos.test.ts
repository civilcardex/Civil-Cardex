import { describe, it, expect } from 'vitest';
import {
  aparatoIdsDeRed,
  extremoPorClic,
  aparatoConConteo,
  asignadosDeConteos,
  asignadosDeCampos,
  preferirExtremo,
} from '../midRamalAparatos.ts';
import {
  APARATOS_DEF,
  AF_UC_IDS,
  AC_UC_IDS,
} from '../../../../constants/engineeringDataFixtures.ts';
import { UD_BASE_INIT } from '../../../../constants';
import { esAplicable } from '../../../fixturesStorage.ts';

// Helpers puros del selector de aparato a mitad de ramal (extraídos del IIFE de
// midRamalAccessorySelector — auditoría 2026-10-29 H-1). Sin motor ni menú.

describe('aparatoIdsDeRed', () => {
  it('af/ac devuelven sus UCs de catálogo', () => {
    expect(aparatoIdsDeRed('af')).toEqual(AF_UC_IDS);
    expect(aparatoIdsDeRed('ac')).toEqual(AC_UC_IDS);
  });

  it('san devuelve solo aplicables, en el orden del libro de UDs', () => {
    const ids = aparatoIdsDeRed('san');
    const esperados = APARATOS_DEF.filter((ap) => esAplicable(ap, 'san', 'ud'))
      .sort(
        (a, b) =>
          UD_BASE_INIT.findIndex((d) => d.id === a.id) -
          UD_BASE_INIT.findIndex((d) => d.id === b.id),
      )
      .map((a) => a.id);
    expect(ids).toEqual(esperados);
  });

  it('gas devuelve solo aparatos del grupo g', () => {
    const ids = aparatoIdsDeRed('gas');
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const def = APARATOS_DEF.find((a) => a.id === id);
      expect(def?.grupo).toBe('g');
    }
  });
});

describe('extremoPorClic', () => {
  it('clic cerca de p0 → aparatoInicio; cerca del último punto → aparatoFin', () => {
    const pts = [
      [0, 0],
      [100, 0],
      [200, 0],
    ];
    expect(extremoPorClic(pts, 5, 0)).toBe('aparatoInicio');
    expect(extremoPorClic(pts, 195, 0)).toBe('aparatoFin');
  });

  it('sin pts (o 1 solo) cae a aparatoInicio (Infinity <= Infinity, como el original)', () => {
    expect(extremoPorClic([], 10, 10)).toBe('aparatoInicio');
    expect(extremoPorClic(undefined, 10, 10)).toBe('aparatoInicio');
  });
});

describe('aparatoConConteo', () => {
  it('devuelve el primer aparato con conteo > 0', () => {
    expect(aparatoConConteo({ lvm: 0, tin: 3, duc: 2 })).toBe('tin');
  });

  it('libro vacío o todo en cero → vacío (el desplegable muestra la base del campo)', () => {
    expect(aparatoConConteo({})).toBe('');
    expect(aparatoConConteo({ lvm: 0 })).toBe('');
  });
});

describe('asignadosDeConteos', () => {
  it('solo ids con conteo > 0, con su cantidad', () => {
    expect(asignadosDeConteos(['lvm', 'tin', 'duc'], { lvm: 0, tin: 3, duc: 1 })).toEqual([
      { id: 'tin', n: 3 },
      { id: 'duc', n: 1 },
    ]);
  });
});

describe('asignadosDeCampos', () => {
  it('el motor vivo tiene prioridad sobre el snapshot rancio', () => {
    expect(
      asignadosDeCampos({ aparatoInicio: 'tin' }, { aparatoInicio: 'lvm', aparatoFin: '' }),
    ).toEqual([{ id: 'lvm', n: 1 }]);
  });

  it('sin vivo usa el snapshot; deduplica extremos y filtra vacíos', () => {
    expect(asignadosDeCampos({ aparatoInicio: 'duc', aparatoFin: 'duc' }, null)).toEqual([
      { id: 'duc', n: 1 },
    ]);
    expect(asignadosDeCampos({}, undefined)).toEqual([]);
  });
});

describe('preferirExtremo', () => {
  it('el extremo clicado manda; si está vacío cae al otro', () => {
    expect(preferirExtremo('aparatoInicio', 'lvm', 'duc')).toBe('lvm');
    expect(preferirExtremo('aparatoInicio', '', 'duc')).toBe('duc');
    expect(preferirExtremo('aparatoFin', 'lvm', 'duc')).toBe('duc');
    expect(preferirExtremo('aparatoFin', 'lvm', '')).toBe('lvm');
    expect(preferirExtremo('aparatoInicio', '', '')).toBe('');
  });
});
