import type { IPlanoEngineCore } from '../PlanoState.ts';
import { planCodoCornerAt } from './drawRamalPath.ts';

/** Arco del codo en la ESQUINA de una guía: mismo radio y brazos que el trim de drawRamalPath para que arco y tubería coincidan. true = había esquina que redondear. */
export function drawCornerCodoArc(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  pt: number[],
  u: { x: number; y: number },
): boolean {
  // Usar planCodoCornerAt para consistencia total con el trim de drawRamalPath (mismo actualRad y arms)
  const corner = planCodoCornerAt(engine, pt);
  if (!corner) return false;
  const [a0, a1] = corner.arms;
  // Determinar cuál de los dos arms es u (el del ramal con el codo) y cuál es el otro
  const isU_A0 = Math.abs(a0.x * u.x + a0.y * u.y) > 0.98;
  const v = isU_A0 ? a1 : a0;
  // Verificar que u sea realmente uno de los arms y que el otro no sea colineal (ya garantizado por planCodoCornerAt)
  if (Math.abs(v.x * u.x + v.y * u.y) >= 0.98) return false;
  const c = engine.toCvs(pt[0], pt[1]);
  const rad = corner.actualRad;
  const cosA = u.x * v.x + u.y * v.y;
  const is45 = Math.abs(cosA + Math.cos(Math.PI / 4)) < 0.05;
  const T_A = { x: c.x + rad * u.x, y: c.y + rad * u.y };
  const T_C = { x: c.x + rad * v.x, y: c.y + rad * v.y };
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.2 * engine.zoom * (engine.lineWidthScale || 1);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  // Hay que reiniciar el dash explícitamente — el cuerpo del ramal puede estar discontinuo
  // (tributario) y el símbolo no debe heredar el dash.
  ctx.setLineDash([]);
  // ponytail: masquer la tubería que cruza la esquina — sobre el tubo negro (REV) el arco negro
  // se perdía y solo quedaban los ticks (mancha). El halo blanco hace leer el arco limpio.
  ctx.beginPath();
  if (is45) {
    ctx.moveTo(T_A.x, T_A.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(T_C.x, T_C.y);
  } else {
    const ccx = c.x + (u.x + v.x) * rad;
    const ccy = c.y + (u.y + v.y) * rad;
    const angle_TA = Math.atan2(-v.y, -v.x);
    const angle_TC = Math.atan2(-u.y, -u.x);
    const cross = u.x * v.y - u.y * v.x;
    ctx.arc(ccx, ccy, rad, angle_TA, angle_TC, cross > 0);
  }
  ctx.lineWidth = 1.2 * engine.zoom * (engine.lineWidthScale || 1);
  ctx.strokeStyle = '#000000';
  ctx.stroke();
  // ponytail: ticks transversales en los extremos del arco — idéntico al quiebre
  // interior de drawRamalPath (2 segmentos del mismo ramal). Sin halo blanco.
  const tickLen = engine.mm2cvs(1.2);
  const perp_u = { x: -u.y, y: u.x };
  const perp_v = { x: -v.y, y: v.x };
  ctx.lineCap = 'square';
  ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
  ctx.strokeStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(T_A.x - (perp_u.x * tickLen) / 2, T_A.y - (perp_u.y * tickLen) / 2);
  ctx.lineTo(T_A.x + (perp_u.x * tickLen) / 2, T_A.y + (perp_u.y * tickLen) / 2);
  ctx.moveTo(T_C.x - (perp_v.x * tickLen) / 2, T_C.y - (perp_v.y * tickLen) / 2);
  ctx.lineTo(T_C.x + (perp_v.x * tickLen) / 2, T_C.y + (perp_v.y * tickLen) / 2);
  ctx.stroke();
  ctx.restore();
  return true;
}
