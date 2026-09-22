import { NETS, initNetCounts } from './PlanoState';
import { enrichCrossFloorGhosts } from '../../utils/crossFloorGhosts';
import { propagarSanDiametroAguasAbajo } from './drawingFlow';
import { direccionBajaPermitida } from './direccionReglas';
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

/** Re-escala TODA la geometría de un documento de trazos de su scaleM actual a `toScale`
 *  preservando posiciones REALES (px_nuevo = px_viejo × scaleM_viejo/toScale). Impone la
 *  escala única del proyecto (calibración calGlobal) a un piso que calibró a mano. Las
 *  magnitudes reales (totalL, areaM2, L de cotas) NO se tocan: px y escala cambian en proporción
 *  inversa, la distancia real queda idéntica. Idempotente: con la escala ya igualada no muta. */
export function rebasarEscalaTrazos(data: PlanoWorkData, toScale: number): void {
  const fromScale = data.scaleM || 0.5;
  if (!toScale || Math.abs(fromScale - toScale) < 1e-9) return;
  const f = fromScale / toScale;
  // 6 decimales de plane-px ≈ submicrón: estabiliza float sin pérdida práctica.
  const n = (v: number): number => +(v * f).toFixed(6);
  const pt2 = (p: number[]): number[] => [n(p[0]), n(p[1])];
  const escPtLista = (obj: unknown, campo: string): void => {
    const o = obj as Record<string, unknown>;
    const pts = o[campo];
    if (Array.isArray(pts)) o[campo] = (pts as number[][]).map(pt2);
  };
  for (const r of (data.ramales || []) as Record<string, unknown>[]) {
    escPtLista(r, 'pts');
    if (typeof r.labelX === 'number') r.labelX = n(r.labelX);
    if (typeof r.labelY === 'number') r.labelY = n(r.labelY);
  }
  for (const b of (data.bajantes || []) as Record<string, unknown>[]) {
    if (typeof b.x === 'number') b.x = n(b.x);
    if (typeof b.y === 'number') b.y = n(b.y);
    if (typeof b.labelX === 'number') b.labelX = n(b.labelX);
    if (typeof b.labelY === 'number') b.labelY = n(b.labelY);
    const desp = b.desplazamientos as Record<string, { dx?: number; dy?: number }> | undefined;
    if (desp) {
      for (const d of Object.values(desp)) {
        if (typeof d.dx === 'number') d.dx = n(d.dx);
        if (typeof d.dy === 'number') d.dy = n(d.dy);
      }
    }
    // Etiquetas arrastradas del fantasma/anillo por nivel (px de plano — sin esto quedaban
    // descolgadas de su marcador tras un re-base).
    const gd = b.ghostData as Record<string, { labelX?: number; labelY?: number }> | undefined;
    if (gd) {
      for (const g of Object.values(gd)) {
        if (g && typeof g.labelX === 'number') g.labelX = n(g.labelX);
        if (g && typeof g.labelY === 'number') g.labelY = n(g.labelY);
      }
    }
  }
  for (const a of (data.areas || []) as Record<string, unknown>[]) {
    escPtLista(a, 'pts');
    if (typeof a.labelX === 'number') a.labelX = n(a.labelX);
    if (typeof a.labelY === 'number') a.labelY = n(a.labelY);
  }
  for (const d of (data.dims || []) as Record<string, unknown>[]) {
    if (typeof d.x1 === 'number') d.x1 = n(d.x1);
    if (typeof d.y1 === 'number') d.y1 = n(d.y1);
    if (typeof d.x2 === 'number') d.x2 = n(d.x2);
    if (typeof d.y2 === 'number') d.y2 = n(d.y2);
    // Etiqueta arrastrada de la cota (px de plano — sin esto quedaba descolgada del segmento).
    if (typeof d.lblX === 'number') d.lblX = n(d.lblX);
    if (typeof d.lblY === 'number') d.lblY = n(d.lblY);
    // d.L (metros reales) intacto: px escala ×f y la escala ÷f — la distancia real no cambia.
  }
  for (const t of (data.textAnnots || []) as Record<string, unknown>[]) {
    if (typeof t.x === 'number') t.x = n(t.x);
    if (typeof t.y === 'number') t.y = n(t.y);
    if (typeof t.lblOffX === 'number') t.lblOffX = n(t.lblOffX);
    if (typeof t.lblOffY === 'number') t.lblOffY = n(t.lblOffY);
  }
  for (const g of (data.guideLines || []) as Record<string, unknown>[]) {
    escPtLista(g, 'pts');
  }
  // Marcadores de asociación entre pisos: px de plano propios — sin esto quedaban corridos
  // tras un re-base (la geometría se movía y ellos no).
  for (const g of (data.crossFloorGhosts || []) as Record<string, unknown>[]) {
    if (typeof g.x === 'number') g.x = n(g.x);
    if (typeof g.y === 'number') g.y = n(g.y);
  }
  data.scaleM = toScale;
}

/** Dedup por id (queda la ÚLTIMA aparición): datos de sesiones con bugs viejos traen el mismo
 *  bajante/ramal dos veces en un piso — el RPC lo rechaza entero ("ON CONFLICT DO UPDATE
 *  cannot affect row a second time", 500) y React se queja de keys duplicadas; además las dos
 *  copias se pelean escribiendo la herencia en cada pasada (bucle de setState). Con `merge`,
 *  en colisión la base es la última copia pasada por la función. */
export function dedupPorId<T>(lista: T[], merge?: (base: T, previa: T) => T): T[] {
  const pos = new Map<string, number>();
  const out: T[] = [];
  for (const el of lista) {
    const id = ((el as { id?: string } | null)?.id || '') + '';
    const i = id ? pos.get(id) : undefined;
    if (i !== undefined) out[i] = merge ? merge(el, out[i]) : el;
    else {
      if (id) pos.set(id, out.length);
      out.push(el);
    }
  }
  return out;
}

// Campos de asociación entre pisos que SOBREVIVEN al dedup: updateElementById muta la PRIMERA
// copia del array; con el dedup keep-last, el libro (ucAplicado) escrito en la copia 1 se
// descartaba al serializar y el autosave pisaba la caché buena (orig. usuario: herencia a 0
// al reentrar con datos legacy duplicados).
const CAMPOS_ASOC = [
  'ucAplicado',
  'ucAplicadoHidro',
  'origenId',
  'descargaEnId',
  'bombaEnId',
  'recibeDeIds',
  'alimentaIds',
] as const;

/** Merge para bajantes en el dedup: base = copia más reciente; los campos de asociación
 *  ausentes en la base se rellenan desde la copia previa. */
export function mergeBajanteDedup<T>(base: T, previa: T): T {
  const b = base as Record<string, unknown>;
  const p = previa as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return base;
  let merged: Record<string, unknown> | null = null;
  for (const k of CAMPOS_ASOC) {
    if (b[k] == null && p[k] != null) {
      if (!merged) merged = { ...b };
      merged[k] = p[k];
    }
  }
  return (merged as T) || base;
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
    ramales: dedupPorId(stripRenderCache(engine.ramales)),
    dims: dedupPorId(stripRenderCache(engine.dims)),
    textAnnots: dedupPorId(stripRenderCache(engine.textAnnots)),
    bajantes: dedupPorId(stripRenderCache(engine.bajantes), mergeBajanteDedup),
    areas: dedupPorId(stripRenderCache(engine.areas)),
    nptLevels: engine.nptLevels,
    crossFloorGhosts: engine.crossFloorGhosts,
    guideLines: dedupPorId(stripRenderCache(engine.guideLines)),
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
  engine.ramales = dedupPorId(d.ramales || []);
  engine.dims = dedupPorId(d.dims || []);
  engine.textAnnots = dedupPorId(d.textAnnots || []);
  // Migración: los canales recolectores usaban el prefijo de código CALL{n}-P{n}, reservado
  // ahora para las cajas de aguas lluvias (tipo caja_ll). Canales → CNL{n}-P{n}.
  engine.bajantes = dedupPorId(
    (d.bajantes || []).map((b) => {
      const bb = b as { tipo?: string; code?: string; id?: string };
      if (bb.tipo === 'canal' && typeof bb.code === 'string' && bb.code.startsWith('CALL')) {
        bb.code = 'CNL' + bb.code.slice(4);
      }
      return b;
    }),
    mergeBajanteDedup,
  );
  engine.areas = dedupPorId(d.areas || []);
  engine.nptLevels = d.nptLevels || [];
  // PUNTO 9: barrido de carga — ningún bajante del ÚLTIMO nivel inferior persiste con
  // direccion 'baja' (coerce a 'continua' + una sola alerta).
  {
    let invalidos = 0;
    for (const b of engine.bajantes as Array<{
      direccion?: string;
      nptBase?: number;
      tipo?: string;
    }>) {
      if (b.direccion !== 'baja' || b.tipo === 'montante') continue;
      if (!direccionBajaPermitida(engine, b)) {
        b.direccion = 'continua';
        invalidos++;
      }
    }
    const alerta = (engine as { triggerAlert?: (t: string, m: string) => void }).triggerAlert;
    if (invalidos && alerta)
      alerta(
        'Dirección inválida corregida',
        `${invalidos} bajante(s) del último nivel del proyecto tenían dirección "baja" (no hay piso debajo) y fueron corregidos a "continua".`,
      );
  }
  // Fantasmas entre pisos se cargan tal cual: son el AVISO del enlace de asociación. Los
  // residuales de bajantes copiados se limpian al copiar (copyDrawingFromPlan), no aquí.
  engine.crossFloorGhosts = d.crossFloorGhosts?.length
    ? enrichCrossFloorGhosts(d.crossFloorGhosts as unknown as CrossFloorGhost[])
    : [];
  engine.guideLines = dedupPorId(d.guideLines || []);
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
