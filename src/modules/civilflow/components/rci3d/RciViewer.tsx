import { useCallback, useEffect, useRef, useState } from 'react';
import RciSidebar from './RciSidebar';
import { COMPONENTS, RCI_MONO } from './rci3dData';
import { useRci3DScene, type Rci3DApi } from './useRci3DScene';
import { useRciCarga } from './useRciCarga';
import { resetVista, vistaIso, vistaOrto, type VistaKey } from './vistasRci';
import { dibujarEtiquetasRci, resetEtiquetasRci } from './etiquetasRci';

// Visor 3D "Cuarto de Bombas RCI" — port del HTML standalone a React + three 0.185 con la
// arquitectura de aparatos3d (escena en hook, carga secuencial GLB, vistas y gizmo). El
// ensamble completo siempre visible; el desplegable selecciona el componente (foco de su
// etiqueta + descripción). Etiquetas = canvas overlay con línea guía numerada del original.
// El wrapper con key permite "Reintentar" tras un fallo de carga: remonta limpio la escena.

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
  fontFamily: RCI_MONO,
  fontSize: '0.68rem',
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  lineHeight: 1,
});

export default function RciViewer(): React.JSX.Element {
  const [montaje, setMontaje] = useState(0);
  return <RciViewerInner key={montaje} onReintentar={() => setMontaje((k) => k + 1)} />;
}

function RciViewerInner({ onReintentar }: { onReintentar: () => void }): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gizmoRef = useRef<HTMLCanvasElement>(null);
  const lblRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<((api: Rci3DApi) => void) | null>(null);
  const apiRef = useRci3DScene(wrapRef, canvasRef, gizmoRef, frameRef);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pct, setPct] = useState(0);
  const [cargaTxt, setCargaTxt] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaKey>('iso');

  // El overlay de etiquetas cachea el ctx del canvas: sin este reset, al volver a la
  // sub-pestaña las etiquetas se dibujarían en el canvas de la instancia anterior.
  useEffect(() => resetEtiquetasRci, []);

  useRciCarga(apiRef, {
    onProgreso: (p, txt) => {
      setPct(p);
      setCargaTxt(txt);
    },
    onListo: () => setReady(true),
    onFallo: (m) => setError(m),
  });

  // Frame de etiquetas sobre el canvas overlay (foco = componente del desplegable).
  const selRef = useRef<number | null>(null);
  useEffect(() => {
    selRef.current = selectedId;
    frameRef.current = (api) => {
      dibujarEtiquetasRci(api, lblRef.current, selRef.current);
    };
    // Cambio de selección → repintar un par de frames (render bajo demanda).
    const api = apiRef.current;
    if (api) api.framesPendientes = 3;
  }, [selectedId, apiRef]);

  const handleVista = useCallback(
    (k: VistaKey) => {
      const api = apiRef.current;
      if (!api) return;
      setVista(k);
      if (k === 'iso') vistaIso(api);
      else vistaOrto(api, k);
    },
    [apiRef],
  );

  const handleReset = useCallback(() => {
    const api = apiRef.current;
    if (api) resetVista(api);
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
      <RciSidebar selectedId={selectedId} onSelect={setSelectedId} />

      <div ref={wrapRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Etiquetas numeradas (línea guía + círculo) — overlay sin interacción */}
        <canvas
          ref={lblRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 150,
            pointerEvents: 'none',
          }}
        />

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
                fontFamily: RCI_MONO,
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
                letterSpacing: '.04em',
                fontFamily: RCI_MONO,
                maxWidth: 320,
                textAlign: 'center',
              }}
            >
              {error}
            </span>
            <button type="button" style={btnVista(false)} onClick={onReintentar}>
              Reintentar
            </button>
          </div>
        )}

        {/* Cluster de vistas + zoom (bottom-left, como aparatos + zooms del HTML) */}
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

        {/* Pie de selección (mismo lenguaje que los chips del HTML) */}
        {ready && selectedId != null && (
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.60rem',
              color: '#7d8590',
              fontFamily: RCI_MONO,
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
