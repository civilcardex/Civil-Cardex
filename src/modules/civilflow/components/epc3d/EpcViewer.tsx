import { useCallback, useRef, useState } from 'react';
import EpcSidebar from './EpcSidebar';
import { MONO_3D } from '../shared/config3d';
import { useEpc3DScene, type Epc3DApi } from './useEpc3DScene';
import { vistaIsoEpc, vistaOrtoEpc, type VistaKey } from './vistasEpc';

// Visor 3D del Equipo de Presión Constante — port del HTML original al patrón aparatos3d:
// sidebar con desplegable + canvas + cluster de vistas bottom-left + gizmo bottom-right.
// Sin botones de zoom (orig. usuario): el scroll del mouse hace zoom.

const BOTONES_VISTA: Array<{ key: VistaKey; label: string }> = [
  { key: 'iso', label: 'ISO' },
  { key: 'front', label: 'FRENTE' },
  { key: 'side', label: 'LATERAL' },
  { key: 'top', label: 'PLANTA' },
];

const BTN_VISTA_STYLE = {
  background: '#161b22',
  border: '1px solid #30363d',
  color: '#e6edf3',
  fontFamily: MONO_3D,
  fontSize: '0.68rem',
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 4,
  cursor: 'pointer',
} as const;
const BTN_VISTA_ACTIVO = {
  ...BTN_VISTA_STYLE,
  borderColor: '#1f6feb',
  color: '#388bfd',
  background: '#0d1f3c',
} as const;

export default function EpcViewer(): React.JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [progreso, setProgreso] = useState(0);
  const [cargandoTxt, setCargandoTxt] = useState('Preparando modelo…');
  const [vistaActiva, setVistaActiva] = useState<VistaKey>('iso');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lblCanvasRef = useRef<HTMLCanvasElement>(null);
  const gizmoRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const apiRef = useEpc3DScene({
    canvas: canvasRef,
    lblCanvas: lblCanvasRef,
    gizmoCanvas: gizmoRef,
    wrap: wrapRef,
    selected,
    onProgress: (pct, label) => {
      setProgreso(pct);
      setCargandoTxt(label);
    },
    onReady: () => setCargando(false),
  });

  const conApi = useCallback(
    (fn: (api: Epc3DApi) => void): void => {
      if (apiRef.current) fn(apiRef.current);
    },
    [apiRef],
  );

  const irVista = useCallback(
    (key: VistaKey): void => {
      conApi((api) => {
        if (key === 'iso') vistaIsoEpc(api, setVistaActiva);
        else vistaOrtoEpc(api, key, setVistaActiva);
      });
    },
    [conApi],
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
      <EpcSidebar selectedId={selected} onSelect={setSelected} />

      {/* Área del canvas + overlays */}
      <div ref={wrapRef} style={{ flex: 1, position: 'relative', minHeight: 380 }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        <canvas
          ref={lblCanvasRef}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5 }}
        />

        {/* Cluster de vistas — bottom-left (igual posición que aparatos) */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 16,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: '0.60rem',
              color: '#7d8590',
              letterSpacing: '.04em',
              fontFamily: MONO_3D,
              textTransform: 'uppercase',
            }}
          >
            vista
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {BOTONES_VISTA.map((b) => (
              <button
                key={b.key}
                type="button"
                style={vistaActiva === b.key ? BTN_VISTA_ACTIVO : BTN_VISTA_STYLE}
                onClick={() => irVista(b.key)}
              >
                {b.label}
              </button>
            ))}
            <button
              type="button"
              title="Resetear vista"
              style={{ ...BTN_VISTA_ACTIVO, color: '#388bfd' }}
              onClick={() => irVista('iso')}
            >
              ⟳
            </button>
          </div>
        </div>

        {/* Gizmo de ejes — bottom-right (reusa el de aparatos) */}
        <canvas
          ref={gizmoRef}
          width={80}
          height={80}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 16,
            width: 80,
            height: 80,
            pointerEvents: 'none',
            opacity: 0.85,
            zIndex: 10,
          }}
        />

        {/* Overlay de carga (clases globales de isometría) */}
        {cargando && (
          <div className="iso-loading-overlay">
            <div className="iso-loading-spinner" />
            <div className="iso-loading-title">Procesando modelo 3D…</div>
            <div className="iso-loading-sub">{cargandoTxt}</div>
            <div
              style={{
                width: 200,
                height: 2,
                background: '#30363d',
                borderRadius: 1,
                overflow: 'hidden',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#1f6feb',
                  width: `${progreso}%`,
                  transition: 'width .3s',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
