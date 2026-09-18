import { useEffect, useRef } from 'react';
import { COMPONENTS, glbUrl } from './aparatos3dData';
import { colocarRigLuz, type Aparatos3DApiRef } from './useAparatos3DScene';
import { poseIso } from './vistasCamara';
import { devError } from '../../../../utils/devError';
import { cargarModelosSecuencial, sleep } from '../shared/cargaSecuencial';

/** Carga SECUENCIAL de los 12 GLB del catálogo (150 ms entre modelos, como el original, para
 *  no congelar la UI), con progreso 20→95 %; al terminar arma el rig del ensamble completo y
 *  calcula la pose ISO por defecto (reset ⟳). Los grupos quedan ocultos hasta seleccionar. */
export function useGlbCatalogo(
  apiRef: Aparatos3DApiRef,
  opts: { onProgress: (pct: number) => void; onReady: () => void },
): void {
  const { onProgress, onReady } = opts;
  const cbRef = useRef({ onProgress, onReady });
  useEffect(() => {
    cbRef.current = { onProgress, onReady };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // La escena se crea en un efecto asíncrono hermano: esperar a que exista el api.
      for (let i = 0; i < 100 && !apiRef.current; i++) await sleep(50);
      const api = apiRef.current;
      if (!api || cancelled) return;
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      if (cancelled) return;
      const loader = new GLTFLoader();
      const THREE = api.THREE;
      const assembly = new THREE.Box3();

      // Un modelo que falla no bloquea el catálogo (best-effort, como el original).
      await cargarModelosSecuencial(
        COMPONENTS.map((c) => c.modelKey),
        (pct) => cbRef.current.onProgress(pct),
        async (modelKey) => {
          try {
            const gltf = await loader.loadAsync(glbUrl(modelKey));
            if (cancelled) return true;
            const grupo = gltf.scene;
            grupo.traverse((obj) => {
              const mesh = obj as import('three').Mesh;
              if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            });
            // Fix pulgadas→metros del original: modelos gigantes → escala 0.0254.
            const box = new THREE.Box3().setFromObject(grupo);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 5) grupo.scale.setScalar(0.0254);
            grupo.visible = false;
            api.scene.add(grupo);
            api.grupos.set(modelKey, grupo);
            assembly.expandByObject(grupo);
            return true;
          } catch (e) {
            devError('[aparatos3d] GLB', modelKey, e);
            return false;
          }
        },
        () => cancelled,
      );
      if (cancelled) return;

      const mc = assembly.getCenter(new THREE.Vector3());
      const mr = assembly.getSize(new THREE.Vector3()).length() / 2 || 5;
      colocarRigLuz(api, mc, mr);
      const { pos, tgt } = poseIso(api, assembly);
      api.defPos = pos;
      api.defTgt = tgt;
      cbRef.current.onProgress(100);
      cbRef.current.onReady();
    })();
    return () => {
      cancelled = true;
    };
    // Carga única del catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
