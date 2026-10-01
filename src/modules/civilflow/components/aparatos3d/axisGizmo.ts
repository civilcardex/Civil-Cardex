import type * as THREE_NS from 'three';

// Gizmo 2D de ejes (port de drawAxisIndicator del original): proyecta los ejes del mundo a
// espacio de vista, dibuja el más profundo primero con alpha reducida y etiqueta X/Y/Z.

const EJE_LEN = 28;
const COLORES: Record<string, string> = { X: '#f85149', Y: '#3fb950', Z: '#388bfd' };
const EJES: Array<{ label: string; dx: number; dy: number; dz: number }> = [
  { label: 'X', dx: 1, dy: 0, dz: 0 },
  { label: 'Y', dx: 0, dy: 1, dz: 0 },
  { label: 'Z', dx: 0, dy: 0, dz: 1 },
];

/** Dibuja el gizmo de ejes sobre el canvas 2D (80×80) según la cámara activa. */
export function dibujarGizmoEjes(canvas: HTMLCanvasElement | null, camera: THREE_NS.Camera): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);

  const proyectados = EJES.map((e) => {
    // Dirección del eje del mundo → espacio de vista (rotación de la inversa de modelWorld).
    const vx = e.dx;
    const vy = e.dy;
    const vz = e.dz;
    const m = camera.matrixWorldInverse.elements;
    // transformDirection (rotation · v, sin traslación):
    const rx = m[0] * vx + m[4] * vy + m[8] * vz;
    const ry = m[1] * vx + m[5] * vy + m[9] * vz;
    const rz = m[2] * vx + m[6] * vy + m[10] * vz;
    return { label: e.label, rx, ry, rz };
  });
  // Fondo primero (rz más negativo apunta lejos de la cámara en espacio de vista).
  proyectados.sort((a, b) => a.rz - b.rz);

  for (const p of proyectados) {
    const sx = cx + p.rx * EJE_LEN;
    const sy = cy - p.ry * EJE_LEN;
    const alpha = p.rz < 0 ? 0.3 : 1;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORES[p.label];
    ctx.fillStyle = COLORES[p.label];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, cx + p.rx * EJE_LEN * 1.28, cy - p.ry * EJE_LEN * 1.28);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#7d8590';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}
