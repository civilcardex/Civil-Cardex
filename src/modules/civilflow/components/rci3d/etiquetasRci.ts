import type * as THREE_NS from 'three';
import { LABEL_POSITIONS, RCI_MONO } from './rci3dData';
import type { Rci3DApi } from './useRci3DScene';

// Capa de etiquetas — port del HTML original: canvas 2D full-viewport (pointer-events none)
// redibujado cada frame. Cada etiqueta = línea guía con codo + flecha en la punta + círculo
// numerado. Oclusión por raycaster contra los occluders con caché refrescada cada 4 frames.
// Modo foco permanente (orig. usuario): solo se dibuja la etiqueta del componente seleccionado
// en el desplegable; sin selección no se dibuja ninguna (estado inicial del HTML tras cargar).

const OCC_EVERY = 4;

interface EtiquetaEstado {
  ctx: CanvasRenderingContext2D | null;
  occCache: Record<string, boolean>;
  frameCnt: number;
  raycaster: THREE_NS.Raycaster | null;
}

const estado: EtiquetaEstado = { ctx: null, occCache: {}, frameCnt: 0, raycaster: null };

/** Invalida el estado cacheado (ctx del canvas, caché de oclusión, raycaster). Obligatorio al
 *  desmontar el visor: el canvas 2D se destruye con él y un ctx viejo haría que el repintado
 *  vaya a un canvas desconectado (etiquetas invisibles en el siguiente montaje). */
export function resetEtiquetasRci(): void {
  estado.ctx = null;
  estado.occCache = {};
  estado.frameCnt = 0;
  estado.raycaster = null;
}

/** ¿La posición 3D está oculta por algún occluder desde la cámara activa? */
function checkOcclusion(api: Rci3DApi, pos3d: THREE_NS.Vector3): boolean {
  if (api.occluders.length === 0) return false;
  const THREE = api.THREE;
  if (!estado.raycaster) estado.raycaster = new THREE.Raycaster();
  const cam = api.orthoOn ? api.camO : api.camP;
  const dir = new THREE.Vector3().subVectors(pos3d, cam.position);
  const dist = dir.length();
  dir.normalize();
  estado.raycaster.set(cam.position, dir);
  estado.raycaster.far = dist - 0.01; // solo hasta el punto, no más allá
  return estado.raycaster.intersectObjects(api.occluders, false).length > 0;
}

/** Línea guía con codo + flecha + círculo numerado (port 1:1 del drawLabel del HTML). */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: number,
  sc: number,
  dir: 0 | 1,
  ang: number,
  L1: number,
  L2: number,
): void {
  const R = Math.round(14 * sc);
  const col = '#1f6feb';
  const lw = 2.5;
  const fs = Math.round(21 * sc);
  const as = Math.round(6 * sc);

  const rad = (ang * Math.PI) / 180;
  const sign = dir === 0 ? 1 : -1;
  const kx = x + sign * Math.sin(rad) * L2;
  const ky = y - Math.cos(rad) * L2;
  const cx = kx + sign * L1;
  const cy = ky;

  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = lw;

  // Segmento con flecha: punta → codo
  ctx.beginPath();
  ctx.moveTo(x + sign * Math.sin(rad) * as * 1.8, y - Math.cos(rad) * as * 1.8);
  ctx.lineTo(kx, ky);
  ctx.stroke();

  // Flecha en la punta
  const fx1 = x + sign * Math.sin(rad) * as * 1.8 - Math.cos(rad) * as;
  const fy1 = y - Math.cos(rad) * as * 1.8 - sign * Math.sin(rad) * as;
  const fx2 = x + sign * Math.sin(rad) * as * 1.8 + Math.cos(rad) * as;
  const fy2 = y - Math.cos(rad) * as * 1.8 + sign * Math.sin(rad) * as;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(fx1, fy1);
  ctx.lineTo(fx2, fy2);
  ctx.closePath();
  ctx.fill();

  // Segmento horizontal: codo → borde círculo
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(cx - sign * R, cy);
  ctx.stroke();

  // Círculo + número
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `bold ${fs}px ${RCI_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(id), cx, cy);
}

/** Frame de etiquetas — llamado desde el loop de la escena. Solo dibuja la etiqueta del
 *  componente seleccionado (foco); sin selección limpia el canvas. */
export function dibujarEtiquetasRci(
  api: Rci3DApi,
  lblCanvas: HTMLCanvasElement | null,
  seleccionado: number | null,
): void {
  if (!lblCanvas) return;
  if (!estado.ctx) estado.ctx = lblCanvas.getContext('2d');
  const ctx = estado.ctx;
  if (!ctx) return;
  const W = lblCanvas.clientWidth;
  const H = lblCanvas.clientHeight;
  if (W <= 0 || H <= 0) return;
  if (lblCanvas.width !== W || lblCanvas.height !== H) {
    lblCanvas.width = W;
    lblCanvas.height = H;
    lblCanvas.style.width = `${W}px`;
    lblCanvas.style.height = `${H}px`;
  }
  ctx.clearRect(0, 0, W, H);
  if (seleccionado == null) return; // sin selección: sin etiquetas (como el HTML al cargar)

  const THREE = api.THREE;
  const cam = api.orthoOn ? api.camO : api.camP;
  // Cámara temporal con el aspect del viewport principal (persp).
  const projCam = cam.clone();
  if (!api.orthoOn) {
    (projCam as THREE_NS.PerspectiveCamera).aspect = W / H;
    projCam.updateProjectionMatrix();
  }

  const doOccCheck = estado.frameCnt++ % OCC_EVERY === 0;

  for (const [idStr, lbl] of Object.entries(LABEL_POSITIONS)) {
    const refId = lbl.ref ?? Number(idStr);
    if (refId !== seleccionado) continue; // foco: solo el seleccionado

    const v = new THREE.Vector3(...lbl.pos).project(projCam as THREE_NS.Camera);
    const x = (v.x * 0.5 + 0.5) * W;
    const y = (v.y * -0.5 + 0.5) * H;
    if (v.z >= 1 || x < 10 || x > W - 10 || y < 10 || y > H - 10) {
      estado.occCache[idStr] = false;
      continue;
    }

    if (doOccCheck) {
      estado.occCache[idStr] = !checkOcclusion(api, new THREE.Vector3(...lbl.pos));
    }
    if (estado.occCache[idStr] === false) continue; // oculta

    drawLabel(ctx, x, y, refId, lbl.scale, lbl.dir, lbl.ang, lbl.L1, lbl.L2);
  }
}
