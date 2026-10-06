import { useEffect, useRef } from 'react';
import { COMPONENTS, glbUrl } from './aparatos3dData';
import { colocarRigLuz, type Aparatos3DApiRef } from './useAparatos3DScene';
import { poseIso } from './cameraViews';
import { devError } from '../../../../utils/devError';
import { cargarModelosSecuencial, disposeGrupo, sleep } from '../shared/sequentialLoad';
import { cargarGlbBuffer } from '../shared/glbCache';

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
            // Caché module-level + parse en memoria: re-entrar no re-descarga el GLB.
            const buf = await cargarGlbBuffer(glbUrl(modelKey));
            const gltf = await loader.parseAsync(buf, '');
            // Desmonte a mitad de carga: la escena ya se disposeó — liberar el grupo
            // parseado o queda huérfano en memoria (igual que hace rci).
            if (cancelled) {
              disposeGrupo(api.THREE, gltf.scene);
              return true;
            }
            // Carrera de montaje (StrictMode/HMR): el api vivo del ref puede ser OTRO
            // distinto al capturado al inicio — un grupo agregado a la escena capturada
            // queda en una escena que nadie renderiza ("no se ve ningún aparato").
            // Trabajar SIEMPRE con el api vivo del ref.
            const apiVivo = apiRef.current ?? api;
            const grupo = gltf.scene;
            grupo.traverse((obj) => {
              const mesh = obj as import('three').Mesh;
              if (!mesh.isMesh) return;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              // Look del parser a mano del HTML de referencia: los GLB usan la extensión
              // LEGACY KHR_materials_pbrSpecularGlossiness (sin texturas, color plano en
              // diffuseFactor). Three moderno ya no la soporta: el loader genera un
              // MeshStandardMaterial con map fantasma sin imagen que NO rasteriza (verificado
              // en navegador: Standard 0 px, Basic/Phong sí). Recrear como Phong con el color
              // diffuse que el loader SÍ copió a .color — shading difuso+especular ≈ r128.
              // CRÍTICO: con UN solo material asignar el material DIRECTO, no un array —
              // una geometría sin groups + material array dibuja CERO triángulos.
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              const nuevos = mats.map((m) => {
                const std = m as import('three').MeshStandardMaterial;
                if (!std || !std.isMeshStandardMaterial) return m;
                return new api.THREE.MeshPhongMaterial({
                  color: std.color.clone(),
                  vertexColors: std.vertexColors,
                  side: api.THREE.DoubleSide,
                  specular: new api.THREE.Color(0x333333),
                  shininess: 30,
                });
              });
              mesh.material = nuevos.length === 1 ? nuevos[0] : nuevos;
            });
            // Fix pulgadas→metros del original: modelos gigantes → escala 0.0254.
            const box = new THREE.Box3().setFromObject(grupo);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 5) grupo.scale.setScalar(0.0254);
            grupo.visible = false;
            // add() re-parenta: si el grupo quedó en otra escena por la carrera, esto lo
            // re-ancla a la escena viva (idempotente).
            apiVivo.scene.add(grupo);
            apiVivo.grupos.set(modelKey, grupo);
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

      // Re-anclar TODOS los grupos a la escena viva por si el api cambió a mitad de la
      // carga (el add de arriba usó el vivo de entonces; el ref puede haber cambiado
      // otra vez). Idempotente y barato (12 adds como máximo).
      const final = apiRef.current;
      if (final) {
        final.grupos.forEach((g) => {
          if (g.parent !== final.scene) final.scene.add(g);
        });
      }
      const apiFinal = final ?? api;

      const mc = assembly.getCenter(new THREE.Vector3());
      const mr = assembly.getSize(new THREE.Vector3()).length() / 2 || 5;
      colocarRigLuz(apiFinal, mc, mr);
      const { pos, tgt } = poseIso(apiFinal, assembly);
      apiFinal.defPos = pos;
      apiFinal.defTgt = tgt;
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
