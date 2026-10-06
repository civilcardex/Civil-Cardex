import { useEffect, useRef } from 'react';
import { COMPONENTS, glbUrl } from './aparatos3dData';
import { colocarRigLuz, type Aparatos3DApiRef } from './useAparatos3DScene';
import { poseIso } from './cameraViews';
import { devError } from '../../../../utils/devError';
import { cargarModelosSecuencial, disposeGrupo, sleep } from '../shared/sequentialLoad';
import { cargarGlbBuffer } from '../shared/glbCache';

type Rgb = [number, number, number];

/** Extrae name → diffuseFactor (RGB) del chunk JSON del GLB. Los colores reales de estos
 *  modelos SketchUp viven SOLO en la extensión legacy KHR_materials_pbrSpecularGlossiness
 *  (muchos materiales no tienen pbrMetallicRoughness.baseColorFactor), que el loader
 *  moderno ya no soporta — es el mismo dato que leía el parser del HTML de referencia. */
function coloresGlb(buf: ArrayBuffer): Map<string, Rgb> {
  const jsonLen = new DataView(buf).getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen))) as {
    materials?: {
      name?: string;
      extensions?: {
        KHR_materials_pbrSpecularGlossiness?: { diffuseFactor?: number[] };
      };
    }[];
  };
  const mapa = new Map<string, Rgb>();
  for (const m of gltf.materials ?? []) {
    const dif = m.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseFactor;
    // Factor corrupto (<3 componentes) cae al gris neutro, igual que la ausencia —
    // indexar dif[0..2] con ! sobre un array corto daría Color(undefined) → NaN → negro.
    if (m.name && dif && dif.length >= 3) mapa.set(m.name, [dif[0]!, dif[1]!, dif[2]!]);
    else if (m.name) mapa.set(m.name, [0.667, 0.667, 0.667]);
  }
  return mapa;
}

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
            const colores = coloresGlb(buf);
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
              // Material receta del HTML de referencia: color = diffuseFactor del GLB
              // (vía coloresGlb; fallback 0xaaaaaa si el material no lo trae), metalness/
              // roughness 0.5 de pbrMetallicRoughness, DoubleSide. Recrear SIN map: el
              // Standard del loader trae el map fantasma del spec-gloss que no rasteriza.
              // CRÍTICO: con UN solo material asignar el material DIRECTO, no un array —
              // una geometría sin groups + material array dibuja CERO triángulos.
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              const nuevos = mats.map((m) => {
                const dif = colores.get(m.name);
                return new api.THREE.MeshStandardMaterial({
                  color: dif ? new api.THREE.Color(dif[0], dif[1], dif[2]) : 0xaaaaaa,
                  metalness: 0.5,
                  roughness: 0.5,
                  side: api.THREE.DoubleSide,
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
