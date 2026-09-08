import { describe, it, expect, beforeEach } from 'vitest';
import { PlanoHistory } from '../PlanoHistory';
import type { IPlanoEngineCore } from '../PlanoState';

// Ítem 1: historial ÚNICO — Ctrl+Z revierte geometría + fantasmas entre pisos + conteos de
// aparatos/accesorios (localStorage), y las operaciones compuestas dejan un solo snapshot.
function makeEngine(): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes: [],
    areas: [],
    dims: [],
    textAnnots: [],
    guideLines: [],
    crossFloorGhosts: [],
    activeRamal: null,
    activeArea: null,
    selId: null,
    _netCounts: {},
    _emitSelect: () => {},
    render: () => {},
    _onDirtyCb: null,
  };
  return engine as IPlanoEngineCore;
}

describe('ítem 1 — historial general', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('undo revierte geometría + conteos de aparatos juntos', () => {
    const eng = makeEngine();
    const h = new PlanoHistory(eng);
    (eng.ramales as unknown[]).push({ id: 'RS1' });
    h.saveSnapshot();
    (eng.ramales as unknown[]).push({ id: 'RS2' });
    localStorage.setItem('civilflow_aparatos_by_tramo_v2', JSON.stringify({ k: 1 }));
    h.saveSnapshot();
    h.undoLast();
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1']);
    expect(localStorage.getItem('civilflow_aparatos_by_tramo_v2')).toBeNull();
  });

  it('redo restaura geometría + conteos nuevos', () => {
    const eng = makeEngine();
    const h = new PlanoHistory(eng);
    h.saveSnapshot();
    (eng.ramales as unknown[]).push({ id: 'RS1' });
    localStorage.setItem('civilflow_aparatos_by_tramo_v2', JSON.stringify({ k: 1 }));
    localStorage.setItem('civilflow_tramo_hidro_data_v3', JSON.stringify({ h: 2 }));
    h.saveSnapshot();
    h.undoLast();
    expect(localStorage.getItem('civilflow_aparatos_by_tramo_v2')).toBeNull();
    h.redoLast();
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1']);
    expect(localStorage.getItem('civilflow_aparatos_by_tramo_v2')).toBe(JSON.stringify({ k: 1 }));
    expect(localStorage.getItem('civilflow_tramo_hidro_data_v3')).toBe(JSON.stringify({ h: 2 }));
  });

  it('undo revierte fantasmas entre pisos', () => {
    const eng = makeEngine();
    const h = new PlanoHistory(eng);
    h.saveSnapshot();
    (eng.crossFloorGhosts as unknown[]).push({ id: 'G1' });
    h.saveSnapshot();
    h.undoLast();
    expect(eng.crossFloorGhosts.length).toBe(0);
  });

  it('asignación de aparato (pausa + conteos + snapshot final): un Ctrl+Z la quita', () => {
    // Orden real de applyAparato/inc: pausa → writes geometría → writes conteos a disco →
    // resume + snapshot. Un solo undo debe quitar glifo Y conteo.
    const eng = makeEngine();
    const h = new PlanoHistory(eng);
    h.saveSnapshot();
    h.pause();
    (eng.ramales as unknown[]).push({ id: 'RS1', aparatoFin: 'san' });
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ san_RS1_: { san: 1 } }),
    );
    h.resume();
    h.saveSnapshot();
    h.undoLast();
    expect(eng.ramales.length).toBe(0);
    expect(localStorage.getItem('civilflow_aparatos_by_tramo_v2')).toBeNull();
  });

  it('pausa colapsa operaciones compuestas en un snapshot', () => {
    const eng = makeEngine();
    const h = new PlanoHistory(eng);
    h.saveSnapshot();
    h.pause();
    (eng.ramales as unknown[]).push({ id: 'A' });
    h.saveSnapshot();
    (eng.ramales as unknown[]).push({ id: 'B' });
    h.saveSnapshot();
    h.resume();
    h.saveSnapshot();
    // Solo 2 snapshots (inicial + final): un undo vuelve al inicio.
    h.undoLast();
    expect(eng.ramales.length).toBe(0);
  });
});
