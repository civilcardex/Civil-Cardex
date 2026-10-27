import { describe, expect, it } from 'vitest';
import { tribCandidatesDe, convertirATributario, convertirARamal } from '../ramalMenuConvert';
import type { PlanoRamal } from '../../../../lib/PlanoEngine/PlanoState.ts';

/** Ramal de prueba con extremos (0,0)-(100,0). */
function ramal(id: string, over: Partial<PlanoRamal> = {}): PlanoRamal {
  return {
    id,
    net: 'san',
    pts: [
      [0, 0],
      [100, 0],
    ],
    tipo: 'ramal',
    ...over,
  } as PlanoRamal;
}

function motor(ramales: PlanoRamal[]) {
  const eng = {
    ramales,
    bajantes: [],
    areas: [],
    dims: [],
    textAnnots: [],
    updateElementById: (id: string, up: Record<string, unknown>) => {
      const r = eng.ramales.find((x) => x.id === id);
      if (r) Object.assign(r, up);
    },
    render: () => {},
    _markDirty: () => {},
  };
  return eng as unknown as Parameters<typeof convertirATributario>[1];
}

function menuBits(selId: string | null) {
  const out: {
    selElement: { id: string } | null;
    setSelElement: (v: never) => void;
    setContextMenuState: (v: unknown) => void;
    ultimoSel: unknown;
  } = {
    selElement: selId ? { id: selId } : null,
    setSelElement: (v: never) => {
      out.ultimoSel = v;
    },
    setContextMenuState: () => {},
    ultimoSel: null,
  };
  return out as unknown as Parameters<typeof convertirATributario>[0];
}

describe('ramalMenuConvert', () => {
  it('candidatos: misma red que toca por extremo; tributarios y ajenos fuera', () => {
    const base = ramal('RS1', {
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    const tocado = ramal('RS2', {
      pts: [
        [100, 0],
        [140, 20],
      ],
    }); // extremo sobre vértice de RS1
    const trib = ramal('T1RS1', {
      tipo: 'tributario',
      pts: [
        [200, 0],
        [210, 0],
      ],
    });
    const otraRed = ramal('RAF1', {
      net: 'af',
      pts: [
        [0, 5],
        [100, 5],
      ],
    });
    const cands = tribCandidatesDe({ ramales: [base, tocado, trib, otraRed] } as never, base);
    expect(cands.map((c) => c.id)).toEqual(['RS2']);
  });

  it('convertirATributario: tipo+padre+label consecutivo y flecha san hacia la unión', () => {
    const padre = ramal('RS8', {
      label: 'RS8',
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    // p0 sobre el FIN del padre; p1 libre.
    const nuevo = ramal('RS9', {
      pts: [
        [100, 0],
        [160, 30],
      ],
    });
    const eng = motor([padre, nuevo]);
    const ctx = menuBits('RS9');
    convertirATributario(ctx, eng, nuevo, 'RS8');
    const t = eng.ramales.find((r) => r.id === 'RS9') as unknown as Record<string, unknown>;
    expect(t.tipo).toBe('tributario');
    expect(t.padre).toBe('RS8');
    expect(String(t.label)).toMatch(/^T1RS8$/);
    // san drena HACIA la unión; la unión está en p0 → la flecha se revierte (flag true,
    // código verbatim: _tribReversed = epIsStart para san/ll).
    expect(t._tribReversed).toBe(true);
  });

  it('convertirARamal: recupera el id libre (RS2 con RS1 ocupado) y limpia padre', () => {
    const t = ramal('T1RS2', {
      tipo: 'tributario',
      padre: 'RS8',
      label: 'T1RS2',
      pts: [
        [0, 0],
        [10, 0],
      ],
    });
    const rs1 = ramal('RS1', {
      pts: [
        [500, 500],
        [600, 500],
      ],
    }); // RS2 queda libre
    const eng = motor([t, rs1]);
    const ctx = menuBits('T1RS2');
    const ok = convertirARamal(ctx, eng, t, () => {});
    expect(ok).toBe(true);
    expect(eng.ramales.some((r) => r.id === 'RS2')).toBe(true);
    expect(eng.ramales.some((r) => r.id === 'T1RS2')).toBe(false);
    const r = eng.ramales.find((x) => x.id === 'RS2') as unknown as Record<string, unknown>;
    expect(r.tipo).toBe('ramal');
    expect(r.padre).toBeNull();
  });

  it('convertirARamal aborta si el resultado llega a un tributario (regla de conexión)', () => {
    const t = ramal('T1RS2', {
      tipo: 'tributario',
      padre: 'RS8',
      label: 'T1RS2',
      pts: [
        [0, 0],
        [10, 0],
      ],
    });
    // OTRO tributario cuyo extremo cae sobre t (bloqueo — la regla: ramales no llegan a tributarios).
    const bloqueo = ramal('T2RS3', {
      tipo: 'tributario',
      padre: 'RS3',
      pts: [
        [10, 0],
        [20, 5],
      ],
    });
    const eng = motor([t, bloqueo]);
    let alertado = false;
    const ok = convertirARamal(ctxDe(t), eng, t, () => {
      alertado = true;
    });
    expect(ok).toBe(false);
    expect(alertado).toBe(true);
  });
});

function ctxDe(sel: { id: string }): Parameters<typeof convertirARamal>[0] {
  return {
    selElement: sel,
    setSelElement: () => {},
    setContextMenuState: () => {},
  } as unknown as Parameters<typeof convertirARamal>[0];
}
