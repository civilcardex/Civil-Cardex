import type * as THREE_NS from 'three';
import { ETIQUETAS } from './epc3dData';
import type { Epc3DApi } from './useEpc3DScene';

// Etiquetas numeradas con flecha (port del HTML original): punta sobre la pieza, segmento
// inclinado con flecha, codo horizontal y círculo con el número. Solo se dibuja la etiqueta
// del componente seleccionado (modo focus) — el desplegable manda, no hay toggle global.

const ETIQUETA_ACTIVA = '#1f6feb';
const ETIQUETA_BASE = '#00ffff';

/** Dibuja una etiqueta: flecha → codo inclinado → segmento horizontal → círculo numerado. */
function dibujarEtiqueta(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: string | number,
  sc: number,
  dir: number,
  ang: number,
  L1: number,
  L2: number,
  activa: boolean,
): void {
  const R = Math.round(14 * sc);
  const col = activa ? ETIQUETA_ACTIVA : ETIQUETA_BASE;
  const lw = activa ? 2.5 : 1.5;
  const fs = Math.round(21 * sc);
  const as = Math.round(6 * sc);

  const rad = (ang * Math.PI) / 180;
  const sign = dir === 0 ? 1 : -1;
  // Codo: sube L2 desde la punta, inclinado ang grados hacia el lado del círculo
  const kx = x + sign * Math.sin(rad) * L2;
  const ky = y - Math.cos(rad) * L2;
  // Círculo: L1 horizontal desde el codo
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

  // Segmento horizontal: codo → borde del círculo
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(cx - sign * R, cy);
  ctx.stroke();

  // Círculo + número
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `bold ${fs}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(id), cx, cy);
}

// Temporales lazy (three se importa dinámicamente — no hay namespace en tiempo de módulo)
let _dir: THREE_NS.Vector3 | null = null;
let _v: THREE_NS.Vector3 | null = null;
let _v2: THREE_NS.Vector3 | null = null;

/** ¿El punto 3D está tapado por algún occluder desde la cámara activa? */
function ocluido(api: Epc3DApi, pos3d: THREE_NS.Vector3): boolean {
  if (!api.occluders.length) return false;
  const cam = api.orthoOn ? api.camO : api.camP;
  _dir ??= new api.THREE.Vector3();
  const dir = _dir.subVectors(pos3d, cam.position);
  const dist = dir.length();
  dir.normalize();
  const ray = api.occRay;
  ray.set(cam.position, dir);
  ray.far = dist - 0.01;
  return ray.intersectObjects(api.occluders, false).length > 0;
}

/** Redimensiona el canvas de etiquetas al viewport y dibuja las etiquetas visibles. */
export function actualizarEtiquetas(api: Epc3DApi, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.parentElement?.clientWidth ?? 0;
  const H = canvas.parentElement?.clientHeight ?? 0;
  if (W <= 0 || H <= 0) return;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
  ctx.clearRect(0, 0, W, H);
  if (api.activeLabel == null) return;

  // Cámara de proyección con el aspect real del viewport principal
  const persp = api.orthoOn ? null : api.camP.clone();
  if (persp) {
    persp.aspect = W / H;
    persp.updateProjectionMatrix();
  }
  const projCam = persp ?? api.camO.clone();

  // Caché de oclusión refrescada cada 4 frames
  const checaOclusion = api.occFrameCnt++ % 4 === 0;
  const THREE = api.THREE;

  for (const [idStr, lbl] of Object.entries(ETIQUETAS)) {
    // Modo focus: solo la etiqueta del seleccionado (sub-etiquetas por su ref)
    const refId = lbl.ref ?? idStr;
    if (String(refId) !== String(api.activeLabel)) continue;
    _v ??= new THREE.Vector3();
    const v = _v.set(lbl.pos[0], lbl.pos[1], lbl.pos[2]).project(projCam);
    const x = (v.x * 0.5 + 0.5) * W;
    const y = (v.y * -0.5 + 0.5) * H;
    if (v.z >= 1 || x < 10 || x > W - 10 || y < 10 || y > H - 10) {
      api.lblOccCache[idStr] = false;
      continue;
    }
    if (checaOclusion) {
      _v2 ??= new THREE.Vector3();
      api.lblOccCache[idStr] = !ocluido(api, _v2.set(lbl.pos[0], lbl.pos[1], lbl.pos[2]));
    }
    if (api.lblOccCache[idStr] === false) continue;
    dibujarEtiqueta(ctx, x, y, refId, lbl.scale, lbl.dir, lbl.ang, lbl.L1, lbl.L2, true);
  }
}
