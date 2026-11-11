import { describe, it, expect, beforeEach } from 'vitest';
import { buildBajanteGraph } from '../buildBajanteGraph.ts';
import type { Tramo } from '../../context/tramosReducer.ts';

/**
 * El grafo de bajantes desde los planos: conecta ramales con sus bajantes (por recibeDeIds
 * explícito o por cercanía <2 px), enlaza secciones verticales de un mismo bajante y mapea
 * la ventilación a la descarga san que cubre. Ej: RS1 con recibeDeIds en BAN1 → arista
 * 'BAN1-p1' ← 'RS1-p1' y una componente conexa de ambos.
 */

beforeEach(() => {
  localStorage.clear();
});

const setDoc = (planId: string, doc: Record<string, unknown>) =>
  localStorage.setItem('civilflow_trazos_' + planId, JSON.stringify(doc));

const ramal = (over: Record<string, unknown> = {}) => ({
  id: 'RS1',
  net: 'san',
  pts: [
    [0, 0],
    [10, 0],
  ],
  label: 'RS1',
  ...over,
});

const bajante = (over: Record<string, unknown>) => ({
  id: 'BAN1',
  net: 'san',
  x: 0,
  y: 0,
  ...over,
});

const tramo = (over: Partial<Tramo>): Tramo =>
  ({ id: 'RS1', tipo: 'ramal', piso: 0, fixtures: {}, ...over }) as Tramo;

describe('buildBajanteGraph', () => {
  it('conexión EXPLÍCITA (recibeDeIds): el ramal se asigna al extremo más cercano al bajante', () => {
    setDoc('p1', {
      ramales: [ramal()],
      bajantes: [bajante({ recibeDeIds: ['RS1'] })],
    });
    const [, , , components] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], [], []);
    // grafo dirigido: 'BAN1-p1' recibe a 'RS1-p1' → componente conexa de ambos
    expect(components).toContainEqual(['BAN1-p1', 'RS1-p1']);
  });

  it('un ramal puede tener un bajante en CADA extremo: ambos se enlazan', () => {
    setDoc('p1', {
      ramales: [
        ramal({
          pts: [
            [0, 0],
            [20, 0],
          ],
        }),
      ],
      bajantes: [bajante({ id: 'B1', x: 0, y: 0 }), bajante({ id: 'B2', x: 20, y: 0 })],
    });
    const [, , , components] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], [], []);
    const comp = components.find((c) => c.length === 3)!;
    expect(comp).toContain('B1-p1');
    expect(comp).toContain('B2-p1');
    expect(comp).toContain('RS1-p1');
  });

  it('desplazamientos por piso: el bajante se busca en su posición DESPLAZADA', () => {
    setDoc('p1', {
      ramales: [
        ramal({
          pts: [
            [5, 0],
            [50, 50],
          ],
        }),
      ],
      bajantes: [bajante({ x: 0, y: 0, desplazamientos: { 'Piso 0': { dx: 5, dy: 0 } } })],
    });
    const [, , , components] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], [], []);
    expect(components).toContainEqual(['BAN1-p1', 'RS1-p1']);
  });

  it('ramal que descarga EN el bajante (descargaEnId hacia él) no se enlaza al revés', () => {
    setDoc('p1', {
      ramales: [
        ramal({
          pts: [
            [0, 0],
            [10, 0],
          ],
        }),
      ],
      bajantes: [bajante({ descargaEnId: 'p1|RS1' })],
    });
    const [, , , components] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], [], []);
    expect(components).toEqual([]); // sin aristas: cada nodo aislado no llega a formarse
  });

  it('conexión GEOMÉTRICA a otro ramal (extremo sobre el cuerpo del otro, <2 px)', () => {
    setDoc('p1', {
      ramales: [
        ramal({
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        }),
        ramal({
          id: 'RS2',
          pts: [
            [10, 0],
            [20, 0],
          ],
        }),
      ],
      bajantes: [],
    });
    const [, , , components] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], [], []);
    expect(components).toHaveLength(1);
    expect(components[0]).toHaveLength(2);
  });

  it('vent: ramal de ventilación conectado a bajante vent y mapeado al san que cubre', () => {
    setDoc('p1', {
      ramales: [
        ramal({
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        }),
        ramal({
          id: 'RV1',
          net: 'vent',
          pts: [
            [10, 0],
            [30, 0],
          ],
        }),
      ],
      bajantes: [bajante({ id: 'BAN1' }), bajante({ id: 'BV1', net: 'vent', x: 30, y: 0 })],
    });
    const [, vMap, ventDiams] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], [], []);
    // BV1 está pegado al extremo de RV1 → conectado; RV1 toca el san RS1 → vMap lo señala
    expect([...(vMap.get('BV1-p1') || [])]).toEqual(['RS1-p1']);
    // sin diamPulg ni diametro el ramal de vent no entra al mapa de diámetros
    expect(ventDiams['RV1-p1']).toBeUndefined();
  });

  it('vent: descargaEnId del ramal de vent redirige la arista al san apuntado', () => {
    setDoc('p1', {
      ramales: [
        ramal({
          id: 'RV1',
          net: 'vent',
          pts: [
            [10, 0],
            [30, 0],
          ],
          descargaEnId: 'p1|RS9',
        }),
      ],
      bajantes: [bajante({ id: 'BV1', net: 'vent', x: 30, y: 0 })],
    });
    const [, vMap] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], [], []);
    expect([...(vMap.get('BV1-p1') || [])]).toEqual(['RS9-p1']);
  });

  it('mapa de diámetros de vent: diamPulg numérico manda y el diametro "2"" se parsea', () => {
    setDoc('p1', {
      ramales: [
        ramal({
          id: 'RV1',
          net: 'vent',
          diamPulg: 3,
          pts: [
            [0, 0],
            [10, 0],
          ],
        }),
        ramal({
          id: 'RV2',
          net: 'vent',
          diametro: '2"',
          pts: [
            [50, 0],
            [60, 0],
          ],
        }),
      ],
      bajantes: [],
    });
    const [, , ventDiams] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], [], []);
    expect(ventDiams).toEqual({ 'RV1-p1': 3, 'RV2-p1': 2 });
  });

  it('secciones del mismo bajante entre pisos: el inferior alimenta al superior (por _key)', () => {
    const tramosSan = [
      tramo({ id: 'BAN1', esBajante: true, _key: 'BAN1-p0', piso: 0 }),
      tramo({ id: 'BAN1', esBajante: true, _key: 'BAN1-p1', piso: 1 }),
    ];
    const [, , , components] = buildBajanteGraph([], tramosSan, []);
    expect(components).toHaveLength(1);
    expect(components[0].toSorted()).toEqual(['BAN1-p0', 'BAN1-p1']);
  });

  it('descargaEnId de un bajante hacia un ramal del piso inferior: arista si el destino existe', () => {
    const tramosSan = [
      tramo({ id: 'RS9', tipo: 'ramal', _key: 'RS9-p0', piso: 0 }),
      tramo({ id: 'BAN1', esBajante: true, _key: 'BAN1-p0', piso: 0, descargaEnId: 'p0|RS9' }),
    ];
    const [, , , components] = buildBajanteGraph([], tramosSan, []);
    expect(components).toHaveLength(1);
    expect(components[0].toSorted()).toEqual(['BAN1-p0', 'RS9-p0']);
  });

  it('orientación de la componente: raíz = menor score (piso bajo, bajante antes que ramal)', () => {
    setDoc('p1', {
      ramales: [ramal()],
      bajantes: [bajante({ recibeDeIds: ['RS1'] })],
    });
    const tramosSan = [tramo({ _key: 'RS1-p1', piso: 1 })];
    const [orientado] = buildBajanteGraph([{ id: 'p1', nivel: 0 }], tramosSan, [
      { id: 'lvm', ud: 2 },
    ]);
    // la raíz es 'RS1-p1' (con tramo: score 110001) — 'BAN1-p1' sin tramo scorea 99999999.
    // Todo nodo dequeued crea su entrada (vacía si no tiene hijos sin visitar).
    expect(orientado).toEqual({ 'RS1-p1': ['BAN1-p1'], 'BAN1-p1': [] });
  });

  it('plans sin nivel o sin doc guardado no aportan nada', () => {
    expect(buildBajanteGraph([{ id: 'pX', nivel: null }], [], [])).toEqual([{}, new Map(), {}, []]);
    expect(buildBajanteGraph([{ id: 'pY', nivel: 0 }], [], [])).toEqual([{}, new Map(), {}, []]);
  });
});
