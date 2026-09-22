import { useCallback, useRef, useState } from 'react';
import AparatosSidebar from './AparatosSidebar';
import { MONO_3D } from '../shared/config3d';
import SinSeleccionOverlay from './SinSeleccionOverlay';
import { COMPONENTS } from './aparatos3dData';
import { colocarRigLuz, useAparatos3DScene } from './useAparatos3DScene';
import { useGlbCatalogo } from './useGlbCatalogo';
import { resetVista, vistaIso, vistaOrto, type VistaKey } from './vistasCamara';

// Visor 3D "Detalle Aparatos" — port del HTML standalone a React + three 0.185 (GLTFLoader y
// OrbitControls de three/examples sustituyen el parser y controles hechos a mano del original;
// los GLB en public/models/aparatos/ son byte-exactos del adjunto).

const BOTONES_VISTA: Array<{ key: VistaKey; label: string }> = [
  { key: 'iso', label: 'ISO' },
  { key: 'front', label: 'FRENTE' },
  { key: 'side', label: 'LATERAL' },
  { key: 'top', label: 'PLANTA' },
];

const btnVista = (active: boolean): React.CSSProperties => ({
  background: active ? '#0d1f3c' : '#161b22',
  border: `1px solid ${active ? '#1f6feb' : '#30363d'}`,
  color: active ? '#388bfd' : '#e6edf3',
  fontFamily: MONO_3D,
  fontSize: '0.68rem',
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  lineHeight: 1,
});

export default function DetalleAparatosViewer(): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gizmoRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useAparatos3DScene(wrapRef, canvasRef, gizmoRef);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [vista, setVista] = useState<VistaKey>('iso');

  useGlbCatalogo(apiRef, {
    onProgress: setPct,
    onReady: () => setReady(true),
  });

  // Toggle del original: clic sobre el aparato activo lo deselecciona (overlay vuelve; el
  // modelo queda visible detrás, como showModelForComp(null)).
  const handleSelect = useCallback(
    (id: number | null) => {
      const api = apiRef.current;
      setSelectedId(id);
      if (!api || id == null) return;
      const comp = COMPONENTS.find((c) => c.id === id);
      if (!comp) return;
      api.grupos.forEach((g) => {
        g.visible = false;
      });
      const grupo = api.grupos.get(comp.modelKey);
      if (!grupo) return;
      grupo.visible = true;
      api.grupoActivo = grupo;
      const THREE = api.THREE;
      const box = new THREE.Box3().setFromObject(grupo);
      const mc = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      colocarRigLuz(api, mc, size.length() / 2 || api.mr);
      vistaIso(api, setVista);
    },
    [apiRef],
  );

  const handleReset = useCallback(() => {
    const api = apiRef.current;
    if (api) resetVista(api, setVista);
  }, [apiRef]);

  const handleVista = useCallback(
    (k: VistaKey) => {
      const api = apiRef.current;
      if (!api) return;
      if (k === 'iso') vistaIso(api, setVista);
      else vistaOrto(api, k, setVista);
    },
    [apiRef],
  );

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
      <AparatosSidebar selectedId={selectedId} onSelect={handleSelect} />

      <div ref={wrapRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {!selectedId && ready && <SinSeleccionOverlay />}

        {!ready && (
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
                fontFamily: MONO_3D,
              }}
            >
              Procesando modelo 3D…
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

        {/* Cluster de vistas + zoom (bottom-left) */}
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
              style={btnVista(false)}
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
      </div>
    </div>
  );
}
