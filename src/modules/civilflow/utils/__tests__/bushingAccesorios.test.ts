import { describe, it, expect } from 'vitest';
import { calcularBushing } from '../accessoriesTable/bushing.ts';
import type { RamalDibujo, TribDibujo, BajanteDibujo } from '../accessoriesTable/collection.ts';
import type { AddAcc } from '../accessoriesTable/counting.ts';
import type { YeeJunction } from '../accessoriesTable/yees.ts';
import type { HidroEntry } from '../sanFittingsCatalog.ts';

/**
 * El bloque bushing/auto-accesorios del resumen: conexiones ramal→bajante (Y simple/doble,
 * codos y bushing por especificación), uniones de yee san con brazos distintos y la regla
 * «Ø del punto» de gas/rci. Ej: ramal 2" a bajante 4" → Y 2"×4" + codo 90° de 4" + bushing 4_2.
 */

type Llamada = [string, string, number];

const registrar = () => {
  const calls: Llamada[] = [];
  const addAcc: AddAcc = (diam, accId, count) => calls.push([diam, accId, count]);
  return { calls, addAcc };
};

const veces = (calls: Llamada[], diam: string, accId: string) =>
  calls.filter(([d, a]) => d === diam && a === accId).reduce((s, [, , n]) => s + n, 0);

const ramal = (over: Partial<RamalDibujo> = {}): RamalDibujo =>
  ({
    id: 'RS1',
    label: 'RS1',
    diametro: '2"',
    pts: [
      [0, 0],
      [10, 0],
    ],
    planId: 'p1',
    ...over,
  }) as RamalDibujo;

const bajante = (over: Partial<BajanteDibujo> = {}): BajanteDibujo =>
  ({ id: 'BAN1', diametro: '4"', x: 0, y: 0, net: 'san', planId: 'p1', ...over }) as BajanteDibujo;

describe('calcularBushing · bajante y sus ramales conectados', () => {
  it('ramal único conectado por geometría: Y simple ramal×bajante + codo 90° del bajante + bushing', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({
      pts: [
        [0, 0],
        [-50, 0],
      ],
    }); // extremo (0,0) toca al bajante
    const { bajanteBushing, bajanteAutoPts } = calcularBushing(
      'san',
      [bajante()],
      [r],
      [],
      [],
      [],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(veces(calls, '2"×4"', 'yeeSimple')).toBe(1);
    expect(veces(calls, '4"', 'codo90rm')).toBe(1);
    expect(bajanteBushing).toEqual({ '4_2': 1 });
    expect(bajanteAutoPts).toEqual([{ x: 0, y: 0 }]);
  });

  it('codo manual en el extremo que toca al bajante: no se auto-agrega otro codo 90°', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({
      pts: [
        [0, 0],
        [-50, 0],
      ],
      accesorioInicio: 'codo90rm',
    });
    const { bajanteBushing } = calcularBushing(
      'san',
      [bajante()],
      [r],
      [],
      [],
      [],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(veces(calls, '4"', 'codo90rm')).toBe(0);
    expect(veces(calls, '2"×4"', 'yeeSimple')).toBe(1);
    expect(bajanteBushing).toEqual({ '4_2': 1 });
  });

  it('dos ramales del mismo Ø: Y doble + 2 codos 45° + UN bushing por la especificación', () => {
    const { calls, addAcc } = registrar();
    const r1 = ramal({
      id: 'RS1',
      pts: [
        [0, 0],
        [-50, 0],
      ],
    });
    const r2 = ramal({
      id: 'RS2',
      pts: [
        [0, 0],
        [50, 0],
      ],
    });
    const { bajanteBushing } = calcularBushing(
      'san',
      [bajante()],
      [r1, r2],
      [],
      [],
      [],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(veces(calls, '2"×4"', 'codo45rc')).toBe(2);
    // dato: compactYeeDiam deduplica brazos iguales → la Y doble sale "2"×4"" (no "2"×2"×4"")
    expect(veces(calls, '2"×4"', 'yeeDoble')).toBe(1);
    expect(bajanteBushing).toEqual({ '4_2': 1 });
  });

  it('dos ramales de Ø distinto: los codos 45° se cuentan, pero Y doble NO procede', () => {
    const { calls, addAcc } = registrar();
    const r1 = ramal({
      id: 'RS1',
      pts: [
        [0, 0],
        [-50, 0],
      ],
    });
    const r2 = ramal({
      id: 'RS2',
      diametro: '3"',
      pts: [
        [0, 0],
        [50, 0],
      ],
    });
    const { bajanteBushing } = calcularBushing(
      'san',
      [bajante()],
      [r1, r2],
      [],
      [],
      [],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(veces(calls, '2"×4"', 'codo45rc')).toBe(1);
    expect(veces(calls, '3"×4"', 'codo45rc')).toBe(1);
    expect(calls.filter(([, a]) => a === 'yeeDoble')).toEqual([]);
    expect(bajanteBushing).toEqual({});
  });

  it('caja y bomba: punto registrado para suprimir yees, pero CERO accesorios (orig. usuario)', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({
      pts: [
        [0, 0],
        [-50, 0],
      ],
    });
    const { bajanteBushing, bajanteAutoPts } = calcularBushing(
      'san',
      [bajante({ tipo: 'caja_san' })],
      [r],
      [],
      [],
      [],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(calls).toEqual([]);
    expect(bajanteBushing).toEqual({});
    expect(bajanteAutoPts).toEqual([{ x: 0, y: 0 }]);
  });

  it('3 o más ramales conectados: el bajante se salta (no hay pieza que lo resuelva)', () => {
    const { calls, addAcc } = registrar();
    const r1 = ramal({
      id: 'RS1',
      pts: [
        [0, 0],
        [-50, 0],
      ],
    });
    const r2 = ramal({
      id: 'RS2',
      pts: [
        [0, 0],
        [50, 0],
      ],
    });
    const r3 = ramal({
      id: 'RS3',
      pts: [
        [0, 0],
        [0, -50],
      ],
    });
    const res = calcularBushing(
      'san',
      [bajante()],
      [r1, r2, r3],
      [],
      [],
      [],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(res.bajanteAutoPts).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('ramal que no está en el dibujo cae al diámetro del índice pulgById', () => {
    const { calls, addAcc } = registrar();
    const lejos = ramal({
      id: 'OTRO',
      pts: [
        [500, 500],
        [600, 500],
      ],
    }); // no toca al bajante
    const res = calcularBushing(
      'san',
      [bajante({ recibeDeIds: ['RX'] })],
      [lejos],
      [],
      [],
      [],
      {},
      {},
      [],
      { RX: 2 },
      addAcc,
    );
    expect(veces(calls, '2"×4"', 'yeeSimple')).toBe(1);
    expect(veces(calls, '4"', 'codo90rm')).toBe(1);
    expect(res.bajanteBushing).toEqual({ '4_2': 1 });
  });

  it('unión de yee san lejos del bajante: un bushing por cada par de brazos distintos', () => {
    const { calls, addAcc } = registrar();
    const yee: YeeJunction = { x: 300, y: 300, m1: '4"', m2: '4"', branch: '2"', hostKey: 'h1' };
    const { bajanteBushing } = calcularBushing(
      'san',
      [],
      [],
      [],
      [],
      [yee],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(bajanteBushing).toEqual({ '4_2': 1 });
    expect(calls).toEqual([]); // las yees solo generan bushing, no accesorios
  });

  it('combo de yee de ventilación "4"×4"×2"": mismo bushing por pares de brazos', () => {
    const { addAcc } = registrar();
    const { bajanteBushing } = calcularBushing(
      'san',
      [],
      [],
      [],
      [],
      [],
      { v1: ['4"×4"×2"'] },
      {},
      [],
      {},
      addAcc,
    );
    expect(bajanteBushing).toEqual({ '4_2': 1 });
  });

  it('yee pegada a un bajante ya procesado: no duplica bushing', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({
      pts: [
        [0, 0],
        [-50, 0],
      ],
    });
    const yee: YeeJunction = { x: 0, y: 0, m1: '4"', m2: '4"', branch: '2"', hostKey: 'h1' };
    const { bajanteBushing } = calcularBushing(
      'san',
      [bajante()],
      [r],
      [],
      [],
      [yee],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(bajanteBushing).toEqual({ '4_2': 1 }); // solo el del bajante, no el de la yee
    expect(veces(calls, '2"×4"', 'yeeSimple')).toBe(1);
  });

  it('bajante de otra red (net distinto) no procesa aunque esté en la lista', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({
      pts: [
        [0, 0],
        [-50, 0],
      ],
    });
    const res = calcularBushing(
      'san',
      [bajante({ net: 'll' })],
      [r],
      [],
      [],
      [],
      {},
      {},
      [],
      {},
      addAcc,
    );
    expect(calls).toEqual([]);
    expect(res.bajanteAutoPts).toEqual([]);
  });
});

describe('calcularBushing · gas/rci: accesorios por Ø del punto y auto-tee', () => {
  const CATALOGO_RCI = [
    { id: 'rociador', nombre: 'Rociador' },
    { id: 'codo90rc', nombre: 'Codo corto 90°' },
  ];

  it('rci: cada rociador del hidroData lleva su tee de reducción a 1/2"', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({ id: 'R1', diametro: '1"' });
    const hidro: Record<string, HidroEntry> = { rci_R1_p1: { accesorios: { rociador: 2 } } };
    calcularBushing('rci', [], [r], [], [], [], {}, hidro, CATALOGO_RCI, {}, addAcc);
    expect(veces(calls, '1"', 'rociador')).toBe(2);
    expect(veces(calls, '1"×1/2"', 'teeDirecto')).toBe(2);
  });

  it('gas: los accesorios del hidroData se cuentan al Ø global del ramal (sin taper)', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({ id: 'G1', diametro: '1/2"' });
    const hidro: Record<string, HidroEntry> = { gas_G1_p1: { accesorios: { codos_45: 3 } } };
    calcularBushing(
      'gas',
      [],
      [r as unknown as RamalDibujo],
      [],
      [],
      [],
      {},
      hidro,
      [{ id: 'codos_45', nombre: 'Codo 45' }],
      {},
      addAcc,
    );
    expect(veces(calls, '1/2"', 'codos_45')).toBe(3);
  });

  it('rci: extremo del ramal que aterriza en el INTERIOR del host lleva 1 auto-tee (sin tee dibujada)', () => {
    const { calls, addAcc } = registrar();
    const host = ramal({
      id: 'H1',
      diametro: '1"',
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    const branch = ramal({
      id: 'B1',
      diametro: '1"',
      pts: [
        [50, 0],
        [50, 50],
      ],
    });
    calcularBushing('rci', [], [host, branch], [], [], [], {}, {}, CATALOGO_RCI, {}, addAcc);
    expect(veces(calls, '1"×1"×1"', 'teeDirecto')).toBe(1);
  });
});

describe('calcularBushing · tees y codos a mitad de cuerpo (redes sin yee: af/ac/gas)', () => {
  const CATALOGO_AF = [
    { id: 'codo90rm', nombre: 'Codo 90°' },
    { id: 'teeReduccion', nombre: 'Tee reducción' },
    { id: 'teeLado', nombre: 'Tee lado' },
  ];

  it('af: codo accMed a mitad de ramal se cuenta como "codoMedio90" aunque el glifo no se dibuje', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({
      diametro: '2"',
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      accMed: { accMed1: 'codo90rm' },
    });
    calcularBushing('af', [], [r], [], [], [], {}, {}, CATALOGO_AF, {}, addAcc);
    expect(veces(calls, '2"', 'codoMedio90')).toBe(1);
  });

  it('af: tee accMed con tributario que llega al punto → nomenclatura host×continuación×derivación', () => {
    const { calls, addAcc } = registrar();
    const host = ramal({
      diametro: '2"',
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      accMed: { accMed2: 'teeReduccion' },
    });
    const trib = ramal({
      id: 'T1',
      diametro: '3"',
      pts: [
        [100, 0],
        [100, 50],
      ],
    }) as unknown as TribDibujo;
    calcularBushing('af', [], [host], [trib], [], [], {}, {}, CATALOGO_AF, {}, addAcc);
    // derivación (trib no colineal) 3" → "2"×2"×3""
    expect(veces(calls, '2"×2"×3"', 'teeReduccion')).toBe(1);
  });

  it('af: tee en el EXTREMO del ramal (accesorioFin) sin derivación → una sola medida', () => {
    const { calls, addAcc } = registrar();
    const r = ramal({ diametro: '2"', accesorioFin: 'teeLado' });
    calcularBushing('af', [], [r], [], [], [], {}, {}, CATALOGO_AF, {}, addAcc);
    expect(veces(calls, '2"', 'teeLado')).toBe(1);
  });

  it('tributarios: sus codos accMed y tees de extremo van con una sola medida', () => {
    const { calls, addAcc } = registrar();
    const trib = {
      id: 'T1',
      label: 'T1',
      diametro: '1-1/2"',
      pts: [
        [0, 0],
        [10, 0],
      ],
      accMed: { accMed1: 'codo90rm' },
      accesorioFin: 'teeLado',
      planId: 'p1',
    } as unknown as TribDibujo;
    calcularBushing('af', [], [], [trib], [], [], {}, {}, CATALOGO_AF, {}, addAcc);
    expect(veces(calls, '1-1/2"', 'codoMedio90')).toBe(1);
    expect(veces(calls, '1-1/2"', 'teeLado')).toBe(1);
  });
});
