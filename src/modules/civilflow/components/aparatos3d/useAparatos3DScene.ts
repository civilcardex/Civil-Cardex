import { useEffect, useRef } from 'react';
import type * as THREE_NS from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { dibujarGizmoEjes } from './axisGizmo';
import { FOV_3D } from '../shared/config3d';
import { aplicarControlesOrbit, attachAntiAutoscroll } from '../shared/controls3d';

export type Three = typeof THREE_NS;
type Grupo3D = THREE_NS.Group;

/** API imperativa de la escena — vive en un ref; los handlers de UI la leen directo. */
export interface Aparatos3DApi {
  THREE: Three;
  scene: THREE_NS.Scene;
  camP: THREE_NS.PerspectiveCamera;
  camO: THREE_NS.OrthographicCamera;
  controls: OrbitControls;
  renderer: THREE_NS.WebGLRenderer;
  keyLight: THREE_NS.DirectionalLight;
  fillLight: THREE_NS.DirectionalLight;
  /** Grupos GLB por modelKey (todos visible=false hasta que se selecciona un aparato). */
  grupos: Map<string, Grupo3D>;
  grupoActivo: Grupo3D | null;
  /** Centro/radio del modelo activo (o del ensamble completo antes de seleccionar). */
  mc: THREE_NS.Vector3;
  mr: number;
  /** Pose ISO por defecto (calculada al terminar la carga del catálogo). */
  defPos: THREE_NS.Vector3 | null;
  defTgt: THREE_NS.Vector3 | null;
  orthoOn: boolean;
  /** Re-encuadre de la vista orto activa (se re-corre en resize). */
  reencuadreOrto: (() => void) | null;
  cancelAnim: number | null;
  /** Recalcula tamaño del renderer/aspect tras un resize del contenedor. */
  ajustar?: () => void;
}

export type Aparatos3DApiRef = React.MutableRefObject<Aparatos3DApi | null>;

/** Monta renderer + escena + cámaras (persp/orto) + rig de 4 luces + OrbitControls sobre el
 *  canvas, con el mismo look del HTML original: fondo 0x0d1117 con fog, sombras suaves 2048²,
 *  sRGB + LinearToneMapping, luces key/fill reposicionables por modelo (setRig). Limpieza
 *  completa al desmontar (Strict Mode monta dos veces). */
export function useAparatos3DScene(
  wrapRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  gizmoRef: React.RefObject<HTMLCanvasElement | null>,
): Aparatos3DApiRef {
  const apiRef = useRef<Aparatos3DApi | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let cancelled = false;
    let detachAntiAutoscroll: (() => void) | null = null;
    let raf = 0;
    // Referencia al namespace three para el restore del pipeline en el cleanup.
    let threeNS: typeof THREE_NS | null = null;
    const ro = new ResizeObserver(() => apiRef.current?.ajustar?.());

    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (cancelled) return;
      threeNS = THREE;

      // Pipeline r128 del HTML de referencia: sin color management (los colores del
      // material se tratan tal cual y sRGB se aplica solo al final) y unidades legacy
      // de luz (×π — r155+ partió entre π). Restore SÍNCRONO en el cleanup con la
      // misma referencia THREE (sin race del import async).
      THREE.ColorManagement.enabled = false;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.LinearToneMapping;
      // Paridad exacta con el HTML de referencia (exposure 1.00 allí).
      renderer.toneMappingExposure = 1.0;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0d1117);
      scene.fog = new THREE.Fog(0x0d1117, 60, 300);

      const camP = new THREE.PerspectiveCamera(FOV_3D, 1, 0.01, 500);
      camP.position.set(8, 4, 10);
      const camO = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.001, 1000);

      // Intensidades del HTML ×π (unidades legacy r128; el original: 0.4/1.6/0.5/0.4/0.25)
      // y posiciones FIJAS de key/fill — el original NUNCA movió el rig por modelo
      // (key 8,16,10 · fill -10,5,-6 · rim 2,-3,-12 · top 0,20,2).
      const LEG = Math.PI;
      const ambient = new THREE.AmbientLight(0xffffff, 0.4 * LEG);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.6 * LEG);
      keyLight.position.set(8, 16, 10);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5 * LEG);
      fillLight.position.set(-10, 5, -6);
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.4 * LEG);
      rimLight.position.set(2, -3, -12);
      const topLight = new THREE.DirectionalLight(0xffffff, 0.25 * LEG);
      topLight.position.set(0, 20, 2);
      scene.add(ambient, keyLight, fillLight, rimLight, topLight);

      // Botón central sin autoscroll nativo de Chrome (compite con el pan que acabamos de
      // asignarle).
      detachAntiAutoscroll = attachAntiAutoscroll(canvas);

      const controls = new OrbitControls(camP, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.25;
      controls.panSpeed = 0.25;
      controls.minDistance = 0.02;
      controls.maxDistance = 200;
      aplicarControlesOrbit(controls, THREE.MOUSE);

      const api: Aparatos3DApi = {
        THREE,
        scene,
        camP,
        camO,
        controls,
        renderer,
        keyLight,
        fillLight,
        grupos: new Map(),
        grupoActivo: null,
        mc: new THREE.Vector3(),
        mr: 5,
        defPos: null,
        defTgt: null,
        orthoOn: false,
        reencuadreOrto: null,
        cancelAnim: null,
      };
      apiRef.current = api;

      const ajustar = () => {
        const w = Math.max(1, wrap.clientWidth);
        const h = Math.max(1, wrap.clientHeight);
        renderer.setSize(w, h, false);
        camP.aspect = w / h;
        camP.updateProjectionMatrix();
        // La orto se re-encuadra con su propia fórmula (el original solo tocaba aspect en persp).
        api.reencuadreOrto?.();
      };
      api.ajustar = ajustar;
      ajustar();
      ro.observe(wrap);

      const camActiva = (): THREE_NS.Camera => (api.orthoOn ? camO : camP);
      const loop = (): void => {
        raf = requestAnimationFrame(loop);
        controls.update();
        dibujarGizmoEjes(gizmoRef.current, camActiva());
        renderer.render(scene, camActiva());
      };
      loop();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      detachAntiAutoscroll?.();
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
      // Limitación conocida: ColorManagement es un flag GLOBAL del singleton three — si
      // dos visores 3D llegaran a convivir montados, el desmonte de este re-activaría CM
      // bajo los pies del otro. Hoy cada visor vive en su ruta (montaje exclusivo).
      if (threeNS) threeNS.ColorManagement.enabled = true;
    };
    // Montaje único de la escena (el api es imperativo; Strict Mode remonta y re-crea limpio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return apiRef;
}

/** Recoloca el rig de luces y los planos near/far de las cámaras para un modelo de centro mc y
 *  radio mr (igual que setActiveModel del original). */
export function colocarRigLuz(api: Aparatos3DApi, mc: THREE_NS.Vector3, mr: number): void {
  api.mc.copy(mc);
  api.mr = mr;
  // Key/Fill FIJAS como el HTML (8,16,10 / -10,5,-6): moverlas por modelo cambiaba el
  // ángulo de sombra de cada aparato (sombras "diferentes" vs la referencia).
  // Solo se ajusta el frustum de sombra y los planos de cámara al radio del modelo.
  const sc = api.keyLight.shadow.camera;
  sc.left = -5;
  sc.right = 5;
  sc.top = 5;
  sc.bottom = -5;
  sc.near = 0.5;
  sc.far = 500;
  sc.updateProjectionMatrix();
  // normalBias: mata el shadow acne (rayas/ondas en caras curvas del GLB) sin
  // despegar la sombra.
  api.keyLight.shadow.normalBias = 0.02 * mr;
  api.camP.near = mr * 0.001;
  api.camP.far = mr * 200;
  api.camP.updateProjectionMatrix();
}
