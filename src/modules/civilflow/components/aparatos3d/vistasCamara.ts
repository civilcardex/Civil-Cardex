import type * as THREE_NS from 'three';
import type { Aparatos3DApi } from './useAparatos3DScene';

// Vistas de cámara — port fiel del original: ISO vuelve a persp interpolada (700 ms, ease-out
// cúbico); FRENTE/LATERAL/PLANTA encuadran la orto sobre el modelo activo con margen 8 %.

export type VistaKey = 'iso' | 'front' | 'side' | 'top';
const TAN_HALF_FOV = Math.tan((50 / 2) * (Math.PI / 180)); // fov 50°

/** Box3 del grupo activo (o del ensamble si no hay selección). */
function cajaActiva(api: Aparatos3DApi): THREE_NS.Box3 {
  const THREE = api.THREE;
  const box = new THREE.Box3();
  if (api.grupoActivo) box.setFromObject(api.grupoActivo);
  else for (const g of api.grupos.values()) box.expandByObject(g);
  if (box.isEmpty()) box.set(new THREE.Vector3(-5, -5, -5), new THREE.Vector3(5, 5, 5));
  return box;
}

/** Distancia de encuadre ISO del original: max(alto/2·tan, ancho/2·tan/aspect, mr/tan)·1.2. */
function distIso(api: Aparatos3DApi, box: THREE_NS.Box3): number {
  const size = box.getSize(new api.THREE.Vector3());
  const aspect = Math.max(
    0.1,
    api.renderer.domElement.clientWidth / Math.max(1, api.renderer.domElement.clientHeight),
  );
  const dH = size.y / 2 / TAN_HALF_FOV;
  const dW = size.x / 2 / (TAN_HALF_FOV * aspect);
  const dR = api.mr / TAN_HALF_FOV;
  return Math.max(dH, dW, dR) * 1.2;
}

/** Interpola cámara persp + target del controls hacia la pose dada (ease-out cúbico 700 ms). */
export function animateTo(
  api: Aparatos3DApi,
  toPos: THREE_NS.Vector3,
  toTgt: THREE_NS.Vector3,
  dur = 700,
): void {
  if (api.cancelAnim != null) cancelAnimationFrame(api.cancelAnim);
  if (api.orthoOn) activarPersp(api);
  const fromPos = api.camP.position.clone();
  const fromTgt = api.controls.target.clone();
  const t0 = performance.now();
  const step = (): void => {
    const t = Math.min(1, (performance.now() - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    api.camP.position.lerpVectors(fromPos, toPos, e);
    api.controls.target.lerpVectors(fromTgt, toTgt, e);
    if (t < 1) api.cancelAnim = requestAnimationFrame(step);
    else api.cancelAnim = null;
  };
  api.cancelAnim = requestAnimationFrame(step);
}

/** Vuelve a la cámara persp (las vistas ISO/animadas la usan). */
export function activarPersp(api: Aparatos3DApi): void {
  api.orthoOn = false;
  api.controls.object = api.camP;
}

/** Encuadre orto del original: proyecta las 8 esquinas de la caja sobre los ejes right/up de
 *  la vista, centra y fija halfW/halfH con margen 8 %, corregido por aspect. */
function encuadreOrto(
  api: Aparatos3DApi,
  box: THREE_NS.Box3,
  right: THREE_NS.Vector3,
  up: THREE_NS.Vector3,
): { halfW: number; halfH: number; radius: number } {
  const THREE = api.THREE;
  const size = box.getSize(new THREE.Vector3());
  const corners: THREE_NS.Vector3[] = [];
  for (const sx of [box.min.x, box.max.x])
    for (const sy of [box.min.y, box.max.y])
      for (const sz of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(sx, sy, sz));
  const center = box.getCenter(new THREE.Vector3());
  let halfW = 0;
  let halfH = 0;
  for (const c of corners) {
    const d = c.clone().sub(center);
    halfW = Math.max(halfW, Math.abs(d.dot(right)));
    halfH = Math.max(halfH, Math.abs(d.dot(up)));
  }
  halfW *= 1.08;
  halfH *= 1.08;
  const aspect = Math.max(
    0.1,
    api.renderer.domElement.clientWidth / Math.max(1, api.renderer.domElement.clientHeight),
  );
  if (halfW / halfH < aspect) halfW = halfH * aspect;
  else halfH = halfW / aspect;
  return { halfW, halfH, radius: size.length() / 2 || api.mr };
}

export function vistaOrto(
  api: Aparatos3DApi,
  key: 'front' | 'side' | 'top',
  marcarBoton?: (k: VistaKey) => void,
): void {
  const THREE = api.THREE;
  const box = cajaActiva(api);
  const center = box.getCenter(new THREE.Vector3());
  const posVec =
    key === 'front'
      ? new THREE.Vector3(0, 0, 1)
      : key === 'side'
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
  const up = key === 'top' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = key === 'side' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const { halfW, halfH, radius } = encuadreOrto(api, box, right, up);
  const camO = api.camO;
  camO.left = -halfW;
  camO.right = halfW;
  camO.top = halfH;
  camO.bottom = -halfH;
  camO.near = -radius * 20;
  camO.far = radius * 20;
  camO.up = up.clone();
  camO.position.copy(center).addScaledVector(posVec, radius * 5);
  camO.lookAt(center);
  camO.updateProjectionMatrix();
  api.orthoOn = true;
  api.controls.object = camO;
  api.controls.target.copy(center);
  // En resize se re-encuadra la misma vista.
  api.reencuadreOrto = () => vistaOrto(api, key, marcarBoton);
  marcarBoton?.(key);
}

/** Pose ISO (pos + target) para una caja: dirección (1,1,1) a la distancia de encuadre. */
export function poseIso(
  api: Aparatos3DApi,
  box: THREE_NS.Box3,
): { pos: THREE_NS.Vector3; tgt: THREE_NS.Vector3 } {
  const THREE = api.THREE;
  const center = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(1, 1, 1).normalize();
  const dist = distIso(api, box);
  return { pos: center.clone().addScaledVector(dir, dist), tgt: center };
}

/** Vista ISO (persp): dirección (1,1,1) normalizada a la distancia de encuadre del original. */
export function vistaIso(api: Aparatos3DApi, marcarBoton?: (k: VistaKey) => void): void {
  api.reencuadreOrto = null;
  const { pos, tgt } = poseIso(api, cajaActiva(api));
  animateTo(api, pos, tgt);
  marcarBoton?.('iso');
}

/** Dolly del original: acerca/aleja sobre el vector cámara→target (persp) o escala la orto. */
export function zoomBy(api: Aparatos3DApi, factor: number): void {
  if (api.orthoOn) {
    api.camO.zoom = Math.min(50, Math.max(0.05, api.camO.zoom / factor));
    api.camO.updateProjectionMatrix();
    return;
  }
  const target = api.controls.target;
  const dir = api.camP.position.clone().sub(target);
  const newDist = Math.max(0.02, dir.length() * factor);
  api.camP.position.copy(target).addScaledVector(dir.normalize(), newDist);
}

/** Reset (⟳): vuelve a la pose ISO por defecto calculada al terminar la carga. */
export function resetVista(api: Aparatos3DApi, marcarBoton?: (k: VistaKey) => void): void {
  if (!api.defPos || !api.defTgt) {
    vistaIso(api, marcarBoton);
    return;
  }
  animateTo(api, api.defPos.clone(), api.defTgt.clone());
  marcarBoton?.('iso');
}
