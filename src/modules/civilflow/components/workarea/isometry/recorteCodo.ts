// Preparación de los codos 90° de bajantes/montantes en isometría: por cada elemento con
// ramal conectado calcula el VÉRTICE (intersección de la línea del ramal con la vertical del
// centro), el lado donde el tubo sigue y el recorte EXACTO del ramal a su tangencia. Se corre
// ANTES del loop de ramales para que el recorte use la distancia exacta (no una aproximación).
// Lección de la ronda anterior: el vértice NO es el extremo del ramal (queda a varios px del
// tubo y el arco se ve desconectado) — es la intersección de las dos líneas reales.

export interface CodoPrep {
  /** Intersección ramal × vertical del bajante (px de pantalla). */
  vertex: { sx: number; sy: number };
  /** Dirección unitaria en pantalla del vértice hacia el interior del ramal. */
  dir: { x: number; y: number };
  /** Recorte del ramal EN px de lámina para que su extremo caiga en la tangencia. */
  dTrimPlane: number;
  ramalId: string;
  /** Extremo del ramal que toca el bajante: 0 = pts[0], 1 = último. */
  ladoExtremo: 0 | 1;
}

/** Claves de bajantes que dibujan glifo de codo: `${x*10}|${y*10}|${planNivel}`. Excluye
 *  fantasmas y tipos sin codo (canal/cajas/calentador/contador) y respeta el filtro de pisos. */
export function construyeJuncCodo(
  bajantes: Array<{
    id: string;
    tipo: string;
    planId: string;
    planNivel: number;
    x: number;
    y: number;
    _isCrossFloorGhost?: boolean;
  }>,
  pisosVisibles: Set<number> | null,
  confirmedPlanos: Array<{ id: string | number; nivel: number | null }>,
): Set<string> {
  const sinCodo = new Set(['canal', 'caja_san', 'caja_ll', 'calentador', 'contador']);
  const s = new Set<string>();
  for (const b of bajantes) {
    if (b._isCrossFloorGhost || sinCodo.has(b.tipo)) continue;
    if (
      pisosVisibles &&
      !pisosVisibles.has(b.planNivel) &&
      !(
        // Con asociación a un piso visible la tubería cruza: cuenta como visible (misma
        // regla del loop de bajantes — ver useIsometryRender).
        (b as { descargaEnId?: string }).descargaEnId &&
        pisosVisibles.has(
          nivelDePlanId(
            confirmedPlanos,
            (b as { descargaEnId?: string }).descargaEnId!.split('|')[0],
          ) ?? NaN,
        )
      )
    )
      continue;
    s.add(`${Math.round(b.x * 10)}|${Math.round(b.y * 10)}|${b.planNivel}`);
  }
  return s;
}

/** Nivel del plano por id; undefined si no existe. */
export function nivelDePlanId(
  plans: Array<{ id: string | number; nivel: number | null }>,
  planId: string,
): number | undefined {
  for (const p of plans) {
    if (String(p.id) === planId) return p.nivel != null ? Number(p.nivel) : undefined;
  }
  return undefined;
}

/** Sonda de escala: px de pantalla por px de lámina en el punto p (sonda de 24 px en +X). */
function sondaEscala(
  proyecta: (iso: { x: number; y: number }, zPix: number) => { sx: number; sy: number },
  isoDe: (px: number, py: number, nivel: number) => { x: number; y: number },
  p: number[],
  planNivel: number,
  zPix: number,
): number {
  const pr0 = proyecta(isoDe(p[0], p[1], planNivel), zPix);
  const pr24 = proyecta(isoDe(p[0] + 24, p[1], planNivel), zPix);
  return Math.hypot(pr24.sx - pr0.sx, pr24.sy - pr0.sy) / 24 || 1;
}

/** Punto del ramal recortado: retrocede por el segmento final dTrimPlane px de lámina
 *  (negativo = extender más allá del extremo; tope ½ segmento para no invertir). */
export function recortaExtremoCodo(p: number[], inner: number[], dTrimPlane: number): number[] {
  const dl = Math.hypot(inner[0] - p[0], inner[1] - p[1]) || 1;
  const t = Math.min(dTrimPlane, dl * 0.5);
  return [p[0] + ((inner[0] - p[0]) / dl) * t, p[1] + ((inner[1] - p[1]) / dl) * t];
}

/** Prepara TODOS los codos de una red ANTES del loop de ramales. Por bajante/montante busca
 *  su ramal conectado (ini/fin = código o geometría tol 6), proyecta los dos puntos, calcula
 *  el vértice (intersección con la vertical del centro) y el recorte exacto del ramal. */
export function preparaCodos(args: {
  bajantes: Array<{
    id: string;
    code?: string;
    tipo: string;
    planId: string;
    planNivel: number;
    x: number;
    y: number;
    _isCrossFloorGhost?: boolean;
  }>;
  ramales: Array<{ id: string; planNivel: number; pts: number[][]; ini?: string; fin?: string }>;
  proyecta: (iso: { x: number; y: number }, zPix: number) => { sx: number; sy: number };
  isoDe: (px: number, py: number, nivel: number) => { x: number; y: number };
  nptMap: Record<number, number>;
  prof: number;
  getZPix: (zMm: number, nivel?: number) => number;
  zoom: number;
}): { porBajante: Map<string, CodoPrep>; porRamal: Map<string, number> } {
  const { bajantes, ramales, proyecta, isoDe, nptMap, prof, getZPix, zoom } = args;
  const porBajante = new Map<string, CodoPrep>();
  const porRamal = new Map<string, number>();
  const sinCodo = new Set(['canal', 'caja_san', 'caja_ll', 'calentador', 'contador']);
  const R = 9 * zoom;
  for (const b of bajantes) {
    if (b._isCrossFloorGhost || sinCodo.has(b.tipo)) continue;
    const codeB = b.code || b.id;
    let ramalA: number[] | null = null;
    let ramalB: number[] | null = null;
    let ramalId = '';
    let lado: 0 | 1 = 0;
    for (const r of ramales) {
      if (r.planNivel !== b.planNivel || r.pts.length < 2) continue;
      const L = r.pts.length - 1;
      const idx =
        r.fin === codeB || Math.hypot(r.pts[L][0] - b.x, r.pts[L][1] - b.y) < 6
          ? L
          : r.ini === codeB || Math.hypot(r.pts[0][0] - b.x, r.pts[0][1] - b.y) < 6
            ? 0
            : -1;
      if (idx === -1) continue;
      ramalA = r.pts[idx];
      ramalB = idx === 0 ? r.pts[1] : r.pts[L - 1];
      ramalId = r.id;
      lado = idx === 0 ? 0 : 1;
      break;
    }
    if (!(ramalA && ramalB)) continue;
    const zPix = getZPix((nptMap[b.planNivel] || 0) - prof * 1000, b.planNivel);
    const Aend = proyecta(isoDe(ramalA[0], ramalA[1], b.planNivel), zPix);
    const Bin = proyecta(isoDe(ramalB[0], ramalB[1], b.planNivel), zPix);
    const centro = proyecta(isoDe(b.x, b.y, b.planNivel), zPix);
    let ux = Aend.sx - Bin.sx;
    let uy = Aend.sy - Bin.sy;
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    // Vértice = intersección de la recta del ramal (Aend + t·u) con la vertical del centro
    // (x = centro.sx — por ahí pasa el tubo). Clamp: si el ramal casi vertical o el cruce
    // queda lejos, cae al extremo del ramal (sin arco desconectado).
    let vertex = { sx: Aend.sx, sy: Aend.sy };
    if (Math.abs(ux) > 0.25) {
      const t = (centro.sx - Aend.sx) / ux;
      if (Math.abs(t) < 60 * zoom) vertex = { sx: Aend.sx + ux * t, sy: Aend.sy + uy * t };
    }
    const dir = { x: -ux, y: -uy }; // vértice → interior del ramal
    const t0 = Math.hypot(vertex.sx - Aend.sx, vertex.sy - Aend.sy);
    const s = sondaEscala(proyecta, isoDe, ramalA, b.planNivel, zPix);
    const prep: CodoPrep = {
      vertex,
      dir,
      dTrimPlane: (R - t0) / s,
      ramalId,
      ladoExtremo: lado,
    };
    porBajante.set(`${b.planId}:${b.id}`, prep);
    porRamal.set(`${ramalId}:${lado}`, prep.dTrimPlane);
  }
  return { porBajante, porRamal };
}
