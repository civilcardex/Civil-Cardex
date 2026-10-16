/** ¿Cayó el clic dentro de este polígono? Traza una línea horizontal desde el clic y cuenta
 *  cuántas veces corta el contorno: un número impar de cortes significa "dentro".
 *  Ej: el rectángulo de un área dibujada devuelve true; un punto fuera, false. */
export function pointInPoly(px: number, py: number, cvsPts: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = cvsPts.length - 1; i < cvsPts.length; j = i++) {
    const xi = cvsPts[i].x,
      yi = cvsPts[i].y;
    const xj = cvsPts[j].x,
      yj = cvsPts[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** ¿Cayó el clic sobre esta etiqueta? Una tubería a 45° arrastra su texto y la caja queda girada,
 *  así que no sirve el rectángulo recto: el clic se rota el ángulo contrario y se compara como si
 *  la etiqueta estuviera nivelada. */
export function pointInLabelBox(
  px: number,
  py: number,
  box: {
    cx: number;
    cy: number;
    w: number;
    h: number;
    angle: number;
    corners?: { x: number; y: number }[];
  },
) {
  if (!box || !box.corners) return false;
  const dx = px - box.cx,
    dy = py - box.cy;
  const cosA = Math.cos(-box.angle),
    sinA = Math.sin(-box.angle);
  const lx = dx * cosA - dy * sinA;
  const ly = dx * sinA + dy * cosA;
  return Math.abs(lx) <= box.w / 2 && Math.abs(ly) <= box.h / 2;
}

/** Distancia más corta del clic al tramo que va de (x1,y1) a (x2,y2). La proyección del clic se
 *  recorta al tramo: si el clic cae "más allá" de un extremo, devuelve la distancia hasta ese
 *  extremo y no hasta la recta que se prolongaría en la misma dirección. */
export function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** ¿Cayó el clic sobre un accesorio dibujado en el cuerpo de un ramal (tee, válvula…)? Devuelve
 *  el índice del vértice donde está, o null si no hay ninguno. El radio de acierto es mayor que el
 *  vértice porque el ícono se dibuja a un lado de la tubería: el clic cae sobre el ícono, no
 *  sobre la línea. */
export function findAccMedVertexHit(
  pts: number[][],
  accMed: Record<string, string> | undefined | null,
  toCvs: (px: number, py: number) => { x: number; y: number },
  cx: number,
  cy: number,
  radius: number,
): number | null {
  if (!accMed || !pts || pts.length < 3) return null;
  for (const key of Object.keys(accMed)) {
    const m = key.match(/^accMed(\d+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    if (idx <= 0 || idx >= pts.length - 1) continue;
    if (!accMed[key]) continue;
    const pc = toCvs(pts[idx][0], pts[idx][1]);
    if (Math.hypot(cx - pc.x, cy - pc.y) < radius) return idx;
  }
  return null;
}

/** ¿Cayó el clic sobre el CUERPO de algún ramal (la parte intermedia, no los extremos)? Devuelve
 *  el id del ramal acertado, o null. Sirve para que un clic sobre una rama de tee no lo robe el
 *  extremo de otro ramal que pasa cerca: si el clic está en el interior del trazo, la selección
 *  de extremos ajenos tiene que ceder. */
export function pointOnAnyBodySegment(
  ramales: { id?: string; pts?: number[][] }[],
  cx: number,
  cy: number,
  toCvs: (px: number, py: number) => { x: number; y: number },
  tol: number,
  excludeId?: string,
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  let bestLen = Infinity;
  for (const r of ramales) {
    if (excludeId !== undefined && r.id === excludeId) continue;
    if (!r.pts || r.pts.length < 2) continue;
    const cvs = r.pts.map((p) => toCvs(p[0], p[1]));
    let len = 0;
    for (let i = 0; i < cvs.length - 1; i++)
      len += Math.hypot(cvs[i + 1].x - cvs[i].x, cvs[i + 1].y - cvs[i].y);
    for (let i = 0; i < cvs.length - 1; i++) {
      const a = cvs[i];
      const b = cvs[i + 1];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.01) continue;
      const t = ((cx - a.x) * dx + (cy - a.y) * dy) / lenSq;
      if (t <= 0.05 || t >= 0.95) continue;
      const px = a.x + t * dx,
        py = a.y + t * dy;
      const dist = Math.hypot(cx - px, cy - py);
      if (dist <= tol && (dist < bestDist || (dist === bestDist && len < bestLen))) {
        bestDist = dist;
        bestLen = len;
        bestId = r.id ?? null;
      }
    }
  }
  return bestId;
}

/** Pega el punto al tramo más cercano y devuelve esa posición (null si el más cercano queda más
 *  lejos que threshold). Ej: al soltar una línea guía a 6 px de un ramal, salta al punto exacto
 *  del ramal para que la unión quede limpia en vez de cruzando al lado. */
export function snapToSegment(x: number, y: number, pts: number[][], threshold: number = Infinity) {
  let best: { x: number; y: number } | null = null;
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i],
      [x2, y2] = pts[i + 1];
    const ddx = x2 - x1,
      ddy = y2 - y1,
      len2 = ddx * ddx + ddy * ddy;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((x - x1) * ddx + (y - y1) * ddy) / len2));
    const ptx = x1 + t * ddx,
      pty = y1 + t * ddy;
    const d = Math.hypot(x - ptx, y - pty);
    if (d < minD && d <= threshold) {
      minD = d;
      best = { x: ptx, y: pty };
    }
  }
  return best;
}

/** Las 4 esquinas de una caja girada `angle` radianes, más el rectángulo que la envuelve;
 *  `margin` la ensancha por fuera. Ej: una etiqueta de una tubería a 45° o una caja de aguas
 *  negras (CAN) girada se prueban con esto. */
export function rotatedRectCorners(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
  margin = 0,
): { corners: { x: number; y: number }[]; minX: number; minY: number; maxX: number; maxY: number } {
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle);
  const hw = w / 2,
    hh = h / 2;
  const corners = [
    { x: cx + cosA * -hw - sinA * -hh, y: cy + sinA * -hw + cosA * -hh },
    { x: cx + cosA * hw - sinA * -hh, y: cy + sinA * hw + cosA * -hh },
    { x: cx + cosA * hw - sinA * hh, y: cy + sinA * hw + cosA * hh },
    { x: cx + cosA * -hw - sinA * hh, y: cy + sinA * -hw + cosA * hh },
  ];
  return {
    corners,
    minX: Math.min(...corners.map((c) => c.x)) - margin,
    minY: Math.min(...corners.map((c) => c.y)) - margin,
    maxX: Math.max(...corners.map((c) => c.x)) + margin,
    maxY: Math.max(...corners.map((c) => c.y)) + margin,
  };
}

/** Distancia del clic al ramal tal como se VE, no como está guardado: los codos se dibujan
 *  redondeados con un arco, así que cerca de una esquina hay que medir hasta ese arco y no hasta
 *  el vértice, o el clic parecería más lejos de la tubería de lo que está.
 *  Ej: un clic justo sobre un codo a 90° devuelve ~0 gracias al arco. */
export function distanceToRamal(
  cx: number,
  cy: number,
  pts: number[][],
  toCvs: (px: number, py: number) => { x: number; y: number },
  rad: number,
): number {
  if (pts.length < 2) return Infinity;

  const cvsPts = pts.map((pt) => toCvs(pt[0], pt[1]));
  let minD = Infinity;

  for (let i = 0; i < cvsPts.length; i++) {
    const isCorner = i > 0 && i < cvsPts.length - 1;
    let actualRad = 0;
    let T_A = { x: 0, y: 0 };
    let T_C = { x: 0, y: 0 };
    let ccx = 0,
      ccy = 0;
    let angle_TA = 0,
      angle_TC = 0;
    let counterclockwise = false;

    if (isCorner) {
      const cvsA = cvsPts[i - 1];
      const cvsB = cvsPts[i];
      const cvsC = cvsPts[i + 1];

      const ax = cvsB.x - cvsA.x,
        ay = cvsB.y - cvsA.y;
      const bx = cvsC.x - cvsB.x,
        by = cvsC.y - cvsB.y;
      const lenA = Math.hypot(ax, ay),
        lenB = Math.hypot(bx, by);

      if (lenA > 0 && lenB > 0) {
        const ux = -ax / lenA,
          uy = -ay / lenA; // B -> A
        const vx = bx / lenB,
          vy = by / lenB; // B -> C
        const cosAngle = ux * vx + uy * vy;

        if (Math.abs(cosAngle) < 0.05) {
          actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);
          if (actualRad > 0.1) {
            T_A = { x: cvsB.x + actualRad * ux, y: cvsB.y + actualRad * uy };
            T_C = { x: cvsB.x + actualRad * vx, y: cvsB.y + actualRad * vy };
            ccx = cvsB.x + (ux + vx) * actualRad;
            ccy = cvsB.y + (uy + vy) * actualRad;
            angle_TA = Math.atan2(-vy, -vx);
            angle_TC = Math.atan2(-uy, -ux);
            const cross = ux * vy - uy * vx;
            counterclockwise = cross > 0;
          }
        }
      }
    }

    if (isCorner && actualRad > 0.1) {
      const distToCenter = Math.hypot(cx - ccx, cy - ccy);
      const distToCircle = Math.abs(distToCenter - actualRad);

      const angle = Math.atan2(cy - ccy, cx - ccx);
      const twoPi = Math.PI * 2;
      const normAngle = ((angle % twoPi) + twoPi) % twoPi;
      const normStart = ((angle_TA % twoPi) + twoPi) % twoPi;
      const normEnd = ((angle_TC % twoPi) + twoPi) % twoPi;

      let inArc = false;
      if (counterclockwise) {
        if (normStart >= normEnd) {
          inArc = normAngle >= normEnd && normAngle <= normStart;
        } else {
          inArc = normAngle >= normEnd || normAngle <= normStart;
        }
      } else {
        if (normStart <= normEnd) {
          inArc = normAngle >= normStart && normAngle <= normEnd;
        } else {
          inArc = normAngle >= normStart || normAngle <= normEnd;
        }
      }

      if (inArc) {
        minD = Math.min(minD, distToCircle);
      } else {
        minD = Math.min(
          minD,
          Math.hypot(cx - T_A.x, cy - T_A.y),
          Math.hypot(cx - T_C.x, cy - T_C.y),
        );
      }
    }
  }

  for (let i = 0; i < cvsPts.length - 1; i++) {
    let start = cvsPts[i];
    let end = cvsPts[i + 1];

    const startIsCorner = i > 0;
    if (startIsCorner) {
      const cvsA = cvsPts[i - 1];
      const cvsB = cvsPts[i];
      const cvsC = cvsPts[i + 1];
      const ax = cvsB.x - cvsA.x,
        ay = cvsB.y - cvsA.y;
      const bx = cvsC.x - cvsB.x,
        by = cvsC.y - cvsB.y;
      const lenA = Math.hypot(ax, ay),
        lenB = Math.hypot(bx, by);
      if (lenA > 0 && lenB > 0) {
        const ux = -ax / lenA,
          uy = -ay / lenA;
        const vx = bx / lenB,
          vy = by / lenB;
        const cosAngle = ux * vx + uy * vy;
        if (Math.abs(cosAngle) < 0.05) {
          const actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);
          if (actualRad > 0.1) {
            start = { x: cvsB.x + actualRad * vx, y: cvsB.y + actualRad * vy }; // T_C
          }
        }
      }
    }

    const endIsCorner = i + 1 < cvsPts.length - 1;
    if (endIsCorner) {
      const cvsA = cvsPts[i];
      const cvsB = cvsPts[i + 1];
      const cvsC = cvsPts[i + 2];
      const ax = cvsB.x - cvsA.x,
        ay = cvsB.y - cvsA.y;
      const bx = cvsC.x - cvsB.x,
        by = cvsC.y - cvsB.y;
      const lenA = Math.hypot(ax, ay),
        lenB = Math.hypot(bx, by);
      if (lenA > 0 && lenB > 0) {
        const ux = -ax / lenA,
          uy = -ay / lenA;
        const vx = bx / lenB,
          vy = by / lenB;
        const cosAngle = ux * vx + uy * vy;
        if (Math.abs(cosAngle) < 0.05) {
          const actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);
          if (actualRad > 0.1) {
            end = { x: cvsB.x + actualRad * ux, y: cvsB.y + actualRad * uy }; // T_A
          }
        }
      }
    }

    const d = pointToSegmentDist(cx, cy, start.x, start.y, end.x, end.y);
    minD = Math.min(minD, d);
  }

  return minD;
}
