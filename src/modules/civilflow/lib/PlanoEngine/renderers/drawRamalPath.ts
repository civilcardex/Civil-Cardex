import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

export interface ElbowInfo {
  T_A: { x: number; y: number };
  T_C: { x: number; y: number };
  perp_u: { x: number; y: number };
  perp_v: { x: number; y: number };
}

export function drawRamalPath(
  ctx: CanvasRenderingContext2D,
  pts: number[][],
  engine: IPlanoEngineCore,
  _col: string,
): ElbowInfo[] {
  if (pts.length < 2) return [];

  const cvsPts = pts.map((pt) => engine.toCvs(pt[0], pt[1]));
  const elbows: ElbowInfo[] = [];

  const activeRamal = engine.activeRamal;
  const r =
    engine.ramales.find((rm) => rm.pts === pts) || (activeRamal?.pts === pts ? activeRamal : null);
  const netId = r ? r.net : engine.activeNet;
  const netRamales = engine.ramales.filter((rm) => rm.net === netId);
  if (
    activeRamal &&
    activeRamal.net === netId &&
    !netRamales.some((rm) => rm.pts === activeRamal.pts)
  ) {
    netRamales.push(activeRamal as unknown as PlanoRamal);
  }

  ctx.beginPath();
  ctx.moveTo(cvsPts[0].x, cvsPts[0].y);

  for (let i = 1; i < cvsPts.length; i++) {
    const isCorner = i < cvsPts.length - 1;
    let drewArc = false;

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
          uy = -ay / lenA;
        const vx = bx / lenB,
          vy = by / lenB;
        const cosAngle = ux * vx + uy * vy;

        const pt = pts[i];
        let isJunc = false;
        for (let k = 0; k < pts.length; k++) {
          if (k !== i && Math.hypot(pts[k][0] - pt[0], pts[k][1] - pt[1]) < 0.5) {
            isJunc = true;
            break;
          }
        }
        if (!isJunc) {
          const r = engine.ramales.find((rm) => rm.pts === pts);
          if (r) {
            const hasTrib = engine.ramales.some(
              (other) =>
                other.padre === r.id &&
                other.pts.length >= 2 &&
                Math.hypot(other.pts[0][0] - pt[0], other.pts[0][1] - pt[1]) < 0.5,
            );
            if (hasTrib) isJunc = true;
          }
        }
        if (!isJunc) {
          isJunc = engine.bajantes.some((b) => {
            if (b.net !== netId) return false;
            const lvl = engine.nivelActual?.label ?? '';
            const disp = b.desplazamientos?.[lvl];
            const bx = b.x + (disp?.dx || 0);
            const by = b.y + (disp?.dy || 0);
            // Verifica la proximidad al propio vértice
            if (Math.hypot(bx - pt[0], by - pt[1]) < 10) return true;
            // También comprueba si la bajante está cerca de los segmentos adyacentes
            const prev = pts[i - 1];
            const next = pts[i + 1];
            if (prev) {
              const dx = pt[0] - prev[0],
                dy = pt[1] - prev[1];
              const lenSq = dx * dx + dy * dy;
              if (lenSq > 0.001) {
                let t = ((bx - prev[0]) * dx + (by - prev[1]) * dy) / lenSq;
                t = Math.max(0, Math.min(1, t));
                const px = prev[0] + t * dx,
                  py = prev[1] + t * dy;
                if (Math.hypot(bx - px, by - py) < 10) return true;
              }
            }
            if (next) {
              const dx = next[0] - pt[0],
                dy = next[1] - pt[1];
              const lenSq = dx * dx + dy * dy;
              if (lenSq > 0.001) {
                let t = ((bx - pt[0]) * dx + (by - pt[1]) * dy) / lenSq;
                t = Math.max(0, Math.min(1, t));
                const px = pt[0] + t * dx,
                  py = pt[1] + t * dy;
                if (Math.hypot(bx - px, by - py) < 10) return true;
              }
            }
            return false;
          });
          if (!isJunc) {
            isJunc = engine.crossFloorGhosts.some((g) => {
              if (g.net !== netId) return false;
              if (Math.hypot(g.x - pt[0], g.y - pt[1]) < 10) return true;
              const prev = pts[i - 1];
              const next = pts[i + 1];
              if (prev) {
                const dx = pt[0] - prev[0],
                  dy = pt[1] - prev[1];
                const lenSq = dx * dx + dy * dy;
                if (lenSq > 0.001) {
                  let t = ((g.x - prev[0]) * dx + (g.y - prev[1]) * dy) / lenSq;
                  t = Math.max(0, Math.min(1, t));
                  const px = prev[0] + t * dx,
                    py = prev[1] + t * dy;
                  if (Math.hypot(g.x - px, g.y - py) < 10) return true;
                }
              }
              if (next) {
                const dx = next[0] - pt[0],
                  dy = next[1] - pt[1];
                const lenSq = dx * dx + dy * dy;
                if (lenSq > 0.001) {
                  let t = ((g.x - pt[0]) * dx + (g.y - pt[1]) * dy) / lenSq;
                  t = Math.max(0, Math.min(1, t));
                  const px = pt[0] + t * dx,
                    py = pt[1] + t * dy;
                  if (Math.hypot(g.x - px, g.y - py) < 10) return true;
                }
              }
              return false;
            });
          }
        }

        const is45 = Math.abs(cosAngle + Math.cos(Math.PI / 4)) < 0.05;
        if (is45 && !isJunc) {
          const rad = engine.mm2cvs(1.5);
          const actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);

          if (actualRad > 0.1) {
            const T_A = { x: cvsB.x + actualRad * ux, y: cvsB.y + actualRad * uy };
            const T_C = { x: cvsB.x + actualRad * vx, y: cvsB.y + actualRad * vy };

            ctx.lineTo(T_A.x, T_A.y);
            ctx.stroke();

            ctx.save();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2 * engine.zoom;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            // Hay que reiniciar el dash explícitamente — ctx.save() conserva el dash que el
            // llamador fijó para el cuerpo (p. ej. la línea discontinua de un tributario), así
            // que sin esto el propio símbolo de codo lo hereda y se dibuja también discontinuo.
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(T_A.x, T_A.y);
            ctx.lineTo(cvsB.x, cvsB.y);
            ctx.lineTo(T_C.x, T_C.y);
            ctx.stroke();
            ctx.restore();

            ctx.beginPath();
            ctx.moveTo(T_C.x, T_C.y);

            const perp_u = { x: -uy, y: ux };
            const perp_v = { x: -vy, y: vx };
            elbows.push({ T_A, T_C, perp_u, perp_v });
            drewArc = true;
          }
        } else if (Math.abs(cosAngle) < 0.05 && !isJunc) {
          const rad = engine.mm2cvs(1.5);
          const actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);

          if (actualRad > 0.1) {
            const T_A = { x: cvsB.x + actualRad * ux, y: cvsB.y + actualRad * uy };
            const T_C = { x: cvsB.x + actualRad * vx, y: cvsB.y + actualRad * vy };
            const ccx = cvsB.x + (ux + vx) * actualRad;
            const ccy = cvsB.y + (uy + vy) * actualRad;
            const angle_TA = Math.atan2(-vy, -vx);
            const angle_TC = Math.atan2(-uy, -ux);
            const cross = ux * vy - uy * vx;
            const counterclockwise = cross > 0;
            const perp_u = { x: -uy, y: ux };
            const perp_v = { x: -vy, y: vx };

            ctx.lineTo(T_A.x, T_A.y);
            ctx.stroke();

            ctx.save();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2 * engine.zoom;
            // Mismo problema de herencia de dash que el inglete de 45° de arriba — se reinicia explícitamente.
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(ccx, ccy, actualRad, angle_TA, angle_TC, counterclockwise);
            ctx.stroke();
            ctx.restore();

            ctx.beginPath();
            ctx.moveTo(T_C.x, T_C.y);

            elbows.push({ T_A, T_C, perp_u, perp_v });
            drewArc = true;
          }
        }
      }
    }

    if (!drewArc) {
      ctx.lineTo(cvsPts[i].x, cvsPts[i].y);
    }
  }

  ctx.stroke();

  if (elbows.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.setLineDash([]);
    const tickLen = engine.mm2cvs(1.0);
    elbows.forEach((elb) => {
      ctx.beginPath();
      ctx.moveTo(
        elb.T_A.x - (elb.perp_u.x * tickLen) / 2,
        elb.T_A.y - (elb.perp_u.y * tickLen) / 2,
      );
      ctx.lineTo(
        elb.T_A.x + (elb.perp_u.x * tickLen) / 2,
        elb.T_A.y + (elb.perp_u.y * tickLen) / 2,
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(
        elb.T_C.x - (elb.perp_v.x * tickLen) / 2,
        elb.T_C.y - (elb.perp_v.y * tickLen) / 2,
      );
      ctx.lineTo(
        elb.T_C.x + (elb.perp_v.x * tickLen) / 2,
        elb.T_C.y + (elb.perp_v.y * tickLen) / 2,
      );
      ctx.stroke();
    });
    ctx.restore();
  }

  return elbows;
}
