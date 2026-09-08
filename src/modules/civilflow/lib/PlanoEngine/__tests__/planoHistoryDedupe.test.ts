import { describe, it, expect } from 'vitest';
import { PlanoHistory } from '../PlanoHistory';
import { APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Causa raíz "Ctrl+Z no quita el aparato del paso inmediato": updateElementById marca dirty
// internamente Y el caller marca al final → DOS snapshots para una acción. El primer Ctrl+Z
// restauraba el duplicado (mismo estado, aparato incluido) y parecía no hacer nada.
// El dedupe de snapshots consecutivos idénticos deja un snapshot por acción real.

function makeCore(): IPlanoEngineCore {
  const ramal = {
    id: 'R1',
    net: 'san',
    pts: [
      [0, 0],
      [100, 0],
    ],
    aparatoFin: '',
  } as unknown as PlanoRamal;
  const core = {
    ramales: [ramal],
    bajantes: [],
    areas: [],
    dims: [],
    textAnnots: [],
    guideLines: [],
    crossFloorGhosts: [],
    _netCounts: {},
    activeRamal: null,
    activeArea: null,
    selId: null,
    render: () => {},
    _emitSelect: () => {},
    _onDirtyCb: null,
  };
  return core as unknown as IPlanoEngineCore;
}

function setCounts(v: string): void {
  localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, v);
}

describe('PlanoHistory — dedupe de snapshots consecutivos idénticos', () => {
  it('doble mark sin cambios intermedios: UN Ctrl+Z revierte el aparato', () => {
    const core = makeCore();
    const hist = new PlanoHistory(core);
    hist.saveSnapshot(); // S0: sin aparato
    const r = core.ramales[0];
    r.aparatoFin = 'lav';
    hist.saveSnapshot(); // mark interno de updateElementById
    hist.saveSnapshot(); // mark del caller — idéntico, debe dedupearse
    hist.undoLast();
    expect(core.ramales[0].aparatoFin).toBe('');
  });

  it('flujo panel (pausa + conteos a disco): Ctrl+Z revierte campo Y conteos', () => {
    const core = makeCore();
    const hist = new PlanoHistory(core);
    setCounts(JSON.stringify({}));
    hist.saveSnapshot(); // S0
    // Simula inc() del panel: pausa → mutación + conteos a disco → resume → mark final.
    hist.pause();
    core.ramales[0].aparatoFin = 'san';
    setCounts(JSON.stringify({ san_R1_1: { san: 1 } }));
    hist.resume();
    hist.saveSnapshot();
    hist.undoLast();
    expect(core.ramales[0].aparatoFin).toBe('');
    expect(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY)).toBe(JSON.stringify({}));
  });

  it('acciones reales distintas no se dedupean: cada Ctrl+Z revierte un paso', () => {
    const core = makeCore();
    const hist = new PlanoHistory(core);
    hist.saveSnapshot(); // S0
    core.ramales[0].aparatoFin = 'lav';
    hist.saveSnapshot(); // S1
    core.ramales[0].diametro = '4"';
    hist.saveSnapshot(); // S2
    hist.undoLast();
    expect(core.ramales[0].diametro).toBeUndefined();
    expect(core.ramales[0].aparatoFin).toBe('lav');
    hist.undoLast();
    expect(core.ramales[0].aparatoFin).toBe('');
  });

  it('redo funciona tras dedupe (doble mark + undo + redo)', () => {
    const core = makeCore();
    const hist = new PlanoHistory(core);
    hist.saveSnapshot();
    core.ramales[0].aparatoFin = 'lav';
    hist.saveSnapshot();
    hist.saveSnapshot(); // duplicado dedupeado
    hist.undoLast();
    expect(core.ramales[0].aparatoFin).toBe('');
    hist.redoLast();
    expect(core.ramales[0].aparatoFin).toBe('lav');
  });
});
