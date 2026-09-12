import { NETS, initNetCounts } from './PlanoState';
import { enrichCrossFloorGhosts } from '../../utils/crossFloorGhosts';
import { propagarSanDiametroAguasAbajo } from './drawingFlow';
import type { CrossFloorGhost } from '../shared/crossFloorGhostTypes';

export interface PlanoWorkData {
  v: number;
  ts?: number;
  scaleM: number;
  definedScaleM: number;
  activeNet: string;
  zoom: number;
  offX: number;
  offY: number;
  lineWidth?: number;
  nets: { id: string; col: string }[];
  ramales: unknown[];
  dims: unknown[];
  textAnnots: unknown[];
  bajantes: unknown[];
  areas: unknown[];
  nptLevels: unknown[];
  guideLines?: unknown[];
  // Los "fantasmas" entre pisos (marcadores del bajante que viene del piso de arriba) pueden
  // escribirse en un piso distinto al que está abierto. Si al cargar este piso no se vuelven a
  // leer, el siguiente autoguardado (que sobreescribe TODO el storage del piso) los borraría sin
  // querer — por eso se incluyen aquí, tanto al leer como al escribir.
  crossFloorGhosts?: unknown[];
}

export function serializeWork(engine: {
  scaleM: number;
  definedScaleM: number;
  activeNet: string;
  zoom: number;
  offX: number;
  offY: number;
  lineWidthScale: number;
  ramales: unknown[];
  dims: unknown[];
  textAnnots: unknown[];
  bajantes: unknown[];
  areas: unknown[];
  nptLevels: unknown[];
  crossFloorGhosts: unknown[];
  guideLines: unknown[];
}): PlanoWorkData {
  // Strip de cachés de render (`_labelBox`, `_circ`): se recalculan en cada render y
  // dominaban el tamaño del JSON (la cuota muda de localStorage congelaba la caché local
  // del piso y el GC borraba sus claves de aparatos — orig. usuario piso 2). Copia
  // superficial solo del elemento que trae cachés; el resto sigue por referencia.
  const stripRenderCache = (arr: unknown[] | undefined): unknown[] =>
    (arr ?? []).map((el) => {
      if (!el || typeof el !== 'object') return el;
      if (!('_labelBox' in el) && !('_circ' in el)) return el;
      const cp = { ...(el as Record<string, unknown>) };
      delete cp._labelBox;
      delete cp._circ;
      return cp;
    });
  return {
    v: 6,
    scaleM: engine.scaleM,
    definedScaleM: engine.definedScaleM,
    activeNet: engine.activeNet,
    zoom: engine.zoom,
    offX: engine.offX,
    offY: engine.offY,
    lineWidth: engine.lineWidthScale,
    nets: NETS.map((n) => ({ id: n.id, col: n.col })),
    ramales: stripRenderCache(engine.ramales),
    dims: stripRenderCache(engine.dims),
    textAnnots: stripRenderCache(engine.textAnnots),
    bajantes: stripRenderCache(engine.bajantes),
    areas: stripRenderCache(engine.areas),
    nptLevels: engine.nptLevels,
    crossFloorGhosts: engine.crossFloorGhosts,
    guideLines: stripRenderCache(engine.guideLines),
  };
}

export function applyWorkData(
  engine: {
    scaleM: number;
    definedScaleM: number;
    activeNet: string;
    lineWidthScale?: number;
    ramales: unknown[];
    dims: unknown[];
    textAnnots: unknown[];
    bajantes: unknown[];
    areas: unknown[];
    nptLevels: unknown[];
    crossFloorGhosts: unknown[];
    guideLines: unknown[];
    selId: string | null;
    activeRamal: unknown;
    activeArea: unknown;
    _netCounts: Record<string, { ramal: number; tributario: number }>;
    _dirty: boolean;
    render: () => void;
    [key: string]: unknown;
  },
  d: PlanoWorkData,
) {
  engine.scaleM = d.scaleM || 0.5;
  engine.definedScaleM = d.definedScaleM || 0;
  engine.activeNet = d.activeNet || 'af';
  engine.zoom = d.zoom ?? 1;
  engine.offX = d.offX ?? 0;
  engine.offY = d.offY ?? 0;
  engine.lineWidthScale = d.lineWidth && d.lineWidth > 0 ? d.lineWidth : 1;
  engine.ramales = d.ramales || [];
  engine.dims = d.dims || [];
  engine.textAnnots = d.textAnnots || [];
  // Migración: los canales recolectores usaban el prefijo de código CALL{n}-P{n}, reservado
  // ahora para las cajas de aguas lluvias (tipo caja_ll). Canales → CNL{n}-P{n}.
  engine.bajantes = (d.bajantes || []).map((b) => {
    const bb = b as { tipo?: string; code?: string; id?: string };
    if (bb.tipo === 'canal' && typeof bb.code === 'string' && bb.code.startsWith('CALL')) {
      bb.code = 'CNL' + bb.code.slice(4);
    }
    return b;
  });
  engine.areas = d.areas || [];
  engine.nptLevels = d.nptLevels || [];
  // Fantasmas entre pisos se cargan tal cual: son el AVISO del enlace de asociación. Los
  // residuales de bajantes copiados se limpian al copiar (copyDrawingFromPlan), no aquí.
  engine.crossFloorGhosts = d.crossFloorGhosts?.length
    ? enrichCrossFloorGhosts(d.crossFloorGhosts as unknown as CrossFloorGhost[])
    : [];
  engine.guideLines = d.guideLines || [];
  // Retro-propagación de diámetros al cargar (orig. usuario): dibujos guardados ANTES de que
  // existiera la propagación quedaron con receptores vacíos/menores aunque sus llegadores ya
  // tenían diámetro (RS1 4" + RS2 2" → RS3 vacío). Cada trazo con diámetro propaga su mayor;
  // la compuerta "todos asignados" y el nunca-bajar hacen que la pasada converja al estado
  // que habría quedado si la propagación hubiera estado activa al asignar.
  {
    const sanLl = (
      engine.ramales as Array<{
        id: string;
        net?: string;
        diametro?: string;
        pts?: number[][];
      }>
    ).filter((r) => (r.net === 'san' || r.net === 'll') && r.diametro);
    for (const r of sanLl) {
      propagarSanDiametroAguasAbajo(
        engine.ramales as unknown as Parameters<typeof propagarSanDiametroAguasAbajo>[0],
        r.id,
        engine.bajantes as unknown as Array<{ recibeDeIds?: string[]; alimentaIds?: string[] }>,
      );
    }
  }
  engine.selId = null;
  engine.activeRamal = null;
  engine.activeArea = null;
  initNetCounts(engine);
  for (const r of engine.ramales as Array<{
    net?: string;
    tipo?: string;
    id?: string;
    label?: string;
  }>) {
    const net = NETS.find((n) => n.id === r.net);
    if (net && r.tipo !== 'tributario') {
      const re = new RegExp('^' + net.lbl + '(\\d+)$');
      // Un Ldesvio tiene id `LD_...` pero label de ramal real (p. ej. "RS2") — el consecutivo
      // debe seguir contándolo, o un ramal manual nuevo chocaría con su label.
      const m = r.id?.match(re) || r.label?.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        const counts = engine._netCounts[r.net!] as unknown as Record<string, number> | undefined;
        if (n > (counts?.[r.tipo!] || 0)) {
          if (!engine._netCounts[r.net!]) engine._netCounts[r.net!] = { ramal: 0, tributario: 0 };
          (engine._netCounts[r.net!] as unknown as Record<string, number>)[r.tipo!] = n;
        }
      }
    }
    if (net && r.tipo === 'tributario') {
      const m = (r.label || r.id || '').match(/^T(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > engine._netCounts[net.id].tributario) engine._netCounts[net.id].tributario = n;
      }
    }
  }
  engine._dirty = false;
  engine.render();
}
