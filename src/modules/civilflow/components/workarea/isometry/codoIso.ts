// Codo 90° de bajantes/montantes en isometría: SOLO el arco de empalme.
// La flecha de dirección (círculo+triángulo) la dibuja useIsometryRender aparte, intacta —
// este módulo es únicamente la curva que conecta el ramal con el tubo vertical.
// El VÉRTICE lo calcula preparaCodos como la INTERSECCIÓN de la línea del ramal con la
// vertical del centro del bajante: así T1 cae sobre el tubo y T2 sobre el extremo recortado
// del ramal — el arco queda conectado a las dos líneas reales (lección de la ronda anterior:
// usar el extremo del ramal como vértice dejaba el arco flotando a varios px del tubo).

export interface CodoIsoArgs {
  ctx: CanvasRenderingContext2D;
  /** Intersección de la línea del ramal con la vertical del bajante (px de pantalla). */
  vertex: { sx: number; sy: number };
  /** Dirección unitaria EN PANTALLA del vértice hacia el interior del ramal. */
  ramalDir: { x: number; y: number };
  /** Lado del arco: donde el tubo SIGUE (el de mayor tramo dibujado) — 'arriba' | 'abajo'. */
  lado: 'arriba' | 'abajo';
  /** Radio del empalme en px de pantalla (uniforme, escala con el zoom). */
  R: number;
  color: string;
  sel: boolean;
}

/** Empalme tangente ramal↔tubo: T1 en la vertical del bajante, T2 en el extremo recortado del
 *  ramal, centro C = vertex + (fd+hd)·R, barrido corto (el wrap de atan2 podía mandarlo por
 *  los 270°). Grosor de línea igual al de las tuberías (2; 3 en selección). */
export function dibujaCodoIso(a: CodoIsoArgs): void {
  const { ctx, vertex, ramalDir, lado, R, sel } = a;
  const color = sel ? '#FFEB3B' : a.color;
  // Eje vertical en PANTALLA: arriba = (0,−1) — el eje z del mundo proyecta vertical.
  const vdx = 0;
  const vdy = -1;
  // Lado vertical del empalme = donde el tubo sigue existiendo (ladoTubo).
  const fdx = lado === 'arriba' ? vdx : -vdx;
  const fdy = lado === 'arriba' ? vdy : -vdy;
  const hd = ramalDir; // del vértice hacia el interior del ramal
  // Si el ramal llega VERTICAL (misma dirección que el tubo) no hay esquina 90° que curvar.
  const dot = ramalDir.x * fdx + ramalDir.y * fdy;
  if (Math.abs(dot) > 0.9) return;
  const p1 = { x: vertex.sx + fdx * R, y: vertex.sy + fdy * R }; // tangencia en el tubo
  const p2 = { x: vertex.sx + hd.x * R, y: vertex.sy + hd.y * R }; // tangencia en el ramal
  const C = { x: vertex.sx + (fdx + hd.x) * R, y: vertex.sy + (fdy + hd.y) * R };
  const ang1 = Math.atan2(p1.y - C.y, p1.x - C.x);
  const ang2 = Math.atan2(p2.y - C.y, p2.x - C.x);
  const dosPi = Math.PI * 2;
  const sweepHorario = (((ang2 - ang1) % dosPi) + dosPi) % dosPi;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = sel ? 3 : 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(C.x, C.y, R, ang1, ang2, sweepHorario > Math.PI);
  ctx.stroke();
  ctx.restore();
}
