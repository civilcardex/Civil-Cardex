import { describe, it, expect } from 'vitest';
import { handleSelectDown } from '../handleMouseDown';
import { selectAt } from '../PlanoEngineSelection';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Bug 1: un clic sobre el CUERPO de una rama de tee (AF) era robado por el extremo cercano de
// otro ramal (el host o un ramal ll que cruzó por casualidad): _tryRamalEndpointHit lo agarraba
// para arrastre y ensureActiveNet cambiaba la red activa a la del ramal robado (aguas lluvias si
// estaba activa), dejando la rama AF sin poder seleccionarse. El fix: si el clic está sobre el
// cuerpo (interior) de OTRO ramal, el acierto de extremo cede y selectAt decide.

function makeRamal(
  id: string,
  net: string,
  pts: number[][],
  bloqueado = true,
  labelBox?: { cx: number; cy: number; w: number; h: number; angle: number },
  mergesFrom?: [string, string],
): PlanoRamal {
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
    labelX: labelBox ? labelBox.cx : pts[0][0],
    labelY: labelBox ? labelBox.cy : pts[0][1],
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado,
    mergesFrom,
    _labelBox: labelBox ? { corners: [], ...labelBox } : undefined,
  } as PlanoRamal;
}

interface Outbox {
  activeNet: string;
  alerts: string[];
}

function makeEngine(
  ramales: PlanoRamal[],
  opts: { activeNet?: string; activeNetworks?: Set<string> } = {},
): { engine: IPlanoEngineCore; outbox: Outbox } {
  const outbox: Outbox = { activeNet: opts.activeNet ?? 'af', alerts: [] };
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    _guideStart: null,
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    _lockedNets: new Set(),
    activeNet: opts.activeNet ?? 'af',
    activeNetworks: opts.activeNetworks ?? new Set(['af']),
    tool: 'sel',
    snapMode: false,
    multiSel: [],
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    ramalDrag: null,
    ptDrag: null,
    bajDrag: null,
    ghostDrag: null,
    lblDrag: null,
    txtDrag: null,
    dimLblDrag: null,
    txtResize: null,
    areaDrag: null,
    dimDrag: null,
    multiDrag: null,
    marqueeRect: null,
    _loadedPlanId: 'plan1',
    toCvs: (px: number, py: number) => ({ x: px, y: py }),
    toPlane: (cx: number, cy: number) => ({ x: cx, y: cy }),
    mm2cvs: (mm: number) => mm * 2,
    pxToM: (px: number) => px,
    realMmToCanvasPx: (mm: number) => mm,
    snapAngle: (_x0, _y0, x1, y1) => ({ x: x1, y: y1 }),
    snapToExisting: () => null,
    getBajantesFantasma: () => [],
    render: () => {},
    scheduleRender: () => {},
    _emitSelect: () => {},
    _markDirty: () => {},
    triggerAlert: (title: string, msg: string) => {
      outbox.alerts.push(`${title}: ${msg}`);
    },
    setActiveNet: (id: string) => {
      outbox.activeNet = id;
      (engine as IPlanoEngineCore).activeNet = id;
    },
  };
  return { engine: engine as IPlanoEngineCore, outbox };
}

// Topología del bug: host AF vertical, rama tee AF saliendo de su cuerpo hacia la derecha, y un
// ramal ll cuyo EXTREMO quedó a <15px de donde el usuario clicó el cuerpo de la rama.
function teeScenario() {
  const host = makeRamal('RAF1', 'af', [
    [0, 0],
    [0, 100],
  ]);
  const tee = makeRamal('TAF1', 'af', [
    [0, 50],
    [40, 50],
  ]);
  const ll = makeRamal(
    'RLL1',
    'll',
    [
      [30, 50],
      [60, 50],
    ],
    false,
  );
  const { engine, outbox } = makeEngine([ll, tee, host], {
    activeNet: 'af',
    activeNetworks: new Set(['af', 'll']),
  });
  return { host, tee, ll, engine, outbox };
}

describe('handleSelectDown — clic sobre cuerpo de rama tee AF con extremo ll cercano', () => {
  it('selecciona la RAMA (no el ll) y NO cambia la red activa a aguas lluvias', () => {
    const { tee, engine, outbox } = teeScenario();
    handleSelectDown(engine, 20, 50);
    expect(engine.selId).toBe(tee.id);
    expect(outbox.activeNet).toBe('af');
    expect(engine.ptDrag).toBeNull();
    expect(outbox.alerts).toEqual([]);
  });

  it('clic sobre el CUERPO del host (no de la rama) sigue seleccionando el host', () => {
    const { host, engine, outbox } = teeScenario();
    handleSelectDown(engine, 0, 25);
    expect(engine.selId).toBe(host.id);
    expect(outbox.activeNet).toBe('af');
    expect(engine.ptDrag).toBeNull();
  });

  it('clic sobre extremo de ramal ll en espacio libre SIGUE agarrando el extremo y cambiando a ll (sin regresión)', () => {
    const ll = makeRamal(
      'RLL1',
      'll',
      [
        [300, 300],
        [340, 300],
      ],
      false,
    );
    const farAf = makeRamal('RAF1', 'af', [
      [0, 0],
      [0, 100],
    ]);
    const { engine, outbox } = makeEngine([ll, farAf], {
      activeNet: 'af',
      activeNetworks: new Set(['af', 'll']),
    });
    handleSelectDown(engine, 300, 300);
    expect(outbox.activeNet).toBe('ll');
    expect(engine.selId).toBe(ll.id);
    expect(engine.ptDrag).not.toBeNull();
    expect(engine.ptDrag?.id).toBe(ll.id);
  });

  it('clic en el vacío cerca de extremos NO dispara marquee si seleccionó algo', () => {
    const { tee, engine } = teeScenario();
    handleSelectDown(engine, 20, 50);
    expect(engine.selId).toBe(tee.id);
  });
});

describe('selectAt — bonus de extremo solo para el ramal cuyo CUERPO se clicó', () => {
  it('clic sobre el cuerpo de A con el extremo de B a <15px: gana A (el del cuerpo)', () => {
    const a = makeRamal('RA', 'af', [
      [0, 0],
      [0, 100],
    ]);
    // B: cuerpo en x ≥ 9 (su extremo es el punto (9,25)); el clic (4,25) está a 4px del cuerpo
    // de A (tol 6) y a 5px del extremo de B (ganaría el bonus -5 sin el gate del bodyOwner).
    const b = makeRamal(
      'RB',
      'll',
      [
        [9, 25],
        [55, 25],
      ],
      false,
    );
    const { engine } = makeEngine([a, b], {
      activeNet: 'af',
      activeNetworks: new Set(['af', 'll']),
    });
    selectAt(engine, 4, 25);
    expect(engine.selId).toBe('RA');
  });
});

// Reporte del usuario: un ramal ll que CRUZA el plano pasa justo por el punto de clic (su CUERPO
// queda debajo de la rama tee AF) — el empate 0-0 se resolvía por orden de array y podía
// seleccionar el ll y cambiar la red activa. El desempate ahora prefiere el cuerpo más corto
// (la rama insertada), determinista sin importar el orden de engine.ramales.
describe('cuerpos de ll que cruzan EXACTAMENTE el punto de clic (empate 0-0)', () => {
  function crossScenario() {
    const host = makeRamal('RAF1', 'af', [
      [0, 0],
      [0, 100],
    ]);
    const tee = makeRamal('TAF1', 'af', [
      [0, 50],
      [40, 50],
    ]);
    // ll CRUZA el clic: su cuerpo pasa por (20,50) exactamente, y es MÁS LARGO que la rama.
    const ll = makeRamal(
      'RLL1',
      'll',
      [
        [0, 50],
        [100, 50],
      ],
      false,
    );
    const { engine, outbox } = makeEngine([ll, tee, host], {
      activeNet: 'af',
      activeNetworks: new Set(['af', 'll']),
    });
    return { host, tee, ll, engine, outbox };
  }

  it('clic sobre la rama con ll cruzando debajo: gana la RAMA MÁS CORTA (tee), red intacta', () => {
    const { tee, engine, outbox } = crossScenario();
    handleSelectDown(engine, 20, 51);
    expect(engine.selId).toBe(tee.id);
    expect(outbox.activeNet).toBe('af');
    expect(engine.ptDrag).toBeNull();
  });

  it('con ll primero y tee después en el array, el resultado es el mismo (determinista)', () => {
    const { tee, engine, outbox } = crossScenario();
    engine.ramales.reverse();
    handleSelectDown(engine, 20, 51);
    expect(engine.selId).toBe(tee.id);
    expect(outbox.activeNet).toBe('af');
  });
});

// Reporte del usuario: la ETIQUETA de la rama tee quedó cerca de la unión, dentro del radio de
// un extremo de ramal ll — el clic en la etiqueta agarraba el extremo, seleccionaba el ll y
// cambiaba la red activa a aguas lluvias.
describe('clic sobre la ETIQUETA de la rama tee cerca de un extremo ll', () => {
  function labelScenario() {
    const host = makeRamal('RAF1', 'af', [
      [0, 0],
      [0, 100],
    ]);
    const tee = makeRamal(
      'TAF1',
      'af',
      [
        [0, 50],
        [40, 50],
      ],
      true,
      { cx: 36, cy: 50, w: 26, h: 10, angle: 0 },
    );
    // Extremo del ll a 8px del CENTRO de la etiqueta de la tee (28,50 vs 36,50 → d=8 < 15).
    const ll = makeRamal(
      'RLL1',
      'll',
      [
        [28, 50],
        [100, 50],
      ],
      false,
    );
    ll.labelX = 70;
    ll.labelY = 70;
    const { engine, outbox } = makeEngine([ll, tee, host], {
      activeNet: 'af',
      activeNetworks: new Set(['af', 'll']),
    });
    return { host, tee, ll, engine, outbox };
  }

  it('clic en la etiqueta de la tee: selecciona la TEE, no cambia a ll, no agarra extremo', () => {
    const { tee, engine, outbox } = labelScenario();
    handleSelectDown(engine, 36, 50);
    expect(engine.selId).toBe(tee.id);
    expect(outbox.activeNet).toBe('af');
    expect(engine.ptDrag).toBeNull();
    expect(outbox.alerts).toEqual([]);
  });

  it('clic en el mismo punto pero SIN caja de etiqueta: sigue sin robar el extremo del ll', () => {
    const host = makeRamal('RAF1', 'af', [
      [0, 0],
      [0, 100],
    ]);
    const tee = makeRamal('TAF1', 'af', [
      [0, 50],
      [40, 50],
    ]);
    const ll = makeRamal(
      'RLL1',
      'll',
      [
        [28, 50],
        [100, 50],
      ],
      false,
    );
    ll.labelX = 70;
    ll.labelY = 70;
    const { engine, outbox } = makeEngine([ll, tee, host], {
      activeNet: 'af',
      activeNetworks: new Set(['af', 'll']),
    });
    handleSelectDown(engine, 36, 50);
    // El clic está sobre el CUERPO del ll (su rama pasa por (36,50)) pero la TEE es el cuerpo
    // más corto — el desempate prefiere la rama, no el ll colector.
    expect(engine.selId).toBe(tee.id);
    expect(outbox.activeNet).toBe('af');
  });
});

// Geometría exacta del reporte con imagen: la matriz de 6" partida en RAC1/RAC3 que se
// encuentran en la unión, y la rama RAC2 de 4" que sube hasta ese punto (con un ramal ll que
// también termina ahí y cuya red está activa). La rama AF debe poder seleccionarse desde el
// cuerpo, desde la etiqueta y cerca de la unión — sin cambio de red.
describe('geometría del caso real: RAC1+RAC3 en la unión y rama vertical RAC2', () => {
  function imgScenario() {
    const rac1 = makeRamal('RAC1', 'af', [
      [0, 50],
      [60, 50],
    ]);
    const rac3 = makeRamal('RAC3', 'af', [
      [60, 50],
      [140, 50],
    ]);
    const rac2 = makeRamal(
      'RAC2',
      'af',
      [
        [60, 50],
        [60, 10],
      ],
      true,
      { cx: 45, cy: 30, w: 20, h: 10, angle: 0 },
    );
    const ll = makeRamal(
      'RLL1',
      'll',
      [
        [60, 50],
        [100, 90],
      ],
      false,
    );
    ll.labelX = 110;
    ll.labelY = 100;
    const { engine, outbox } = makeEngine([rac1, rac3, rac2, ll], {
      activeNet: 'll',
      activeNetworks: new Set(['af', 'll']),
    });
    return { rac1, rac2, rac3, ll, engine, outbox };
  }

  it('clic sobre el CUERPO de RAC2 lo selecciona y cambia a af (la red del ramal)', () => {
    const { rac2, engine, outbox } = imgScenario();
    handleSelectDown(engine, 60, 30);
    expect(engine.selId).toBe(rac2.id);
    expect(outbox.activeNet).toBe('af');
    expect(engine.ptDrag).toBeNull();
  });

  it('clic sobre la ETIQUETA de RAC2 lo selecciona (no lo roba el ll de la unión)', () => {
    const { rac2, engine, outbox } = imgScenario();
    handleSelectDown(engine, 45, 30);
    expect(engine.selId).toBe(rac2.id);
    expect(outbox.activeNet).toBe('af');
    expect(engine.ptDrag).toBeNull();
  });

  it('clic cerca de la unión (sobre el arranque de RAC2) selecciona la RAMA, no el ll', () => {
    const { rac2, engine, outbox } = imgScenario();
    handleSelectDown(engine, 60, 45);
    expect(engine.selId).toBe(rac2.id);
    expect(outbox.activeNet).toBe('af');
    expect(outbox.alerts).toEqual([]);
  });

  it('clic en el vacío lejos de todo DESELECCIONA sin cambiar la red activa', () => {
    const { engine, outbox } = imgScenario();
    engine.selId = 'RLL1';
    handleSelectDown(engine, 300, 300);
    expect(engine.selId).toBeNull();
    expect(outbox.activeNet).toBe('ll');
  });
});
describe('ramal auto-creado por tee (mergesFrom) — el "fantasma" RAF3 no roba clics de la rama real', () => {
  // Topología real de autoSplitJunctionAndSumFlow: el ramal dibujado por el usuario (AF_UP)
  // termina en la unión (60,50) y el tramo aguas abajo auto-creado (RAF3, mergesFrom) arranca
  // EXACTAMENTE en ese mismo punto y continúa hacia la derecha. El arranque de RAF3 está a
  // <15px de la etiqueta y del cuerpo corto de AF_UP, así que pre-fix cualquier clic ahí
  // agarraba el vértice de unión de RAF3 (aún "seleccionado fantasma" tras una edición de
  // diámetro) y lo seleccionaba a él en vez de al ramal real.
  function splitScenario() {
    const upstream = makeRamal(
      'AF_UP',
      'af',
      [
        [50, 50],
        [60, 50],
      ],
      false,
      { cx: 53, cy: 50, w: 14, h: 10, angle: 0 },
    );
    const downstream = makeRamal(
      'RAF3',
      'af',
      [
        [60, 50],
        [140, 50],
      ],
      true,
      { cx: 100, cy: 45, w: 22, h: 10, angle: 0 },
      ['AF_UP', 'T1'],
    );
    const { engine } = makeEngine([upstream, downstream], {
      activeNet: 'af',
      activeNetworks: new Set(['af', 'll']),
    });
    return { upstream, downstream, engine };
  }

  it('clic sobre la ETIQUETA de la rama real con el fantasma RAF3 ya seleccionado: gana la rama real', () => {
    const { upstream, engine } = splitScenario();
    engine.selId = 'RAF3';
    handleSelectDown(engine, 53, 50);
    expect(engine.selId).toBe(upstream.id);
    expect(engine.ptDrag).toBeNull();
  });

  it('clic sobre el CUERPO corto de la rama real cerca de la unión: gana la rama real', () => {
    const { upstream, engine } = splitScenario();
    engine.selId = 'RAF3';
    handleSelectDown(engine, 55, 50);
    expect(engine.selId).toBe(upstream.id);
    // El punto coincide con la Caja de la etiqueta de AF_UP (su etiqueta está en el medio del
    // segmento corto, justo en el clic): gana la etiqueta, sin arrastre — ya no lo roba el
    // vértice de unión del fantasma RAF3.
    expect(engine.ptDrag).toBeNull();
  });

  it('clic sobre el vértice de unión comparte punto: gana el extremo de la rama REAL (no RAF3)', () => {
    const { upstream, engine } = splitScenario();
    handleSelectDown(engine, 60, 50);
    expect(engine.selId).toBe(upstream.id);
    expect(engine.ptDrag).toBeNull();
  });

  it('el tramo auto-creado SIGUE siendo seleccionable desde su propio cuerpo', () => {
    const { downstream, engine } = splitScenario();
    handleSelectDown(engine, 100, 50);
    expect(engine.selId).toBe(downstream.id);
    expect(engine.ptDrag).toBeNull();
  });

  it('el tramo auto-creado NO bloqueado sigue siendo arrastrable por su extremo LIBRE', () => {
    const { downstream, engine } = splitScenario();
    downstream.bloqueado = false;
    engine.selId = 'RAF3';
    handleSelectDown(engine, 140, 50);
    expect(engine.ptDrag).not.toBeNull();
    expect(engine.ptDrag?.id).toBe(downstream.id);
    expect(engine.ptDrag?.ptIdx).toBe(1);
  });

  it('clic a 2px de la unión con el fantasma RAF3 seleccionado: gana RAF2 (extremo de la rama real)', () => {
    const { upstream, engine } = splitScenario();
    engine.selId = 'RAF3';
    handleSelectDown(engine, 61, 51);
    expect(engine.selId).toBe(upstream.id);
    expect(engine.ptDrag?.id).toBe(upstream.id);
  });

  it('deseleccionar tras elegir un elemento de OTRA red: NO vuelve a seleccionar RAF3 ni cambia a AF', () => {
    const { downstream, engine } = splitScenario();
    const llRamal = makeRamal(
      'LL1',
      'll',
      [
        [300, 300],
        [340, 300],
      ],
      false,
      { cx: 320, cy: 300, w: 14, h: 10, angle: 0 },
    );
    engine.ramales.push(llRamal);
    // Seleccionar el ramal ll — el motor cambia la red activa a ll.
    handleSelectDown(engine, 320, 300);
    expect(engine.selId).toBe('LL1');
    expect(engine.activeNet).toBe('ll');
    // Deseleccionar: clic vacío lejos de todo.
    handleSelectDown(engine, 500, 500);
    expect(engine.selId).toBeNull();
    expect(engine.activeNet).toBe('ll');
    expect(downstream.id).toBe('RAF3');
    expect(engine.selId).not.toBe('RAF3');
  });
});

describe('rama corta de tee — el cuerpo no se convierte en "extremo" (hitbox grande)', () => {
  // Ramas de tee cortas (10px de cuerpo): el radio de extremo de 15px convertía TODO el cuerpo
  // en zona de arrastre del extremo. Ahora: clic sobre el propio cuerpo a >4px del extremo =
  // selección limpia; solo ≤4px del extremo agarra el arrastre del vértice.
  function shortBranchScenario() {
    const branch = makeRamal(
      'RAF2B',
      'af',
      [
        [90, 50],
        [100, 50],
      ],
      false,
      { cx: 93, cy: 43, w: 14, h: 10, angle: 0 },
    );
    const downstream = makeRamal(
      'RAF3B',
      'af',
      [
        [100, 50],
        [180, 50],
      ],
      true,
      { cx: 140, cy: 45, w: 22, h: 10, angle: 0 },
      ['RAF1B', 'RAF2B'],
    );
    const { engine } = makeEngine([branch, downstream], {
      activeNet: 'af',
      activeNetworks: new Set(['af']),
    });
    return { branch, downstream, engine };
  }

  it('clic sobre el CUERPO de la rama corta (a 5px del extremo): selección limpia, sin arrastre', () => {
    const { branch, engine } = shortBranchScenario();
    engine.selId = 'RAF3B';
    handleSelectDown(engine, 95, 52);
    expect(engine.selId).toBe(branch.id);
    expect(engine.ptDrag).toBeNull();
  });

  it('clic sobre la ETIQUETA de la rama corta: gana la rama corta', () => {
    const { branch, engine } = shortBranchScenario();
    engine.selId = 'RAF3B';
    handleSelectDown(engine, 93, 43);
    expect(engine.selId).toBe(branch.id);
    expect(engine.ptDrag).toBeNull();
  });

  it('clic a 2px del extremo de la rama corta: SIGUE agarrando el arrastre del vértice', () => {
    const { branch, engine } = shortBranchScenario();
    engine.selId = 'RAF3B';
    handleSelectDown(engine, 99, 49);
    expect(engine.selId).toBe(branch.id);
    expect(engine.ptDrag?.id).toBe(branch.id);
    expect(engine.ptDrag?.ptIdx).toBe(1);
  });
});

describe('arrastre de vértice del ramal YA seleccionado (sin regresión)', () => {
  it('segundo clic sobre el vértice libre de la tee inicia ptDrag de la tee', () => {
    const host = makeRamal('RAF1', 'af', [
      [0, 0],
      [0, 100],
    ]);
    const tee = makeRamal(
      'TAF1',
      'af',
      [
        [0, 50],
        [40, 50],
      ],
      false,
    );
    const ll = makeRamal(
      'RLL1',
      'll',
      [
        [300, 300],
        [340, 300],
      ],
      false,
    );
    const { engine, outbox } = makeEngine([ll, tee, host], {
      activeNet: 'af',
      activeNetworks: new Set(['af', 'll']),
    });
    engine.selId = tee.id;
    handleSelectDown(engine, 40, 50);
    expect(engine.ptDrag).not.toBeNull();
    expect(engine.ptDrag?.id).toBe(tee.id);
    expect(engine.ptDrag?.ptIdx).toBe(1);
    expect(outbox.activeNet).toBe('af');
  });

  it('clic exacto sobre el vértice de unión (0,50) selecciona el HOST de forma determinista', () => {
    const { host, engine, outbox } = (() => {
      const host = makeRamal('RAF1', 'af', [
        [0, 0],
        [0, 100],
      ]);
      const tee = makeRamal('TAF1', 'af', [
        [0, 50],
        [40, 50],
      ]);
      const ll = makeRamal(
        'RLL1',
        'll',
        [
          [30, 50],
          [60, 50],
        ],
        false,
      );
      return {
        host,
        engine: makeEngine([ll, tee, host], {
          activeNet: 'af',
          activeNetworks: new Set(['af', 'll']),
        }).engine,
        outbox: makeEngine([ll, tee, host], {
          activeNet: 'af',
          activeNetworks: new Set(['af', 'll']),
        }).outbox,
      };
    })();
    handleSelectDown(engine, 0, 50);
    expect(engine.selId).toBe(host.id);
    expect(outbox.activeNet).toBe('af');
    expect(engine.ptDrag).toBeNull();
  });
});
