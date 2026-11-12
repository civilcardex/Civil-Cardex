import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

// CODO 90° AUTO EN LA ESQUINA L de rci (ped. usuario): un ramal nuevo que aterriza EXACTAMENTE
// en el extremo de otro ramal rci con dirección distinta estampa 'codo90rc' en los extremos
// libres de AMBOS — el arco de esquina se dibuja y el accesorio cuenta en filas R/T y en el
// resumen de accesorios por diámetro. Colineales (misma recta) NO son codo. Extremos ocupados
// (rociador de cabeza…) no se pisan.

function mk(id: string, net: string, pts: number[][], extra: Partial<PlanoRamal> = {}): PlanoRamal {
  return {
    id,
    net,
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    nSalidas: 1,
    material: '',
    diametro: '',
    bloqueado: false,
    ...extra,
  } as PlanoRamal;
}

function makeEngine(net: string, ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet: net,
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { [net]: { ramal: 1, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
  };
  return engine as IPlanoEngineCore;
}

describe('finishRamal — codo 90° auto en esquina L de rci', () => {
  it('ramal vertical que nace en el extremo del horizontal: ambos extremos libres reciben codo90rc', () => {
    const horizontal = mk('RRCI1', 'rci', [
      [0, 0],
      [200, 0],
    ]);
    const engine = makeEngine('rci', [horizontal]);
    engine.activeRamal = {
      net: 'rci',
      tipo: 'ramal',
      padre: null,
      pts: [
        [200, 0],
        [200, -150],
      ],
    } as never;

    finishRamal(engine);

    expect(engine.ramales).toHaveLength(2);
    const vertical = engine.ramales.find((r) => r.pts[0][0] === 200 && r.pts[0][1] === 0)!;
    expect(vertical.accesorioInicio).toBe('codo90rc');
    expect(horizontal.accesorioFin).toBe('codo90rc');
  });

  it('colineales (misma recta): NO estampa codo', () => {
    const a = mk('RRCI1', 'rci', [
      [0, 0],
      [200, 0],
    ]);
    const engine = makeEngine('rci', [a]);
    engine.activeRamal = {
      net: 'rci',
      tipo: 'ramal',
      padre: null,
      pts: [
        [200, 0],
        [400, 0],
      ],
    } as never;

    finishRamal(engine);

    const nuevo = engine.ramales[1];
    expect(nuevo.accesorioInicio).toBeUndefined();
    expect(a.accesorioFin).toBeUndefined();
  });

  it('extremo con rociador (cabeza sembrada): NO se pisa el accesorio existente', () => {
    const horizontal = mk('RRCI1', 'rci', [
      [0, 0],
      [200, 0],
    ]);
    horizontal.accesorioFin = 'rociador#2';
    const engine = makeEngine('rci', [horizontal]);
    engine.activeRamal = {
      net: 'rci',
      tipo: 'ramal',
      padre: null,
      pts: [
        [200, 0],
        [200, -150],
      ],
    } as never;

    finishRamal(engine);

    expect(horizontal.accesorioFin).toBe('rociador#2'); // intacto
    const vertical = engine.ramales[1];
    expect(vertical.accesorioInicio).toBe('codo90rc'); // el suyo sí
  });

  it('en af NO estampa (la llegada a extremo MERGEA como extensión — comportamiento intacto)', () => {
    const a = mk('RAF1', 'af', [
      [0, 0],
      [200, 0],
    ]);
    const engine = makeEngine('af', [a]);
    engine.activeRamal = {
      net: 'af',
      tipo: 'ramal',
      padre: null,
      pts: [
        [200, 0],
        [200, -150],
      ],
    } as never;

    finishRamal(engine);

    // El merge por extremo consume el trazo: un solo ramal extendido, sin codo estampado.
    expect(engine.ramales).toHaveLength(1);
    expect(a.accesorioFin).toBeUndefined();
    expect(a.pts).toHaveLength(3);
  });
});
