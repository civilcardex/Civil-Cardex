import type { IPlanoEngineCore } from './PlanoState';
import { _firstSegmentAngle } from './drawingAngles';
import { _statusMsg } from './ramalMeasure';

/** Aplica el snap a un punto de la línea guía (click o preview): ángulo sobre la cuadrícula de
 *  la red activa (desde el punto anterior de la guía) + pegada a elementos existentes. Sin snap
 *  (snapMode off) devuelve el punto crudo. */
export function snapGuidePoint(
  engine: IPlanoEngineCore,
  fromPt: { x: number; y: number } | null,
  px: number,
  py: number,
): { x: number; y: number } {
  let p: { x: number; y: number } = { x: px, y: py };
  if (!engine.snapMode) return p;
  if (fromPt) p = engine.snapAngle(fromPt.x, fromPt.y, px, py, engine.activeNet, 'ramal');
  const sp = engine.snapToExisting(p.x, p.y, engine.activeNet, 'ramal');
  if (sp) return sp;
  return p;
}

/** Snap de conexión de la línea guía con el EXTREMO de un ramal: si el trazo pasa cerca de
 *  un extremo con otro ángulo, la guía se traslada para pasar exactamente por él y se rota
 *  al múltiplo permitido más cercano (90° af/ac/gas, 45° san/ll/vent). Devuelve los
 *  extremos ajustados, o los originales si no hay conexión cercana. */
export function snapGuideLineToRamal(
  engine: IPlanoEngineCore,
  s: { x: number; y: number },
  p: { x: number; y: number },
): { s: { x: number; y: number }; p: { x: number; y: number } } {
  if (!engine.snapMode) return { s, p };
  const gx = p.x - s.x;
  const gy = p.y - s.y;
  const L = Math.hypot(gx, gy);
  if (L < 1e-6) return { s, p };
  const gux = gx / L;
  const guy = gy / L;
  const thresh = 16 / engine.zoom;
  for (const r of engine.ramales) {
    if (engine._hiddenNets.has(r.net) || !r.pts || r.pts.length < 2) continue;
    for (const e of [r.pts[0], r.pts[r.pts.length - 1]]) {
      const t = ((e[0] - s.x) * gux + (e[1] - s.y) * guy) / L;
      if (t < 0.02 || t > 0.98) continue;
      const projX = s.x + gux * L * t;
      const projY = s.y + guy * L * t;
      if (Math.hypot(e[0] - projX, e[1] - projY) >= thresh) continue;
      const adj = e === r.pts[0] ? r.pts[1] : r.pts[r.pts.length - 2];
      const rdx = adj[0] - e[0];
      const rdy = adj[1] - e[1];
      const rlen = Math.hypot(rdx, rdy);
      if (rlen < 0.001) continue;
      const dux = rdx / rlen;
      const duy = rdy / rlen;
      const cosA = Math.max(-1, Math.min(1, dux * gux + duy * guy));
      const theta = (Math.acos(cosA) * 180) / Math.PI;
      const step = r.net === 'san' || r.net === 'll' || r.net === 'vent' ? 45 : 90;
      const candidates = step === 45 ? [45, 90, 135] : [90];
      let target = candidates[0];
      let bestDiff = Infinity;
      for (const c of candidates) {
        const diff = Math.abs(theta - c);
        if (diff < bestDiff) {
          bestDiff = diff;
          target = c;
        }
      }
      // Rota la dirección de la guía al ángulo permitido conservando el lado (signo del
      // producto cruz) y el largo, y la traslada para que pase exactamente por el extremo —
      // el extremo queda en el mismo parámetro t que tenía sobre el trazo original.
      const cross = dux * guy - duy * gux;
      const side = cross >= 0 ? 1 : -1;
      const baseAng = Math.atan2(duy, dux);
      const newAng = baseAng + (side * (target * Math.PI)) / 180;
      const ngx = Math.cos(newAng);
      const ngy = Math.sin(newAng);
      return {
        s: { x: e[0] - ngx * L * t, y: e[1] - ngy * L * t },
        p: { x: e[0] + ngx * L * (1 - t), y: e[1] + ngy * L * (1 - t) },
      };
    }
  }
  return { s, p };
}

/** Maneja un clic con la herramienta de línea guía: fija el punto inicial en el primer clic
 *  y crea la guía (libre, sin pegarse a ramales) en el segundo, etiquetada con la red activa
 *  para que sus acciones posteriores (rotar, convertir a ramal) sepan qué reglas aplican.
 *  Ambos puntos pasan por el snap cuando está activo. */
export function handleGuideDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!engine._guideStart) {
    engine._guideStart = snapGuidePoint(engine, null, px, py);
  } else {
    const s = engine._guideStart;
    const p = snapGuidePoint(engine, s, px, py);
    // Ítem 3 (guías): si el trazo pasa cerca del extremo de un ramal con un ángulo fuera de
    // snap, se traslada/rota para conectarlo cumpliendo el ángulo (como ramales con bajantes).
    const line = snapGuideLineToRamal(engine, s, p);
    engine.guideLines.push({
      id: 'GL' + Date.now(),
      net: engine.activeNet,
      pts: [
        [line.s.x, line.s.y],
        [line.p.x, line.p.y],
      ],
    });
    engine._guideStart = null;
    engine.render();
    engine._markDirty();
  }
}

/** Puntos de conexión entre una línea guía y los EXTREMOS de los ramales: contacto directo
 *  (extremo con extremo) o cruce (la guía atraviesa el extremo del ramal). Cada punto
 *  aparece una sola vez. Lo usan el renderer para resaltar la conexión y el menú contextual
 *  de la guía para habilitar "Crear tributarios". */
/** Snap del cruce guía-ramal al EXTREMO del ramal: si el cruce cae cerca de un extremo (dentro
 *  del radio de snap de conexión), se ajusta al extremo exacto — un tributario creado desde una
 *  guía que "cruza el extremo" conecta EN el extremo (codo 90°) en vez de dividir el ramal a
 *  1-2px de él (lo que creaba un stub invisible y un símbolo de tee en vez del codo). */
export function snapGuideCrossingToEndpoint(
  engine: IPlanoEngineCore,
  ramalId: string,
  pt: [number, number],
): [number, number] {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return pt;
  const thresh = Math.max(2, 16 / engine.zoom);
  let bestPt: [number, number] | null = null;
  let bestD = thresh;
  for (const e of [r.pts[0], r.pts[r.pts.length - 1]]) {
    const d = Math.hypot(e[0] - pt[0], e[1] - pt[1]);
    if (d < bestD) {
      bestD = d;
      bestPt = [e[0], e[1]];
    }
  }
  return bestPt ?? pt;
}

/** Puntos de conexión entre una línea guía y los extremos de los ramales (contacto directo o cruce en T), sin duplicados por proximidad. */
export function guideRamalJunctions(
  ramales: Array<{ id: string; pts?: number[][] }>,
  guide: { pts: [number, number][] },
): Array<{ point: [number, number]; ramalId: string; passThrough: boolean }> {
  const TOL = 0.5;
  const [p0, p1] = guide.pts;
  const out: Array<{ point: [number, number]; ramalId: string; passThrough: boolean }> = [];
  const gx = p1[0] - p0[0];
  const gy = p1[1] - p0[1];
  const glen = Math.hypot(gx, gy);
  if (glen < 1e-6) return out;
  const ux = gx / glen;
  const uy = gy / glen;
  const add = (pt: [number, number], ramalId: string, passThrough: boolean) => {
    if (out.some((j) => Math.hypot(j.point[0] - pt[0], j.point[1] - pt[1]) < TOL)) return;
    out.push({ point: pt, ramalId, passThrough });
  };
  for (const r of ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    for (const e of [r.pts[0], r.pts[r.pts.length - 1]]) {
      // Contacto: extremo de la guía sobre el extremo del ramal.
      if (
        Math.hypot(e[0] - p0[0], e[1] - p0[1]) < TOL ||
        Math.hypot(e[0] - p1[0], e[1] - p1[1]) < TOL
      ) {
        add([e[0], e[1]], r.id, false);
        continue;
      }
      // Cruce: extremo del ramal sobre la línea infinita de la guía, proyección interior.
      // El parámetro t se normaliza por la longitud de la guía — sin el divisor, una guía
      // larga proyectaba t = distancia absoluta (p. ej. 10 en una guía de 20px) y el rango
      // 0.02–0.98 jamás se cumplía, por lo que un cruce perpendicular sobre un extremo
      // nunca se detectaba (el botón "Crear tributarios" no aparecía).
      const dx = e[0] - p0[0];
      const dy = e[1] - p0[1];
      const t = (dx * ux + dy * uy) / glen;
      if (t < 0.02 || t > 0.98) continue;
      if (Math.abs(dx * uy - dy * ux) <= TOL) add([e[0], e[1]], r.id, true);
    }
    // Cruce con el CUERPO del ramal (a mitad de segmento): la conexión visual (círculo cyan)
    // también marca dónde la guía atraviesa el trazo de un ramal, no solo sus extremos — es el
    // mismo punto que usa el botón "Crear tributario" (findGuideCrossing).
    for (let i = 0; i < r.pts.length - 1; i++) {
      const hit = segSegIntersection(p0, p1, r.pts[i], r.pts[i + 1]);
      if (hit) add(hit, r.id, false);
    }
  }
  return out;
}

/** Intersección estricta (interior en ambos, margen 0.02–0.98) de dos segmentos. */
function segSegIntersection(
  a: [number, number],
  b: [number, number],
  c: number[],
  d: number[],
): [number, number] | null {
  const r1x = b[0] - a[0];
  const r1y = b[1] - a[1];
  const r2x = d[0] - c[0];
  const r2y = d[1] - c[1];
  const den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * r2y - (c[1] - a[1]) * r2x) / den;
  const u = ((c[0] - a[0]) * r1y - (c[1] - a[1]) * r1x) / den;
  if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
  return [a[0] + t * r1x, a[1] + t * r1y];
}

/** ¿La guía ATRAVIESA el extremo de un ramal (cruce en T)? Habilita "Crear tributarios a partir
 *  de línea guía". Devuelve el cruce más cercano al primer extremo de la guía, o null. */
export function findGuideTCrossing(
  ramales: Array<{ id: string; pts?: number[][] }>,
  guide: { pts: [number, number][] },
): { point: [number, number]; ramalId: string } | null {
  const hits = guideRamalJunctions(ramales, guide).filter((j) => j.passThrough);
  if (!hits.length) return null;
  const [p0] = guide.pts;
  let best = hits[0];
  let bestD = Infinity;
  for (const h of hits) {
    const d = Math.hypot(h.point[0] - p0[0], h.point[1] - p0[1]);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return { point: best.point, ramalId: best.ramalId };
}
