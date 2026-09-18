import { describe, it, expect } from 'vitest';
import { autoDetectRamalConnections, podarReferenciasStaleDeBajantes } from '../PlanoEngineNetwork';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Regresión (orig. usuario 2026-09-18): borrar/recortar un trazo dejaba a la caja o
// bajante/montante "recordando" la asociación (recibeDeIds/alimentaIds con ids de trazos que
// ya no llegan) — Bajante completo fantasma y conteos podridos. La poda corre tras el
// auto-detect en cada _markDirty: solo sobrevive la asociación cuyo extremo SIGUE tocando.

function makeRamal(id: string, pts: number[][], fin = '', ini = ''): PlanoRamal {
  return {
    id,
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label: id,
    ini,
    fin,
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: false,
  } as PlanoRamal;
}

function makeBajante(
  id: string,
  x: number,
  y: number,
  extra: Partial<PlanoBajante> = {},
): PlanoBajante {
  return {
    id,
    code: id,
    net: 'san',
    tipo: 'caja_san',
    x,
    y,
    recibeDeIds: [],
    alimentaIds: [],
    ...extra,
  } as unknown as PlanoBajante;
}

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[]): IPlanoEngineCore {
  return {
    ramales,
    bajantes,
    nivelActual: { label: 'P1', n: 1, npt: 0 },
  } as unknown as IPlanoEngineCore;
}

describe('podarReferenciasStaleDeBajantes', () => {
  it('trazo BORRADO: la caja deja de recordarlo', () => {
    const caja = makeBajante('CAN1', 0, 0, { recibeDeIds: ['RS9'] });
    const engine = makeEngine([], [caja]);
    podarReferenciasStaleDeBajantes(engine);
    expect(caja.recibeDeIds).toEqual([]);
  });

  it('trazo RECORTADO (extremo conectado fuera): fin limpiado por auto-detect y la caja lo suelta', () => {
    // El ramal llegaba a la caja en (0,0); el borrador recortó ese extremo y el nuevo
    // extremo quedó lejos — autoDetect limpia r.fin y la poda libera la caja.
    const r = makeRamal('RS1', [
      [100, 0],
      [80, 0],
    ]);
    const caja = makeBajante('CAN1', 0, 0, { recibeDeIds: ['RS1'] });
    const engine = makeEngine([r], [caja]);
    autoDetectRamalConnections(engine);
    podarReferenciasStaleDeBajantes(engine);
    expect(r.fin).toBe('');
    expect(caja.recibeDeIds).toEqual([]);
  });

  it('asociación VÁLIDA sobrevive (extremo sigue tocando la caja)', () => {
    const r = makeRamal(
      'RS1',
      [
        [100, 0],
        [0, 0],
      ],
      'CAN1',
    );
    const caja = makeBajante('CAN1', 0, 0, { recibeDeIds: ['RS1'] });
    const engine = makeEngine([r], [caja]);
    autoDetectRamalConnections(engine);
    podarReferenciasStaleDeBajantes(engine);
    expect(r.fin).toBe('CAN1');
    expect(caja.recibeDeIds).toEqual(['RS1']);
  });

  it('montante con alimentaIds stale: id de trazo recortado fuera', () => {
    const r = makeRamal('RS1', [
      [50, 50],
      [120, 0],
    ]);
    const mont = makeBajante('M1', 0, 0, { tipo: 'montante', alimentaIds: ['RS1'] });
    const engine = makeEngine([r], [mont]);
    autoDetectRamalConnections(engine);
    podarReferenciasStaleDeBajantes(engine);
    expect(mont.alimentaIds).toEqual([]);
  });

  it('bajante desplazado entrepisos: la association sigue al fantasma desplazado', () => {
    const r = makeRamal(
      'RS1',
      [
        [100, 0],
        [40, 30],
      ],
      'BAN1',
    );
    const ban = makeBajante('BAN1', 0, 0, {
      tipo: 'bajante',
      desplazamientos: { P1: { dx: 40, dy: 30 } },
      recibeDeIds: ['RS1'],
    });
    const engine = makeEngine([r], [ban]);
    autoDetectRamalConnections(engine);
    podarReferenciasStaleDeBajantes(engine);
    expect(ban.recibeDeIds).toEqual(['RS1']);
  });

  it('canal excluido: sus recibeDeIds los maneja canalAssociation, la poda no los toca', () => {
    const canal = makeBajante('CH1', 0, 0, { tipo: 'canal', recibeDeIds: ['RS_MUERTO'] });
    const engine = makeEngine([], [canal]);
    podarReferenciasStaleDeBajantes(engine);
    expect(canal.recibeDeIds).toEqual(['RS_MUERTO']);
  });
});
