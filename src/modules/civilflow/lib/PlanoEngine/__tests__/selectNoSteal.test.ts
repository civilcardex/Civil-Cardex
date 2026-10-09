import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';
import { camposAsocManual } from '../PlanoEngineSelectionEdit';
import { podarReferenciasStaleDeBajantes } from '../PlanoEngineNetwork';

// Robo de selección en updateElementById (orig. usuario): al editar OTRO elemento desde el
// menú del seleccionado (asociar bajante/montante desde el menú del ramal), el _emitSelect
// final propagaba el EDITADO como nueva selección — el menú/panel cambiaba de elemento y el
// checkbox quedaba rancio. El emit ahora está gated por selId.

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => makeCanvas(),
    };
  }
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      devicePixelRatio: 1,
    };
  }
  if (!g.Image) {
    g.Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      set src(_v: string) {
        this.onerror();
      }
    };
  }
});

function makeCanvas() {
  const ctxStub = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'canvas') return null;
        if (k === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    width: 800,
    height: 600,
    style: {},
    getContext: () => ctxStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
}

function makeEngine(): PlanoEngine {
  const canv = makeCanvas();
  const cw = { addEventListener: () => {}, removeEventListener: () => {}, style: {} };
  return new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
}

function seed(eng: PlanoEngine): {
  ramal: { id: string };
  baj: { id: string };
  mont: { id: string };
} {
  eng.ramales.push({
    id: 'RS1',
    label: 'RS1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [100, 0],
    ],
  } as never);
  eng.bajantes.push({
    id: 'BAN1',
    code: 'BAN1',
    net: 'san',
    tipo: 'bajante',
    x: 100,
    y: 0,
  } as never);
  eng.bajantes.push({
    id: 'MAF1',
    code: 'MAF1',
    net: 'af',
    tipo: 'montante',
    x: 50,
    y: 50,
  } as never);
  return { ramal: { id: 'RS1' }, baj: { id: 'BAN1' }, mont: { id: 'MAF1' } };
}

describe('updateElementById no roba la selección', () => {
  it('editando OTRO elemento (montante desde ramal seleccionado): escribe y NO emite select', () => {
    const eng = makeEngine();
    const { ramal, mont } = seed(eng);
    eng.selId = ramal.id;
    const emitidos: Array<string | null> = [];
    eng._onSelectCb = ((el: { id?: string } | null) => emitidos.push(el?.id ?? null)) as never;

    eng.updateElementById(
      mont.id,
      camposAsocManual(eng.bajantes.find((x) => x.id === mont.id)!, ramal.id, true),
    );

    const vivo = eng.bajantes.find((x) => x.id === mont.id);
    expect((vivo?.recibeDeIds || []).includes(ramal.id)).toBe(true);
    // La poda stale (corre en cada _markDirty) NO borra la asociación manual.
    podarReferenciasStaleDeBajantes(eng);
    expect((vivo?.recibeDeIds || []).includes(ramal.id)).toBe(true);
    // La selección sigue en el ramal y el montante NUNCA se emitió como selección.
    expect(eng.selId).toBe(ramal.id);
    expect(emitidos.some((id) => id === mont.id)).toBe(false);
  });

  it('asociación SIN libro manual y sin geometría: la poda stale la quita (comportamiento original)', () => {
    const eng = makeEngine();
    const { ramal, mont } = seed(eng);
    eng.bajantes.find((x) => x.id === mont.id)!.recibeDeIds = [ramal.id];
    podarReferenciasStaleDeBajantes(eng);
    const vivo = eng.bajantes.find((x) => x.id === mont.id);
    expect((vivo?.recibeDeIds || []).includes(ramal.id)).toBe(false);
  });

  it('editando el PROPIO seleccionado: el emit se conserva (panel/menú sincronizan)', () => {
    const eng = makeEngine();
    const { ramal, baj } = seed(eng);
    eng.selId = baj.id;
    const emitidos: Array<string | null> = [];
    eng._onSelectCb = ((el: { id?: string } | null) => emitidos.push(el?.id ?? null)) as never;

    eng.updateElementById(baj.id, { recibeDeIds: [ramal.id], alimentaIds: [] });

    const vivo = eng.bajantes.find((x) => x.id === baj.id);
    expect((vivo?.recibeDeIds || []).includes(ramal.id)).toBe(true);
    expect(emitidos.includes(baj.id)).toBe(true);
  });

  it('san: asociar bajante desde el menú del ramal escribe ambas direcciones y no roba', () => {
    const eng = makeEngine();
    const { ramal, baj } = seed(eng);
    eng.selId = ramal.id;
    const emitidos: Array<string | null> = [];
    eng._onSelectCb = ((el: { id?: string } | null) => emitidos.push(el?.id ?? null)) as never;

    // Mismo write que la sección "Bajantes asociados" del ramalMenu.
    eng.updateElementById(baj.id, {
      recibeDeIds: [ramal.id],
      alimentaIds: [],
      descargaEnId: ramal.id,
    });

    const vivo = eng.bajantes.find((x) => x.id === baj.id);
    expect((vivo?.recibeDeIds || []).includes(ramal.id)).toBe(true);
    expect(eng.selId).toBe(ramal.id);
    expect(emitidos.some((id) => id === baj.id)).toBe(false);
  });
});
