// Codo 90° de bajantes/montantes en isometría: SOLO la curva de empalme.
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

/** Constante de la aproximación de un cuarto de círculo con Bézier cúbica (0.5523·R): los dos
 *  puntos de control caen sobre las tangentes y la curva queda tangente a las dos líneas para
 *  CUALQUIER ángulo de pantalla. En iso la vertical y el ramal forman 54.7° o 125.3° (no 90°):
 *  el arco circular solo era tangente a 90° y en el lado obtuso se enroscaba hacia afuera. */
const K_BEZIER = 0.5523;

/** Empalme tangente ramal↔tubo: T1 sobre la vertical del bajante y T2 sobre el extremo
 *  recortado del ramal (ambos a R del vértice), con los controles sobre las tangentes — la
 *  curva entra y sale alineada con las dos tuberías (sin escalón ni gancho). Grosor de línea
 *  igual al de las tuberías (2; 3 en selección). */
export function dibujaCodoIso(a: CodoIsoArgs): void {
  const { ctx, vertex, ramalDir, lado, R, sel } = a;
  const color = sel ? '#FFEB3B' : a.color;
  // Eje vertical en PANTALLA: arriba = (0,−1) — el eje z del mundo proyecta vertical.
  const fdx = 0;
  const fdy = lado === 'arriba' ? -1 : 1;
  const hd = ramalDir; // del vértice hacia el interior del ramal
  // Si el ramal llega VERTICAL (misma dirección que el tubo) no hay esquina 90° que curvar.
  const dot = ramalDir.x * fdx + ramalDir.y * fdy;
  if (Math.abs(dot) > 0.9) return;
  const t1 = { x: vertex.sx + fdx * R, y: vertex.sy + fdy * R }; // tangencia en el tubo
  const t2 = { x: vertex.sx + hd.x * R, y: vertex.sy + hd.y * R }; // tangencia en el ramal
  const k = K_BEZIER * R;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = sel ? 3 : 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  // Controles sobre las tangentes (de T1 hacia el vértice y de T2 hacia el vértice).
  ctx.bezierCurveTo(t1.x - fdx * k, t1.y - fdy * k, t2.x - hd.x * k, t2.y - hd.y * k, t2.x, t2.y);
  ctx.stroke();
  ctx.restore();
}
