import { describe, it, expect, beforeEach } from 'vitest';
import { validateBeforeClose } from './closeValidation';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoRamal } from '../../lib/PlanoEngine/PlanoState';

// Conversión ramal↔tributario: solo cambia el tipo del trazo — la carga (aparatos en el mapa
// o fixtures en el propio elemento) debe seguir cubriendo el UC/UD del cierre (orig. usuario:
// convertir un ramal con aparatos disparaba "UC/UD pendientes" nombrando al T{n} nuevo).
function resetStorage() {
  (globalThis as unknown as { localStorage: Storage }).localStorage = (() => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, String(v)),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      key: (_i: number) => null,
      get length() {
        return m.size;
      },
    };
  })();
}
const setLS = (k: string, v: unknown) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(k, JSON.stringify(v));

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RS2',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: 'RS2',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '2"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

function makeEngine(ramales: PlanoRamal[]): PlanoEngine {
  return {
    ramales,
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    activeNet: 'san',
    _loadedPlanId: 1,
    _hiddenNets: new Set(),
  } as unknown as PlanoEngine;
}

const alertas: { title: string; msg: string }[] = [];
const onAlert = (title: string, msg: string) => alertas.push({ title, msg });

// Padre RS1 con carga propia: solo el elemento en prueba puede disparar la alerta.
const RS1 = () => R({ id: 'RS1', label: 'RS1', uc: 5 });

describe('validateBeforeClose — conversión ramal↔tributario', () => {
  beforeEach(() => {
    resetStorage();
    alertas.length = 0;
  });

  it('ramal→tributario con aparatos en el mapa (id conservado) NO dispara la alerta', () => {
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS2_1: { lv: 2 } });
    const trib = R({ tipo: 'tributario', padre: 'RS1', label: 'T1RS1' });
    const eng = makeEngine([RS1(), trib]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('tributario con aparatos como fixtures EN el elemento NO dispara la alerta', () => {
    const trib = R({
      tipo: 'tributario',
      padre: 'RS1',
      label: 'T1RS1',
      fixtures: { lv: 2 },
    });
    const eng = makeEngine([RS1(), trib]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('tributario→ramal con aparatos migrados por renameRamalId (id nuevo) NO dispara', () => {
    // convertToRamal renombra T1788→RS9 y renameRamalId migra los aparatos a la clave nueva.
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS9_1: { lv: 2 } });
    const ramal = R({ id: 'RS9', label: 'RS9', uc: 0 });
    const eng = makeEngine([RS1(), ramal]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('tributario SIN carga ninguna sí dispara (la validación sigue funcionando)', () => {
    // Geometría propia lejos de RS1: nadie con UD le descarga encima → sigue flaggeado.
    const trib = R({
      tipo: 'tributario',
      padre: 'RS1',
      label: 'T1RS1',
      pts: [
        [60, 0],
        [100, 0],
      ],
    });
    const eng = makeEngine([RS1(), trib]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(false);
    expect(alertas[0]?.title).toBe('UC/UD pendientes');
    expect(alertas[0]?.msg).toContain('T1RS1');
  });

  it('barrido de planos confirmados: trazo del tributario con aparatos en el mapa NO dispara', () => {
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS2_1: { lv: 2 } });
    setLS('civilflow_trazos_1', {
      ramales: [{ id: 'RS2', net: 'san', tipo: 'tributario', label: 'T1RS1', diametro: '2"' }],
      bajantes: [],
    });
    const trib = R({ tipo: 'tributario', padre: 'RS1', label: 'T1RS1' });
    const eng = makeEngine([RS1(), trib]);
    const planos = [{ id: 1, status: 'confirmed' }];
    expect(validateBeforeClose(eng, planos as never, onAlert)).toBe(true);
  });

  it('RS8 con aparatos en el nivel cargado: la copia stale en OTRO plan no dispara la alerta', () => {
    // Reporte usuario: RS8 con 18 UD asignadas recibía "UC/UD pendientes" porque otro plano
    // confirmado (piso replicado / trazo stale) traía el mismo id sin aparatos.
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS8_1: { sif: 2, lvm: 2, ino: 4 } });
    setLS('civilflow_trazos_2', {
      ramales: [{ id: 'RS8', net: 'san', tipo: 'ramal', label: 'RS8', diametro: '2"' }],
      bajantes: [],
    });
    const eng = makeEngine([
      R({ id: 'RS8', label: 'RS8', uc: 0, fixtures: { sif: 2, lvm: 2, ino: 4 } }),
    ]);
    const planos = [
      { id: 1, name: 'P2', status: 'confirmed' },
      { id: 2, name: 'P1', status: 'confirmed' },
    ];
    expect(validateBeforeClose(eng, planos as never, onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('copia en otro plan SIN carga y sin cobertura del engine: alerta nombrando el plano', () => {
    // RS9 existe SOLO en el trazo del plano 2 sin aparatos → alerta legítima, y ahora nombra
    // de qué plano viene el pendiente.
    setLS('civilflow_trazos_2', {
      ramales: [{ id: 'RS9', net: 'san', tipo: 'ramal', label: 'RS9', diametro: '2"' }],
      bajantes: [],
    });
    const eng = makeEngine([R({ id: 'RS8', label: 'RS8', uc: 5 })]);
    const planos = [{ id: 2, name: 'P1', status: 'confirmed' }];
    expect(validateBeforeClose(eng, planos as never, onAlert)).toBe(false);
    expect(alertas[0]?.title).toBe('UC/UD pendientes');
    expect(alertas[0]?.msg).toContain('RS9');
    expect(alertas[0]?.msg).toContain('P1');
  });

  it('receptor sin carga propia pero que RECIBE UD de un alimentador cargado: no dispara', () => {
    // Alineado con las tablas: la fila del receptor muestra la UD que le llega por el grafo —
    // no está vacía → sin aviso (orig. usuario: RS8/T2RS7 con UDs visibles recibían el aviso).
    const trib = R({
      id: 'T2RS1',
      tipo: 'tributario',
      label: 'T2RS1',
      pts: [
        [30, 30],
        [30, 0],
      ],
      fixtures: { lv: 0 },
    });
    const feeder = R({
      id: 'T1RS1',
      tipo: 'tributario',
      label: 'T1RS1',
      pts: [
        [30, 60],
        [30, 30],
      ],
      fixtures: { lv: 4 },
    });
    const eng = makeEngine([RS1(), trib, feeder]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('piso replicado: T3 de ESTE nivel con aparatos cubre la copia T3 (otro id) de otro plano', () => {
    // Escenario exacto del usuario: yee doble en P2; borrar un segmento del brazo principal;
    // T3 (id uniq de P2) tiene SIF 1 = 2 UD visibles en el panel. El plano P1 confirmado trae
    // OTRA copia con la misma etiqueta T3, id uniq distinto y sin aparatos → sin alerta.
    setLS('civilflow_aparatos_by_tramo_v2', { san_T1788abc_1: { sif: 1 } });
    setLS('civilflow_trazos_2', {
      ramales: [{ id: 'T9999xyz', tipo: 'tributario', net: 'san', label: 'T3', diametro: '2"' }],
      bajantes: [],
    });
    const t3 = R({
      id: 'T1788abc',
      tipo: 'tributario',
      label: 'T3',
      fixtures: { sif: 1 },
      pts: [
        [30, 30],
        [30, 0],
      ],
    });
    const eng = makeEngine([t3]);
    const planos = [
      { id: 1, name: 'P2', status: 'confirmed' },
      { id: 2, name: 'P1', status: 'confirmed' },
    ];
    expect(validateBeforeClose(eng, planos as never, onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('piso replicado: copia con etiqueta NO cubierta en el engine sigue alertando', () => {
    // T9 de otro plano sin cobertura por etiqueta en el nivel cargado → alerta legítima.
    setLS('civilflow_trazos_2', {
      ramales: [{ id: 'T7777abc', tipo: 'tributario', net: 'san', label: 'T9', diametro: '2"' }],
      bajantes: [],
    });
    const eng = makeEngine([
      R({
        id: 'T1788abc',
        tipo: 'tributario',
        label: 'T3',
        fixtures: { sif: 1 },
        pts: [
          [30, 30],
          [30, 0],
        ],
      }),
    ]);
    const planos = [{ id: 2, name: 'P1', status: 'confirmed' }];
    expect(validateBeforeClose(eng, planos as never, onAlert)).toBe(false);
    expect(alertas[0]?.msg).toContain('T9');
    expect(alertas[0]?.msg).toContain('P1');
  });
});

// Validación GLOBAL (orig. usuario): los pisos NO cargados también bloquean el cierre —
// diámetros pendientes y bajante con diámetro menor al de su ramal, en cualquier piso.
describe('validateBeforeClose — validación global multi-piso', () => {
  beforeEach(() => {
    resetStorage();
    alertas.length = 0;
  });

  const planos2 = [
    { id: 1, nivel: 1, name: 'P1', status: 'confirmed' },
    { id: 2, nivel: 2, name: 'P2', status: 'confirmed' },
  ] as unknown as Parameters<typeof validateBeforeClose>[1];

  it('ramal sin diámetro en OTRO piso bloquea el cierre (con prefijo de piso)', () => {
    setLS('civilflow_trazos_2', {
      ramales: [{ id: 'RS9', net: 'san', tipo: 'ramal', label: 'RS9', diametro: '', uc: 5 }],
      bajantes: [],
    });
    const ok = validateBeforeClose(makeEngine([RS1()]), planos2, onAlert);
    expect(ok).toBe(false);
    expect(
      alertas.some((a) => a.title === 'Diámetros pendientes' && a.msg.includes('Piso 2')),
    ).toBe(true);
  });

  it('bajante con diámetro menor que su ramal en OTRO piso bloquea el cierre', () => {
    setLS('civilflow_trazos_2', {
      ramales: [{ id: 'RS9', net: 'san', tipo: 'ramal', label: 'RS9', diametro: '4"', uc: 5 }],
      bajantes: [
        {
          id: 'BAN9',
          net: 'san',
          tipo: 'bajante',
          code: 'BAN9',
          dNominal: '2"',
          recibeDeIds: ['RS9'],
        },
      ],
    });
    const ok = validateBeforeClose(makeEngine([RS1()]), planos2, onAlert);
    expect(ok).toBe(false);
    expect(alertas.some((a) => a.title === 'Diámetro no permitido')).toBe(true);
  });

  it('otro piso completo → cierre permitido', () => {
    setLS('civilflow_trazos_2', {
      ramales: [{ id: 'RS9', net: 'san', tipo: 'ramal', label: 'RS9', diametro: '4"', uc: 5 }],
      bajantes: [
        {
          id: 'BAN9',
          net: 'san',
          tipo: 'bajante',
          code: 'BAN9',
          dNominal: '4"',
          recibeDeIds: ['RS9'],
        },
      ],
    });
    expect(validateBeforeClose(makeEngine([RS1()]), planos2, onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });
});

describe('validateBeforeClose — receptores con UD autosumada por flujo', () => {
  beforeEach(() => {
    resetStorage();
    alertas.length = 0;
  });

  it('cadena transitiva T(con aparato)→RS1→RS2: ni RS1 ni RS2 disparan la alerta', () => {
    const t1 = R({
      id: 'T1RS1',
      label: 'T1RS1',
      tipo: 'tributario',
      aparatoFin: 'lav',
      pts: [
        [0, 0],
        [20, 0],
      ],
    });
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [20, 0],
        [60, 0],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [60, 0],
        [100, 0],
      ],
    });
    const eng = makeEngine([t1, rs1, rs2]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('alimentador dibujado al revés (descarga por pts[0]) también cubre al receptor', () => {
    // RS1 con carga propia (uc) pero dibujado de derecha a izquierda: su descarga cae en
    // pts[0]=[40,0]; el chequeo direccional viejo miraba el último punto y marcaba a RS2.
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      uc: 5,
      pts: [
        [40, 0],
        [0, 0],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [60, 0],
        [40, 0],
      ],
    });
    const eng = makeEngine([rs1, rs2]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('un tramo verdaderamente huérfano (sin carga ni alimentador) sigue disparando', () => {
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      uc: 5,
      pts: [
        [0, 0],
        [20, 0],
      ],
    });
    const islas = R({
      id: 'RS9',
      label: 'RS9',
      pts: [
        [500, 500],
        [540, 500],
      ],
    });
    const eng = makeEngine([rs1, islas]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(false);
    expect(alertas[0]?.title).toBe('UC/UD pendientes');
    expect(alertas[0]?.msg).toContain('RS9');
  });
});

describe('validateBeforeClose — salidas y herencia con UD autoasignada', () => {
  beforeEach(() => {
    resetStorage();
    alertas.length = 0;
  });

  const makeEngineConBajantes = (ramales: PlanoRamal[], bajantes: unknown[]) =>
    ({
      ...makeEngine(ramales),
      bajantes,
    }) as unknown as Parameters<typeof validateBeforeClose>[0];
  const BAN2 = (o = {}) => ({
    net: 'san',
    id: 'BAN2',
    code: 'BAN2',
    tipo: 'bajante',
    dNominal: '4"',
    recibeDeIds: ['RS1'],
    ...o,
  });
  // Salida sin nada propio: nace lejos de RS1 para no heredar por flujo.
  const RS7 = (o = {}) =>
    R({
      id: 'RS7',
      label: 'RS7',
      pts: [
        [500, 0],
        [540, 0],
      ],
      ...o,
    });

  it('salida por alimentaIds sin conteos propios pasa (espejo de solo lectura)', () => {
    const eng = makeEngineConBajantes([RS1(), RS7()], [BAN2({ alimentaIds: ['RS7'] })]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('salida por ini = código sin alimentaIds pasa', () => {
    const eng = makeEngineConBajantes([RS1(), RS7({ ini: 'BAN2' })], [BAN2({})]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('ramal en libro de herencia (ucAplicado) sin conteos pasa', () => {
    const eng = makeEngineConBajantes([RS1(), RS7()], [BAN2({ ucAplicado: { RS7: { san: 2 } } })]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('ini a código INEXISTENTE no exime (sigue disparando)', () => {
    const eng = makeEngineConBajantes([RS1(), RS7({ ini: 'BANX' })], [BAN2({})]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(false);
    expect(alertas[0]?.title).toBe('UC/UD pendientes');
    expect(alertas[0]?.msg).toContain('RS7');
  });

  it('salida en piso cacheado no cargado pasa', () => {
    setLS('civilflow_trazos_2', {
      ramales: [{ id: 'RS7', net: 'san', tipo: 'ramal', label: 'RS7', diametro: '2"' }],
      bajantes: [{ net: 'san', id: 'BAN2', code: 'BAN2', dNominal: '4"', alimentaIds: ['RS7'] }],
    });
    const eng = makeEngine([RS1()]);
    const planos = [{ id: 2, status: 'confirmed' }];
    expect(validateBeforeClose(eng, planos as never, onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });
});
