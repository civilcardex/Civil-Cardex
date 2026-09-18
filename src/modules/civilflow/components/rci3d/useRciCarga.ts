import { useEffect, useRef } from 'react';
import type { Rci3DApi, Rci3DApiRef } from './useRci3DScene';
import { parseGLB } from './rciGlbParser';
import { CHEQUE_GROUPS, GLB_POSITIONS, MODELO_KEYS, glbUrl } from './rci3dData';

// Carga secuencial de las 13 piezas GLB (port del loadModel del HTML): 150 ms de pausa entre
// modelos para no congelar el browser, barra 20→95 %, y al terminar el "finishLoading" —
// bbox/centro/radio, rig de luces ajustado, pose ISO default y lista de oclusores para las
// etiquetas. El recolor blanco→rojo de los grupos cheque vive en el parser (fusión por
// material). Sombras estáticas: se repintan una sola vez al terminar (autoUpdate=false).

interface Opciones {
  onProgreso: (pct: number, texto: string) => void;
  onListo: () => void;
}

/** Terminación de la carga (port del finishLoading): encadre, luces, near/far, pose ISO
 *  default, oclusores (meshes con lado máximo ≥ 0.3·MR) y repintado único de sombras. */
function finalizarCarga(api: Rci3DApi): void {
  const THREE = api.THREE;
  const box = new THREE.Box3().setFromObject(api.assembly);
  box.getCenter(api.mc);
  box.getSize(api.bbox);
  api.mr = box.getBoundingSphere(new THREE.Sphere()).radius;

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

export function useRciCarga(apiRef: Rci3DApiRef, { onProgreso, onListo }: Opciones): void {
  const optsRef = useRef({ onProgreso, onListo });
  useEffect(() => {
    optsRef.current = { onProgreso, onListo };
  });

  useEffect(() => {
    let cancelled = false;

    const cargar = (i: number): void => {
      const api = apiRef.current;
      if (!api) return;
      if (cancelled) return;
      if (i >= MODELO_KEYS.length) {
        finalizarCarga(api);
        optsRef.current.onProgreso(100, '');
        optsRef.current.onListo();
        return;
      }
      const name = MODELO_KEYS[i];
      optsRef.current.onProgreso(
        20 + (i / MODELO_KEYS.length) * 75,
        `Cargando ${name}… (${i + 1}/${MODELO_KEYS.length})`,
      );
      // Pausa real entre modelos para que el browser no se congele (igual que el HTML).
      window.setTimeout(() => {
        if (cancelled) return;
        const api2 = apiRef.current;
        if (!api2) return;
        void (async () => {
          try {
            const res = await fetch(glbUrl(name));
            const buf = await res.arrayBuffer();
            const group = await parseGLB(api2.THREE, buf, CHEQUE_GROUPS.includes(name));
            const pos = GLB_POSITIONS[name];
            group.position.set(pos[0], pos[1], pos[2]);
            api2.assembly.add(group);
            api2.piezas.set(name, group);
          } catch (e) {
            console.error(`Error ${name}:`, e);
          }
          cargar(i + 1);
        })();
      }, 150);
    };

    // El original esperaba 1 s antes de empezar (deja montar la escena).
    const t = window.setTimeout(() => cargar(0), 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // La carga corre una sola vez por montaje del visor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
