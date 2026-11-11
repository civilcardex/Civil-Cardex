import { describe, it, expect } from 'vitest';
import { markDirty, chequearPresionGlobal } from '../dirtyPipeline.ts';
import {
  emitStatus,
  emitSelect,
  emitDelete,
  triggerAlert,
  triggerOpciones,
  triggerAccesorioModal,
} from '../engineEmitters.ts';
import { handlePointerUp } from '../events/pointerUp.ts';
import type { IPlanoEngineCore } from '../PlanoState.ts';

/**
 * Caracterización de los módulos extraídos de PlanoEngine (extracción verbatim): el pipeline
 * de trabajo sucio, los emisores al visor y el mouse up. El comportamiento completo del motor
 * queda fijado por los 20 tests de integración que instancian la clase.
 */

function makeEngine(): IPlanoEngineCore {
  return {
    ramales: [],
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    _dirty: false,
    _chequeoHash: {},
    _history: { saveSnapshot: () => {} },
    _onDirtyCb: null,
    panning: false,
    tool: 'sel',
    canv: { style: {} } as unknown as HTMLCanvasElement,
    render: () => {},
    triggerAlert: () => {},
    _markDirty: () => {},
  } as unknown as IPlanoEngineCore;
}

describe('dirtyPipeline', () => {
  it('markDirty marca _dirty, corre el pipeline y dispara onDirty', () => {
    const eng = makeEngine();
    let dirtyCalled = 0;
    (eng as unknown as { _onDirtyCb: () => void })._onDirtyCb = () => {
      dirtyCalled++;
    };
    markDirty(eng);
    expect(eng._dirty).toBe(true);
    expect(dirtyCalled).toBe(1);
  });

  it('markDirty sobrevive a un cálculo que lanza (el guardado no se pierde)', () => {
    const eng = makeEngine();
    (eng as unknown as { ramales: unknown[] }).ramales = [
      { net: 'san', pts: null }, // fuerza lanzamiento en el pipeline
    ];
    let dirtyCalled = 0;
    (eng as unknown as { _onDirtyCb: () => void })._onDirtyCb = () => {
      dirtyCalled++;
    };
    expect(() => markDirty(eng)).not.toThrow();
    expect(dirtyCalled).toBe(1);
  });

  it('chequearPresionGlobal sin ramales de presión no alerta', () => {
    const eng = makeEngine();
    let alerts = 0;
    eng.triggerAlert = () => {
      alerts++;
    };
    chequearPresionGlobal(eng);
    expect(alerts).toBe(0);
  });
});

describe('engineEmitters', () => {
  it('emitSelect limpia las cajas de render del objeto emitido', () => {
    const eng = makeEngine();
    let got: Record<string, unknown> | null = null;
    (eng as unknown as { _onSelectCb: (x: unknown) => void })._onSelectCb = (x) => {
      got = x as Record<string, unknown>;
    };
    emitSelect(eng, {
      id: 'RS1',
      label: 'RS1',
      _circ: { x: 0, y: 0, r: 5 },
      _box: { x: 0, y: 0, w: 1, h: 1 },
    } as never);
    expect(got).not.toBeNull();
    expect(got!._circ).toBeUndefined();
    expect(got!._box).toBeUndefined();
    expect(got!.id).toBe('RS1');
  });

  it('emitSelect(null) emite null; sin callback no lanza', () => {
    const eng = makeEngine();
    let got: unknown = 'x';
    (eng as unknown as { _onSelectCb: (x: unknown) => void })._onSelectCb = (x) => {
      got = x;
    };
    emitSelect(eng, null);
    expect(got).toBeNull();
    expect(() => emitStatus(makeEngine(), 'hola')).not.toThrow();
  });

  it('emitDelete/triggerAlert pasan al callback registrado', () => {
    const eng = makeEngine();
    const ids: string[][] = [];
    const alerts: string[] = [];
    (eng as unknown as { _onDeleteCb: (x: string[]) => void })._onDeleteCb = (x) => ids.push(x);
    (eng as unknown as { _onAlertCb: (t: string) => void })._onAlertCb = (t) => alerts.push(t);
    emitDelete(eng, ['RS1']);
    triggerAlert(eng, 'T', 'm');
    expect(ids).toEqual([['RS1']]);
    expect(alerts).toEqual(['T']);
  });

  it('triggerOpciones sin callback resuelve -1; con callback resuelve la elección', async () => {
    expect(await triggerOpciones(makeEngine(), 't', 'm', ['a'])).toBe(-1);
    const eng = makeEngine();
    (eng as unknown as { _onOpcionesCb: () => Promise<number> })._onOpcionesCb = () =>
      Promise.resolve(2);
    expect(await triggerOpciones(eng, 't', 'm', ['a', 'b'])).toBe(2);
  });

  it('triggerAccesorioModal sin callback no lanza', () => {
    expect(() =>
      triggerAccesorioModal(makeEngine(), {
        ramalId: 'RAF1',
        angleDeg: 45,
        junctionIndex: 0,
        point: [0, 0],
        net: 'af',
      }),
    ).not.toThrow();
  });
});

describe('events/pointerUp', () => {
  // Entorno node: MouseEvent no existe — el instanceof de pointerUp da false y basta un objeto.
  const mouseUp = (ctrl = false) =>
    ({ clientX: 0, clientY: 0, ctrlKey: ctrl }) as unknown as MouseEvent;

  it('suelta el paneo y restaura el cursor según herramienta', () => {
    const eng = makeEngine();
    eng.panning = true;
    eng.tool = 'sel' as never;
    handlePointerUp(eng, mouseUp());
    expect(eng.panning).toBe(false);
    expect((eng.canv.style as unknown as { cursor: string }).cursor).toBe('default');
  });

  it('sin paneo delega en handleDragUp sin lanzar', () => {
    const eng = makeEngine();
    expect(() => handlePointerUp(eng, mouseUp(true))).not.toThrow();
  });
});
