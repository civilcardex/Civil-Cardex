import { describe, it, expect } from 'vitest';
import { updateSelected } from '../PlanoEngineSelectionEdit';
import { convergirDiametroNodoPresion } from '../drawingFlow';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Redes de presión: la regla salida/entrada se RETIRÓ (sin alerta). Los trazos conectados
// en la unión toman automáticamente el MAYOR diámetro (solo suben, nunca bajan).

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    activeNet: 'af',
    tipoTramo: 'ramal',
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: 'PVC-S', diametro: '', pendiente: 2 },
    _netCounts: {
      san: { ramal: 0, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 2, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    zoom: 1,
    _hiddenNets: new Set(),
    pxToM: (px) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
  };
  return engine as IPlanoEngineCore;
}

const R = (id: string, pts: number[][], diametro: string): PlanoRamal =>
  ({
    id,
    net: 'af',
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
    labelX: pts[0][0],
    labelY: pts[0][1],
    labelAngle: 0,
    material: 'PVC-S',
    diametro,
    pendiente: 2,
    bloqueado: false,
  }) as PlanoRamal;

describe('convergencia de diámetro en nodos de presión', () => {
  it('subir el tramo arrastra al vecino de la unión (extremo con extremo)', () => {
    const eng = makeEngine([
      R(
        'RAF1',
        [
          [0, 0],
          [40, 0],
        ],
        '1"',
      ),
      R(
        'RAF2',
        [
          [40, 0],
          [80, 0],
        ],
        '3/4"',
      ),
    ]);
    eng.selId = 'RAF1';
    updateSelected(eng, { diametro: '1-1/4"' });
    expect(eng.ramales[0].diametro).toBe('1-1/4"');
    expect(eng.ramales[1].diametro).toBe('1-1/4"');
  });

  it('bajar el tramo NO baja al vecino ni alerta (nunca baja)', () => {
    const alertas: string[] = [];
    const eng = makeEngine([
      R(
        'RAF1',
        [
          [0, 0],
          [40, 0],
        ],
        '1"',
      ),
      R(
        'RAF2',
        [
          [40, 0],
          [80, 0],
        ],
        '3/4"',
      ),
    ]);
    (eng as unknown as { triggerAlert: (t: string, m: string) => void }).triggerAlert = (t) =>
      alertas.push(t);
    eng.selId = 'RAF1';
    updateSelected(eng, { diametro: '1/2"' });
    expect(eng.ramales[0].diametro).toBe('1/2"');
    expect(eng.ramales[1].diametro).toBe('3/4"');
    expect(alertas).toHaveLength(0);
  });

  it('vecino en T sobre el cuerpo también sube', () => {
    const eng = makeEngine([
      R(
        'RAF1',
        [
          [0, 0],
          [100, 0],
        ],
        '1-1/4"',
      ),
      R(
        'RAF2',
        [
          [50, 0],
          [50, 60],
        ],
        '3/4"',
      ),
    ]);
    convergirDiametroNodoPresion(eng.ramales, 'RAF1');
    expect(eng.ramales[1].diametro).toBe('1-1/4"');
  });

  it('imagen 2026-10-14: RAF2 entrante sube SOLO a RAF3 — RAF1 (paralela) intacta', () => {
    // RAF2 nace abajo y fluye HACIA la unión (entrante): subir RAF2 arrastra a la
    // continuación RAF3, jamás a RAF1 (entra a la unión por la izquierda, paralela).
    const raf1 = R(
      'RAF1',
      [
        [0, 0],
        [40, 0],
      ],
      '1/2"',
    );
    const raf3 = R(
      'RAF3',
      [
        [40, 0],
        [80, 0],
      ],
      '1/2"',
    );
    const raf2 = R(
      'RAF2',
      [
        [40, -60],
        [40, 0],
      ],
      '1/2"',
    );
    const eng = makeEngine([raf1, raf3, raf2]);
    eng.selId = 'RAF2';
    updateSelected(eng, { diametro: '3"' });
    expect(eng.ramales.find((r) => r.id === 'RAF2')!.diametro).toBe('3"');
    expect(eng.ramales.find((r) => r.id === 'RAF3')!.diametro).toBe('3"');
    expect(eng.ramales.find((r) => r.id === 'RAF1')!.diametro).toBe('1/2"');
  });

  it('entrante con _tribReversed no sube cuando sube la continuación', () => {
    // RAF2 dibujada al revés (flujo pts[last]→pts[0], _tribReversed): su origen queda en
    // (80,0) — NO recibe el destino de flujo de RAF1 → no sube con ella.
    const raf1 = R(
      'RAF1',
      [
        [0, 0],
        [40, 0],
      ],
      '1"',
    );
    const raf2 = R(
      'RAF2',
      [
        [40, 0],
        [80, 0],
      ],
      '1/2"',
    );
    raf2._tribReversed = true;
    const eng = makeEngine([raf1, raf2]);
    eng.selId = 'RAF1';
    updateSelected(eng, { diametro: '1-1/4"' });
    expect(eng.ramales.find((r) => r.id === 'RAF2')!.diametro).toBe('1/2"');
  });

  it('redes no presión (san) no convergen', () => {
    const eng = makeEngine([
      R(
        'RS1',
        [
          [0, 0],
          [40, 0],
        ],
        '4"',
      ),
      R(
        'RS2',
        [
          [40, 0],
          [80, 0],
        ],
        '2"',
      ),
    ]);
    eng.ramales.forEach((r) => {
      r.net = 'san';
    });
    expect(convergirDiametroNodoPresion(eng.ramales, 'RS1')).toBe(false);
    expect(eng.ramales[1].diametro).toBe('2"');
  });

  it('imagen usuario 2026-10-14: subir RAF1 arrastra SOLO a RAF3 — RAF2 (lateral perpendicular) intacta', () => {
    // RAF1 llega a la T (40,0); RAF2 NACE en la T y fluye hacia abajo (lateral, perpendicular);
    // RAF3 continúa colineal hacia MAF1. La convergencia sigue el sentido de los aparatos:
    // solo la continuación colineal sube — la hermana de la unión conserva su diámetro.
    const eng = makeEngine([
      R(
        'RAF1',
        [
          [0, 0],
          [40, 0],
        ],
        '1/2"',
      ),
      R(
        'RAF3',
        [
          [40, 0],
          [80, 0],
        ],
        '1/2"',
      ),
      R(
        'RAF2',
        [
          [40, 0],
          [40, -60],
        ],
        '1/2"',
      ),
    ]);
    eng.selId = 'RAF1';
    updateSelected(eng, { diametro: '3"' });
    expect(eng.ramales.find((r) => r.id === 'RAF1')!.diametro).toBe('3"');
    expect(eng.ramales.find((r) => r.id === 'RAF3')!.diametro).toBe('3"');
    expect(eng.ramales.find((r) => r.id === 'RAF2')!.diametro).toBe('1/2"');
  });

  it('continuación SIN diámetro + lateral diametrada: la lateral no sube (conteo topológico)', () => {
    // El conteo de candidatos es topológico: la continuación colineal SIN diámetro cuenta
    // igual → modo estricto → la lateral perpendicular (diametrada) conserva el suyo,
    // independiente del estado transitorio del tercer tramo.
    const eng = makeEngine([
      R(
        'RAF1',
        [
          [0, 0],
          [40, 0],
        ],
        '1/2"',
      ),
      R(
        'RAF3',
        [
          [40, 0],
          [80, 0],
        ],
        '',
      ), // continuación colineal, SIN diámetro aún
      R(
        'RAF2',
        [
          [40, 0],
          [40, -60],
        ],
        '1/2"',
      ), // lateral perpendicular diametrada
    ]);
    eng.selId = 'RAF1';
    updateSelected(eng, { diametro: '3"' });
    // El vecino sin diámetro no recibe push (oIn<=0 salta) — el pin es la LATERAL: no sube
    // aunque sea la única "elegible" diametrada.
    expect(eng.ramales.find((r) => r.id === 'RAF3')!.diametro).toBe('');
    expect(eng.ramales.find((r) => r.id === 'RAF2')!.diametro).toBe('1/2"');
  });

  it('downstream autocreado (mergesFrom) converge aunque doble en ángulo en la unión', () => {
    // La continuación nacida del split de mi cuerpo me lista en mergesFrom: sube aunque
    // el tramo doble 90° en la unión (misma regla de esContinuacion en aparatosPresion).
    const eng = makeEngine([
      R(
        'RAF1',
        [
          [0, 0],
          [40, 0],
        ],
        '1/2"',
      ),
      R(
        'RAF3',
        [
          [40, 0],
          [40, -60],
        ],
        '1/2"',
      ),
      R(
        'RAF2',
        [
          [40, 0],
          [80, 0],
        ],
        '1/2"',
      ),
    ]);
    (eng.ramales.find((r) => r.id === 'RAF3') as PlanoRamal).mergesFrom = ['RAF1', 'RAF2'];
    eng.selId = 'RAF1';
    updateSelected(eng, { diametro: '3"' });
    expect(eng.ramales.find((r) => r.id === 'RAF3')!.diametro).toBe('3"');
    // RAF2 colineal también sube (continuación geométrica); RAF2 perpendicular no existiría
    // aquí — la verificación de la lateral es el test anterior.
  });
  it('cascada multi-hop: subir el primero sube TODA la cadena lineal', () => {
    const eng = makeEngine([
      R(
        'RAF1',
        [
          [0, 0],
          [40, 0],
        ],
        '1"',
      ),
      R(
        'RAF4',
        [
          [40, 0],
          [80, 0],
        ],
        '3/4"',
      ),
      R(
        'RAF3',
        [
          [80, 0],
          [120, 0],
        ],
        '1/2"',
      ),
    ]);
    eng.selId = 'RAF1';
    updateSelected(eng, { diametro: '1-1/4"' });
    expect(eng.ramales.find((r) => r.id === 'RAF4')!.diametro).toBe('1-1/4"');
    expect(eng.ramales.find((r) => r.id === 'RAF3')!.diametro).toBe('1-1/4"');
  });

  it('lateral perpendicular de un salto intermedio conserva su diámetro', () => {
    const eng = makeEngine([
      R(
        'RAF1',
        [
          [0, 0],
          [40, 0],
        ],
        '1"',
      ),
      R(
        'RAF4',
        [
          [40, 0],
          [80, 0],
        ],
        '3/4"',
      ),
      R(
        'RAF3',
        [
          [80, 0],
          [120, 0],
        ],
        '1/2"',
      ),
      R(
        'RAF2',
        [
          [80, 0],
          [80, 60],
        ],
        '1/2"',
      ),
    ]);
    eng.selId = 'RAF1';
    updateSelected(eng, { diametro: '1-1/4"' });
    expect(eng.ramales.find((r) => r.id === 'RAF3')!.diametro).toBe('1-1/4"');
    expect(eng.ramales.find((r) => r.id === 'RAF2')!.diametro).toBe('1/2"');
  });
});
