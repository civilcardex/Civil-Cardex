import { NETS, initNetCounts } from './PlanoState';

export interface PlanoWorkData {
  v: number;
  ts?: number;
  scaleM: number;
  definedScaleM: number;
  activeNet: string;
  zoom: number;
  offX: number;
  offY: number;
  nets: { id: string; col: string }[];
  ramales: unknown[];
  dims: unknown[];
  textAnnots: unknown[];
  bajantes: unknown[];
  areas: unknown[];
  nptLevels: unknown[];
}

export function serializeWork(engine: {
  scaleM: number;
  definedScaleM: number;
  activeNet: string;
  zoom: number;
  offX: number;
  offY: number;
  ramales: unknown[];
  dims: unknown[];
  textAnnots: unknown[];
  bajantes: unknown[];
  areas: unknown[];
  nptLevels: unknown[];
}): PlanoWorkData {
  return {
    v: 6, scaleM: engine.scaleM, definedScaleM: engine.definedScaleM, activeNet: engine.activeNet,
    zoom: engine.zoom, offX: engine.offX, offY: engine.offY,
    nets: NETS.map(n => ({ id: n.id, col: n.col })),
    ramales: engine.ramales, dims: engine.dims, textAnnots: engine.textAnnots,
    bajantes: engine.bajantes, areas: engine.areas, nptLevels: engine.nptLevels,
  };
}


export function applyWorkData(
  engine: {
    scaleM: number;
    definedScaleM: number;
    activeNet: string;
    ramales: unknown[];
    dims: unknown[];
    textAnnots: unknown[];
    bajantes: unknown[];
    areas: unknown[];
    nptLevels: unknown[];
    selId: string | null;
    activeRamal: unknown;
    activeArea: unknown;
    _netCounts: Record<string, { ramal: number; tributario: number }>;
    _dirty: boolean;
    render: () => void;
    [key: string]: unknown;
  },
  d: PlanoWorkData
) {
  engine.scaleM = d.scaleM || 0.5;
  engine.definedScaleM = d.definedScaleM || 0;
  engine.activeNet = d.activeNet || 'af';
  engine.zoom = d.zoom ?? 1;
  engine.offX = d.offX ?? 0;
  engine.offY = d.offY ?? 0;
  engine.ramales = d.ramales || [];
  engine.dims = d.dims || [];
  engine.textAnnots = d.textAnnots || [];
  engine.bajantes = d.bajantes || [];
  engine.areas = d.areas || [];
  engine.nptLevels = d.nptLevels || [];
  engine.selId = null;
  engine.activeRamal = null;
  engine.activeArea = null;
  initNetCounts(engine);
  for (const r of engine.ramales as Array<{ net?: string; tipo?: string; id?: string }>) {
    const net = NETS.find(n => n.id === r.net);
    if (net && r.tipo !== 'tributario') {
      const m = r.id?.match(new RegExp('^' + net.lbl + '(\\d+)$'));
      if (m) {
        const n = parseInt(m[1], 10);
        const counts = engine._netCounts[r.net!] as unknown as Record<string, number> | undefined;
        if (n > (counts?.[r.tipo!] || 0)) {
          if (!engine._netCounts[r.net!]) engine._netCounts[r.net!] = { ramal: 0, tributario: 0 };
          (engine._netCounts[r.net!] as unknown as Record<string, number>)[r.tipo!] = n;
        }
      }
    }
  }
  engine._dirty = false;
  engine.render();
}
