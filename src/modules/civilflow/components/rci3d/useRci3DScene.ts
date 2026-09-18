import { useEffect, useRef } from 'react';
import type * as THREE_NS from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { dibujarGizmoEjes } from '../aparatos3d/ejeGizmo';

export type Three = typeof THREE_NS;

/** API imperativa de la escena RCI — vive en un ref; UI y carga la leen directo. */
export interface Rci3DApi {
  THREE: Three;
  scene: THREE_NS.Scene;
  camP: THREE_NS.PerspectiveCamera;
  camO: THREE_NS.OrthographicCamera;
  controls: OrbitControls;
  renderer: THREE_NS.WebGLRenderer;
  keyLight: THREE_NS.DirectionalLight;
  fillLight: THREE_NS.DirectionalLight;
  /** Grupo ensamble completo (las 13 piezas GLB posicionadas). */
  assembly: THREE_NS.Group;
  /** Piezas por modelKey. */
  piezas: Map<string, THREE_NS.Group>;
  /** Centro/tamaño/radio del ensamble (calculados al terminar la carga). */
  mc: THREE_NS.Vector3;
  bbox: THREE_NS.Vector3;
  mr: number;
  /** Pose ISO por defecto (definida al terminar la carga). */
  defPos: THREE_NS.Vector3 | null;
  defTgt: THREE_NS.Vector3 | null;
  orthoOn: boolean;
  /** Oclusores para las etiquetas: meshes grandes (losas, paredes). */
  occluders: THREE_NS.Mesh[];
  reencuadreOrto: (() => void) | null;
  cancelAnim: number | null;
  ajustar?: () => void;
  /** Repinta las sombras una vez (autoUpdate=false: escena estática). */
  marcarSombras?: () => void;
  /** RENDER BAJO DEMANDA (orig. usuario: "está lento"): frames restantes a renderizar. El
   *  loop solo pinta cuando OrbitControls reporta movimiento, hay animación de vista o este
   *  contador > 0 — idle = GPU en cero. */
  framesPendientes: number;
}

export type Rci3DApiRef = React.MutableRefObject<Rci3DApi | null>;

/** Monta renderer + escena + cámaras + rig de 4 luces + OrbitControls con el look del HTML
 *  original (fondo 0x0d1117 + fog, sombras PCFSoft 2048², sRGB + LinearToneMapping). El color
 *  management moderno se desactiva para reproducir el pipeline de three r128 (vertex colors
 *  lineales + salida sRGB, sin conversión de entrada). Limpieza completa al desmontar. */
export function useRci3DScene(
  wrapRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  gizmoRef: React.RefObject<HTMLCanvasElement | null>,
  onFrame?: React.MutableRefObject<((api: Rci3DApi) => void) | null>,
): Rci3DApiRef {
  const apiRef = useRef<Rci3DApi | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let cancelled = false;
    let raf = 0;
    const ro = new ResizeObserver(() => apiRef.current?.ajustar?.());

    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (cancelled) return;
      THREE.ColorManagement.enabled = false; // pipeline r128: vertex colors lineales + sRGB out

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // RENDIMIENTO (orig. usuario): la escena es estática — las sombras se pintan solo cuando
      // la carga/recolor marca needsUpdate, no en cada frame.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      renderer.outputColorSpace = THREE.SRGBColorSpace; // sustituye outputEncoding de r128
      renderer.toneMapping = THREE.LinearToneMapping;
      renderer.toneMappingExposure = 1.0;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0d1117);
      scene.fog = new THREE.Fog(0x0d1117, 60, 300);

      const camP = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
      camP.position.set(8, 4, 10);
      const camO = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.001, 1000);

      // Iluminación metálica 4 puntos del original (intensidades EXACTAS del HTML). three
      // r155+ eliminó el modo "legacy lights" que multiplicaba por π — sin la compensación
      // todo queda ~3× más oscuro que el HTML (orig. usuario: "se sigue viendo oscuro").
      const LEG = Math.PI;
      const ambient = new THREE.AmbientLight(0xffffff, 0.4 * LEG);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.6 * LEG);
      keyLight.position.set(8, 16, 10);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5 * LEG);
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.4 * LEG);
      rimLight.position.set(2, -3, -12);
      const topLight = new THREE.DirectionalLight(0xffffff, 0.25 * LEG);
      topLight.position.set(0, 20, 2);
      scene.add(ambient, keyLight, fillLight, rimLight, topLight);

      const assembly = new THREE.Group();
      scene.add(assembly);

      const controls = new OrbitControls(camP, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.25;
      controls.panSpeed = 0.25;
      controls.minDistance = 0.02;
      controls.maxDistance = 400;

      const api: Rci3DApi = {
        THREE,
        scene,
        camP,
        camO,
        controls,
        renderer,
        keyLight,
        fillLight,
        assembly,
        piezas: new Map(),
        mc: new THREE.Vector3(),
        bbox: new THREE.Vector3(10, 10, 10),
        mr: 5,
        defPos: null,
        defTgt: null,
        orthoOn: false,
        occluders: [],
        reencuadreOrto: null,
        cancelAnim: null,
        framesPendientes: 5,
      };
      api.marcarSombras = () => {
        renderer.shadowMap.needsUpdate = true;
        api.framesPendientes = 3;
      };
      // Movimiento del usuario (rotar/pan/rueda) → repintar un par de frames.
      controls.addEventListener('change', () => {
        api.framesPendientes = 2;
      });
      apiRef.current = api;

      const ajustar = () => {
        const w = Math.max(1, wrap.clientWidth);
        const h = Math.max(1, wrap.clientHeight);
        renderer.setSize(w, h, false);
        camP.aspect = w / h;
        camP.updateProjectionMatrix();
        api.reencuadreOrto?.();
      };
      api.ajustar = ajustar;
      ajustar();
      ro.observe(wrap);

      const camActiva = (): THREE_NS.Camera => (api.orthoOn ? camO : camP);
      const loop = (): void => {
        raf = requestAnimationFrame(loop);
        const moved = controls.update();
        // Render bajo demanda: solo si hubo movimiento, hay animación de vista o quedan
        // frames pendientes (carga, selección, sombras). Idle = no se pinta nada.
        const animando = api.cancelAnim != null;
        if (moved || animando || api.framesPendientes > 0) {
          if (!animando) api.framesPendientes--;
          dibujarGizmoEjes(gizmoRef.current, camActiva());
          renderer.render(scene, camActiva());
          onFrame?.current?.(api);
        }
      };
      loop();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      const api = apiRef.current;
      if (api) {
        if (api.cancelAnim != null) cancelAnimationFrame(api.cancelAnim);
        api.controls.dispose();
        api.scene.traverse((obj) => {
          const mesh = obj as THREE_NS.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const mat = mesh.material as THREE_NS.Material | THREE_NS.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        });
        api.scene.clear();
        api.renderer.dispose();
        apiRef.current = null;
      }
    };
    // Montaje único de la escena (el api es imperativo; Strict Mode remonta y re-crea limpio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return apiRef;
}
