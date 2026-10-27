// Tour de onboarding (spotlight): resalta un apartado de la pantalla a la vez con una
// tarjeta que lo explica — Anterior/Siguiente/Saltar. La primera vez que se entra a cada
// pantalla (visor, workarea flow, workarea manager) se muestra solo; el botón AYUDA lo
// repite. Cero dependencias: el "agujero" del foco es un div con box-shadow gigante.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Un paso del tour. Sin `sel` (o con ancla oculta) la tarjeta va centrada. */
export interface TourStep {
  sel?: string;
  titulo: string;
  desc: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6; // aire entre el ancla y el borde del agujero

/** ¿El ancla existe y está visible? (display:none o colapsada → rect 0). */
function rectDe(sel?: string): Rect | null {
  if (!sel) return null;
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function TourOverlay({ steps, onEnd }: { steps: TourStep[]; onEnd: () => void }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(() => rectDe(steps[0]?.sel));
  const cardRef = useRef<HTMLDivElement | null>(null);

  const paso = steps[Math.min(idx, steps.length - 1)];
  const esUltimo = idx >= steps.length - 1;

  // Re-medir el ancla al cambiar de paso y al redimensionar la ventana.
  useEffect(() => {
    const medir = () => setRect(rectDe(paso?.sel));
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [paso?.sel]);

  // Escape termina; foco a la tarjeta al montar y en cada paso.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd();
    };
    window.addEventListener('keydown', onKey);
    cardRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, onEnd]);

  // Posición de la tarjeta: debajo del ancla si cabe, si no arriba, clamp horizontal.
  // Sin ancla (paso final) va centrada.
  const cardStyle: React.CSSProperties = rect
    ? (() => {
        const cardW = Math.min(340, window.innerWidth - 24);
        let x = rect.x + rect.w / 2 - cardW / 2;
        x = Math.max(12, Math.min(x, window.innerWidth - cardW - 12));
        const abajo = rect.y + rect.h + PAD + 10;
        return abajo + 180 < window.innerHeight
          ? { position: 'absolute', left: x, top: abajo, width: cardW }
          : { position: 'absolute', left: x, top: Math.max(12, rect.y - 190), width: cardW };
      })()
    : {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(360px, calc(100vw - 32px))',
      };

  const hueco: React.CSSProperties = rect
    ? {
        position: 'absolute',
        left: rect.x - PAD,
        top: rect.y - PAD,
        width: rect.w + PAD * 2,
        height: rect.h + PAD * 2,
        borderRadius: 10,
        // El "spotlight": la sombra gigante oscurece TODO excepto el ancla.
        boxShadow: '0 0 0 200vmax rgba(4,6,10,0.72)',
        border: '1px solid rgba(77,143,247,0.55)',
        pointerEvents: 'none',
      }
    : { display: 'none' };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999 }}>
      <div style={hueco} />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour: ${paso?.titulo ?? ''}`}
        tabIndex={-1}
        style={{
          ...cardStyle,
          background: 'var(--bg2, #17181d)',
          border: '1px solid var(--line, #2c2f38)',
          borderRadius: 'var(--r2, 10px)',
          padding: '14px 16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          outline: 'none',
        }}
      >
        <p style={{ margin: 0, fontSize: 11, color: 'var(--txt3, #9ba8aa)', fontWeight: 700 }}>
          {idx + 1} / {steps.length}
        </p>
        <h2 style={{ margin: '4px 0 6px', fontSize: 15 }}>{paso?.titulo}</h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--txt2, #c3c8cf)' }}>
          {paso?.desc}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onEnd}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              background: 'transparent',
              border: 'none',
              color: 'var(--txt3, #9ba8aa)',
              cursor: 'pointer',
            }}
          >
            Saltar tour
          </button>
          <div style={{ flex: 1 }} />
          {idx > 0 && (
            <button
              type="button"
              onClick={() => setIdx((i) => i - 1)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: 'transparent',
                border: '1px solid var(--line, #2c2f38)',
                borderRadius: 6,
                color: 'var(--txt, #e2e2e8)',
                cursor: 'pointer',
              }}
            >
              Anterior
            </button>
          )}
          <button
            type="button"
            onClick={() => (esUltimo ? onEnd() : setIdx((i) => i + 1))}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              background: 'var(--acc, #2563eb)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {esUltimo ? 'Listo' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
