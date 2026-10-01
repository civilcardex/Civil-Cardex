import { describe, it, expect, vi } from 'vitest';
import { handleKeyDown } from '../handleKeyDown';
import { zoomAnclado } from '../planoCamera';
import { snapAngle } from '../planoCoords';
import type { IPlanoEngineCore } from '../PlanoState';

// Split mecánico del hub (planoCoords/planoCamera/handleKeyDown): el contrato importa —
// guard de foco, modificadores del navegador respetados y zoom anclado con clamp.

function makeEngine(): IPlanoEngineCore & { setTool: ReturnType<typeof vi.fn> } {
  const eng = {
    tool: 'sel',
    activeNet: 'll',
    activeNetworks: new Set(['recolectora']),
    activeRamal: null,
    activeArea: null,
    multiSel: [],
    selId: null,
    _guideStart: null,
    _dimStart: null,
    _canalStart: null,
    setTool: vi.fn(),
    finishRamal: vi.fn(),
    finishArea: vi.fn(),
    cancelRamal: vi.fn(),
    cancelArea: vi.fn(),
    undoLast: vi.fn(),
    redoLast: vi.fn(),
    deleteSelected: vi.fn(),
    getSelected: vi.fn(() => null),
    _emitSelect: vi.fn(),
    render: vi.fn(),
    toCvs: (x: number, y: number) => ({ x, y }),
    _selPointCvs: undefined,
  };
  return eng as never as IPlanoEngineCore & { setTool: ReturnType<typeof vi.fn> };
}

function key(
  k: string,
  opts: Partial<{ ctrl: boolean; alt: boolean; meta: boolean; tag: string }> = {},
): KeyboardEvent {
  return {
    key: k,
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    altKey: opts.alt ?? false,
    shiftKey: false,
    target: { tagName: opts.tag ?? 'CANVAS' },
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('handleKeyDown — guard de foco y modificadores', () => {
  it('con foco en INPUT los atajos de herramienta no disparan', () => {
    const eng = makeEngine();
    handleKeyDown(eng, key('l', { tag: 'INPUT' }));
    expect(eng.setTool).not.toHaveBeenCalled();
  });

  it("'l' con red ll + recolectora → herramienta canal", () => {
    const eng = makeEngine();
    handleKeyDown(eng, key('l'));
    expect(eng.setTool).toHaveBeenCalledWith('canal');
  });

  it('Ctrl+L es del navegador: no cambia herramienta', () => {
    const eng = makeEngine();
    handleKeyDown(eng, key('l', { ctrl: true }));
    expect(eng.setTool).not.toHaveBeenCalled();
  });

  it('Ctrl+Z con foco en SELECT sí deshace (un select no edita texto)', () => {
    const eng = makeEngine();
    handleKeyDown(eng, key('z', { ctrl: true, tag: 'SELECT' }));
    expect(eng.undoLast).toHaveBeenCalled();
  });
});

describe('zoomAnclado', () => {
  const cam = () => ({ zoom: 1, offX: 0, offY: 0, render: vi.fn() });

  it('duplica el zoom manteniendo fijo el punto ancla del canvas', () => {
    const c = cam();
    c.offX = 100;
    // Punto (150,50) del canvas: en plane es (50,-100); tras zoom 2 debe seguir en 150,50.
    zoomAnclado(c, 2, 150, 50);
    expect(c.zoom).toBe(2);
    expect(150 * 1 - (150 - 100) * 2).toBe(c.offX);
    expect(c.render).toHaveBeenCalled();
    // Inversa: el punto de plano bajo el ancla no cambia.
    const px = (150 - 100) / 1;
    expect((150 - c.offX) / 2).toBeCloseTo(px, 6);
  });

  it('clampa a los límites 0.05–6', () => {
    const c = cam();
    zoomAnclado(c, 99, 0, 0);
    expect(c.zoom).toBe(6);
    zoomAnclado(c, 0.001, 0, 0);
    expect(c.zoom).toBe(0.05);
  });

  it('zoom igual tras el clamp: no-op sin render', () => {
    const c = cam();
    zoomAnclado(c, 1, 0, 0);
    expect(c.render).not.toHaveBeenCalled();
  });
});

describe('snapAngle (puro)', () => {
  it('pega a 45° en san y a 90° en tributarios af/ac', () => {
    // 30° real → 45° en san (la distancia al origen se conserva).
    const san = snapAngle(0, 0, 100, Math.tan((30 * Math.PI) / 180) * 100, 'san');
    const dist = Math.hypot(100, Math.tan((30 * Math.PI) / 180) * 100);
    expect(san.x).toBeCloseTo(san.y, 6); // a 45°: x == y
    expect(san.x).toBeCloseTo(dist * Math.SQRT1_2, 6);
    // 60° real → 90° en tributario af (45° sería ambiguo: equidista de 0° y 90°).
    const af = snapAngle(0, 0, 100, Math.tan((60 * Math.PI) / 180) * 100, 'af', 'tributario');
    expect(af.x).toBeCloseTo(0, 6);
    expect(af.y).toBeCloseTo(200, 6);
  });
});
