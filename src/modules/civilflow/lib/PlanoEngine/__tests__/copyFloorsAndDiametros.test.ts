import { describe, expect, it, beforeEach } from 'vitest';
import { copyDrawingFromPlan } from '../../../utils/copyDrawingFromPlan';
import { propagarSanDiametroAguasAbajo } from '../drawingFlow';
import { writeDiametroToDrawing } from '../../../utils/writeDiameterToDrawing';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';

/* ── Helpers motor ── */
function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    textAnnots: [],
    areas: [],
    guideLines: [],
    dims: [],
    crossFloorGhosts: [],
    selId: null,
    activeNet: 'san',
    zoom: 1,
    _loadedPlanId: 2,
    _hiddenNets: new Set(),
    _netCounts: {
      san: { ramal: 5, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    toPlane: (x, y) => ({ x, y }),
    toCvs: (x, y) => ({ x, y }),
    pxToM: (px: number) => px,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    nivelActual: { label: 'P1', n: 1, npt: 0 } as never,
  };
  return engine as IPlanoEngineCore;
}
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [10, 0],
    ],
    totalL: 0,
    label: 'R',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

/* ── Copia entre pisos ── */
function setTrazos(planId: string, data: unknown) {
  // storageService.loadFromStorage lee con el prefijo civilflow_
  localStorage.setItem('civilflow_trazos_' + planId, JSON.stringify(data));
}

describe('copiar elementos entre pisos (ítems 2/3)', () => {
  beforeEach(() => localStorage.clear());

  it('tributarios copian con numeración POR RAÍZ (como recién creados) — no contador global', () => {
    // Dos tributarios de raíces distintas: cada uno arranca en T1 de su raíz, igual que
    // allocTributaryNumber — el contador global viejo acuñaba T2RS7 para el segundo (orig.
    // usuario: etiquetas inconsistentes tras copiar).
    const eng = makeEngine([R({ id: 'RS5', label: 'RS5' }), R({ id: 'RS7', label: 'RS7' })]);
    setTrazos('1', {
      ramales: [
        {
          id: 'T1',
          net: 'san',
          tipo: 'tributario',
          padre: 'RS5',
          pts: [
            [1, 1],
            [2, 2],
          ],
          label: 'T1RS5',
        },
        {
          id: 'T2',
          net: 'san',
          tipo: 'tributario',
          padre: 'RS7',
          pts: [
            [3, 3],
            [4, 4],
          ],
          label: 'T1RS7',
        },
      ],
      bajantes: [],
    });
    const res = copyDrawingFromPlan(eng as never, '2', '1', [
      { netId: 'san', tipos: new Set(['tributario']) },
    ]);
    expect(res.copied).toBe(2);
    const labels = eng.ramales.filter((r) => r.tipo === 'tributario').map((r) => r.label);
    expect(labels).toContain('T1RS5');
    expect(labels).toContain('T1RS7');
    // Los ids de los copiados son uniqRamalId (no colisionan con nada) y quedan bloqueados.
    const copied = eng.ramales.filter((r) => r.copiaPiso);
    expect(copied).toHaveLength(2);
    expect(copied.every((r) => r.bloqueado)).toBe(true);
  });

  it('las copias quedan marcadas copiaPiso + bloqueado y limpian fantasmas que las duplican', () => {
    const eng = makeEngine([]);
    eng.crossFloorGhosts = [
      {
        id: 'BAN1',
        net: 'san',
        code: 'BAN1',
        x: 5,
        y: 5,
        dNominal: '',
        direccion: 'baja',
        piso: 'P1',
        sourcePlanId: '1',
        sourceBajanteId: 'BAN1',
      },
    ] as never;
    setTrazos('1', {
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [10, 0],
          ],
          label: 'RS1',
        },
      ],
      bajantes: [
        {
          id: 'BAN1',
          net: 'san',
          tipo: 'bajante',
          code: 'BAN1',
          x: 10,
          y: 0,
          recibeDeIds: ['RS1'],
        },
      ],
    });
    copyDrawingFromPlan(eng as never, '2', '1', [
      { netId: 'san', tipos: new Set(['ramal', 'bajante']) },
    ]);
    expect(eng.ramales.every((r) => r.copiaPiso && r.bloqueado)).toBe(true);
    expect(eng.bajantes.every((b) => b.copiaPiso)).toBe(true);
    // El fantasma del BAN1 copiado ya no existe — una sola etiqueta BAN1 en el piso.
    expect(eng.crossFloorGhosts).toHaveLength(0);
    expect(eng.bajantes.filter((b) => b.code === 'BAN1')).toHaveLength(1);
  });
});

/* ── Diámetros: propagación al mayor (ítem 11) ── */
const pulg = (r: PlanoRamal) => diamPulgFromLabel(r.diametro || '');

describe('propagación de diámetros al mayor', () => {
  it('dos tributarios llegan a un tributario: el receptor sube al mayor de los asignados', () => {
    // T1 y T2 descargan en T3 (cuerpo de T3 pasa por el destino de ambos).
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      label: 'T1',
      pts: [
        [0, -20],
        [0, -10],
      ],
      diametro: '',
    });
    const t2 = R({
      id: 'T2',
      tipo: 'tributario',
      label: 'T2',
      pts: [
        [20, -20],
        [20, -10],
      ],
      diametro: '',
    });
    const t3 = R({
      id: 'T3',
      tipo: 'tributario',
      label: 'T3',
      pts: [
        [0, -10],
        [20, -10],
        [20, 0],
      ],
      diametro: '2"',
    });
    const ramales = [t1, t2, t3];
    // El usuario asigna 4" a T1 (panel): T3 sube EN VIVO al mayor de los asignados.
    t1.diametro = '4"';
    propagarSanDiametroAguasAbajo(ramales as never, 'T1');
    expect(t3.diametro).toBe('4"');
    // T2 luego a 3": el mayor sigue siendo 4" — T3 no baja.
    t2.diametro = '3"';
    propagarSanDiametroAguasAbajo(ramales as never, 'T2');
    expect(t3.diametro).toBe('4"');
  });

  it('cadena larga trib→ramal(tronco partido)→ramal→ramal: el mayor se propaga hasta el final', () => {
    // Tronco grande partido por autospliteo en 3 piezas colineales (RS1a|RS1b|RS1c por
    // mergesFrom encadenado); dos tributarios llegan a piezas distintas.
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      label: 'T1',
      pts: [
        [0, -20],
        [0, -10],
      ],
      diametro: '',
    });
    const a = R({
      id: 'RS1a',
      label: 'RS1a',
      pts: [
        [0, -10],
        [10, 0],
      ],
      diametro: '2"',
    });
    const b = R({
      id: 'RS1b',
      label: 'RS1b',
      pts: [
        [10, 0],
        [20, 0],
      ],
      diametro: '2"',
      mergesFrom: ['RS1a', 'OLD'],
    });
    const c = R({
      id: 'RS1c',
      label: 'RS1c',
      pts: [
        [20, 0],
        [30, 0],
      ],
      diametro: '2"',
      mergesFrom: ['RS1b', 'OLD2'],
    });
    const t2 = R({
      id: 'T2',
      tipo: 'tributario',
      label: 'T2',
      pts: [
        [25, -20],
        [25, 0],
      ],
      diametro: '',
    });
    const ramales = [t1, a, b, c, t2];
    // T1 = 4": baja en RS1a → RS1a sube y el mayor continúa por b y c EN VIVO — T2 sin
    // diámetro no bloquea (regla max-de-asignados).
    t1.diametro = '4"';
    propagarSanDiametroAguasAbajo(ramales as never, 'T1');
    expect(a.diametro).toBe('4"');
    expect(b.diametro).toBe('4"');
    expect(c.diametro).toBe('4"');
    // Luego asigna 3" a T2: el mayor sigue 4" — no baja.
    t2.diametro = '3"';
    propagarSanDiametroAguasAbajo(ramales as never, 'T2');
    expect(c.diametro).toBe('4"');
    // Un ramal NUNCA alimenta a un tributario: T9 receptor de ramal no cambia.
    const tR = R({
      id: 'T9',
      tipo: 'tributario',
      label: 'T9',
      pts: [
        [100, -20],
        [100, -10],
      ],
      diametro: '2"',
    });
    const rUp2 = R({
      id: 'RS10',
      label: 'RS10',
      pts: [
        [90, -10],
        [100, -10],
      ],
      diametro: '4"',
    });
    propagarSanDiametroAguasAbajo([tR, rUp2] as never, 'RS10');
    expect(tR.diametro).toBe('2"');
  });

  it('nunca baja: receptor mayor conserva su diámetro', () => {
    const a = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [10, 0],
      ],
      diametro: '2"',
    });
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      label: 'T1',
      pts: [
        [10, 0],
        [20, 0],
      ],
      diametro: '3"',
    });
    propagarSanDiametroAguasAbajo([a, t1] as never, 'RS1');
    expect(t1.diametro).toBe('3"');
  });

  it('receptor VACÍO hereda el mayor de los llegadores (caso RS1/RS2→RS3 del usuario)', () => {
    // RS1 (4") y RS2 (2") llegan a la unión; RS3 (receptor) sin diámetro.
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [-50, 0],
        [0, 0],
      ],
      diametro: '4"',
    });
    const rs2 = R({
      id: 'RS2',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [30, 30],
        [0, 0],
      ],
      diametro: '2"',
    });
    const rs3 = R({
      id: 'RS3',
      label: 'RS3',
      pts: [
        [0, 0],
        [50, 0],
      ],
      diametro: '',
    });
    propagarSanDiametroAguasAbajo([rs1, rs2, rs3] as never, 'RS2');
    // La asignación del último llegador dispara: RS3 adopta el mayor (4") aunque estaba vacío.
    expect(rs3.diametro).toBe('4"');
    // Orden de array inverso (receptor elegido directo): mismo resultado.
    const rs1b = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [-50, 0],
        [0, 0],
      ],
      diametro: '4"',
    });
    const rs2b = R({
      id: 'RS2',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [30, 30],
        [0, 0],
      ],
      diametro: '2"',
    });
    const rs3b = R({
      id: 'RS3',
      label: 'RS3',
      pts: [
        [0, 0],
        [50, 0],
      ],
      diametro: '',
    });
    propagarSanDiametroAguasAbajo([rs3b, rs2b, rs1b] as never, 'RS2');
    expect(rs3b.diametro).toBe('4"');
  });

  it('asignación desde la TABLA de diseño propaga al receptor vacío (ruta storage)', () => {
    // La tabla escribe DIRECTO al storage (sin updateElementById): writeDiametroToDrawing debe
    // disparar propagarSanDiametroAguasAbajo sobre los datos persistidos (orig. usuario).
    localStorage.clear();
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      'civilflow_trazos_p1',
      JSON.stringify({
        ramales: [
          {
            id: 'RS1',
            net: 'san',
            tipo: 'ramal',
            pts: [
              [-50, 0],
              [0, 0],
            ],
            diametro: '',
          },
          {
            id: 'RS2',
            net: 'san',
            tipo: 'tributario',
            padre: 'RS1',
            pts: [
              [30, 30],
              [0, 0],
            ],
            diametro: '',
          },
          {
            id: 'RS3',
            net: 'san',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [50, 0],
            ],
            diametro: '',
          },
        ],
        bajantes: [],
      }),
    );
    const plans = [{ id: 'p1', status: 'confirmed' }] as unknown as Parameters<
      typeof writeDiametroToDrawing
    >[3];
    // Asignar RS1 = 4" desde la tabla: solo RS1 cambia (falta RS2).
    expect(writeDiametroToDrawing('RS1-p1', 'san', '4"', plans).ok).toBe(true);
    const read = (): Record<string, string> => {
      const data = JSON.parse(
        (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(
          'civilflow_trazos_p1',
        ) || '{}',
      ) as { ramales: Array<{ id: string; diametro?: string }> };
      return Object.fromEntries(data.ramales.map((r) => [r.id, r.diametro || '']));
    };
    expect(read().RS1).toBe('4"');
    // RS3 hereda en la primera escritura (max-de-asignados: RS1 ya aporta 4").
    expect(read().RS3).toBe('4"');
    // Asignar RS2 = 2" (último llegador faltante): el mayor sigue 4" — no baja.
    expect(writeDiametroToDrawing('RS2-p1', 'san', '2"', plans).ok).toBe(true);
    const byId = read();
    expect(byId.RS2).toBe('2"');
    expect(byId.RS3).toBe('4"');
  });

  it('datos reales del usuario: fin cruzados por split + hermano en la unión (RS1/RS2→RS3)', () => {
    // Volcado real (consola): RS1.fin="RS2", RS2.fin="RS1" (referencias cruzadas viejas del
    // split), RS3 nace en la unión con mergesFrom [RS1, RS2]. Ambos llegadores asignados,
    // RS3 vacío → debe heredar 4".
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      fin: 'RS2',
      ini: 'CSUB',
      diametro: '4"',
      pts: [
        [569.6, 1058.9],
        [636.4, 1058.9],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      label: 'RS2',
      tipo: 'ramal',
      fin: 'RS1',
      ini: 'SIF',
      diametro: '2"',
      pts: [
        [590.2, 1105.1],
        [636.4, 1058.9],
      ],
    });
    const rs3 = R({
      id: 'RS3',
      label: 'RS3',
      ini: 'RS1',
      diametro: '',
      mergesFrom: ['RS1', 'RS2'],
      pts: [
        [636.4, 1058.9],
        [691.6, 1058.9],
      ],
    });
    propagarSanDiametroAguasAbajo([rs1, rs2, rs3] as never, 'RS2');
    expect(rs3.diametro).toBe('4"');
    // El hermano RS2 no es "engullido" por RS1: conserva su propio diámetro.
    expect(rs2.diametro).toBe('2"');
  });

  it('generalizado: tributario receptor con fin cruzados SIN mergesFrom (trib→trib)', () => {
    // Misma topología que el caso real pero sobre tributarios: los fin se apuntan entre
    // participantes de la unión y no hay mergesFrom — el waiver debe ser geométrico.
    const t1 = R({
      id: 'T1',
      label: 'T1RS1',
      tipo: 'tributario',
      fin: 'T2RS1',
      ini: 'CSUB',
      diametro: '4"',
      pts: [
        [0, -20],
        [10, -10],
      ],
    });
    const t2 = R({
      id: 'T2RS1',
      label: 'T2RS1',
      tipo: 'tributario',
      fin: 'T1',
      ini: 'SIF',
      diametro: '2"',
      pts: [
        [20, -20],
        [10, -10],
      ],
    });
    const t3 = R({
      id: 'T3RS1',
      label: 'T3RS1',
      tipo: 'tributario',
      ini: 'T1',
      diametro: '',
      pts: [
        [10, -10],
        [20, 0],
      ],
    });
    propagarSanDiametroAguasAbajo([t1, t2, t3] as never, 'T2RS1');
    expect(t3.diametro).toBe('4"');
    expect(t2.diametro).toBe('2"');
  });

  it('generalizado: ramal receptor con llegadores trib+ramal y fin cruzados sin mergesFrom', () => {
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      fin: 'T1RS1',
      ini: 'CSUB',
      diametro: '4"',
      pts: [
        [-50, 0],
        [0, 0],
      ],
    });
    const t1 = R({
      id: 'T1RS1',
      label: 'T1RS1',
      tipo: 'tributario',
      fin: 'RS1',
      ini: 'SIF',
      diametro: '2"',
      pts: [
        [30, 30],
        [0, 0],
      ],
    });
    const rs3 = R({
      id: 'RS3',
      label: 'RS3',
      ini: 'RS1',
      diametro: '',
      pts: [
        [0, 0],
        [50, 0],
      ],
    });
    propagarSanDiametroAguasAbajo([rs1, t1, rs3] as never, 'RS1');
    expect(rs3.diametro).toBe('4"');
    expect(t1.diametro).toBe('2"');
  });

  it('fin hacia un elemento REMOTO sigue excluyendo (co-sumidero real)', () => {
    // T1 declara fin hacia RS9, que está en OTRO lugar: su descarga NO es para T2.
    const t1 = R({
      id: 'T1',
      label: 'T1',
      tipo: 'tributario',
      fin: 'RS9',
      diametro: '4"',
      pts: [
        [0, -20],
        [10, -10],
      ],
    });
    const t2 = R({
      id: 'T2',
      label: 'T2',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [10, -10],
        [20, 0],
      ],
    });
    const rs9 = R({
      id: 'RS9',
      label: 'RS9',
      diametro: '2"',
      pts: [
        [200, 200],
        [300, 200],
      ],
    });
    propagarSanDiametroAguasAbajo([t1, t2, rs9] as never, 'T1');
    expect(t2.diametro).toBe('2"');
  });

  it('maraña real (volcado RS8): tronco T6→T1→T2→T4→RS8 se llena aunque T6 no tenga diámetro', () => {
    // Cadena vertical real: T7(2") y T9(2") llegan a T1; T6 (tronco inicial SIN diámetro y SIN
    // llegadores) también llega a la unión T1/T2; T4→RS8 con RS9(4") llegando a RS8.
    // Con la compuerta estricta, T6 (que nunca se autoasigna) congelaba toda la cadena.
    const t7 = R({
      id: 'T7',
      tipo: 'tributario',
      fin: 'T7',
      diametro: '2"',
      pts: [
        [572.3, 716.9],
        [572.3, 769.3],
      ],
    });
    const t9 = R({
      id: 'T9',
      tipo: 'tributario',
      fin: 'T9',
      diametro: '2"',
      pts: [
        [534.8, 731.8],
        [572.3, 769.3],
      ],
    });
    const t6 = R({
      id: 'T6',
      tipo: 'tributario',
      fin: 'T6',
      diametro: '',
      pts: [
        [594.9, 680.2],
        [594.9, 791.9],
      ],
    });
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      fin: 'T1',
      diametro: '',
      pts: [
        [572.3, 769.3],
        [594.9, 791.9],
      ],
    });
    const t2 = R({
      id: 'T2',
      tipo: 'tributario',
      fin: 'T2',
      diametro: '',
      pts: [
        [594.9, 791.9],
        [594.9, 857.6],
      ],
    });
    const t4 = R({
      id: 'T4',
      tipo: 'tributario',
      fin: 'RS8',
      diametro: '',
      pts: [
        [594.9, 857.6],
        [594.9, 915.9],
      ],
    });
    const rs9 = R({
      id: 'RS9',
      label: 'RS9',
      diametro: '4"',
      pts: [
        [460.1, 781.1],
        [594.9, 915.9],
      ],
    });
    const rs8 = R({
      id: 'RS8',
      label: 'RS8',
      diametro: '',
      ini: 'RS9',
      pts: [
        [594.9, 915.9],
        [634.0, 955.0],
        [634.0, 1168.7],
      ],
    });
    const ramales = [t7, t9, t6, t1, t2, t4, rs9, rs8];
    // El usuario asigna T7 (lateral): la cadena completa se llena EN VIVO.
    propagarSanDiametroAguasAbajo(ramales as never, 'T7');
    expect(t1.diametro).toBe('2"');
    expect(t2.diametro).toBe('2"');
    expect(t4.diametro).toBe('2"');
    // RS8 recibe también a RS9 (4"): toma el MAYOR.
    expect(rs8.diametro).toBe('4"');
    // T6 (sin llegadores) permanece como está — el usuario lo asigna a mano.
    expect(t6.diametro).toBe('');
    // Al asignar T6 = 3": T6 descarga en la unión donde NACE T2 → receptor = T2, que toma el
    // mayor de SUS llegadores (T1 2", T6 3") = 3". T4 lo sigue. RS8 se sostiene en 4" (RS9).
    t6.diametro = '3"';
    propagarSanDiametroAguasAbajo(ramales as never, 'T6');
    expect(t2.diametro).toBe('3"');
    expect(t4.diametro).toBe('3"');
    expect(rs8.diametro).toBe('4"');
    expect(t1.diametro).toBe('2"');
  });

  it('ciclo trib→trib converge (sin colgarse ni alternar)', () => {
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      label: 'T1',
      pts: [
        [0, 0],
        [10, 0],
      ],
      diametro: '4"',
    });
    const t2 = R({
      id: 'T2',
      tipo: 'tributario',
      label: 'T2',
      pts: [
        [10, 0],
        [0, 0],
      ],
      diametro: '2"',
    });
    propagarSanDiametroAguasAbajo([t1, t2] as never, 'T1');
    expect(pulg(t1)).toBe(4);
    expect(pulg(t2)).toBe(4);
  });
});
