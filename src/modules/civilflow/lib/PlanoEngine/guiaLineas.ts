import type { IPlanoEngineCore } from './PlanoEstado.ts';
import { ANGLE_EPS, _firstSegmentAngle } from './dibujoAngulos.ts';
import { _statusMsg } from './ramalMedir.ts';

/** Al trazar una línea guía, cada clic se pega a los ángulos legales y a extremos de tuberías
 *  cercanas (el mismo imán del ramal). Si apagaste el snap, el punto queda donde hiciste clic. */
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

/** Si el último trazo de la guía llega torcido a un ramal, lo endereza SOLO a él: gira alrededor
 *  del vértice anterior hasta el ángulo legal de la red (45° en san (Sanitaria), ll (Lluvias) y
 *  vent (Ventilación); 90° en af (Agua Fría) y ac (Agua Caliente)). Los trazos ya dibujados de la
 *  misma guía quedan intactos. */
export function snapGuideSegmentToRamal(
  engine: IPlanoEngineCore,
  prevPt: { x: number; y: number },
  newPt: { x: number; y: number },
): { x: number; y: number } {
  if (!engine.snapMode) return newPt;
  const gx = newPt.x - prevPt.x;
  const gy = newPt.y - prevPt.y;
  const L = Math.hypot(gx, gy);
  if (L < 1e-6) return newPt;
  const gux = gx / L;
  const guy = gy / L;
  const thresh = 16 / (engine.zoom || 1);
  for (const r of engine.ramales) {
    if (engine._hiddenNets.has(r.net) || !r.pts || r.pts.length < 2) continue;
    for (const e of [r.pts[0], r.pts[r.pts.length - 1]]) {
      // t hasta 1.2: el caso más común es que el segmento TERMINA en el extremo (clic sobre
      // él, t≈1) o lo pasa apenas — un t>1.2 ya es un cruce por el cuerpo, no una conexión.
      const t = ((e[0] - prevPt.x) * gux + (e[1] - prevPt.y) * guy) / L;
      if (t < 0.02 || t > 1.2) continue;
      const projX = prevPt.x + gux * L * t;
      const projY = prevPt.y + guy * L * t;
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
      // Conexión ya válida: no se toca (±0.5° absorbe solo error de punto flotante).
      if (bestDiff <= ANGLE_EPS) return newPt;
      const cross = dux * guy - duy * gux;
      const side = cross >= 0 ? 1 : -1;
      const newAng = Math.atan2(duy, dux) + (side * (target * Math.PI)) / 180;
      const ux2 = Math.cos(newAng);
      const uy2 = Math.sin(newAng);
      // Extremo exacto: intersección del rayo corregido con la LÍNEA del segmento del ramal —
      // mantiene la conexión con el trazo existente y el ángulo legal a la vez (el largo del
      // segmento conectado absorbe el ajuste; nunca se mueve prevPt).
      const den = ux2 * duy - uy2 * dux;
      if (Math.abs(den) > 1e-9) {
        const s = ((e[0] - prevPt.x) * duy - (e[1] - prevPt.y) * dux) / den;
        if (s > 0) return { x: prevPt.x + s * ux2, y: prevPt.y + s * uy2 };
      }
      return { x: prevPt.x + L * ux2, y: prevPt.y + L * uy2 };
    }
  }
  return newPt;
}

/** Cada clic agrega un tramo más a la guía (hacen falta al menos 2 vértices); doble clic o
 *  Enter/Esc la termina y la deja fija en el plano. */
export function handleGuideDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!engine._guideStart || !engine._guidePts) {
    const p = snapGuidePoint(engine, null, px, py);
    engine._guideStart = p;
    engine._guidePts = [[p.x, p.y]];
    engine.render();
    return;
  }
  const pts = engine._guidePts;
  const last = pts[pts.length - 1];
  // Clic sobre el último vértice con ≥2 vértices = cerrar (doble-click): commit sin agregar
  // punto duplicado.
  const closeTol = 6 / (engine.zoom || 1);
  if (pts.length >= 2 && Math.hypot(px - last[0], py - last[1]) < closeTol) {
    commitOpenGuide(engine);
    return;
  }
  let p = snapGuidePoint(engine, engine._guideStart, px, py);
  // Ítems 3/4/7: si el segmento nuevo conecta con el extremo de un ramal en ángulo fuera de
  // regla, se corrige SOLO este segmento (pivote fijo = vértice anterior) — los segmentos ya
  // dibujados de la misma guía quedan exactamente como fueron trazados.
  p = snapGuideSegmentToRamal(engine, { x: last[0], y: last[1] }, p);
  // Ignorar clics que colapsan con el último vértice (no aportan segmento).
  if (Math.hypot(p.x - last[0], p.y - last[1]) < 1e-6) {
    engine.render();
    return;
  }
  pts.push([p.x, p.y]);
  engine._guideStart = p;
  engine.render();
}

/** Commitea la guía en construcción (si tiene ≥2 vértices) como una sola entidad con todos
 *  sus segmentos; con 0-1 vértices la descarta. Un único snapshot para todo el trazo. */
export function commitOpenGuide(engine: IPlanoEngineCore): void {
  const pts = engine._guidePts;
  engine._guideStart = null;
  engine._guidePts = null;
  if (!pts || pts.length < 2) {
    engine.render();
    return;
  }
  const finalPts = pts.map((p) => [p[0], p[1]] as [number, number]);
  // Ítems 3/4/7: pasada local por segmento — cada vértice se ajusta contra su vecino anterior
  // si su segmento conecta con un extremo de ramal en ángulo fuera de regla. Idempotente (los
  // segmentos ya corregidos al clicar cumplen ±0.5° y no se tocan); nunca mueve los segmentos
  // anteriores. Cubre también las guías de 2 puntos (caso original).
  for (let i = 1; i < finalPts.length; i++) {
    const fixed = snapGuideSegmentToRamal(
      engine,
      { x: finalPts[i - 1][0], y: finalPts[i - 1][1] },
      { x: finalPts[i][0], y: finalPts[i][1] },
    );
    finalPts[i] = [fixed.x, fixed.y];
  }
  engine.guideLines.push({
    id: 'GL' + Date.now(),
    net: engine.activeNet,
    pts: finalPts,
  });
  engine.render();
  engine._markDirty();
}

/** ¿El clic cayó sobre alguna parte de la guía (no solo su etiqueta)? Permite seleccionar y
 *  arrastrar guías con forma de L o U. */
export function guideBodyHit(
  engine: IPlanoEngineCore,
  guide: { pts: [number, number][] },
  px: number,
  py: number,
): boolean {
  const c = engine.toCvs(px, py);
  const TOL = 12;
  for (let i = 0; i < guide.pts.length - 1; i++) {
    const p1 = engine.toCvs(guide.pts[i][0], guide.pts[i][1]);
    const p2 = engine.toCvs(guide.pts[i + 1][0], guide.pts[i + 1][1]);
    const l2 = (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
    let t = l2 === 0 ? 0 : ((c.x - p1.x) * (p2.x - p1.x) + (c.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(c.x - (p1.x + t * (p2.x - p1.x)), c.y - (p1.y + t * (p2.y - p1.y))) <= TOL)
      return true;
  }
  return false;
}

/** Acomoda el cruce guía-ramal al extremo exacto del ramal: sin esto quedan pedazos de 1-2 px que
 *  no se ven pero rompen la conexión al convertir la guía. */
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

/** Lista los puntos donde la guía toca una tubería: de punta a punta, atravesando su extremo (T) o
 *  cruzando su cuerpo. Sin repetir el mismo punto dos veces. */
export function guideRamalJunctions(
  ramales: Array<{ id: string; pts?: number[][] }>,
  guide: { pts: [number, number][] },
): Array<{ point: [number, number]; ramalId: string; passThrough: boolean }> {
  const TOL = 0.5;
  const out: Array<{ point: [number, number]; ramalId: string; passThrough: boolean }> = [];
  if (!guide.pts || guide.pts.length < 2) return out;
  const add = (pt: [number, number], ramalId: string, passThrough: boolean) => {
    if (out.some((j) => Math.hypot(j.point[0] - pt[0], j.point[1] - pt[1]) < TOL)) return;
    out.push({ point: pt, ramalId, passThrough });
  };
  // Contacto extremo-con-extremo: cualquier vértice de la guía sobre un extremo de ramal.
  // Cruce: extremo del ramal sobre la línea infinita de cada segmento, proyección interior.
  // (El parámetro t se normaliza por la longitud del segmento — sin el divisor, un segmento
  // largo proyectaba t = distancia absoluta y el rango 0.02–0.98 jamás se cumplía.)
  for (let g = 0; g < guide.pts.length - 1; g++) {
    const p0 = guide.pts[g];
    const p1 = guide.pts[g + 1];
    const gx = p1[0] - p0[0];
    const gy = p1[1] - p0[1];
    const glen = Math.hypot(gx, gy);
    if (glen < 1e-6) continue;
    const ux = gx / glen;
    const uy = gy / glen;
    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      for (const e of [r.pts[0], r.pts[r.pts.length - 1]]) {
        if (
          Math.hypot(e[0] - p0[0], e[1] - p0[1]) < TOL ||
          Math.hypot(e[0] - p1[0], e[1] - p1[1]) < TOL
        ) {
          add([e[0], e[1]], r.id, false);
          continue;
        }
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

/** ¿La guía atraviesa el extremo de un ramal formando una T? Si sí, se habilita "Crear
 *  tributarios a partir de línea guía". Devuelve el cruce más cercano al inicio de la guía, o
 *  null si no hay ninguno. */
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
