import { describe, it, expect, beforeEach } from 'vitest';
import { computeBajanteVentTable, maxSanRamalDiamPulg } from '../bajanteVentRows.ts';
import type { Tramo } from '../../context/tramosReducer.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

/**
 * La tabla de memoria "Bajantes de aguas negras y ventilación": UD (Unidades de Desague)
 * propias + descendientes por bajante, ramales asociados del mismo piso (sin LD_) y la
 * columna de vent (Wyly-Eaton (formula de ventilacion sanitaria) via calculateVentStack).
 * Ej: bajante con 4 UD → fila con caudal Hunter ~0.30 LPS y Manning 0.009.
 */

beforeEach(() => {
  localStorage.clear();
});

const bajanteTramo = (over: Partial<Tramo>): Tramo =>
  ({
    id: 'BAN1',
    tipo: 'bajante',
    esBajante: true,
    piso: 0,
    _key: 'BAN1-p0',
    fixtures: {},
    ...over,
  }) as Tramo;

const fila = (t: { rows: unknown[][] }, code: string) =>
  t.rows.find((r) => r[0] === code) as unknown[] | undefined;

describe('maxSanRamalDiamPulg · mayor diámetro san conectado', () => {
  const storage = {
    p1: {
      ramales: [
        { id: 'RS1', tipo: 'ramal', net: 'san', diamPulg: 2 },
        { id: 'RS2', tipo: 'ramal', net: 'san', diametro: '3"' },
        { id: 'RV1', tipo: 'ramal', net: 'vent', diamPulg: 9 },
        { id: 'RO1', tipo: 'ramal', net: 'san', _net: 'san', diamPulg: 1.5 },
      ],
    },
  };

  it('mira SOLO ramales san (net o _net) de recibeDeIds y devuelve el mayor', () => {
    expect(maxSanRamalDiamPulg(['RS1', 'RS2', 'RV1', 'RO1'], 'p1', storage)).toBe(3);
  });

  it('ids ausentes, lista vacía o plan sin datos devuelven 0', () => {
    expect(maxSanRamalDiamPulg(undefined, 'p1', storage)).toBe(0);
    expect(maxSanRamalDiamPulg([], 'p1', storage)).toBe(0);
    expect(maxSanRamalDiamPulg(['RS1'], 'pX', storage)).toBe(0);
    expect(maxSanRamalDiamPulg(['RS1'], undefined, storage)).toBe(0);
  });

  it('sin diamPulg cae al parseo del diametro por etiqueta; el desconocido no aporta', () => {
    const st = { p1: { ramales: [{ id: 'RS9', tipo: 'ramal', net: 'san', diametro: '1-1/2"' }] } };
    expect(maxSanRamalDiamPulg(['RS9', 'RSX'], 'p1', st)).toBe(1.5);
  });
});

describe('computeBajanteVentTable', () => {
  it('sin bajantes no hay tabla', () => {
    expect(computeBajanteVentTable([], [], [], [])).toBeNull();
    expect(
      computeBajanteVentTable([bajanteTramo({ net: 'vent' })], [] as PlanItem[], [], []),
    ).toBeNull();
  });

  it('un bajante con 4 UD: fila con origen/destino/UD y física de vent', () => {
    const t = bajanteTramo({
      code: 'BAN1',
      fixtures: { lvm: 2 },
      bajR: 7 / 24,
      nmaning: 0.009,
      bajDprop: 4,
      bajLong: 3,
      bajFDarcy: 0.025,
    });
    const tabla = computeBajanteVentTable(
      [t],
      [] as PlanItem[],
      [{ id: 'lvm', ud: 2 }],
      [{ n: 0 }, { n: 1 }],
    )!;
    expect(tabla.title).toBe('Bajantes de aguas negras y ventilación');
    const fila1 = fila(tabla, 'BAN1')!;
    expect(fila1[1]).toBe('P0'); // piso 0 con pisos [{n:0},{n:1}]
    expect(fila1[3]).toBe('—'); // sin doc de plano: sin ramales asociados
    expect(fila1[4]).toBe(4); // 2 lavamanos × 2 UD
    expect(fila1[5]).toBe('7/24'); // el radio del Excel
    expect(fila1[7]).toBe('0.009'); // Manning
    expect(fila1[15]).toBe('0.98'); // velocidad de aire en la tubería de vent
    expect(fila1[16]).toBe('0.025'); // fricción f
    expect(fila1[18]).toBe(3); // longitud bajante
    expect(fila1[9]).toBe('4"'); // D propuesto del tramo
    expect(fila1[10]).toEqual(expect.any(String)); // chequeo de la pila de vent
  });

  it('radio 7/24 exacto se muestra "7/24"; un radio distinto cae a "1/4" y al default 7/24 en el cálculo', () => {
    const t = bajanteTramo({ code: 'BAN1', fixtures: { lvm: 1 }, bajR: 0.2 });
    const tabla = computeBajanteVentTable(
      [t],
      [] as PlanItem[],
      [{ id: 'lvm', ud: 2 }],
      [{ n: 0 }],
    )!;
    expect(fila(tabla, 'BAN1')![5]).toBe('1/4');
  });

  it('UD = 0 en la fila y en descendientes: la columna de UD muestra "—"', () => {
    const tabla = computeBajanteVentTable(
      [bajanteTramo({ code: 'BAN1' })],
      [] as PlanItem[],
      [],
      [],
    )!;
    expect(fila(tabla, 'BAN1')![4]).toBe('—');
    expect(fila(tabla, 'BAN1')![6]).toBe('—'); // sin caudal no hay Q
    expect(fila(tabla, 'BAN1')![8]).toBe('—'); // sin Q no hay D calc
  });

  it('descargaEnId nombra el destino con el piso corto del plan apuntado', () => {
    const t = bajanteTramo({ code: 'BAN1', descargaEnId: 'p1|RS9' });
    const plans = [{ id: 'p1', nivel: 1, status: 'confirmed' }] as unknown as PlanItem[];
    const tabla = computeBajanteVentTable([t], plans, [], [{ n: 1 }])!;
    expect(fila(tabla, 'BAN1')![2]).toBe('RS9-P1');
  });

  it('los ramales asociados salen del doc del mismo piso y los LD_ (ramal desvio entrepisos) se excluyen', () => {
    localStorage.setItem(
      'civilflow_trazos_p0',
      JSON.stringify({ ramales: [{ id: 'RS1' }, { id: 'RS2' }, { id: 'LD_x' }] }),
    );
    const t = bajanteTramo({ code: 'BAN1', recibeDeIds: ['RS1', 'RS2', 'LD_x', 'RSFantasma'] });
    // el doc se lee por la lista de plans: p0 debe estar para que storageByPlan lo traiga
    const tabla = computeBajanteVentTable(
      [t],
      [{ id: 'p0', nivel: 0, status: 'confirmed' } as unknown as PlanItem],
      [],
      [],
    )!;
    expect(fila(tabla, 'BAN1')![3]).toBe('RS1, RS2');
  });

  it('los descendientes conectados suman al total del bajante (grafo del dibujo)', () => {
    localStorage.setItem(
      'civilflow_trazos_p0',
      JSON.stringify({
        ramales: [
          {
            id: 'RS1',
            net: 'san',
            pts: [
              [0, 0],
              [10, 0],
            ],
          },
        ],
        bajantes: [{ id: 'BAN1', net: 'san', x: 0, y: 0, recibeDeIds: ['RS1'] }],
      }),
    );
    const rs1 = {
      id: 'RS1',
      tipo: 'ramal',
      piso: 0,
      _key: 'RS1-p0',
      fixtures: { lvm: 2 },
    } as unknown as Tramo;
    const t = bajanteTramo({ code: 'BAN1', fixtures: { lvm: 1 } });
    const tabla = computeBajanteVentTable(
      [t, rs1],
      [{ id: 'p0', nivel: 0, status: 'confirmed' } as unknown as PlanItem],
      [{ id: 'lvm', ud: 2 }],
      [{ n: 0 }],
    )!;
    // propias 1×2 + descendiente 2×2 = 6
    expect(fila(tabla, 'BAN1')![4]).toBe(6);
  });
});
