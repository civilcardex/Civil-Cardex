import type * as THREE_NS from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FOV_3D } from './config3d';
import { aplicarControlesOrbit } from './controls3d';

// Montaje y dispose COMUNES de los 3 visores 3D (rci / epc / aparatos): renderer, escena
// (fondo 0x0d1117 + fog 60-300), cámaras persp/orto, rig de 4 luces ×π y OrbitControls con
// el mapeo unificado. Cada visor pasa SUS calibraciones del HTML de referencia por opts —
// los valores NO se unifican (RCI maxDistance 400, EP sombra PCF, aparatos preserveDrawingBuffer…):
// desincronizarlos rompía la paridad visual con los HTML originales. Lo que SÍ es idéntico en
// los 3 (escena base, rig 0.4/1.6/0.5/0.4/0.25×π, key 8,16,10, rim 2,-3,-12, top 0,20,2,
// damping 0.08/rotate 0.25/pan 0.25/minDistance 0.02) vive aquí una sola vez.

/** Opciones de montaje: cada visor pasa las calibraciones de SU HTML de referencia. */
export interface EscenaOpts {
  /** FOV de la persp (RCI_FOV y FOV_3D valen lo mismo: 50). */
  fov?: number;
  maxDistance?: number;
  /** Legacy del HTML: PCFSoft fue REMOVIDO de three moderno — la opción queda muerta y
   *  siempre es PCF (sin aviso en consola). */
  /** Canvas con buffer preservado (aparatos: captura PNG del visor). */
  preserveDrawingBuffer?: boolean;
  /** powerPreference del renderer (rci: 'high-performance'). */
  highPerf?: boolean;
  /** Posición del fill: rci lo deja en el origen; epc/aparatos (-10,5,-6). */
  fillPos?: [number, number, number];
  /** Pipeline r128: ColorManagement off (rci/aparatos lo restauran en el dispose). */
  cmLegacy?: boolean;
  /** Anti shadow-acne del rci (sin esto, franjas que titilean en pisos/muros). */
  shadowBias?: { bias: number; normalBias: number };
  /** Escena estática: autoUpdate=false + needsUpdate inicial (rci; epc lo marca tras la carga). */
  sombrasEstaticas?: boolean;
}

/** Base común de un visor 3D: todo lo que los 3 mounts construyen igual salvo opts. */
export interface EscenaBase {
  THREE: typeof THREE_NS;
  renderer: THREE_NS.WebGLRenderer;
  scene: THREE_NS.Scene;
  camP: THREE_NS.PerspectiveCamera;
  camO: THREE_NS.OrthographicCamera;
  controls: OrbitControls;
  keyLight: THREE_NS.DirectionalLight;
  fillLight: THREE_NS.DirectionalLight;
  /** Grupo raíz donde cada visor añade sus piezas GLB. */
  assembly: THREE_NS.Group;
  /** Restaura el ColorManagement global (solo con cmLegacy — flag global del singleton three). */
  restaurarColor: () => void;
}

/** Monta renderer + escena + cámaras + rig de 4 luces + OrbitControls. Ej: await montarEscena(canvas, {maxDistance: 400, cmLegacy: true}) en el mount de un visor. */
export async function montarEscena(
  canvas: HTMLCanvasElement,
  opts: EscenaOpts = {},
): Promise<EscenaBase> {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

  if (opts.cmLegacy) THREE.ColorManagement.enabled = false; // pipeline r128: vertex colors lineales + sRGB out

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    ...(opts.highPerf ? { powerPreference: 'high-performance' as const } : {}),
    ...(opts.preserveDrawingBuffer ? { preserveDrawingBuffer: true } : {}),
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  // PCFSoft fue REMOVIDO de three moderno (aviso en consola, cae a PCF igual): PCF directo.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (opts.sombrasEstaticas) {
    // La escena es estática: las sombras se pintan solo cuando la carga las marca.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.Fog(0x0d1117, 60, 300);

  const camP = new THREE.PerspectiveCamera(opts.fov ?? FOV_3D, 1, 0.01, 500);
  camP.position.set(8, 4, 10);
  const camO = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.001, 1000);

  // Iluminación metálica 4 puntos (intensidades EXACTAS del HTML ×π — three r155+ eliminó
  // el modo "legacy lights" que multiplicaba por π: sin la compensación todo queda ~3× más
  // oscuro, orig. usuario "se sigue viendo oscuro").
  const LEG = Math.PI;
  const ambient = new THREE.AmbientLight(0xffffff, 0.4 * LEG);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6 * LEG);
  keyLight.position.set(8, 16, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  if (opts.shadowBias) {
    keyLight.shadow.bias = opts.shadowBias.bias;
    keyLight.shadow.normalBias = opts.shadowBias.normalBias;
  }
  const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5 * LEG);
  const fill = opts.fillPos ?? ([0, 0, 0] as const);
  fillLight.position.set(fill[0], fill[1], fill[2]);
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
  controls.maxDistance = opts.maxDistance ?? 200;
  aplicarControlesOrbit(controls, THREE.MOUSE); // mapeo unificado: derecho = nada (decisión 2026-09-22)

  return {
    THREE,
    renderer,
    scene,
    camP,
    camO,
    controls,
    keyLight,
    fillLight,
    assembly,
    restaurarColor: () => {
      if (opts.cmLegacy) THREE.ColorManagement.enabled = true; // estado global de three: dejarlo como estaba
    },
  };
}

/** Dispose común de un visor: cancela animación pendiente, libera controls/geometry/materials/renderer y FUERZA la pérdida del contexto WebGL (dispose() solo libera recursos — sin forceContextLoss, alternar visores acumula contextos hasta el tope de Chrome y mata el canvas de otro visor).
 *  forzarPerdida=false para el CANCELLADO del race de StrictMode: ahí el renderer nació y muere
 *  sobre el MISMO canvas que el remonte siguiente va a usar — forzar la pérdida lo deja sin
 *  contexto (WebGLRenderer: «precision» de null, ped. 2026-11-17 isometrías vacías) — sin
 *  force loss el remonte reusa ese mismo contexto y no hay acumulación (un canvas = un contexto). */
export function disposeEscena(
  api: {
    scene: THREE_NS.Scene;
    controls: OrbitControls;
    renderer: THREE_NS.WebGLRenderer;
    cancelAnim?: number | null;
  } | null,
  restaurarColor?: () => void,
  forzarPerdida = true,
): void {
  if (!api) return;
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
  if (forzarPerdida) api.renderer.forceContextLoss();
  restaurarColor?.();
}
