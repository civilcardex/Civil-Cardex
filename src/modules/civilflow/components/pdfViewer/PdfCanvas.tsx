import { memo, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { pisoLbl } from '../../constants';
import type { Piso } from '../useWorkAreaState';
import type { PlanItem } from '../../context/PlansContext';
const PdfCanvas_S1: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(17,19,23,0.8)',
};
const PdfCanvas_S2: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  padding: 40,
  background: 'rgba(17,19,23,0.95)',
};
const PdfCanvas_S3: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  padding: '32px 48px',
  maxWidth: 480,
  background: 'linear-gradient(135deg,rgba(77,143,247,0.15),rgba(0,220,229,0.08))',
  border: '2px solid rgba(77,143,247,0.4)',
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(77,143,247,0.15),inset 0 1px 0 rgba(77,143,247,0.1)',
};
const PdfCanvas_S4: React.CSSProperties = {
  marginTop: 6,
  padding: '8px 18px',
  background: 'rgba(0,220,229,0.15)',
  border: '1px solid rgba(0,220,229,0.45)',
  borderRadius: 6,
  color: '#00dce5',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'Geist',monospace",
  letterSpacing: 1,
  textTransform: 'uppercase',
};
const PdfCanvas_S5: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: 40,
  background: '#111317',
};
const PdfCanvas_S6: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  background: 'rgba(17,19,23,0.95)',
};
const PdfCanvas_S7: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  padding: '32px 48px',
  maxWidth: 480,
  background: 'linear-gradient(135deg,rgba(245,166,35,0.18),rgba(245,166,35,0.08))',
  border: '2px solid rgba(245,166,35,0.55)',
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(245,166,35,0.2),inset 0 1px 0 rgba(245,166,35,0.15)',
};
const PdfCanvas_S8: React.CSSProperties = {
  marginTop: 6,
  padding: '8px 18px',
  background: 'rgba(0,220,229,0.15)',
  border: '1px solid rgba(0,220,229,0.45)',
  borderRadius: 6,
  color: '#00dce5',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'Geist',monospace",
  letterSpacing: 1,
  textTransform: 'uppercase',
};
const PdfCanvas_S9: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '4px 14px',
  background: 'rgba(17,19,23,0.92)',
  borderTop: '1px solid #3a494a',
  fontFamily: "'Geist',monospace",
  fontSize: 12,
  color: '#8AB4D6',
};

interface PdfCanvasProps {
  cwRef: RefObject<HTMLDivElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  pdfCanvasRef: RefObject<HTMLCanvasElement | null>;
  drawCanvasRef: RefObject<HTMLCanvasElement | null>;
  currentFile: File | null;
  error: Error | string | null;
  loading: boolean;
  selectedNivel: number | null;
  pisos: Piso[];
  planos: PlanItem[];
  tool: string;
  snapOn: boolean;
}

function PdfCanvas({
  cwRef,
  containerRef,
  pdfCanvasRef,
  drawCanvasRef,
  currentFile,
  error,
  loading,
  selectedNivel,
  planos,
  tool,
  snapOn,
}: PdfCanvasProps) {
  const navigate = useNavigate();
  return (
    <div
      ref={cwRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        background: '#111317',
        position: 'relative',
      }}
    >
      {/* Canvases and container always mounted to prevent unmounting and losing references */}
      <div
        ref={containerRef}
        role="img"
        aria-label="Área de dibujo de planos"
        style={{
          position: 'relative',
          display: currentFile && !error ? 'inline-block' : 'none',
        }}
      >
        <div id="pdfWrap" style={{ transformOrigin: '0 0' }}>
          <canvas ref={pdfCanvasRef} style={{ display: 'block', background: '#fff' }} />
        </div>
        <canvas
          ref={drawCanvasRef}
          aria-label="Lienzo de trazado de redes"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair',
          }}
        />
        {loading && currentFile && (
          <div style={PdfCanvas_S1}>
            <div className="sp" />
          </div>
        )}
      </div>

      {/* Warning overlays and screens rendered absolute/flex on top of/instead of the canvas */}
      {(!currentFile || selectedNivel === null || selectedNivel === undefined) && !error && (
        <div style={PdfCanvas_S2}>
          <div style={PdfCanvas_S3}>
            <div
              style={{
                fontSize: 56,
                lineHeight: 1,
                filter: 'drop-shadow(0 0 12px rgba(77,143,247,0.4))',
              }}
            >
              📐
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#4D8FF7',
                fontFamily: "'Geist',monospace",
                letterSpacing: 0.5,
                textAlign: 'center',
              }}
            >
              Selecciona un piso con plano asociado
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#e2e2e8',
                fontFamily: "'Geist',monospace",
                textAlign: 'center',
                lineHeight: 1.5,
                maxWidth: 360,
              }}
            >
              Para empezar a dibujar, selecciona un{' '}
              <strong style={{ color: '#00dce5' }}>piso</strong> que tenga un plano confirmado en el
              panel derecho, o carga un plano desde la pestaña{' '}
              <strong style={{ color: '#00dce5' }}>"Carga de planos"</strong>.
            </div>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('openTab', 'planos');
                navigate('/civilflowareatrabajo');
              }}
              style={PdfCanvas_S4}
            >
              📐 Ir a Carga de planos
            </button>
          </div>
        </div>
      )}

      {currentFile && error && (
        <div style={PdfCanvas_S5}>
          <div style={{ fontSize: 40 }}>⚠</div>
          <div style={{ color: '#ffb4ab', fontFamily: "'Geist',monospace", fontSize: 13 }}>
            Error al cargar el PDF
          </div>
          <div style={{ color: '#9BA8AA', fontFamily: "'Geist',monospace", fontSize: 12 }}>
            {(typeof error === 'string' ? error : error.message) || String(error)}
          </div>
        </div>
      )}

      {currentFile &&
        !error &&
        selectedNivel !== null &&
        selectedNivel !== undefined &&
        !planos.some((p) => p.nivel === selectedNivel && p.status === 'confirmed') && (
          <div style={PdfCanvas_S6}>
            <div style={PdfCanvas_S7}>
              <div
                style={{
                  fontSize: 56,
                  lineHeight: 1,
                  filter: 'drop-shadow(0 0 12px rgba(245,166,35,0.5))',
                }}
              >
                ⚠️
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#f5a623',
                  fontFamily: "'Geist',monospace",
                  letterSpacing: 0.5,
                  textAlign: 'center',
                }}
              >
                {pisoLbl(selectedNivel ?? 0)} — Sin plano asociado
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#e2e2e8',
                  fontFamily: "'Geist',monospace",
                  textAlign: 'center',
                  lineHeight: 1.5,
                  maxWidth: 360,
                }}
              >
                El nivel seleccionado no tiene un plano confirmado. Carga un plano desde la pestaña{' '}
                <strong style={{ color: '#00dce5' }}>"Carga de planos"</strong> y asígnale este
                nivel para empezar a dibujar.
              </div>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('openTab', 'planos');
                  navigate('/civilflowareatrabajo');
                }}
                style={PdfCanvas_S8}
              >
                📐 Ir a Carga de planos
              </button>
            </div>
          </div>
        )}

      <div style={PdfCanvas_S9}>
        <div style={{ flex: 1 }} />
        {tool === 'line' && (
          <span style={{ color: '#8AB4D6', fontSize: 12 }}>
            Enter/Doble-clic:Guardar · Esc:Cancelar
          </span>
        )}
        {tool === 'area' && (
          <span style={{ color: '#8AB4D6', fontSize: 12 }}>
            Enter/Doble-clic:Cerrar · Esc:Cancelar
          </span>
        )}
        {snapOn && <span style={{ color: '#10B981', fontSize: 12 }}>Snap</span>}
      </div>
    </div>
  );
}

export default memo(PdfCanvas);
