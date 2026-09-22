import { useEffect, useRef } from 'react';
import type { Rci3DApi, Rci3DApiRef, Three } from './useRci3DScene';
import { parseGLB } from './rciGlbParser';
import { CHEQUE_GROUPS, GLB_POSITIONS, MODELO_KEYS, glbUrl } from './rci3dData';
import { devError } from '../../../../utils/devError';
import { cargarModelosSecuencial, sleep } from '../shared/cargaSecuencial';
import { cargarGlbBuffer } from '../shared/glbCache';

// Carga secuencial de las 13 piezas GLB (port del loadModel del HTML) sobre el núcleo común
// de los visores 3D (shared/cargaSecuencial): progreso 20→95 %, pausa entre modelos, y al
// terminar el "finishLoading" — bbox/centro/radio, rig de luces ajustado, pose ISO default y
// lista de oclusores para las etiquetas. El recolor blanco→rojo de los grupos cheque vive en
// el parser (fusión por material). Sombras estáticas: un solo repintado al terminar.
// Robustez: espera activa por la escena (import('three') tarda en bundle frío), fetch que
// valida res.ok, y fallo visible en UI cuando no hay nada que mostrar (pantalla negra = bug).

interface Opciones {
  onProgreso: (pct: number, texto: string) => void;
  onListo: () => void;
  /** Fallo irrecuperable (escena sin iniciar tras ~15 s, assets ausentes, ensamble vacío). */
  onFallo: (mensaje: string) => void;
}

/** Reintentos de arranque (150 ms c/u) esperando a que la escena termine de inicializarse. */
const ESPERAS_MAX = 100;

/** Libera geometría/material de una pieza parseada que ya no se usará (desmonte a mitad de
 *  carga: el assembly viejo ya se disposeó con la escena — sin esto, fuga por carga cortada). */
function disposePieza(THREE: Three, group: InstanceType<Three['Group']>): void {
  group.traverse((obj) => {
    const mesh = obj as InstanceType<typeof THREE.Mesh>;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as
      | InstanceType<typeof THREE.Material>
      | InstanceType<typeof THREE.Material>[]
      | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

/** Terminación de la carga (port del finishLoading): encadre, luces, near/far, pose ISO
 *  default, oclusores (meshes con lado máximo ≥ 0.3·MR) y repintado único de sombras. */
function finalizarCarga(api: Rci3DApi): void {
  const THREE = api.THREE;
  const box = new THREE.Box3().setFromObject(api.assembly);
  box.getCenter(api.mc);
  box.getSize(api.bbox);
  api.mr = box.getBoundingSphere(new THREE.Sphere()).radius;
  // Ensamble vacío (assets ausentes) daría dist=0/near=0: cámara en el origen y pantalla
  // negra "lista" — se reporta como fallo en vez de pintar nada.
  if (!isFinite(api.mr) || api.mr <= 0) throw new Error('ensamble_vacio');

  const key = api.keyLight;
  key.position.set(api.mc.x + api.mr * 1.5, api.mc.y + api.mr * 3, api.mc.z + api.mr * 1.5);
  const sc = key.shadow.camera;
  sc.left = -api.mr * 2;
  sc.bottom = -api.mr * 2;
  sc.right = api.mr * 2;
  sc.top = api.mr * 2;
  sc.far = api.mr * 20;
  sc.updateProjectionMatrix();
  api.fillLight.position.set(api.mc.x - api.mr * 1.5, api.mc.y + api.mr, api.mc.z - api.mr * 1.5);

  const fovR = (api.camP.fov * Math.PI) / 180;
  const aspect = Math.max(
    0.1,
    api.renderer.domElement.clientWidth / Math.max(1, api.renderer.domElement.clientHeight),
  );
  const dist =
    Math.max(
      api.bbox.y / 2 / Math.tan(fovR / 2),
      api.bbox.x / 2 / (Math.tan(fovR / 2) * aspect),
      api.mr / Math.tan(fovR / 2),
    ) * 1.05;
  const isoDir = new THREE.Vector3(1, 1, 1).normalize();
  const isoPos = api.mc.clone().addScaledVector(isoDir, dist);
  api.camP.position.copy(isoPos);
  api.camP.lookAt(api.mc);
  api.controls.target.copy(api.mc);
  api.defPos = isoPos;
  api.defTgt = api.mc.clone();
  api.camP.near = api.mr * 0.001;
  api.camP.far = api.mr * 200;
  api.camP.updateProjectionMatrix();

  // Oclusores de etiquetas — solo la ESTRUCTURA (mampostería + tanque). Con los meshes
  // fusionados, incluir las tuberías hacía que cada etiqueta se auto-ocultara con su propia
  // pieza (orig. usuario: no salían al seleccionar).
  api.occluders = [];
  for (const nombre of ['mamposteria', 'tanque']) {
    const pieza = api.piezas.get(nombre);
    if (!pieza) continue;
    pieza.traverse((obj) => {
      const mesh = obj as InstanceType<typeof THREE.Mesh>;
      if (mesh.isMesh) api.occluders.push(mesh);
    });
  }

  api.marcarSombras?.();
}

export function useRciCarga(apiRef: Rci3DApiRef, { onProgreso, onListo, onFallo }: Opciones): void {
  const optsRef = useRef({ onProgreso, onListo, onFallo });
  useEffect(() => {
    optsRef.current = { onProgreso, onListo, onFallo };
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // La escena se inicializa async (el import de three puede tardar en bundle frío):
      // esperar en vez de bailar con el spinner a 0 % para siempre.
      let api = apiRef.current;
      for (let i = 0; i < ESPERAS_MAX && !api; i++) {
        await sleep(150);
        if (cancelled) return;
        api = apiRef.current;
      }
      if (!api) {
        optsRef.current.onFallo('No se pudo iniciar el visor 3D.');
        return;
      }
      const escena = api;
      const fallas = await cargarModelosSecuencial(
        MODELO_KEYS,
        (pct, texto) => optsRef.current.onProgreso(pct, texto),
        async (name) => {
          try {
            // Caché module-level: re-entrar a la sub-pestaña no re-descarga el GLB.
            const buf = await cargarGlbBuffer(glbUrl(name));
            const group = await parseGLB(escena.THREE, buf, CHEQUE_GROUPS.includes(name));
            if (cancelled) {
              disposePieza(escena.THREE, group);
              return true;
            }
            const pos = GLB_POSITIONS[name];
            group.position.set(pos[0], pos[1], pos[2]);
            escena.assembly.add(group);
            escena.piezas.set(name, group);
            return true;
          } catch (e) {
            devError('[rci3d] GLB', name, e);
            return false;
          }
        },
        () => cancelled,
      );
      if (cancelled) return;
      if (fallas >= MODELO_KEYS.length) {
        optsRef.current.onFallo('No se pudieron cargar los modelos 3D.');
        return;
      }
      try {
        finalizarCarga(escena);
      } catch (e) {
        devError('[rci3d] encuadre', e);
        optsRef.current.onFallo('El modelo 3D cargó vacío (recursos no disponibles).');
        return;
      }
      optsRef.current.onProgreso(100, '');
      optsRef.current.onListo();
    })();
    return () => {
      cancelled = true;
    };
    // La carga corre una sola vez por montaje del visor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
