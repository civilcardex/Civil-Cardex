import { describe, it, expect, beforeEach } from 'vitest';
import { applyBajanteAssociation } from '../bajanteAssociationApply';
import { clearBajanteAssociation } from '../bajanteAssociationLimpia.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoEstado.ts';
import { TRAZOS_PREFIX } from '../../constants/almacenamientoClaves.ts';

/**
 * El Ldesvio (LD, ramal en L) que conecta el fantasma con el original debe quedar registrado como ramal asociado: recibeDeIds + asocManual + fin.
 * Ej: asociar BAN1 -> el original lista el LD y el panel muestra "Ramal asociado" marcado; desasociar lo saca.
 */
const PLANS = [
  { id: '1', name: 'P1', nivel: 0, npt: 0, status: 'confirmed' },
  { id: '2', name: 'P2', nivel: 1, npt: 320, status: 'confirmed' },
] as never[];

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'san',
    tipoTramo: 'ramal',
    _loadedPlanId: loadedPlanId,
    nivelActual: { label: 'P2', n: 1, npt: 320 } as never,
    scaleM: 0.5,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    updateElementById: () => {},
  };
  return engine as IPlanoEngineCore;
}

function doc(planId: string): {
  bajantes?: Array<Record<string, unknown>>;
  ramales?: Array<Record<string, unknown>>;
} {
  return JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + planId) || '{}');
}

const SRC = {
  planId: '2',
  id: 'BAN1',
  x: 0,
  y: 0,
  net: 'san',
  dNominal: '4"',
  code: 'BAN1',
  nivelN: 1,
  npt: 320,
  tipo: 'bajante',
};
const TGT = {
  planId: '1',
  id: 'BAN2',
  x: 60,
  y: 60,
  net: 'san',
  dNominal: '4"',
  code: 'BAN2',
  nivelN: 0,
  npt: 0,
  tipo: 'bajante',
};

function seed(tipo: 'bajante' | 'montante'): void {
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [],
      bajantes: [{ id: 'BAN1', code: 'BAN1', net: 'san', tipo, x: 0, y: 0, dNominal: '4"' }],
    }),
  );
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      ramales: [],
      bajantes: [{ id: 'BAN2', code: 'BAN2', net: 'san', tipo, x: 60, y: 60, dNominal: '4"' }],
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('el desvío en L queda como RAMAL ASOCIADO real del elemento', () => {
  it('bajante: el original registra el LD en recibeDeIds + asocManual y el LD apunta a su código', () => {
    seed('bajante');
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      code: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      dNominal: '4"',
    } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);

    const d1 = doc('1');
    const ld = (d1.ramales || []).find((r) => String(r.id).startsWith('LD_'));
    expect(ld).toBeDefined();
    const ldId = String(ld!.id);
    const b2 = (d1.bajantes || []).find((b) => b.id === 'BAN2') as Record<string, unknown>;
    // Estado REAL: el panel y el menú leen estas listas → "Ramal asociado" marcado.
    expect(b2.recibeDeIds).toContain(ldId);
    expect(b2.asocManual).toContain(ldId);
    // El LD LLEGA al original: su `fin` es el código del bajante.
    expect(ld!.fin).toBe('BAN2');
  });

  it('montante: mismo criterio que el bajante (misma lógica de asociación)', () => {
    seed('montante');
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      code: 'BAN1',
      net: 'san',
      tipo: 'montante',
      x: 0,
      y: 0,
      dNominal: '4"',
    } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);

    const d1 = doc('1');
    const ld = (d1.ramales || []).find((r) => String(r.id).startsWith('LD_'));
    expect(ld).toBeDefined();
    const ldId = String(ld!.id);
    const b2 = (d1.bajantes || []).find((b) => b.id === 'BAN2') as Record<string, unknown>;
    expect(b2.recibeDeIds).toContain(ldId);
    expect(b2.asocManual).toContain(ldId);
    expect(ld!.fin).toBe('BAN2');
  });

  it('desasociar: el LD sale de las listas (no queda un ramal fantasma asociado)', () => {
    seed('bajante');
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      code: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      dNominal: '4"',
    } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);
    const ldId = String(
      (doc('1').ramales || []).find((r) => String(r.id).startsWith('LD_'))?.id || '',
    );
    expect(ldId).not.toBe('');

    clearBajanteAssociation(eng, '2', 'BAN1', 'san', '1|BAN2', PLANS);

    const d1 = doc('1');
    const b2 = (d1.bajantes || []).find((b) => b.id === 'BAN2') as Record<string, unknown>;
    expect((b2.recibeDeIds as string[]) || []).not.toContain(ldId);
    expect((b2.asocManual as string[]) || []).not.toContain(ldId);
  });
});
