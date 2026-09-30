import { useCallback, useEffect, useRef, useState } from 'react';
import type { Rci3DApi } from './useRci3DScene';

// LUPA circular (port del HTML Isometrico_RCI_Open_Code_v19 §1682-1778): renderer WebGL
// secundario creado solo al prender; cámara clonada recentrada bajo el cursor (soporta
// perspectiva y ortográfica); magnificación ×2–×12 con la rueda en CAPTURA sobre el visor
// (mientras la lupa está prendida la rueda NO zoomea la vista principal; fuera del visor el
// scroll queda intacto). El VISOR (visorRef) recibe los pointer events y define el rect del
// NDC — el círculo (wrapRef, pointer-events:none) solo se posiciona en el cursor. Con render
// bajo demanda cada movimiento pide un frame (framesPendientes); idle = GPU en cero.

const LENS_SIZE = 350;
const LENS_MIN = 2.0;
const LENS_MAX = 12.0;

/** Lupa con toggle (botón del visor, como el HTML). visorRef = elemento que recibe los
 *  pointer events y define el rect del NDC (el canvas principal, como el HTML §1752). */
export function useLupa(
  apiRef: React.MutableRefObject<Rci3DApi | null>,
  visorRef: React.RefObject<HTMLElement | null>,
) {
  const [on, setOn] = useState(false);
  const [magnitud, setMagnitud] = useState(4.0);
  const magRef = useRef(4.0);
  const rendererRef = useRef<import('three').WebGLRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ndc = useRef({ x: 0, y: 0, dentro: false });

  const setMag = useCallback(
    (v: number) => {
      const nv = Math.min(LENS_MAX, Math.max(LENS_MIN, v));
      magRef.current = nv;
      setMagnitud(nv);
      const api = apiRef.current;
      if (api) api.framesPendientes = Math.max(api.framesPendientes, 2); // repinta con la nueva magnitud
    },
    [apiRef],
  );

  const toggle = useCallback(() => setOn((p) => !p), []);

  // Renderer secundario: un solo contexto GL, creado al primer prendido.
  useEffect(() => {
    if (!on || rendererRef.current || !canvasRef.current) return;
    let vivos = true;
    void (async () => {
      const THREE = await import('three');
      if (!vivos || !canvasRef.current) return;
      const r = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        logarithmicDepthBuffer: true,
      });
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      r.setSize(LENS_SIZE, LENS_SIZE, false);
      r.setClearColor(0x0d1117);
      rendererRef.current = r;
    })();
    return () => {
      vivos = false;
    };
  }, [on]);

  // Al desmontar: liberar el contexto GL real (dispose() solo libera recursos; sin esto,
  // alternar visores acumula contextos hasta el tope de Chrome — mismo motivo que el
  // renderer principal en useRci3DScene).
  useEffect(() => {
    return () => {
      const r = rendererRef.current;
      if (r) {
        r.dispose();
        r.forceContextLoss();
        rendererRef.current = null;
      }
    };
  }, []);

  // Puntero sobre el VISOR → NDC + posición del círculo + frame bajo demanda.
  useEffect(() => {
    const visor = visorRef.current;
    if (!on || !visor) return;
    const pedirFrame = () => {
      const api = apiRef.current;
      if (api) api.framesPendientes = Math.max(api.framesPendientes, 1);
    };
    const mover = (e: PointerEvent) => {
      const rect = visor.getBoundingClientRect();
      ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ndc.current.dentro = true;
      if (wrapRef.current) {
        wrapRef.current.style.left = `${e.clientX}px`;
        wrapRef.current.style.top = `${e.clientY}px`;
        wrapRef.current.style.display = 'block';
      }
      pedirFrame(); // el contenido de la lupa sigue al cursor sin mover la cámara
    };
    const salir = () => {
      ndc.current.dentro = false;
      if (wrapRef.current) wrapRef.current.style.display = 'none';
    };
    const entrar = () => {
      if (wrapRef.current) wrapRef.current.style.display = 'block';
    };
    visor.addEventListener('pointerenter', entrar);
    visor.addEventListener('pointermove', mover);
    visor.addEventListener('pointerleave', salir);
    return () => {
      visor.removeEventListener('pointerenter', entrar);
      visor.removeEventListener('pointermove', mover);
      visor.removeEventListener('pointerleave', salir);
      salir();
    };
  }, [on, apiRef, visorRef]);

  // Rueda en CAPTURA sobre el visor: ajusta la magnificación y bloquea el zoom de OrbitControls
  // (capture dispara ANTES del listener del canvas); el resto de la app no se entera.
  useEffect(() => {
    const visor = visorRef.current;
    if (!on || !visor) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setMag(magRef.current * (e.deltaY < 0 ? 1.25 : 1 / 1.25));
    };
    visor.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => visor.removeEventListener('wheel', wheel, { capture: true } as never);
  }, [on, setMag, visorRef]);

  // Prender/apagar: frames base + visibility del círculo (HTML toggleLens §1710: si el cursor
  // ya está encima aparece de una vez; al apagar se oculta).
  useEffect(() => {
    const api = apiRef.current;
    if (api && on) api.framesPendientes = Math.max(api.framesPendientes, 3);
    if (wrapRef.current) {
      wrapRef.current.style.display = on && ndc.current.dentro ? 'block' : 'none';
    }
  }, [on, apiRef]);

  const renderLupa = useCallback(() => {
    const api = apiRef.current;
    const r = rendererRef.current;
    if (!on || !r || !api || !ndc.current.dentro) return;
    const cam = api.orthoOn ? api.camO : api.camP;
    const THREE = api.THREE;
    const ray = new THREE.Raycaster();
    const ndcV = new THREE.Vector2(ndc.current.x, ndc.current.y);
    ray.setFromCamera(ndcV, cam);
    let punto: { x: number; y: number; z: number } | null = null;
    if (api.occluders.length) {
      const hits = ray.intersectObjects(api.occluders, false);
      if (hits.length) punto = hits[0].point;
    }
    if (!punto) {
      const d = cam.position.distanceTo(api.controls.target);
      punto = ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(d));
    }
    const lc = cam.clone();
    lc.position.copy(cam.position);
    const ejeR = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const upV = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    let shW: number, shH: number;
    const anyCam = cam as unknown as {
      isPerspectiveCamera?: boolean;
      fov?: number;
      aspect?: number;
      right?: number;
      left?: number;
      top?: number;
      bottom?: number;
      zoom?: number;
    };
    if (anyCam.isPerspectiveCamera) {
      const dist = cam.position.distanceTo(punto);
      const half = Math.tan(((anyCam.fov ?? 50) * Math.PI) / 360) * dist;
      shW = half * (anyCam.aspect ?? 1);
      shH = half;
    } else {
      const z = anyCam.zoom || 1;
      shW = ((anyCam.right ?? 5) - (anyCam.left ?? -5)) / 2 / z;
      shH = ((anyCam.top ?? 5) - (anyCam.bottom ?? -5)) / 2 / z;
    }
    lc.position
      .addScaledVector(ejeR, ndc.current.x * shW)
      .addScaledVector(upV, ndc.current.y * shH);
    (lc as unknown as { zoom: number }).zoom = (anyCam.zoom || 1) * magRef.current;
    (lc as unknown as { aspect: number }).aspect = 1;
    if ('left' in lc) {
      const o = lc as unknown as { left: number; right: number; top: number; bottom: number };
      o.left = -0.5;
      o.right = 0.5;
      o.top = 0.5;
      o.bottom = -0.5;
    }
    lc.updateProjectionMatrix();
    r.render(api.scene, lc);
  }, [apiRef, on]);

  return {
    on,
    toggle,
    magnitud,
    canvasRef,
    wrapRef,
    renderLupa,
    dentro: () => ndc.current.dentro,
  };
}
