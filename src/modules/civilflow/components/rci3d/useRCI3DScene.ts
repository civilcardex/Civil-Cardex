import { useEffect, useRef } from 'react';
import type * as THREE_NS from 'three';
import { dibujarGizmoEjes } from '../aparatos3d/axisGizmo.ts';
import { attachAntiAutoscroll } from '../shared/controls3d';
import { disposeEscena, montarEscena } from '../shared/threeStage';
import { devError } from '../../../../utils/devError.ts';

export type Three = typeof THREE_NS;

/** API imperativa de la escena RCI (Red Contra Incendio) — vive en un ref; UI y carga la leen directo. */
export interface Rci3DApi {
  THREE: Three;
  scene: THREE_NS.Scene;
  camP: THREE_NS.PerspectiveCamera;
  camO: THREE_NS.OrthographicCamera;
  controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
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
  /** RENDER BAJO DEMANDA (pedido del cliente: "está lento"): cuántos cuadros faltan dibujar (0 = quieto). */
  framesPendientes: number;
  /** Lupa prendida: el loop repinta continuo (el círculo sigue al cursor sin mover la cámara). */
  lupaOn?: boolean;
}

export type Rci3DApiRef = React.MutableRefObject<Rci3DApi | null>;

/** Monta la escena RCI (base común threeStage: look del HTML original 0x0d1117 + fog, sombras
 * PCFSoft 2048², sRGB + LinearToneMapping, rig 4 luces ×π, anti shadow-acne) con RENDER BAJO
 * DEMANDA: el loop solo pinta si hubo movimiento, hay animación de vista o quedan frames
 * pendientes (carga, selección, sombras). */
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
    let detachAntiAutoscroll: (() => void) | null = null;
    let raf = 0;
    let restaurarColor: (() => void) | null = null;
    const ro = new ResizeObserver(() => apiRef.current?.ajustar?.());

    (async () => {
      // Base común con las calibraciones del HTML rci (maxDistance 400, bias anti-acne,
      // pipeline r128, render bajo demanda).
      const base = await montarEscena(canvas, {
        maxDistance: 400,
        highPerf: true,
        fillPos: [0, 0, 0],
        cmLegacy: true,
        shadowBias: { bias: -0.0005, normalBias: 0.02 },
        sombrasEstaticas: true,
      });
      if (cancelled) {
        disposeEscena(base);
        return;
      }
      restaurarColor = base.restaurarColor;
      const { THREE, scene, camP, camO, controls, renderer, keyLight, fillLight, assembly } = base;

      detachAntiAutoscroll = attachAntiAutoscroll(canvas);

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
        if (moved || animando || api.framesPendientes > 0 || api.lupaOn) {
          if (!animando) api.framesPendientes = Math.max(0, api.framesPendientes - 1);
          dibujarGizmoEjes(gizmoRef.current, camActiva());
          renderer.render(scene, camActiva());
          onFrame?.current?.(api);
        }
      };
      loop();
    })().catch((e: unknown) => {
      // Sin WebGL o con import fallido: el api queda null y useRciCarga reporta el fallo por
      // su tope de espera de arranque (única vía de error; aquí solo evitamos la unhandled
      // rejection).
      devError('[rci3d] init escena', e);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      detachAntiAutoscroll?.();
      disposeEscena(apiRef.current, restaurarColor ?? undefined);
      apiRef.current = null;
    };
    // Montaje único de la escena (el api es imperativo; Strict Mode remonta y re-crea limpio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return apiRef;
}
