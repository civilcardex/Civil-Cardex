import { describe, it, expect } from 'vitest';
import { correrEspejos } from '../fixtureMirrors';
import type { EspejosArgs } from '../fixtureMirrorsTypes';
import { salidasDeBajante } from '../../fixturesStorage';
import { APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys.ts';

/**
 * REPRO del rastrillo de salidas (orig. usuario RS2-P2): el espejo escribía el agregado
 * del bajante EN la clave de un ramal ENTRANTE mal clasificado como salida. Como el
 * agregado camina recibeDeIds (y esa clave está en la caminata), cada pase sumaba otra
 * vez los aparatos del resto del grupo: RS2-P2 crecía al cambiar de piso y el Ldesvio
 * del piso inferior arrastraba el mismo grupo creciente. Con el veto entrante en
 * idsSalidasDeBajante, dos pases seguidos dejan el disco IDÉNTICO.
 */

const DISK_KEY = 'civilflow_' + APARATOS_BY_TRAMO_KEY;

function seedMundo(): void {
  localStorage.clear();
  localStorage.setItem(
    DISK_KEY,
    JSON.stringify({ san_BAN1_P2: { lav: 1 }, san_RS2_P2: { ino: 1 } }),
  );
}

const ENG = {
  _loadedPlanId: 'P2',
  zoom: 1,
  bajantes: [
    {
      id: 'BAN1',
      net: 'san',
      code: 'BAN1',
      x: 980,
      y: 320,
      alimentaIds: ['RS2'],
      recibeDeIds: ['RS2'],
    },
  ],
  ramales: [
    {
      id: 'RS2',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [690, 320],
        [975, 320],
      ],
      fin: 'BAN1',
    },
  ],
  crossFloorGhosts: [],
};

function argsSobre(): EspejosArgs {
  return {
    engineRef: { current: ENG } as never,
    loadingPlanRef: { current: false } as never,
    netId: 'san',
    planId: 'P2',
    plans: [{ id: 'P2', nivel: 2 }] as never,
    setCounts: () => {},
    setHidroData: () => {},
    // El walk del panel (agregadoBajante): lo propio del bajante + lo que llega por
    // recibeDeIds — lee el disco VIVO, igual que FixturesPanel.
    agregadoBajante: (bajId: string) => {
      const disk = JSON.parse(localStorage.getItem(DISK_KEY) || '{}');
      const baj = (ENG.bajantes as Array<{ id: string; recibeDeIds?: string[] }>).find(
        (b) => b.id === bajId,
      );
      const agg: Record<string, number> = { ...(disk[`san_${bajId}_P2`] || {}) };
      for (const rid of baj?.recibeDeIds || [])
        for (const [k, v] of Object.entries(disk[`san_${rid}_P2`] || {}))
          agg[k] = (agg[k] || 0) + (v as number);
      return agg;
    },
    exitsDeBajante: (bajId: string) => salidasDeBajante(ENG as never, bajId),
  } as never;
}

function discoDe(clave: string): Record<string, number> {
  return JSON.parse(localStorage.getItem(DISK_KEY) || '{}')[clave] || {};
}

describe('espejos de salidas: el entrante no se re-fusiona (sin rastrillo)', () => {
  it('dos pases seguidos: san_RS2_P2 queda {ino:1}, no absorbe el agregado del bajante', () => {
    seedMundo();
    correrEspejos(argsSobre());
    expect(discoDe('san_RS2_P2')).toEqual({ ino: 1 });
    correrEspejos(argsSobre());
    expect(discoDe('san_RS2_P2')).toEqual({ ino: 1 });
    expect(discoDe('san_BAN1_P2')).toEqual({ lav: 1 });
  });
});
