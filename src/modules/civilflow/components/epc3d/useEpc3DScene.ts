import { useEffect, useRef, useState, type RefObject } from 'react';
import type * as THREE_NS from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLB_POSITIONS, GLB_SCALE_OVERRIDE, GLB_URL } from './epc3dData';
import { parseGLB } from './glbParser';
import { cargarModelosSecuencial } from '../shared/cargaSecuencial';
import { actualizarEtiquetas } from './etiquetas';
import { dibujarGizmoEjes } from '../aparatos3d/ejeGizmo';

// Hook imperativo del visor EPC (patrón useAparatos3DScene): API en un ref que la UI lee
// directamente. Port del HTML original "EPC CIVILCARDEX SEP 16 2026 VF" — renderer, escena,
// carga secuencial de 3 GLB, pose ISO fija, refBox, occluders y loop rAF (render + etiquetas + gizmo).

const MODELOS = ['epc_esquema', 'tapa_tanque', 'mamposteria'] as const;
/** Radio del cubo de referencia fijo para encuadres orto (validado a mano en el HTML). */
const REFBOX_RADIO = 3.12;
const ISO_POS: [number, number, number] = [5.3044, 3.6881, 2.9976];
const ISO_TGT: [number, number, number] = [2.728, 0.443, -2.5611];

export interface Epc3DApi {
  THREE: typeof THREE_NS;
  renderer: THREE_NS.WebGLRenderer;
  scene: THREE_NS.Scene;
  ensamble: THREE_NS.Group;
  camP: THREE_NS.PerspectiveCamera;
  camO: THREE_NS.OrthographicCamera;
  controls: OrbitControls;
  orthoOn: boolean;
  /** Radio de la mampostería (referencia de escala para luces/sombras/orto). */
  mr: number;
  /** Cubo fijo centrado en la pose ISO — base del encuadre orto del HTML. */
  refBox: THREE_NS.Box3 | null;
  defPos: THREE_NS.Vector3;
  defTgt: THREE_NS.Vector3;
  cancelAnim: number | null;
  piezas: Map<string, THREE_NS.Group>;
  /** Etiqueta activa: id del componente (null = ninguna). */
  activeLabel: number | null;
  occluders: THREE_NS.Object3D[];
  lblOccCache: Record<string, boolean>;
  occFrameCnt: number;
  /** Raycaster reutilizado para el chequeo de oclusión de etiquetas (sin allocar por frame). */
  occRay: THREE_NS.Raycaster;
}

interface Opts {
  canvas: RefObject<HTMLCanvasElement | null>;
  lblCanvas: RefObject<HTMLCanvasElement | null>;
  gizmoCanvas: RefObject<HTMLCanvasElement | null>;
  wrap: RefObject<HTMLDivElement | null>;
  selected: number | null;
  onProgress: (pct: number, label: string) => void;
  onReady: () => void;
}

/** Monta la escena 3D del EPC sobre el canvas y carga los modelos. Corre una vez por montaje. */
export function useEpc3DScene({
  canvas,
  lblCanvas,
  gizmoCanvas,
  wrap,
  selected,
  onProgress,
  onReady,
}: Opts): RefObject<Epc3DApi | null> {
  const apiRef = useRef<Epc3DApi | null>(null);
  const [ready, setReady] = useState(false);
  const progressRef = useRef({ onProgress, onReady });
  useEffect(() => {
    progressRef.current = { onProgress, onReady };
  });

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let ro: ResizeObserver | null = null;

    (async (): Promise<void> => {
      const canvasEl = canvas.current;
      if (!canvasEl) return;
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft deprecado en three moderno (cae a PCF igual)
      // Escena estática: el mapa de sombras se renderiza UNA vez tras la carga, no por frame
      // (rendimiento — orbitar no cambia las sombras).
      renderer.shadowMap.autoUpdate = false;
      // r128 del HTML usaba outputEncoding = sRGBEncoding
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.LinearToneMapping;
      renderer.toneMappingExposure = 1.0;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0d1117);
      scene.fog = new THREE.Fog(0x0d1117, 60, 300);

      const camP = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
      camP.position.set(8, 4, 10);
      const camO = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.001, 1000);

      // Iluminación 4 puntos del HTML — intensidades del r128 original ×π: three moderno
      // (r155+) usa unidades de luz físicas y sin la conversión la escena se ve más oscura.
      const PI = Math.PI;
      scene.add(new THREE.AmbientLight(0xffffff, 0.4 * PI));
      const dir = new THREE.DirectionalLight(0xffffff, 1.6 * PI);
      dir.position.set(8, 16, 10);
      dir.castShadow = true;
      dir.shadow.mapSize.set(2048, 2048);
      scene.add(dir);
      const fill = new THREE.DirectionalLight(0x88aaff, 0.5 * PI);
      fill.position.set(-10, 5, -6);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, 0.4 * PI);
      rim.position.set(2, -3, -12);
      scene.add(rim);
      const topLight = new THREE.DirectionalLight(0xffffff, 0.25 * PI);
      topLight.position.set(0, 20, 2);
      scene.add(topLight);

      const controls = new OrbitControls(camP, canvasEl);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.25;
      controls.panSpeed = 0.25;
      controls.minDistance = 0.02;
      controls.maxDistance = 200;

      const ensamble = new THREE.Group();
      scene.add(ensamble);
      const piezas = new Map<string, THREE_NS.Group>();

      const onResize = (): void => {
        const w = wrap.current?.clientWidth ?? 0;
        const h = wrap.current?.clientHeight ?? 0;
        if (w <= 0 || h <= 0) return;
        renderer.setSize(w, h);
        if (!apiRef.current?.orthoOn) {
          camP.aspect = w / h;
          camP.updateProjectionMatrix();
        }
      };
      if (wrap.current) {
        ro = new ResizeObserver(onResize);
        ro.observe(wrap.current);
      }
      onResize();

      // ── Carga secuencial de GLB (fetch + parser propio, núcleo común de los visores) ──
      await cargarModelosSecuencial(
        MODELOS,
        (pct, texto) => progressRef.current.onProgress(pct, texto),
        async (name) => {
          try {
            const res = await fetch(GLB_URL(name));
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = await res.arrayBuffer();
            const group = await parseGLB(THREE, buf);
            const pos = GLB_POSITIONS[name];
            group.position.set(pos[0], pos[1], pos[2]);
            const scl = GLB_SCALE_OVERRIDE[name];
            if (scl) group.scale.set(scl[0], scl[1], scl[2]);
            // Mampostería semitransparente (paredes del cuarto)
            if (name === 'mamposteria') {
              group.traverse((m) => {
                if (!(m instanceof THREE.Mesh)) return;
                m.material = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(0.76, 0.7, 0.6),
                  metalness: 0.05,
                  roughness: 0.85,
                  transparent: true,
                  opacity: 0.35,
                  side: THREE.DoubleSide,
                  depthWrite: false,
                });
              });
            }
            ensamble.add(group);
            piezas.set(name, group);
            return true;
          } catch {
            // best-effort: un modelo que falla no bloquea el visor
            return false;
          }
        },
        () => cancelled,
      );
      if (cancelled) return;

      // ── finishLoading: encuadre ISO fijo + refBox + occluders ──
      const boxRef = piezas.has('mamposteria')
        ? new THREE.Box3().setFromObject(piezas.get('mamposteria')!)
        : new THREE.Box3().setFromObject(ensamble);
      const MC = boxRef.getCenter(new THREE.Vector3());
      const MR = boxRef.getBoundingSphere(new THREE.Sphere()).radius;

      dir.position.set(MC.x + MR * 1.5, MC.y + MR * 3, MC.z + MR * 1.5);
      dir.shadow.camera.left = dir.shadow.camera.bottom = -MR * 2;
      dir.shadow.camera.right = dir.shadow.camera.top = MR * 2;
      dir.shadow.camera.far = MR * 20;
      dir.shadow.camera.updateProjectionMatrix();
      fill.position.set(MC.x - MR * 1.5, MC.y + MR, MC.z - MR * 1.5);

      const isoPos = new THREE.Vector3(...ISO_POS);
      const isoTgt = new THREE.Vector3(...ISO_TGT);
      camP.position.copy(isoPos);
      camP.lookAt(isoTgt);
      camP.updateMatrixWorld();
      controls.target.copy(isoTgt);

      // Centrar el modelo en el viewport del canvas (funciona con cualquier ancho de sidebar)
      camP.aspect =
        canvasEl.clientWidth / (canvasEl.clientHeight || canvasEl.height) || camP.aspect;
      camP.updateProjectionMatrix();
      const proj = MC.clone().project(camP);
      const distCam = camP.position.distanceTo(isoTgt);
      const fovRad = (camP.fov * Math.PI) / 180;
      const worldPerX = Math.tan(fovRad / 2) * camP.aspect * distCam;
      const worldPerY = Math.tan(fovRad / 2) * distCam;
      const pan = new THREE.Vector3()
        .addScaledVector(
          new THREE.Vector3().setFromMatrixColumn(camP.matrixWorld, 0),
          proj.x * worldPerX,
        )
        .addScaledVector(
          new THREE.Vector3().setFromMatrixColumn(camP.matrixWorld, 1),
          proj.y * worldPerY,
        );
      camP.position.add(pan);
      isoTgt.add(pan);
      controls.target.copy(isoTgt);
      camP.near = MR * 0.001;
      camP.far = MR * 200;
      camP.updateProjectionMatrix();

      // Cubo de referencia fijo para encuadres orto (centro = pose ISO validada a mano)
      const refBox = new THREE.Box3(
        new THREE.Vector3(
          isoTgt.x - REFBOX_RADIO,
          isoTgt.y - REFBOX_RADIO,
          isoTgt.z - REFBOX_RADIO,
        ),
        new THREE.Vector3(
          isoTgt.x + REFBOX_RADIO,
          isoTgt.y + REFBOX_RADIO,
          isoTgt.z + REFBOX_RADIO,
        ),
      );

      // Occluders de etiquetas: solo meshes grandes (losas, paredes, pisos)
      const occluders: THREE_NS.Object3D[] = [];
      const occBox = new THREE.Box3();
      const occSz = new THREE.Vector3();
      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        occBox.setFromObject(obj);
        occBox.getSize(occSz);
        if (Math.max(occSz.x, occSz.y, occSz.z) >= 0.3 * MR) occluders.push(obj);
      });

      apiRef.current = {
        THREE,
        renderer,
        scene,
        ensamble,
        camP,
        camO,
        controls,
        orthoOn: false,
        mr: MR,
        refBox,
        defPos: camP.position.clone(),
        defTgt: isoTgt.clone(),
        cancelAnim: null,
        piezas,
        activeLabel: null,
        occluders,
        lblOccCache: {},
        occFrameCnt: 0,
        occRay: new THREE.Raycaster(),
      };
      if (cancelled) return;
      // Sombras calculadas una sola vez (escena estática; orbitar no las cambia)
      renderer.shadowMap.needsUpdate = true;
      progressRef.current.onProgress(100, '');
      setReady(true);
      progressRef.current.onReady();

      // ── Loop rAF: render + etiquetas + gizmo ──
      const animate = (): void => {
        raf = requestAnimationFrame(animate);
        const api = apiRef.current;
        if (!api) return;
        api.controls.update();
        const cam = api.orthoOn ? api.camO : api.camP;
        api.renderer.render(api.scene, cam);
        if (lblCanvas.current) actualizarEtiquetas(api, lblCanvas.current);
        if (gizmoCanvas.current) dibujarGizmoEjes(gizmoCanvas.current, cam);
      };
      animate();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      const api = apiRef.current;
      apiRef.current = null;
      if (api?.cancelAnim != null) cancelAnimationFrame(api.cancelAnim);
      if (api) {
        api.controls.dispose();
        api.scene.traverse((obj) => {
          if (obj instanceof api.THREE.Mesh) {
            obj.geometry.dispose();
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
          }
        });
        api.scene.clear();
        api.renderer.dispose();
        api.renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montaje único; callbacks por ref
  }, []);

  // Selección del desplegable → etiqueta activa (modo focus en actualizarEtiquetas)
  useEffect(() => {
    if (apiRef.current) apiRef.current.activeLabel = selected;
  }, [selected, ready]);

  return apiRef;
}
