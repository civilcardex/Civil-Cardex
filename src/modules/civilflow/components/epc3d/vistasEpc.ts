import type { Epc3DApi } from './useEpc3Escena.ts';
import { animarCamaraHacia, aspectDe, proyeccionEsquinas } from '../shared/controls3d';

// Vistas de cámara — port del HTML original: ISO vuelve a la pose fija manual (validada a mano),
// FRENTE/LATERAL/PLANTA encuadran la orto sobre el refBox (cubo fijo r=3.12 centrado en el ISO).

export type VistaKey = 'iso' | 'front' | 'side' | 'top';

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
  const { minR, maxR, minU, maxU } = proyeccionEsquinas(
    (x, y, z) => new THREE.Vector3(x, y, z),
    box.min,
    box.max,
    tgt,
    right,
    realUp,
  );

  // Frustum simétrico con margen 15 %, corregido por aspect del canvas
  const aspect = aspectDe(api.renderer.domElement);
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
  activarPersp(api);
  animarCamaraHacia(api, api.defPos.clone(), api.defTgt.clone());
  marcarBoton?.('iso');
}
