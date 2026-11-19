import { useEffect, useRef } from 'react';
import type * as THREE_NS from 'three';
import { dibujarGizmoEjes } from './axisGizmo.ts';
import { attachAntiAutoscroll } from '../shared/controls3d';
import { disposeEscena, montarEscena } from '../shared/threeStage';
import type { EscenaBase } from '../shared/threeStage';
import { devError } from '../../../../utils/devError.ts';

export type Three = typeof THREE_NS;
type Grupo3D = THREE_NS.Group;

/** API imperativa de la escena — vive en un ref; los handlers de UI la leen directo. */
export interface Aparatos3DApi {
  THREE: Three;
  scene: THREE_NS.Scene;
  camP: THREE_NS.PerspectiveCamera;
  camO: THREE_NS.OrthographicCamera;
  controls: EscenaBase['controls'];
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

/** Monta la escena 3D de aparatos (base común threeStage: fondo 0x0d1117 + fog, sombras
 * suaves 2048², sRGB + LinearToneMapping, rig 4 luces ×π FIJO — el original NUNCA movió
 * key/fill por modelo (key 8,16,10 · fill -10,5,-6 · rim 2,-3,-12 · top 0,20,2). */
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
    let restaurarColor: (() => void) | null = null;
    const ro = new ResizeObserver(() => apiRef.current?.ajustar?.());

    (async () => {
      // Base común (preserveDrawingBuffer: captura PNG del visor; cmLegacy: pipeline r128).
      const base = await montarEscena(canvas, {
        maxDistance: 200,
        preserveDrawingBuffer: true,
        fillPos: [-10, 5, -6],
        cmLegacy: true,
      });
      if (cancelled) {
        // CANCELLADO del race de StrictMode: sin forceContextLoss — el remonte siguiente
        // reutiliza este MISMO canvas y su contexto (con force loss moría con
        // «precision» de null y la isometría quedaba vacía).
        disposeEscena(base, undefined, false);
        return;
      }
      restaurarColor = base.restaurarColor;
      const { THREE, scene, camP, camO, controls, renderer, keyLight, fillLight } = base;

      // Botón central sin autoscroll nativo de Chrome (compite con el pan que acabamos de
      // asignarle).
      detachAntiAutoscroll = attachAntiAutoscroll(canvas);

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
    })().catch((e: unknown) => devError('[aparatos3d] init escena', e));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      detachAntiAutoscroll?.();
      disposeEscena(apiRef.current, restaurarColor ?? undefined);
      apiRef.current = null;
      // Limitación conocida: ColorManagement es un flag GLOBAL del singleton three — si
      // dos visores 3D llegaran a convivir montados, el desmonte de este re-activaría CM
      // bajo los pies del otro. Hoy cada visor vive en su ruta (montaje exclusivo).
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
