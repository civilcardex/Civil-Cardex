import type * as THREE_NS from 'three';
import { ETIQUETAS } from './epc3dData.ts';
import type { Epc3DApi } from './useEpc3DScene.ts';
import { dibujarEtiquetaLider } from '../shared/leaderLabel.ts';

// Etiquetas numeradas con flecha (port del HTML original): punta sobre la pieza, segmento
// inclinado con flecha, codo horizontal y círculo con el número. Solo se dibuja la etiqueta
// del componente seleccionado (modo focus) — el desplegable manda, no hay toggle global.

const ETIQUETA_ACTIVA = '#1f6feb';
const ETIQUETA_BASE = '#00ffff';

/** Dibuja una etiqueta: flecha → codo inclinado → segmento horizontal → círculo numerado.
 *  Activa = azul/grueso; base = cian/fin. Geometría en dibujarEtiquetaLider (compartida). */
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
  dibujarEtiquetaLider(
    ctx,
    x,
    y,
    id,
    sc,
    dir,
    ang,
    L1,
    L2,
    activa ? ETIQUETA_ACTIVA : ETIQUETA_BASE,
    activa ? 2.5 : 1.5,
    'bold {fs}px monospace',
  );
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
