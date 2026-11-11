import { describe, it, expect } from 'vitest';
import type { IPlanoEngineCore } from '../PlanoState.ts';
import { confirmarMarquee } from '../drags/marqueeSelect.ts';
import {
  dragFlowCheck,
  draggedOntoWrongPadre,
  tryRotateToValidAngle,
} from '../drags/dragValidation.ts';
import { dragUpGhost, dragUpBajante } from '../drags/dragUpBajante.ts';
import { dragUpVertex } from '../drags/dragUpVertex.ts';
import { dragUpRamalBody, checkAccesorioTrigger } from '../drags/dragUpRamalBody.ts';

/**
 * Caracterización de los módulos dragUp* extraídos de handleDragUp (extracción verbatim).
 * El comportamiento profundo (asociación a bajantes, rollback de flujos) ya queda fijado por
 * dropAssociatesToBajante/multiSelectMarquee/multiselectUniversal vía el dispatcher; aquí se
 * ejercita cada módulo directamente con casos puntuales.
 */

function makeEngine(): IPlanoEngineCore {
  return {
    ramales: [],
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    dims: [],
    multiSel: [],
    selId: null,
    marqueeRect: null,
    toCvs: (x: number, y: number) => ({ x, y }),
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    render: () => {},
    triggerAlert: () => {},
  } as unknown as IPlanoEngineCore;
}

describe('marqueeSelect.confirmarMarquee', () => {
  it('sin marqueeRect devuelve false (no había gesto)', () => {
    expect(confirmarMarquee(makeEngine(), false)).toBe(false);
  });

  it('con marqueeRect llena multiSel y devuelve true', () => {
    const eng = makeEngine();
    eng.marqueeRect = { x1: 0, y1: 0, x2: 100, y2: 100 };
    eng.ramales = [
      {
        id: 'RS1',
        pts: [
          [50, 50],
          [500, 500],
        ],
      },
    ] as never;
    expect(confirmarMarquee(eng, false)).toBe(true);
    expect(eng.multiSel).toContain('RS1');
    expect(eng.marqueeRect).toBeNull();
  });

  it('click simple (<3px) sobre área la selecciona directamente', () => {
    const eng = makeEngine();
    eng.marqueeRect = { x1: 10, y1: 10, x2: 12, y2: 12 };
    eng._areaClickCandidate = 'AR1';
    eng.areas = [{ id: 'AR1', pts: [[10, 10]] }] as never;
    let sel: unknown;
    eng._emitSelect = ((x: unknown) => {
      sel = x;
    }) as never;
    expect(confirmarMarquee(eng, false)).toBe(true);
    expect(eng.selId).toBe('AR1');
    expect((sel as { id: string }).id).toBe('AR1');
  });
});

describe('dragValidation', () => {
  it('draggedOntoWrongPadre: extremo del tributario sobre VÉRTICE de otro ramal → true', () => {
    const eng = makeEngine();
    eng.ramales = [
      {
        id: 'R2',
        net: 'san',
        tipo: 'ramal',
        padre: null,
        pts: [
          [10, 0],
          [20, 0],
        ],
      },
    ] as never;
    const ram = {
      id: 'RT1',
      net: 'san',
      tipo: 'tributario',
      padre: 'RP',
      pts: [
        [0, 0],
        [10, 0],
      ],
    } as never;
    expect(draggedOntoWrongPadre(eng, ram)).toBe(true);
  });

  it('draggedOntoWrongPadre: extremo sobre el ramal PADRE → false', () => {
    const eng = makeEngine();
    eng.ramales = [
      {
        id: 'RP',
        net: 'san',
        tipo: 'ramal',
        padre: null,
        pts: [
          [10, 0],
          [20, 0],
        ],
      },
    ] as never;
    const ram = {
      id: 'RT1',
      net: 'san',
      tipo: 'tributario',
      padre: 'RP',
      pts: [
        [0, 0],
        [10, 0],
      ],
    } as never;
    expect(draggedOntoWrongPadre(eng, ram)).toBe(false);
  });

  it('dragFlowCheck: ramal af no se valida (solo san/ll/vent)', () => {
    const eng = makeEngine();
    const ram = {
      id: 'RAF',
      net: 'af',
      pts: [
        [0, 0],
        [10, 0],
      ],
    } as never;
    expect(dragFlowCheck(eng, ram, [])).toBeNull();
  });

  it('tryRotateToValidAngle: sin bajante cerca devuelve false', () => {
    const eng = makeEngine();
    eng.bajantes = [{ id: 'B9', net: 'af', x: 500, y: 500 }] as never;
    const ram = {
      id: 'RAF',
      net: 'af',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [10, 5],
      ],
    } as never;
    expect(tryRotateToValidAngle(eng, ram, 1, true)).toBe(false);
  });
});

describe('dragUpBajante.dragUpGhost', () => {
  it('desplazamiento real crea el ramal Ldesvio conector', () => {
    const eng = makeEngine();
    eng.nivelActual = { label: 'P2', n: 2 } as never;
    eng._netCounts = { af: { ramal: 0 } } as never;
    eng.pxToM = (px: number) => px * 0.01;
    eng.bajantes = [
      {
        id: 'B1',
        net: 'af',
        x: 10,
        y: 10,
        desplazamientos: { P2: { dx: 30, dy: 0 } },
      },
    ] as never;
    eng.ghostDrag = { id: 'B1' } as never;
    dragUpGhost(eng);
    expect(eng.ramales.length).toBe(1);
    const ld = eng.ramales[0] as unknown as { id: string; bloqueado: boolean };
    expect(ld.id.startsWith('RAF')).toBe(true);
    expect(ld.bloqueado).toBe(true);
    expect(
      (eng.bajantes[0] as unknown as { desplazamientos: Record<string, { Ldesvio: string }> })
        .desplazamientos.P2.Ldesvio,
    ).toBe(ld.id);
    expect(eng.ghostDrag).toBeNull();
  });

  it('desplazamiento ~0 (<1px) se borra sin crear ramal', () => {
    const eng = makeEngine();
    eng.nivelActual = { label: 'P2', n: 2 } as never;
    eng.bajantes = [
      {
        id: 'B1',
        net: 'af',
        x: 10,
        y: 10,
        desplazamientos: { P2: { dx: 0.4, dy: 0.2 } },
      },
    ] as never;
    eng.ghostDrag = { id: 'B1' } as never;
    dragUpGhost(eng);
    expect(eng.ramales.length).toBe(0);
    expect(
      (eng.bajantes[0] as unknown as { desplazamientos: Record<string, unknown> }).desplazamientos
        .P2,
    ).toBeUndefined();
  });

  it('dragUpBajante sin bajDrag es no-op', () => {
    expect(() => dragUpBajante(makeEngine())).not.toThrow();
  });
});

describe('dragUpVertex / dragUpRamalBody / checkAccesorioTrigger', () => {
  it('dragUpVertex sin ptDrag es no-op', () => {
    expect(() => dragUpVertex(makeEngine())).not.toThrow();
  });

  it('dragUpRamalBody sin ramalDrag es no-op', () => {
    expect(() => dragUpRamalBody(makeEngine())).not.toThrow();
  });

  it('checkAccesorioTrigger sin modal registrado no dispara nada', () => {
    expect(() => checkAccesorioTrigger(makeEngine(), 'RX')).not.toThrow();
  });

  it('checkAccesorioTrigger ignora redes san/ll/vent (uniones automáticas)', () => {
    const eng = makeEngine();
    let triggered = 0;
    eng.triggerAccesorioModal = () => {
      triggered++;
    };
    eng.ramales = [{ id: 'RS1', net: 'san' }] as never;
    checkAccesorioTrigger(eng, 'RS1');
    expect(triggered).toBe(0);
  });
});
