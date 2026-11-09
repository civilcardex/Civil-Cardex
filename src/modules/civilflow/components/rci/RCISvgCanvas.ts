/** Curvas de canvas del módulo RCI (extraídas de RCISvgSchemas por el guard de líneas):
 *  rectángulo de fuego (NFPA 13) y curva de la bomba (NFPA 20). NO usan var(--x): reciben
 *  colores resueltos (temaResuelto()).
 *  Ej: dibujaRectangulo(ctx, cv.clientWidth, 360, R.roc, temaResuelto()). */
import type { BombaResult, Criterios } from '../../lib/rci/types';
import { puntoEnPoligono } from '../../lib/shared/geometry.ts';
import { COL_RCI, fmtNum, niceStep, type TemaRci } from './RCISvgTheme.tsx';
/* ---------------- Canvas: rectángulo de fuego y curva de la bomba ---------------- */

/** Rectángulo de fuego (NFPA 13) sobre canvas: ramales en gris, envolvente S×L, el rectángulo
 *  teórico 1,2√A en rojo discontinuo y los rociadores en operación rellenos.
 *  w/h son el tamaño CSS del canvas (la función asume que el contexto ya está escalado por DPR;
 *  NO usa var(--x): pase colores resueltos, p. ej. temaResuelto()).
 *  Ej: dibujaRectangulo(ctx, cv.clientWidth, 360, R.roc, temaResuelto()). */
export function dibujaRectangulo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  roc: Criterios,
  tema: TemaRci = COL_RCI,
): void {
  const g = ctx;
  const o = roc;
  g.clearRect(0, 0, w, h);
  g.font = `12px ${tema.font}`;
  if (!(o.S > 0 && o.L > 0 && o.Nramal > 0)) {
    g.fillStyle = tema.muted;
    g.fillText('Ingrese S y L en Entradas', 20, 30);
    return;
  }
  const nx = o.Nramal,
    ny = o.Nramales,
    W = nx * o.S,
    H = ny * o.L;
  const x0r = W / 2 - o.Llargo / 2,
    y0r = H / 2 - o.Acorto / 2;
  const minX = Math.min(-o.S, x0r) - 0.3,
    maxX = Math.max(W + o.S, x0r + o.Llargo) + 0.3;
  const minY = Math.min(-o.L, y0r) - 0.3,
    maxY = Math.max(H + o.L * 0.6, y0r + o.Acorto) + 0.3;
  const pad = { l: 46, r: 16, t: 34, b: 30 };
  const sc = Math.min((w - pad.l - pad.r) / (maxX - minX), (h - pad.t - pad.b) / (maxY - minY));
  const ox = pad.l + (w - pad.l - pad.r - sc * (maxX - minX)) / 2,
    oy = h - pad.b - (h - pad.t - pad.b - sc * (maxY - minY)) / 2;
  const X = (x: number) => ox + (x - minX) * sc,
    Y = (y: number) => oy - (y - minY) * sc;
  // ramales
  g.strokeStyle = tema.lineStrong;
  g.lineWidth = 1;
  for (let j = -1; j <= ny; j++) {
    const y = (j + 0.5) * o.L;
    if (y < minY || y > maxY) continue;
    g.beginPath();
    g.moveTo(X(minX + 0.2), Y(y));
    g.lineTo(X(maxX - 0.2), Y(y));
    g.stroke();
  }
  // envolvente
  g.strokeStyle = tema.muted;
  g.lineWidth = 1.2;
  g.setLineDash([]);
  g.strokeRect(X(0), Y(H), W * sc, H * sc);
  // rectángulo teórico
  g.strokeStyle = tema.fire;
  g.lineWidth = 2.2;
  g.setLineDash([8, 5]);
  g.strokeRect(X(x0r), Y(y0r + o.Acorto), o.Llargo * sc, o.Acorto * sc);
  g.setLineDash([]);
  // rociadores
  let k = 0;
  for (let j = -1; j <= ny; j++)
    for (let i = -1; i <= nx; i++) {
      const x = (i + 0.5) * o.S,
        y = (j + 0.5) * o.L;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const on = i >= 0 && i < nx && j >= 0 && j < ny && j * nx + i < o.Nreq;
      g.beginPath();
      g.arc(X(x), Y(y), on ? 5.5 : 4, 0, Math.PI * 2);
      if (on) {
        g.fillStyle = tema.fire;
        g.fill();
        k++;
      } else {
        g.strokeStyle = tema.lineStrong;
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
  // cotas
  g.fillStyle = tema.ink;
  g.textAlign = 'center';
  g.fillText(
    `Lado largo ${fmtNum(o.Llargo)} m (1,2√A)`,
    X(x0r + o.Llargo / 2),
    Y(y0r + o.Acorto) - 8,
  );
  g.save();
  g.translate(X(x0r) - 10, Y(y0r + o.Acorto / 2));
  g.rotate(-Math.PI / 2);
  g.fillText(`${fmtNum(o.Acorto)} m`, 0, 0);
  g.restore();
  g.fillStyle = tema.muted;
  g.textAlign = 'left';
  g.fillText(
    `Ramales →   S = ${fmtNum(o.S)} m   L = ${fmtNum(o.L)} m   ${k} rociadores en operación   Área ${fmtNum(o.Adis * 0.092903)} m²`,
    10,
    16,
  );
}

/** Curva de la bomba (NFPA 20) sobre canvas: rejilla con pasos "bonitos", líneas de 100 % y
 *  150 % del caudal, la curva P = a·Q² + b·Q + churn y los puntos de demanda D1/D2.
 *  Escalas siempre positivas: con demanda nula el gráfico queda vacío (aviso centrado).
 *  Ej: dibujaCurvaBomba(ctx, cv.clientWidth, 360, R.bomba, temaResuelto()). */
export function dibujaCurvaBomba(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bomba: Pick<BombaResult, 'Qnom' | 'Pnom' | 'Pchurn' | 'ca' | 'cb' | 'D1' | 'D2'>,
  tema: TemaRci = COL_RCI,
): void {
  const g = ctx;
  const b = bomba;
  const pad = { l: 50, r: 16, t: 14, b: 38 };
  const qMax = Math.max(1.6 * b.Qnom, b.D1.Q * 1.1, b.D2 ? b.D2.Q * 1.1 : 0, 10) || 10;
  const pMax = Math.max(b.Pchurn, b.D1.P, b.D2 ? b.D2.P : 0, b.Pnom * 1.05, 10) * 1.12 || 10;
  const X = (q: number) => pad.l + (q / qMax) * (w - pad.l - pad.r),
    Y = (p: number) => h - pad.b - (p / pMax) * (h - pad.t - pad.b);
  g.clearRect(0, 0, w, h);
  g.font = `12px ${tema.font}`;
  g.strokeStyle = tema.line;
  g.fillStyle = tema.muted;
  g.lineWidth = 1;
  g.textAlign = 'right';
  const stepP = niceStep(pMax / 5),
    stepQ = niceStep(qMax / 6);
  for (let p = 0; p <= pMax; p += stepP) {
    g.beginPath();
    g.moveTo(pad.l, Y(p));
    g.lineTo(w - pad.r, Y(p));
    g.stroke();
    g.fillText(fmtNum(p, 0), pad.l - 6, Y(p) + 4);
  }
  g.textAlign = 'center';
  for (let q = 0; q <= qMax; q += stepQ) {
    g.beginPath();
    g.moveTo(X(q), h - pad.b);
    g.lineTo(X(q), pad.t);
    g.stroke();
    g.fillText(fmtNum(q, 0), X(q), h - pad.b + 15);
  }
  g.fillText('Caudal (gpm)', (w + pad.l) / 2, h - 6);
  g.save();
  g.translate(14, (h - pad.b + pad.t) / 2);
  g.rotate(-Math.PI / 2);
  g.fillText('Presión neta (psi)', 0, 0);
  g.restore();
  (
    [
      [b.Qnom, '100 %'],
      [1.5 * b.Qnom, '150 %'],
    ] as [number, string][]
  ).forEach(([q, t]) => {
    g.setLineDash([4, 4]);
    g.strokeStyle = tema.lineStrong;
    g.beginPath();
    g.moveTo(X(q), Y(0));
    g.lineTo(X(q), pad.t);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = tema.muted;
    g.fillText(t, X(q), pad.t + 10);
  });
  g.strokeStyle = tema.ink;
  g.lineWidth = 2.2;
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const q = (1.5 * b.Qnom * i) / 60,
      p = b.ca * q * q + b.cb * q + b.Pchurn;
    if (i) g.lineTo(X(q), Y(p));
    else g.moveTo(X(q), Y(p));
  }
  g.stroke();
  const pt = (d: { Q: number; P: number } | null, col: string, lab: string) => {
    if (!d) return;
    g.fillStyle = col;
    g.beginPath();
    g.arc(X(d.Q), Y(d.P), 6, 0, Math.PI * 2);
    g.fill();
    g.textAlign = 'left';
    g.fillStyle = tema.ink;
    g.fillText(`${lab} ${fmtNum(d.Q, 0)} gpm @ ${fmtNum(d.P, 1)} psi`, X(d.Q) + 9, Y(d.P) - 8);
  };
  pt(b.D1, tema.fire, 'D1');
  pt(b.D2, tema.steel, 'D2');
  if (!(b.Pnom > 0)) {
    g.textAlign = 'center';
    g.fillStyle = tema.muted;
    g.fillText(
      'Sin demanda calculada: complete la red de rociadores y la ruta del cuarto de bombas',
      (w + pad.l) / 2,
      (h - pad.b + pad.t) / 2,
    );
  }
}

/** Geometría del rectángulo de fuego DEFINIDO en el dibujo (lo arma RCIDesign del doc de
 *  trazos del piso activo): polígono del área marcada, polilíneas de ramales y posiciones de
 *  rociadores — todo en METROS. Ej: { ptsM, ramPtsM, rocPts }. */
export interface RectFuegoDibujo {
  ptsM: number[][];
  ramPtsM: number[][][];
  rocPts: number[][];
}

/** Rectángulo de fuego desde el DIBUJO REAL (ped. usuario): ramales en gris, el polígono del
 *  área definida en rojo sólido, los rociadores del dibujo verdes (dentro del área) o grises
 *  (fuera) y la envolvente de los que quedan dentro. Escala: fit al bbox de todo.
 *  Ej: dibujaRectFuegoDibujo(g, w, h, { ptsM, ramPtsM, rocPts }, temaResuelto()). */
export function dibujaRectFuegoDibujo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rect: RectFuegoDibujo,
  tema: TemaRci = COL_RCI,
): void {
  const g = ctx;
  g.clearRect(0, 0, w, h);
  g.font = `12px ${tema.font}`;
  const todos = [...rect.ptsM, ...rect.rocPts, ...rect.ramPtsM.flat()];
  if (!todos.length) return;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of todos) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const margen = Math.max((maxX - minX) * 0.08, (maxY - minY) * 0.08, 0.5);
  minX -= margen;
  minY -= margen;
  maxX += margen;
  maxY += margen;
  const pad = { l: 20, r: 16, t: 30, b: 20 };
  const sc = Math.min((w - pad.l - pad.r) / (maxX - minX), (h - pad.t - pad.b) / (maxY - minY));
  const ox = pad.l + (w - pad.l - pad.r - sc * (maxX - minX)) / 2;
  const oy = h - pad.b - (h - pad.t - pad.b - sc * (maxY - minY)) / 2;
  const X = (x: number) => ox + (x - minX) * sc;
  const Y = (y: number) => oy - (y - minY) * sc;

  /* Ramales del dibujo (gris fino). */
  g.strokeStyle = tema.lineStrong;
  g.lineWidth = 1.2;
  for (const pts of rect.ramPtsM) {
    if (pts.length < 2) continue;
    g.beginPath();
    g.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (let i = 1; i < pts.length; i++) g.lineTo(X(pts[i][0]), Y(pts[i][1]));
    g.stroke();
  }

  /* Polígono del rectángulo DEFINIDO: rojo sólido (el estado de la marca en el dibujo). */
  g.strokeStyle = tema.fire;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(X(rect.ptsM[0][0]), Y(rect.ptsM[0][1]));
  for (let i = 1; i < rect.ptsM.length; i++) g.lineTo(X(rect.ptsM[i][0]), Y(rect.ptsM[i][1]));
  g.closePath();
  g.stroke();

  /* Envolvente de los rociadores DENTRO del área (gris claro). */
  const dentro = rect.rocPts.filter((p) => puntoEnPoligono(p, rect.ptsM));
  if (dentro.length > 1) {
    let bMinX = Infinity,
      bMinY = Infinity,
      bMaxX = -Infinity,
      bMaxY = -Infinity;
    for (const [x, y] of dentro) {
      if (x < bMinX) bMinX = x;
      if (x > bMaxX) bMaxX = x;
      if (y < bMinY) bMinY = y;
      if (y > bMaxY) bMaxY = y;
    }
    g.strokeStyle = tema.line;
    g.lineWidth = 1.5;
    g.strokeRect(X(bMinX), Y(bMaxY), (bMaxX - bMinX) * sc, (bMaxY - bMinY) * sc);
  }

  /* Roociadores del dibujo: verde = dentro del rectángulo, gris = fuera. */
  for (const p of rect.rocPts) {
    const adentro = puntoEnPoligono(p, rect.ptsM);
    g.beginPath();
    g.arc(X(p[0]), Y(p[1]), 5, 0, Math.PI * 2);
    g.fillStyle = adentro ? tema.ok : tema.muted;
    g.fill();
    g.strokeStyle = tema.surf;
    g.lineWidth = 1.5;
    g.stroke();
  }

  g.fillStyle = tema.muted;
  g.fillText(
    `${rect.rocPts.length} rociadores del dibujo · ${dentro.length} dentro del área definida`,
    pad.l,
    18,
  );
}
