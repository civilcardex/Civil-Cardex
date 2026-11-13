import { describe, it, expect, beforeEach } from 'vitest';
import { computeWaterNetworkRows, computeHeaterNetworkTotal } from '../waterRowsCore.ts';
import { HEATER_LOSS_FACTOR } from '../waterRowsShared.ts';
import type { Tramo } from '../../context/tramosReducer.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

/**
 * Caracterización del snapshot de filas de diseño af (Agua Fria)/ac (Agua Caliente) que usan las
 * memorias (computeWaterNetworkRows): UC (Unidades de Consumo)/Q (Caudal) Hunter (metodo de
 * probabilidad de uso simultaneo), grafo de conectividad leído de los planos y presiones por
 * Hazen-Williams. Valores CONGELADOS contra el código vigente ANTES del split a waterRows/ —
 * si un número cambia sin cambio de física, el split rompió algo.
 * Ej: RS1 con 2 lavamanos (1 UC) y Q=0.116 L/s → diámetro estimado √Q ≈ 0.34.
 */

beforeEach(() => {
  localStorage.clear();
});

const DIAMS = [
  { pulg: 0.75, nominal: '3/4" RDE 11', dInt: 21 },
  { pulg: 1.25, nominal: '1 1/4" RDE 10', dInt: 35.05 },
  { pulg: 2, nominal: '2" RDE 10', dInt: 51.42 },
];
const lookup = (pulg: number) => DIAMS.find((d) => Math.abs(d.pulg - pulg) < 0.01)?.dInt ?? 0;
const plan = (id: number, nivel: number): PlanItem =>
  ({ id, file: null, name: `P${id}`, nivel, scale: 1, status: 'ok' }) as unknown as PlanItem;
const tramo = (over: Partial<Tramo> & { id: string }): Tramo =>
  ({ piso: 1, fixtures: {}, accesorios: {}, ...over }) as Tramo;

describe('computeWaterNetworkRows · caracterización', () => {
  it('red af sin planos: UC propia/Hunter por tramo aislado y presión por pmax del aparato', () => {
    const rs1 = tramo({
      id: 'RS1',
      _key: 'RS1',
      ini: 'LVM',
      fin: '',
      nSalidas: 2,
      fixtures: { lvm: 2 },
      diamDisPulg: 0.75,
      totalL: 8,
      material: 'PVC-S',
    });
    const rs2 = tramo({
      id: 'RS2',
      _key: 'RS2',
      ini: 'INO',
      fin: '',
      nSalidas: 1,
      fixtures: { san: 1 },
      diamDisPulg: 1.25,
      totalL: 12,
      material: 'PVC-S',
    });
    const rows = computeWaterNetworkRows('af', [rs1, rs2], [], [], '20', DIAMS, lookup);
    expect(rows).toHaveLength(2);
    // UC propia = parcial (sin heredados): 2 lavamanos × 0.5 = 1; 1 inodoro × 2.2 = 2.2.
    // Carga propagada: udTotal === udPropia, sin acumular subárbol.
    expect(rows[0]).toMatchObject({ id: 'RS1', udPropia: 1, udTotal: 1, K: 1, Qprob: 0.116 });
    expect(rows[1]).toMatchObject({ id: 'RS2', udPropia: 2.2, udTotal: 2.2, K: 1, Qprob: 0.2 });
    // Diámetro estimado = √Q redondeado a 2 decimales.
    expect(rows[0].diamEst).toBe(0.34);
    expect(rows[1].diamEst).toBe(0.45);
    // Sin raíz: Pin cae al pmax del aparato del ini (LVM 5.63, INO 14.1).
    expect(rows[0]).toMatchObject({ Pin: 5.63, diamDis: '3/4" RDE 11', dInt: 21, cHW: 150 });
    expect(rows[1]).toMatchObject({ Pin: 14.1, diamDis: '1 1/4" RDE 10', dInt: 35.05 });
    // Velocidad y pérdida Hazen-Williams congeladas (V = 4Q/(πD²) en m/s ×1000? — valores vigentes).
    expect(rows[0].Vmms).toBe(334.9);
    expect(rows[0].Lt).toBe(8);
    expect(rows[0].hfPct).toBe(7.62);
    expect(rows[0].hfM).toBe(0.06);
    expect(rows[0].Pfin).toBe(5.57);
    expect(rows[1].Vmms).toBe(207.3);
    expect(rows[1].hfPct).toBe(1.72);
    expect(rows[1].hfM).toBe(0.02);
    expect(rows[1].Pfin).toBe(14.08);
  });

  it('af con plan doc: bajante M1 alimenta RS1 — raíz por grado y presión padre→hijo encadenada', () => {
    const m1 = tramo({
      id: 'M1',
      _key: 'M1-1',
      ini: 'M1',
      fin: 'LVM',
      nSalidas: 3,
      fixtures: { lvm: 4 },
      diamDisPulg: 1.25,
      totalL: 12,
      material: 'PVC-S',
    });
    const rs1 = tramo({
      id: 'RS1',
      _key: 'RS1-1',
      ini: 'M1',
      fin: 'LVM',
      nSalidas: 2,
      fixtures: { lvm: 2 },
      diamDisPulg: 0.75,
      totalL: 8,
      material: 'PVC-S',
    });
    // Doc del plano 1: el ramal RS1 nace en el bajante M1 (extremo a <2 px de la caja).
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [
          {
            id: 'RS1',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [100, 100],
              [200, 200],
            ],
          },
        ],
        bajantes: [{ id: 'M1', net: 'af', tipo: 'bajante', x: 100, y: 100 }],
      }),
    );
    const rows = computeWaterNetworkRows('af', [m1, rs1], [], [plan(1, 1)], '20', DIAMS, lookup);
    expect(rows).toHaveLength(2);
    // Orden piso desc + etiqueta: M1 antes que RS1.
    expect(rows.map((r) => r.id)).toEqual(['M1', 'RS1']);
    // udTotal = carga de la clave (ya propagada), NO suma del subárbol: M1 no arrastra las 1 UC de RS1.
    expect(rows[0]).toMatchObject({ id: 'M1', udPropia: 2, udTotal: 2 });
    expect(rows[1]).toMatchObject({ id: 'RS1', udPropia: 1, udTotal: 1 });
    // Raíz por grado (sin CALENT ni isAC2 en af): el primer tramo de mayor grado — M1.
    // Su Pin viene de la acometida f1 (Pfin de la fila Contador→Montante); RS1 hereda Pfin de M1.
    expect(rows[1].Pin).toBe(rows[0].Pfin);
    expect(rows[0].Pin).toBe(19.73);
    expect(rows[0].Pfin).toBe(19.72);
    expect(rows[1].Pfin).toBe(19.66);
  });

  it('ac con calentador: raíz CALENT toma pFin×0.9 del tramo af fuente; heater total = tabla', () => {
    const calent = tramo({
      id: 'CALENT1',
      _key: 'CALENT1',
      ini: 'CALENT1',
      fin: 'M1',
      nSalidas: 2,
      fixtures: { lvm: 4 },
      diamDisPulg: 1.25,
      totalL: 3,
      material: 'PVC-S',
    });
    const m1 = tramo({
      id: 'M1',
      _key: 'M1',
      ini: 'M1',
      fin: 'LVM',
      nSalidas: 1,
      fixtures: { lvm: 2 },
      diamDisPulg: 0.75,
      totalL: 5,
      material: 'PVC-S',
    });
    // Demanda UC de la red ac tras el calentador = misma heurística de raíz que la tabla:
    // 4 lavamanos × 0.5 uc_ac = 2.
    expect(computeHeaterNetworkTotal([calent, m1], [])).toEqual({ udTotal: 2 });
    // El calentador "come" presión: la raíz ac entra con pFin del tramo af que lo alimenta × 0.9.
    const afFuente = tramo({
      id: 'AF-CALENT',
      _key: 'AF-CALENT',
      ini: 'AF1',
      fin: 'CALENT1',
      pFin: 18,
      fixtures: {},
    });
    const rows = computeWaterNetworkRows('ac', [calent, m1], [afFuente], [], '20', DIAMS, lookup);
    const rowCalent = rows.find((r) => r.id === 'CALENT1');
    const rowM1 = rows.find((r) => r.id === 'M1');
    expect(rowCalent!.Pin).toBe(18 * HEATER_LOSS_FACTOR);
    // M1 aislado (sin planos que lo conecten): ini 'M1' no es aparato → pRed 20.
    expect(rowM1!.Pin).toBe(20);
    expect(rowCalent!.udTotal).toBe(2);
    expect(rowM1!.udTotal).toBe(1);
  });

  it('af con acometida real: AC-02 toma Qaco del mapa Hunter y la raíz entra por Pfin de la fila 1', () => {
    const ac1 = tramo({
      id: 'AC-01',
      _key: 'AC-01',
      ini: 'RP',
      fin: 'CNT1',
      nSalidas: 0,
      fixtures: {},
      diamDisPulg: 0.75,
      totalL: 8,
      material: 'PVC-S',
    });
    const ac2 = tramo({
      id: 'AC-02',
      _key: 'AC-02',
      ini: 'CNT1',
      fin: 'M1',
      nSalidas: 2,
      fixtures: { lvm: 6 },
      diamDisPulg: 1.25,
      totalL: 9,
      material: 'PVC-S',
    });
    const rows = computeWaterNetworkRows('af', [ac1, ac2], [], [], '20', DIAMS, lookup);
    // AC-01 es el lado frío (RP): sin fila propia; AC-02 (CNT) es la raíz por la heurística isAC2.
    expect(rows.map((r) => r.id)).toEqual(['AC-02']);
    // Qaco = hunterQ(UC de AC-02 = 6×0.5 = 3, 2 descargas) = 0.248 — NO la fórmula del ucTotal.
    expect(rows[0].Qprob).toBe(0.248);
    expect(rows[0].diamEst).toBe(0.5);
    // La fila 1 usa la longitud real de AC-01 (8 m, sin accesorios) y su Pfin alimenta la raíz.
    expect(rows[0].Pin).toBe(19.79);
    expect(rows[0].Pfin).toBe(19.77);
    expect(rows[0].Vmms).toBe(257);
  });
});
