import type * as THREE_NS from 'three';
import type { Epc3DApi } from './useEpc3DScene';

// Vistas de cámara — port del HTML original: ISO vuelve a la pose fija manual (validada a mano),
// FRENTE/LATERAL/PLANTA encuadran la orto sobre el refBox (cubo fijo r=3.12 centrado en el ISO).

export type VistaKey = 'iso' | 'front' | 'side' | 'top';

/** Interpola cámara persp + target del controls hacia la pose dada (ease-out cúbico 700 ms). */
export function animateTo(
  api: Epc3DApi,
  toPos: THREE_NS.Vector3,
  toTgt: THREE_NS.Vector3,
  dur = 700,
): void {
  if (api.cancelAnim != null) cancelAnimationFrame(api.cancelAnim);
  activarPersp(api);
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
export function activarPersp(api: Epc3DApi): void {
  api.orthoOn = false;
  api.controls.object = api.camP;
}

/** Port de setOrthoView: encuadra la orto sobre el refBox fijo con margen 15 % y aspect. */
export function vistaOrtoEpc(
  api: Epc3DApi,
  key: Exclude<VistaKey, 'iso'>,
  marcarBoton?: (k: VistaKey) => void,
): void {
  const THREE = api.THREE;
  const box = api.refBox ?? new THREE.Box3().setFromObject(api.ensamble);
  const posVec =
    key === 'front'
      ? new THREE.Vector3(0, 0, 1)
      : key === 'side'
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
  const up = key === 'top' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const tgt = box.getCenter(new THREE.Vector3());
  const fwd = posVec.clone().negate().normalize();
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const realUp = new THREE.Vector3().crossVectors(right, fwd).normalize();

  // Proyectar las 8 esquinas sobre los ejes right/up de la vista (relativas al centro)
  let minR = 1e9;
  let maxR = -1e9;
  let minU = 1e9;
  let maxU = -1e9;
  for (const sx of [box.min.x, box.max.x])
    for (const sy of [box.min.y, box.max.y])
      for (const sz of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(sx, sy, sz).sub(tgt);
        const r = v.dot(right);
        const u = v.dot(realUp);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
      }

  // Frustum simétrico con margen 15 %, corregido por aspect del canvas
  const canvW = api.renderer.domElement.clientWidth || 1;
  const canvH = api.renderer.domElement.clientHeight || 1;
  const aspect = canvW / canvH;
  let halfW = Math.max(Math.abs(minR), Math.abs(maxR)) * 1.15;
  let halfH = Math.max(Math.abs(minU), Math.abs(maxU)) * 1.15;
  if (halfW / halfH > aspect) halfH = halfW / aspect;
  else halfW = halfH * aspect;

  const camO = api.camO;
  camO.left = -halfW;
  camO.right = halfW;
  camO.top = halfH;
  camO.bottom = -halfH;
  camO.near = -api.mr * 10;
  camO.far = api.mr * 10;
  const dist = box.getBoundingSphere(new THREE.Sphere()).radius * 5;
  camO.position.copy(tgt).addScaledVector(posVec, dist);
  camO.up.copy(up);
  camO.lookAt(tgt);
  camO.updateProjectionMatrix();
  api.orthoOn = true;
  api.controls.object = camO;
  api.controls.target.copy(tgt);
  api.controls.update();
  marcarBoton?.(key);
}

/** Vista ISO: pose fija manual del original (defPos/defTgt, calculadas al terminar la carga). */
export function vistaIsoEpc(api: Epc3DApi, marcarBoton?: (k: VistaKey) => void): void {
  animateTo(api, api.defPos.clone(), api.defTgt.clone());
  marcarBoton?.('iso');
}
