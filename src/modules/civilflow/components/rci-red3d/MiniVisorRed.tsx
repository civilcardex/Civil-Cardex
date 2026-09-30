import { useCallback, useEffect, useRef, useState } from 'react';
import type * as THREE_NS from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseGLBRed } from './rciRedParser';
import { cargarGlbBuffer } from '../shared/glbCache';
import type { VistaKey } from '../rci3d/vistasRci';

// Mini visor de detalle (port del HTML Isometrico_RCI_Open_Code_v19 §1378-1621): segunda
// escena propia con el GLB del componente (rociador/colgante/soportes). Panel FIJO (sin
// arrastre); frustum culling OFF en el detalle; láminas "SIN" del colgante ocultas; placas
// de contexto translúcidas por heurística dimensional (caso especial rociador); vistas
// ISO/FRENTE/LATERAL/PLANTA con PLANTA de up dinámico + zoom por frustum/dolly.

export const BOTONES_VISTA: Array<{ key: VistaKey; label: string }> = [
  { key: 'iso', label: 'ISO' },
  { key: 'front', label: 'FRENTE' },
  { key: 'side', label: 'LATERAL' },
  { key: 'top', label: 'PLANTA' },
];

/** Botón de vista del estilo del HTML (.btn-view). */
export const btnVista = (active: boolean): React.CSSProperties => ({
  background: active ? '#0d1f3c' : '#161b22',
  border: `1px solid ${active ? '#1f6feb' : '#30363d'}`,
  color: active ? '#388bfd' : '#e6edf3',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.68rem',
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  lineHeight: 1,
});

interface Props {
  titulo: string;
  detalle: string;
  onCerrar: () => void;
}

/** API imperativa del mini (vive en un ref; vistas y zoom la leen directo). */
interface MiniApi {
  THREE: typeof THREE_NS | null;
  renderer: THREE_NS.WebGLRenderer | null;
  scene: THREE_NS.Scene | null;
  camP: THREE_NS.PerspectiveCamera | null;
  camO: THREE_NS.OrthographicCamera | null;
  controls: OrbitControls | null;
  defPos: THREE_NS.Vector3 | null;
  defTgt: THREE_NS.Vector3 | null;
  refBox: THREE_NS.Box3 | null;
  mr: number;
  orthoOn: boolean;
}

export default function MiniVisorRed({ titulo, detalle, onCerrar }: Props): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<MiniApi>({
    THREE: null,
    renderer: null,
    scene: null,
    camP: null,
    camO: null,
    controls: null,
    defPos: null,
    defTgt: null,
    refBox: null,
    mr: 1,
    orthoOn: false,
  });
  const [vista, setVista] = useState<VistaKey>('iso');
  const [error, setError] = useState<string | null>(null);

  // Montaje único: renderer + escena + luces (con compensación legacy ×π) + carga del GLB.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let vivos = true;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    const a = api.current;

    void (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (!vivos) return;
      a.THREE = THREE;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x161b22);
      const camP = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
      const camO = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
      // Luces del HTML §1394-1397 (r128 legacy → ×π, igual que el visor principal).
      const LEG = Math.PI;
      scene.add(new THREE.AmbientLight(0xffffff, 0.45 * LEG));
      const d1 = new THREE.DirectionalLight(0xffffff, 1.5 * LEG);
      d1.position.set(4, 8, 5);
      const d2 = new THREE.DirectionalLight(0x88aaff, 0.4 * LEG);
      d2.position.set(-5, 2, -4);
      const d3 = new THREE.DirectionalLight(0xffffff, 0.3 * LEG);
      d3.position.set(1, -3, -6);
      scene.add(d1, d2, d3);

      const controls = new OrbitControls(camP, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.25;
      controls.panSpeed = 0.25;
      // SIN clamps de distancia (el mini del HTML usa OrbitControls sin límites): los GLB de
      // detalle son grandes (R~900) y el auto-encuadre los pone a ~3R — un maxDistance los
      // yankaría DENTRO de la pieza en cada update() (visto en soporte transversal).

      const ajustar = () => {
        const w = Math.max(1, wrap.clientWidth);
        const h = Math.max(1, wrap.clientHeight);
        renderer.setSize(w, h, false);
        if (!a.orthoOn) {
          camP.aspect = w / h;
          camP.updateProjectionMatrix();
        }
      };
      a.renderer = renderer;
      a.scene = scene;
      a.camP = camP;
      a.camO = camO;
      a.controls = controls;
      ajustar();
      ro = new ResizeObserver(ajustar);
      ro.observe(wrap);

      // Loop propio: escena minúscula — render continuo (HTML renderMini §1614).
      const loop = (): void => {
        raf = requestAnimationFrame(loop);
        if (!vivos || !a.renderer || !a.scene || !a.controls) return;
        a.controls.update();
        a.renderer.render(a.scene, a.orthoOn ? a.camO! : a.camP!);
      };
      loop();

      // Carga del GLB de detalle con el MISMO parser de la red (jerarquía AutoCAD).
      try {
        const buf = await cargarGlbBuffer(`/models/rci-red/${detalle}.glb`);
        if (!vivos) return;
        const { group } = parseGLBRed(THREE, buf);
        const mBox = new THREE.Box3().setFromObject(group);
        const mSz = mBox.getSize(new THREE.Vector3());
        const mMax = Math.max(mSz.x, mSz.y, mSz.z);
        group.traverse((m) => {
          const mesh = m as InstanceType<typeof THREE.Mesh>;
          if (!mesh.isMesh) return;
          // Frustum culling OFF: evita que una pieza desaparezca según la vista.
          mesh.frustumCulled = false;
          // Láminas planas del texto del dibujo (gris claro del fallback): ocultas en colgante.
          if (detalle === 'colgante') {
            const mC = (mesh.material as { color?: { r: number; g: number } }).color;
            if (mC) {
              const esSIN = Math.abs(mC.r - mC.g) < 0.06 && mC.r > 0.5;
              const bB = new THREE.Box3().setFromObject(mesh);
              const sB = bB.getSize(new THREE.Vector3());
              if (esSIN && Math.min(sB.x, sB.y, sB.z) <= 0.08) mesh.visible = false;
            }
          }
        });
        // Muro/placa de contexto (la transparencia de AutoCAD no viaja en el GLB): heurística
        // por dimensión — ≥70% del modelo en 2 ejes y espesor <15% → translúcida (§1445-1470).
        group.traverse((m) => {
          const mesh = m as InstanceType<typeof THREE.Mesh>;
          if (!mesh.isMesh) return;
          const b = new THREE.Box3().setFromObject(mesh);
          const s = b.getSize(new THREE.Vector3());
          const sorted = [s.x, s.y, s.z].sort((p, q) => q - p);
          const esPlate =
            (sorted[0] >= mMax * 0.7 && sorted[1] >= mMax * 0.38 && sorted[2] <= mMax * 0.15) ||
            (detalle === 'rociador' &&
              sorted[0] >= mMax * 0.7 &&
              sorted[2] <= mMax * 0.15 &&
              sorted[1] >= sorted[2] * 1.5);
          if (esPlate) {
            const col = (mesh.material as { color?: { r: number; g: number; b: number } })?.color;
            mesh.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(col?.r ?? 0.7, col?.g ?? 0.7, col?.b ?? 0.7),
              metalness: 0.05,
              roughness: 0.85,
              transparent: true,
              opacity: 0.2,
              side: THREE.DoubleSide,
              depthWrite: false,
            });
          }
        });
        scene.add(group);

        // fitMiniToModel (§1401-1416): auto-encuadre ISO relativo.
        const ctr = new THREE.Vector3();
        mBox.getCenter(ctr);
        const hull = mBox.getSize(new THREE.Vector3());
        const R = hull.length() / 2;
        const W = Math.max(1, wrap.clientWidth);
        const H = Math.max(1, wrap.clientHeight);
        camP.aspect = W / H;
        const fovRad = (camP.fov * Math.PI) / 180;
        // Fit exacto del HTML §1410 (factor 1.40 — la pieza llena ~70% del cuadro).
        const dist =
          (Math.max(hull.y / 2, hull.x / 2 / camP.aspect, R) / Math.tan(fovRad / 2)) * 1.4;
        camP.position.copy(ctr).add(new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(dist));
        camP.near = dist * 0.01;
        camP.far = dist * 50;
        camP.updateProjectionMatrix();
        controls.target.copy(ctr);
        controls.update();
        a.refBox = mBox.clone();
        a.mr = mBox.getBoundingSphere(new THREE.Sphere()).radius;
        a.defPos = camP.position.clone();
        a.defTgt = ctr.clone();
      } catch {
        if (vivos) setError('⏳ GLB de detalle pendiente — pendiente de que lo generes en AutoCAD');
      }
    })().catch(() => {
      if (vivos) setError('No se pudo iniciar el detalle 3D.');
    });

    return () => {
      vivos = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (a.controls) a.controls.dispose();
      if (a.scene) {
        a.scene.traverse((obj) => {
          const mesh = obj as import('three').Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const mat = mesh.material as
            | import('three').Material
            | import('three').Material[]
            | undefined;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        });
        a.scene.clear();
      }
      if (a.renderer) {
        a.renderer.dispose();
        a.renderer.forceContextLoss();
      }
      a.renderer = null;
      a.scene = null;
      a.controls = null;
    };
    // Montaje único por detalle (key del componente padre).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Vistas del mini (§1578-1595): ISO vuelve a la pose del auto-encuadre; PLANTA con up
   *  dinámico (eje más largo del bbox horizontal en imagen); orto con encuadre §1551-1568. */
  const handleVista = useCallback((k: VistaKey) => {
    const a = api.current;
    const THREE = a.THREE;
    if (!THREE || !a.controls || !a.camP || !a.camO || !a.refBox) return;
    if (k === 'iso') {
      a.orthoOn = false;
      a.controls.object = a.camP;
      if (a.defPos && a.defTgt) {
        a.camP.position.copy(a.defPos);
        a.controls.target.copy(a.defTgt);
      }
      a.controls.update();
      setVista('iso');
      return;
    }
    const bbY = a.refBox.getSize(new THREE.Vector3());
    const upTop = bbY.z >= bbY.x ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, -1);
    const UP = { front: new THREE.Vector3(0, 1, 0), side: new THREE.Vector3(0, 1, 0), top: upTop };
    const POS = {
      front: new THREE.Vector3(0, 0, 1),
      side: new THREE.Vector3(1, 0, 0),
      top: new THREE.Vector3(0, 1, 0),
    };
    const posVec = POS[k];
    const upVec = UP[k];

    // Encuadre orto del HTML §1551-1568: target = centro del box; half = máximo absoluto
    // ×1.15 con aspect-fit; near/far ±mr·10; cámara retrocedida radius·5.
    const box = a.refBox;
    const wrap = wrapRef.current;
    const aspect = Math.max(0.1, (wrap?.clientWidth || 1) / Math.max(1, wrap?.clientHeight || 1));
    const tgt = new THREE.Vector3();
    box.getCenter(tgt);
    const fwd = posVec.clone().negate().normalize();
    const right = new THREE.Vector3().crossVectors(fwd, upVec).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const corners: THREE_NS.Vector3[] = [];
    for (const sx of [box.min.x, box.max.x])
      for (const sy of [box.min.y, box.max.y])
        for (const sz of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(sx, sy, sz));
    let minR = 1e9;
    let maxR = -1e9;
    let minU = 1e9;
    let maxU = -1e9;
    for (const c of corners) {
      const v = c.clone().sub(tgt);
      const r = v.dot(right);
      const u = v.dot(realUp);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
    }
    let hw = Math.max(Math.abs(minR), Math.abs(maxR)) * 1.15;
    let hh = Math.max(Math.abs(minU), Math.abs(maxU)) * 1.15;
    if (hw / hh > aspect) hh = hw / aspect;
    else hw = hh * aspect;

    const mr = Math.max(0.001, a.mr);
    const camO = a.camO;
    camO.left = -hw;
    camO.right = hw;
    camO.top = hh;
    camO.bottom = -hh;
    camO.near = -mr * 10;
    camO.far = mr * 10;
    camO.updateProjectionMatrix();
    const dist = box.getBoundingSphere(new THREE.Sphere()).radius * 5;
    camO.position.copy(tgt).addScaledVector(posVec, dist);
    camO.up.copy(upVec);
    camO.lookAt(tgt);
    a.orthoOn = true;
    a.controls.object = camO;
    a.controls.target.copy(tgt);
    a.controls.update();
    setVista(k);
  }, []);

  /** miniZoom (§1597-1609): frustum (orto) o dolly sobre el vector target (persp). */
  const zoomMini = useCallback((f: number) => {
    const a = api.current;
    if (!a.controls || !a.camP || !a.camO) return;
    if (a.orthoOn) {
      const cam = a.camO;
      const cx = (cam.left + cam.right) / 2;
      const cy = (cam.bottom + cam.top) / 2;
      const hw = ((cam.right - cam.left) / 2) * f;
      const hh = ((cam.top - cam.bottom) / 2) * f;
      cam.left = cx - hw;
      cam.right = cx + hw;
      cam.bottom = cy - hh;
      cam.top = cy + hh;
      cam.updateProjectionMatrix();
    } else {
      const dir = a.camP.position.clone().sub(a.controls.target);
      dir.setLength(Math.max(0.02, dir.length() * f));
      a.camP.position.copy(a.controls.target).add(dir);
    }
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        top: 16,
        width: 558,
        height: 522,
        background: '#161b22',
        border: '1px solid #30363d',
        borderTop: '2px solid #1f6feb',
        borderRadius: 6,
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 30px rgba(0,0,0,.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 10px',
          borderBottom: '1px solid #30363d',
          userSelect: 'none',
          flexShrink: 0,
          borderRadius: '6px 6px 0 0',
        }}
      >
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 600,
            color: '#388bfd',
            flex: 1,
            letterSpacing: '.03em',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {titulo}
        </span>
        <button type="button" style={btnVista(false)} onClick={onCerrar} title="Cerrar">
          ✕
        </button>
      </div>
      <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {error != null && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#7d8590',
              fontSize: '0.70rem',
              zIndex: 305,
              padding: 20,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            zIndex: 302,
          }}
        >
          <div style={{ display: 'flex', gap: 3 }}>
            {BOTONES_VISTA.map((b) => (
              <button
                key={b.key}
                type="button"
                style={btnVista(vista === b.key)}
                onClick={() => handleVista(b.key)}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <button
              type="button"
              style={btnVista(false)}
              onClick={() => zoomMini(1.25)}
              title="Alejar"
            >
              ◂
            </button>
            <button
              type="button"
              style={btnVista(false)}
              onClick={() => zoomMini(0.8)}
              title="Acercar"
            >
              ▸
            </button>
            <button
              type="button"
              style={{ ...btnVista(false), color: '#388bfd' }}
              onClick={() => handleVista('iso')}
              title="Reset"
            >
              ⟳
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
