/**
 * Caracterización de las funciones PURAS centrales de bajanteAssocShared (cierre de ramales
 * aguas arriba, servidos y alineación): casos congelados que deben sobrevivir intactos al
 * split del monolito en bajanteAssoc/. Si cambian, cambió la lógica — no el archivo.
 * Ej: R1 recibe el bajante, R2 es tributario de R1 → el cierre trae [R1, R2].
 */
import { describe, expect, it } from 'vitest';
import {
  adoptarDiametroDelSuperior,
  idsServidosPorBajante,
  isAligned,
  upstreamRamalIdsForBajante,
  type InheritPoolRamal,
} from '../bajanteAssocShared.ts';

/** El bajante de pruebas: BAN1 en (200,100), red sanitaria. */
const BAJ = { net: 'san', bajId: 'BAN1', bajX: 200, bajY: 100 };

describe('upstreamRamalIdsForBajante (cierre aguas arriba)', () => {
  it('cierre completo: recibeDeIds + tributarios por padre + mergesFrom + cadena geométrica, sin LDs ni huérfanos', () => {
    const pool: InheritPoolRamal[] = [
      // R1: cabeza sobre el bajante (entra por recibeDeIds).
      {
        id: 'R1',
        net: 'san',
        pts: [
          [100, 100],
          [200, 100],
        ],
      },
      // R2: tributario de R1 (padre) y además su cabeza cae sobre la cola de R1.
      {
        id: 'R2',
        net: 'san',
        padre: 'R1',
        pts: [
          [50, 100],
          [100, 100],
        ],
      },
      // R3: llega por recibeDeIds y trae fuentes de split (mergesFrom).
      {
        id: 'R3',
        net: 'san',
        pts: [
          [10, 0],
          [20, 0],
        ],
        mergesFrom: ['R3a', 'R3b'],
      },
      {
        id: 'R3a',
        net: 'san',
        pts: [
          [0, 0],
          [10, 0],
        ],
      },
      {
        id: 'R3b',
        net: 'san',
        pts: [
          [0, 10],
          [10, 10],
        ],
      },
      // R4: cadena extremo-con-extremo — su cabeza cae sobre la cola de R2 (tol 0.6 px).
      {
        id: 'R4',
        net: 'san',
        pts: [
          [20, 100],
          [50, 100],
        ],
      },
      // R5: conectado a nada — fuera del cierre.
      {
        id: 'R5',
        net: 'san',
        pts: [
          [500, 500],
          [510, 510],
        ],
      },
      // LD_X: ramal desvío entrepisos — jamás entra al cierre.
      {
        id: 'LD_X',
        net: 'san',
        pts: [
          [100, 200],
          [150, 200],
        ],
      },
      // Otro net — fuera del cierre.
      {
        id: 'AF1',
        net: 'af',
        pts: [
          [100, 100],
          [200, 100],
        ],
      },
    ];
    const out = upstreamRamalIdsForBajante({
      ...BAJ,
      bajCode: 'BAN1',
      recibeDeIds: ['R1', 'FANTOM', 'R3'], // FANTOM: id listado que ya no existe en el pool
      alimentaIds: [],
      pool,
    });
    expect(out.sort()).toEqual(['R1', 'R2', 'R3', 'R3a', 'R3b', 'R4']);
  });

  it('semilla geométrica: cola junto al bajante ENTRA; cola junto + cabeza lejos es ESPEJO y queda fuera', () => {
    const pool: InheritPoolRamal[] = [
      // Espejo de salida: su COLA (arranque) toca el bajante y su cabeza queda lejos → jamás fuente.
      {
        id: 'MIRROR',
        net: 'san',
        pts: [
          [200, 100],
          [150, 100],
        ],
      },
      // Fuente sin listas: su CABEZA (descarga) cae a 1 px del bajante (< GEO_TOL_BAJANTE 2.0).
      {
        id: 'SRC',
        net: 'san',
        pts: [
          [150, 100],
          [199, 100],
        ],
      },
    ];
    const out = upstreamRamalIdsForBajante({
      ...BAJ,
      recibeDeIds: [],
      alimentaIds: [],
      pool,
    });
    expect(out).toEqual(['SRC']);
  });

  it('net de presión (af): los ramales SERVIDOS (ini = código del bajante) quedan fuera del cierre', () => {
    const pool: InheritPoolRamal[] = [
      // SA nace en el montante MAC1 → le entrega su carga → excluido del cierre.
      {
        id: 'SA',
        net: 'af',
        ini: 'MAC1',
        pts: [
          [0, 0],
          [10, 0],
        ],
      },
      // RA sí entra al montante (recibeDeIds).
      {
        id: 'RA',
        net: 'af',
        pts: [
          [100, 100],
          [200, 100],
        ],
      },
    ];
    const out = upstreamRamalIdsForBajante({
      net: 'af',
      bajId: 'MAC1',
      bajCode: 'MAC1',
      bajX: 200,
      bajY: 100,
      recibeDeIds: ['RA'],
      alimentaIds: [],
      pool,
    });
    expect(out).toEqual(['RA']);
  });
});

describe('idsServidosPorBajante (lo que el bajante entrega)', () => {
  it('ini=code, asocManual y alimentaIds SÍ sirven; cabeza sobre el bajante y fin=code NO', () => {
    const pool: InheritPoolRamal[] = [
      {
        id: 'SA',
        net: 'san',
        ini: 'MAC1',
        pts: [
          [0, 0],
          [10, 0],
        ],
      },
      // SB: su cabeza toca el bajante → ENTRA al montante → no es servido.
      {
        id: 'SB',
        net: 'san',
        pts: [
          [0, 0],
          [200, 100],
        ],
      },
      {
        id: 'SC',
        net: 'san',
        pts: [
          [0, 0],
          [5, 0],
        ],
      },
      // SD: el apply marcó su fin con el código del montante → jamás servido.
      {
        id: 'SD',
        net: 'san',
        fin: 'MAC1',
        ini: 'MAC1',
        pts: [
          [0, 0],
          [3, 0],
        ],
      },
      {
        id: 'SE',
        net: 'san',
        pts: [
          [0, 0],
          [1, 0],
        ],
      },
    ];
    const servidos = idsServidosPorBajante({
      bajCode: 'MAC1',
      asocManual: ['SC'],
      alimentasIds: ['SE'],
      pool,
      x: 200,
      y: 100,
    });
    expect([...servidos].sort()).toEqual(['SA', 'SC', 'SE']);
  });
});

describe('isAligned (misma posición física entre láminas)', () => {
  it('misma lámina: < 0.5 px en ambos ejes alinea; 0.6 px ya no', () => {
    const a = { planId: 'p1', x: 100, y: 100 } as never;
    expect(isAligned(a, { planId: 'p1', x: 100, y: 100 } as never)).toBe(true);
    expect(isAligned(a, { planId: 'p1', x: 100.4, y: 100 } as never)).toBe(true);
    expect(isAligned(a, { planId: 'p1', x: 100.6, y: 100 } as never)).toBe(false);
    expect(isAligned(a, { planId: 'p1', x: 100, y: 100.7 } as never)).toBe(false);
  });
});

describe('adoptarDiametroDelSuperior (diámetro entre pisos)', () => {
  it('toma el dNominal del superior si difiere; con null o igual no toca nada', () => {
    const asociado = { dNominal: '4"' };
    expect(adoptarDiametroDelSuperior(asociado, { dNominal: '6"' })).toBe(true);
    expect(asociado.dNominal).toBe('6"');
    expect(adoptarDiametroDelSuperior(asociado, { dNominal: '6"' })).toBe(false);
    expect(adoptarDiametroDelSuperior(asociado, null)).toBe(false);
    expect(asociado.dNominal).toBe('6"');
  });
});
