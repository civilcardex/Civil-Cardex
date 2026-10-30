import { project } from '../geometry';
import type { VistaIso } from './isoView.ts';

/** Pase 4 (último) de la isometría: ejes X/Y/Z de colores en la esquina inferior izquierda y
 * el rótulo de la rotación actual (ej: "-45°/30° z1.0") arriba a la izquierda. Va al FINAL para
 * que ningún tubo lo tape. Ej: al arrastrar la vista, el rótulo muestra siempre los grados
 * vivos de rotX/rotZ y el factor z de escala vertical. */
export function pintaEjes(args: {
  ctx: CanvasRenderingContext2D;
  /** Alto del lienzo en px CSS — los ejes se anclan a H - 50. */
  H: number;
  vista: VistaIso;
}): void {
  const { ctx, H, vista } = args;
  const { rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy } = vista;
  // Indicador de ejes (esquina inferior izquierda)
  const axCx = 50,
    axCy = H - 50;
  const axLen = 25;
  const axisColors = ['#ff4444', '#44ff44', '#4488ff'];
  const axisLabels = ['X', 'Y', 'Z'];
  const axisDirs: [number, number, number][] = [
    [axLen, 0, 0],
    [0, axLen, 0],
    [0, 0, axLen],
  ];
  for (let i = 0; i < 3; i++) {
    const from = project(
      0,
      0,
      0,
      rotZ,
      rotX,
      scaleZ,
      zoom,
      offX - cx + axCx,
      offY - cy + axCy,
      0,
      0,
    );
    const to = project(
      axisDirs[i][0],
      axisDirs[i][1],
      axisDirs[i][2],
      rotZ,
      rotX,
      scaleZ,
      zoom,
      offX - cx + axCx,
      offY - cy + axCy,
      0,
      0,
    );
    ctx.beginPath();
    ctx.moveTo(from.sx, from.sy);
    ctx.lineTo(to.sx, to.sy);
    ctx.strokeStyle = axisColors[i];
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = axisColors[i];
    ctx.font = 'bold 10px Geist,monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(axisLabels[i], to.sx, to.sy - 3);
  }
  ctx.fillStyle = '#5a6a6b';
  ctx.font = '9px Geist,monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${rotX}°/${rotZ}° z${scaleZ.toFixed(1)}`, 6, 6);
}
