import { useCallback, useEffect, useRef, useState } from 'react';
import RciRedSidebar from './RciRedSidebar';
import { COMPONENTS, LABEL_POSITIONS } from './rciRedData';
import type { RciRedLabel } from './rciRedData';
import { useRci3DScene, type Rci3DApi } from '../rci3d/useRci3DScene';
import { useRciRedCarga } from './useRciRedLoad';
import { useLupa } from '../rci3d/useMagnifier';
import { vistaOrto, resetVista, type VistaKey } from '../rci3d/viewsRci';
import MiniVisorRed, { BOTONES_VISTA, btnVista } from './MiniViewerRed';

// Visor 3D "Red contra incendio" — port del HTML Isometrico_RCI_Open_Code_v19. Modelo REAL
// de la red (tubería por pisos + abrazaderas SPLIT + losas translúcidas). Lupa con toggle
// (como el HTML): renderer secundario que sigue al cursor, rueda ×2–×12. Etiquetas SIEMPRE
// ON (orig. usuario, sin botón): foco en el componente del desplegable, sin selección la #1.
// ISO y ⟳ van a la pose ISO_DEFAULT calibrada (HTML VIEWS.iso / rst). Selección con detalle
// abre el mini visor y el canvas se corre a la derecha (HTML syncLayoutForMini).

// Dibuja las etiquetas de la RED — SIEMPRE ON (orig. usuario, sin toggle): con componente
// seleccionado dibuja SOLO sus etiquetas (modo foco, HTML §1215); sin selección, la
// principal (ref 1). Occlusion-cast por etiqueta en cada frame pintado (el HTML cachéa cada
// 4 frames; con foco son ≤4 etiquetas — simplificación deliberada).
function dibujarEtiquetasRed(
  api: Rci3DApi,
  lblCanvas: HTMLCanvasElement | null,
  seleccionado: number | null,
): void {
  if (!lblCanvas) return;
  const ctx = lblCanvas.getContext('2d');
  if (!ctx) return;
  const W = lblCanvas.clientWidth;
  const H = lblCanvas.clientHeight;
  if (W <= 0 || H <= 0) return;
  if (lblCanvas.width !== W || lblCanvas.height !== H) {
    lblCanvas.width = W;
    lblCanvas.height = H;
  }
  ctx.clearRect(0, 0, W, H);
  const cam = api.orthoOn ? api.camO : api.camP;
  const projCam = cam.clone();
  if (!api.orthoOn) {
    (projCam as unknown as { aspect: number }).aspect = W / H;
    projCam.updateProjectionMatrix();
  }
  const THREE = api.THREE;
  const ray = new THREE.Raycaster();

  const checkOcclusion = (pos3d: { x: number; y: number; z: number }): boolean => {
    if (!api.occluders.length) return false;
    if (api.orthoOn) {
      const d = new THREE.Vector3();
      cam.getWorldDirection(d);
      const L = 1000;
      ray.set(new THREE.Vector3(pos3d.x, pos3d.y, pos3d.z).addScaledVector(d, -L), d);
      ray.far = L - 0.01;
      return ray.intersectObjects(api.occluders, false).length > 0;
    }
    const dir = new THREE.Vector3(
      pos3d.x - cam.position.x,
      pos3d.y - cam.position.y,
      pos3d.z - cam.position.z,
    );
    const dist = dir.length();
    dir.normalize();
    ray.set(cam.position, dir);
    ray.far = dist - 0.01;
    return ray.intersectObjects(api.occluders, false).length > 0;
  };

  const entries = Object.entries(LABEL_POSITIONS) as Array<[string, RciRedLabel]>;
  for (const [idStr, lbl] of entries) {
    const refId = lbl.ref ?? (Number.isNaN(Number(idStr)) ? idStr : parseInt(idStr, 10));
    // Foco (HTML §1215): seleccionado = solo sus etiquetas; sin selección, la principal.
    if (seleccionado != null && String(refId) !== String(seleccionado)) continue;
    if (seleccionado == null && refId !== 1) continue;

    const v = new THREE.Vector3(lbl.pos[0], lbl.pos[1], lbl.pos[2]).project(projCam as never);
    const x = (v.x * 0.5 + 0.5) * W;
    const y = (v.y * -0.5 + 0.5) * H;
    if (v.z >= 1 || x < 10 || x > W - 10 || y < 10 || y > H - 10) continue;
    if (checkOcclusion({ x: lbl.pos[0], y: lbl.pos[1], z: lbl.pos[2] })) continue;

    const activo = seleccionado != null && String(refId) === String(seleccionado);
    dibujarLabelRed(ctx, x, y, refId, lbl, activo);
  }
}

/** Etiqueta mecánica del HTML: flecha en la pieza + leader inclinado + codo + horizontal + círculo numerado. */
function dibujarLabelRed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: number | string,
  lbl: RciRedLabel,
  activo: boolean,
): void {
  const R = Math.round(14 * lbl.scale);
  const col = activo ? '#1f6feb' : '#00ffff';
  const lw = activo ? 2.5 : 1.5;
  const fs = Math.round(21 * lbl.scale);
  const as = Math.round(6 * lbl.scale);
  const rad = (lbl.ang * Math.PI) / 180;
  const sign = lbl.dir === 0 ? 1 : -1;
  const vs = lbl.vdir === 1 ? 1 : -1;
  const ux = sign * Math.sin(rad);
  const uy = vs * Math.cos(rad);
  const kx = x + ux * lbl.L2;
  const ky = y + uy * lbl.L2;
  const cx = kx + sign * lbl.L1;
  const cy = ky;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(kx, ky);
  ctx.stroke();
  const nx = -uy * as;
  const ny = ux * as;
  const bx = x + ux * as * 1.8;
  const by = y + uy * as * 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(bx + nx, by + ny);
  ctx.lineTo(bx - nx, by - ny);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(cx - sign * R, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `bold ${fs}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(id), cx, cy);
}

export default function RciRedViewer(): React.JSX.Element {
  const [montaje, setMontaje] = useState(0);
  return <RciRedInner key={montaje} onReintentar={() => setMontaje((k) => k + 1)} />;
}

function RciRedInner({ onReintentar }: { onReintentar: () => void }): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gizmoRef = useRef<HTMLCanvasElement>(null);
  const lblRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<((api: Rci3DApi) => void) | null>(null);
  const apiRef = useRci3DScene(wrapRef, canvasRef, gizmoRef, frameRef);
  // Lupa con toggle; el CANVAS principal recibe los eventos y define el rect del NDC
  // (HTML §1752 — así la lupa no sigue sobre los botones de vista).
  const lupa = useLupa(apiRef, canvasRef);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pct, setPct] = useState(0);
  const [cargaTxt, setCargaTxt] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaKey>('iso');

  useRciRedCarga(apiRef, {
    onProgreso: (p, txt) => {
      setPct(p);
      setCargaTxt(txt);
    },
    onListo: () => setReady(true),
    onFallo: (m) => setError(m),
  });

  // Etiquetas (siempre ON) + lupa se repintan desde el frame del visor (render bajo demanda).
  const selRef = useRef<number | null>(null);
  useEffect(() => {
    selRef.current = selectedId;
    frameRef.current = (api) => {
      dibujarEtiquetasRed(api, lblRef.current, selRef.current);
      lupa.renderLupa();
    };
    const api = apiRef.current;
    if (api) api.framesPendientes = 3; // repinta el cambio de selección/foco
  }, [selectedId, apiRef, lupa]);

  // Mini visor de detalle: componente con GLB de detalle (soportes/colgante/rociador).
  const selComp = selectedId != null ? COMPONENTS.find((c) => c.id === selectedId) : undefined;
  const miniDetalle = ready && selComp?.detail ? selComp.detail : null;

  const handleVista = useCallback(
    (k: VistaKey) => {
      const api = apiRef.current;
      if (!api) return;
      setVista(k);
      // HTML VIEWS.iso: animateTo(defPos/defTgt) = pose ISO_DEFAULT calibrada al cargar.
      if (k === 'iso') resetVista(api);
      else vistaOrto(api, k);
    },
    [apiRef],
  );

  // ⟳ = HTML rst: anima hacia la pose ISO_DEFAULT (defPos/defTgt, fijada al terminar carga).
  const handleReset = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    resetVista(api);
    setVista('iso');
  }, [apiRef]);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        position: 'relative',
        background: '#0d1117',
      }}
    >
      <div
        style={{
          width: 370,
          minWidth: 370,
          background: '#161b22',
          borderRight: '1px solid #30363d',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* LUPA OFF/ON (HTML btn-lens-toggle, solo texto). Etiquetas no tienen botón:
            siempre ON (orig. usuario). */}
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '0.62rem',
            fontWeight: 600,
            color: lupa.on ? '#3fb950' : '#7d8590',
            border: 'none',
            borderBottom: '1px solid #30363d',
            background: 'transparent',
            fontFamily: 'JetBrains Mono, monospace',
            transition: 'background .12s',
          }}
          onClick={lupa.toggle}
        >
          {lupa.on ? 'LUPA ON' : 'LUPA OFF'}
        </button>
        <RciRedSidebar selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Mini visor abierto: el canvas principal se corre a la derecha del panel
          (HTML syncLayoutForMini; el ResizeObserver re-encuadra). */}
      {miniDetalle != null && selComp && (
        <div style={{ width: 574, flexShrink: 0, position: 'relative', background: '#0d1117' }}>
          <MiniVisorRed
            key={miniDetalle}
            titulo={`${selComp.id} — ${selComp.name}`}
            detalle={miniDetalle}
            onCerrar={() => setSelectedId(null)}
          />
        </div>
      )}

      <div ref={wrapRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Overlay de etiquetas (HTML lbl-canvas): alineado al viewport desde el dibujo. */}
        <canvas
          ref={lblRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 150,
          }}
        />

        {/* Círculo de la lupa: sigue al cursor; el contenido lo pinta renderLupa en cada
            frame pintado del visor (el repintado lo pide useLupa al mover el cursor). */}
        <div
          ref={lupa.wrapRef}
          style={{
            position: 'fixed',
            width: 350,
            height: 350,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid #3fb950',
            boxShadow: '0 0 12px rgba(63,185,80,.35)',
            pointerEvents: 'none',
            zIndex: 9000,
            transform: 'translate(-50%, -50%)',
            background: '#0d1117',
            display: 'none',
          }}
        >
          <canvas
            ref={lupa.canvasRef}
            width={350}
            height={350}
            style={{ width: 350, height: 350, display: 'block' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: '50%',
              transform: 'translateX(-50%)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.6rem',
              color: '#3fb950',
              background: 'rgba(13,17,23,.85)',
              padding: '2px 6px',
              borderRadius: 3,
            }}
          >
            ×{lupa.magnitud.toFixed(1)}
          </div>
        </div>

        {!ready && error == null && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#0d1117',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              zIndex: 200,
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                color: '#7d8590',
                letterSpacing: '.04em',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {cargaTxt || 'Procesando modelo 3D…'}
            </span>
            <div
              style={{
                width: 200,
                height: 2,
                background: '#30363d',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#1f6feb',
                  width: `${pct}%`,
                  transition: 'width .3s',
                  borderRadius: 1,
                }}
              />
            </div>
          </div>
        )}

        {error != null && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#0d1117',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 200,
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                color: '#f85149',
                maxWidth: 320,
                textAlign: 'center',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {error}
            </span>
            <button type="button" style={btnVista(false)} onClick={onReintentar}>
              Reintentar
            </button>
          </div>
        )}

        {/* Cluster de vistas + reset */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: '0.60rem',
              color: '#7d8590',
              marginBottom: 2,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
            }}
          >
            vista
          </div>
          <div style={{ display: 'flex', gap: 4, pointerEvents: 'auto' }}>
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
            <span
              style={{
                width: 1,
                background: '#30363d',
                margin: '0 2px',
                display: 'inline-block',
                height: 26,
              }}
            />
            <button
              type="button"
              style={{ ...btnVista(false), color: '#388bfd' }}
              onClick={handleReset}
              title="Resetear vista"
            >
              ⟳
            </button>
          </div>
        </div>

        {/* Gizmo de ejes */}
        <canvas
          ref={gizmoRef}
          width={80}
          height={80}
          style={{
            position: 'absolute',
            bottom: 80,
            right: 16,
            width: 80,
            height: 80,
            zIndex: 100,
            pointerEvents: 'none',
            opacity: 0.85,
          }}
        />

        {ready && selectedId != null && (
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.60rem',
              color: '#7d8590',
              fontFamily: 'JetBrains Mono, monospace',
              zIndex: 100,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {COMPONENTS.find((c) => c.id === selectedId)?.name ?? ''}
          </div>
        )}
      </div>
    </div>
  );
}
