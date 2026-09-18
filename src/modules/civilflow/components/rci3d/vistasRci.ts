import type * as THREE_NS from 'three';
import type { Rci3DApi } from './useRci3DScene';

// Vistas de cámara — port del HTML original: ISO persp interpolada (700 ms, ease-out cúbico);
// FRENTE/LATERAL/PLANTA orto con encuadre por proyección de las 8 esquinas del bbox (margen
// 8 %); zoom por escala de frustum (orto) o dolly sobre el vector cámara→target (persp).

export type VistaKey = 'iso' | 'front' | 'side' | 'top';

const TAN_HALF_FOV = Math.tan((50 / 2) * (Math.PI / 180)); // fov 50°

/** Vuelve a la cámara persp (las vistas ISO/animadas la usan). */
export function activarPersp(api: Rci3DApi): void {
  api.orthoOn = false;
  api.controls.object = api.camP;
}

/** Interpola cámara persp + target del controls hacia la pose dada (ease-out cúbico 700 ms). */
export function animateTo(
  api: Rci3DApi,
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
    // Render bajo demanda: la animación exige repintar mientras dura.
    api.framesPendientes = 2;
    if (t < 1) api.cancelAnim = requestAnimationFrame(step);
    else api.cancelAnim = null;
  };
  api.cancelAnim = requestAnimationFrame(step);
}

/** Distancia ISO del original: max(alto/2·tan, ancho/2·tan/aspect, MR/tan)·1.05. */
function distIso(api: Rci3DApi): number {
  const aspect = Math.max(
    0.1,
    api.renderer.domElement.clientWidth / Math.max(1, api.renderer.domElement.clientHeight),
  );
  return (
    Math.max(
      api.bbox.y / 2 / TAN_HALF_FOV,
      api.bbox.x / 2 / (TAN_HALF_FOV * aspect),
      api.mr / TAN_HALF_FOV,
    ) * 1.05
  );
}

/** Encuadre orto del original: proyecta las 8 esquinas del bbox sobre los ejes right/up,
 *  centra en el medio proyectado y fija halfW/halfH con margen 8 % corregido por aspect. */
function setOrthoView(api: Rci3DApi, posVec: THREE_NS.Vector3, upVec: THREE_NS.Vector3): void {
  const THREE = api.THREE;
  api.orthoOn = true;

  const box = new THREE.Box3().setFromObject(api.assembly);
  const aspect = Math.max(
    0.1,
    api.renderer.domElement.clientWidth / Math.max(1, api.renderer.domElement.clientHeight),
  );

  const fwd = posVec.clone().negate().normalize();
  const right = new THREE.Vector3().crossVectors(fwd, upVec).normalize();
  const realUp = new THREE.Vector3().crossVectors(right, fwd).normalize();

  const corners: THREE_NS.Vector3[] = [];
  for (const sx of [box.min.x, box.max.x])
    for (const sy of [box.min.y, box.max.y])
      for (const sz of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(sx, sy, sz));

  let minR = 1e9;
  let maxR = -1e9;
  let minU = 1e9;
  let maxU = -1e9;
  for (const c of corners) {
    const r = c.dot(right);
    const u = c.dot(realUp);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
  }

  const cR = (minR + maxR) / 2;
  const cU = (minU + maxU) / 2;
  let halfW = ((maxR - minR) / 2) * 1.08;
  let halfH = ((maxU - minU) / 2) * 1.08;
  if (halfW / halfH > aspect) halfH = halfW / aspect;
  else halfW = halfH * aspect;

  const tgt = new THREE.Vector3().addScaledVector(right, cR).addScaledVector(realUp, cU);

  const camO = api.camO;
  camO.left = -halfW;
  camO.right = halfW;
  camO.top = halfH;
  camO.bottom = -halfH;
  camO.near = -api.mr * 10;
  camO.far = api.mr * 10;
  camO.updateProjectionMatrix();

  camO.position.copy(tgt).addScaledVector(posVec, api.mr * 5);
  camO.up = upVec.clone();
  camO.lookAt(tgt);
  api.controls.object = camO;
  api.controls.target.copy(tgt);
  api.controls.update();
}

export function vistaOrto(api: Rci3DApi, key: 'front' | 'side' | 'top'): void {
  const THREE = api.THREE;
  if (key === 'front') setOrthoView(api, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
  else if (key === 'side')
    setOrthoView(api, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
  else setOrthoView(api, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
}

/** Vista ISO (persp): dirección (1,1,1) a la distancia de encuadre del original. */
export function vistaIso(api: Rci3DApi): void {
  const THREE = api.THREE;
  api.reencuadreOrto = null;
  activarPersp(api);
  const dir = new THREE.Vector3(1, 1, 1).normalize();
  const dist = distIso(api);
  animateTo(api, api.mc.clone().addScaledVector(dir, dist), api.mc.clone());
}

/** Reset (⟳): vuelve a la pose ISO por defecto calculada al terminar la carga. */
export function resetVista(api: Rci3DApi): void {
  if (!api.defPos || !api.defTgt) {
    vistaIso(api);
    return;
  }
  animateTo(api, api.defPos.clone(), api.defTgt.clone());
}
