import React, { useState, useRef, useCallback, useEffect } from 'react';
import ModalProtocolo from './ModalProtocol';
import ModalPrimeraCalibracion from './ModalFirstCalibration';
import type { Piso } from '../../lib/shared/projectTypes';
import type { PlanItem } from '../../context/PlansContext';
import { usePlanFileLoader } from './usePlanFileLoader';
import { TOAST_BG, PlanoConfigurator_S1, PlanoConfigurator_S2 } from './PlanoConfigurator.styles';
import { useCalibration } from './useCalibration';
import { dibujaOverlayCalibracion } from './calibrationOverlay';
import { PanelCalibracion } from './CalibrationPanel';

interface PlanoConfiguratorProps {
  planFile: File;
  planName: string;
  planId: number;
  onSaveConfig: (config: {
    planId: number;
    origen: { x_px: number; y_px: number } | null;
    scaleM: number | null;
    factorX: number | null;
    factorY: number | null;
    calGlobal: boolean | null;
    definedScale: number | null;
  }) => void;
  onIrADibujo: () => void;
  existingCal?: ExistingCal | null;
  /** Flujo "Asignar piso" (origen aún sin marcar): activa el modo de marcado de origen al
   *  abrir, para que el clic siguiente sea directamente el punto físico. */
  autoOrigen?: boolean;
  pisos: Piso[];
  plans: PlanItem[];
  planNivel: number | null;
  onUpdateNivel: (planId: number, nivel: number | null) => void;
  /** True cuando NINGÚN plan del proyecto tiene origen + scaleM (escala metros por pixel) guardados — el modal de calibración muestra
   * entonces un aviso de "primera calibración del proyecto". */
  esPrimeraCalibracion: boolean;
}

export interface ExistingCal {
  origen: { x_px: number; y_px: number } | null;
  scaleM: number | null;
  factorX: number | null;
  factorY: number | null;
  calGlobal: boolean | null;
  definedScale?: number | null;
}

function PlanoConfiguratorBase({
  planFile,
  planName,
  planId,
  onSaveConfig,
  existingCal,
  autoOrigen,
  pisos,
  plans,
  planNivel,
  onUpdateNivel,
  esPrimeraCalibracion,
}: PlanoConfiguratorProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [showProtocolo, setShowProtocolo] = useState(false);
  const [confirmFirstCal, setConfirmFirstCal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!existingCal);
  const [toast, setToast] = useState<{ msg: string; type: 'err' | 'ok' | 'warn' } | null>(null);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const [panning, setPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const overlayContRef = useRef<HTMLDivElement | null>(null);
  const canvRef = useRef<HTMLCanvasElement | null>(null);
  const pageWRef = useRef(0);
  const pageHRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    [],
  );

  const showToast = useCallback((msg: string, type: 'err' | 'ok' | 'warn' = 'err') => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 8000);
  }, []);

  const fitView = useCallback(() => {
    const cw = overlayContRef.current;
    if (!cw || !pageWRef.current || !pageHRef.current) return;
    const w = cw.clientWidth;
    const h = cw.clientHeight;
    const z = Math.min(w / pageWRef.current, h / pageHRef.current, 1.5);
    setZoom(z);
    setOffset({
      x: Math.max(0, (w - pageWRef.current * z) / 2),
      y: Math.max(0, (h - pageHRef.current * z) / 2),
    });
  }, []);

  const { isPdf, loading, imgLoaded, pdfCanvRef } = usePlanFileLoader({
    planFile,
    pageWRef,
    pageHRef,
    onLoaded: fitView,
  });

  const {
    origen,
    setOrigen,
    modoOrigen,
    setModoOrigen,
    modoCalX,
    setModoCalX,
    modoCalY,
    setModoCalY,
    calStart,
    setCalStart,
    calPreview,
    setCalPreview,
    lenX,
    setLenX,
    lenY,
    setLenY,
    factorX,
    setFactorX,
    factorY,
    setFactorY,
    scaleM,
    setScaleM,
    definedScale,
    setDefinedScale,
    preScaleM,
    setPreScaleM,
    canvasToPlane,
    calcularPromedio,
    activarModoOrigen,
    activarModoCalX,
    activarModoCalY,
    getCursorPos,
  } = useCalibration({ zoom, offset, overlayContRef, isPdf, existingCal, showToast });

  // Flujo "Asignar piso" (origen sin marcar): el paso 2 abre directo en modo marcado de
  // origen — el siguiente clic sobre la lámina es el punto físico. El usuario puede salirse
  // del modo con el mismo botón o Escape.
  useEffect(() => {
    if (autoOrigen && !origen) {
      setModoCalX(false);
      setModoCalY(false);
      setModoOrigen(true);
    }
  }, [autoOrigen, origen, setModoCalX, setModoCalY, setModoOrigen]);

  // Render del overlay
  // Render del overlay: solo pinta; el dibujo vive en calibracionOverlay.ts.
  React.useEffect(() => {
    const canv = canvRef.current;
    if (!canv || !imgLoaded || !pageWRef.current || !pageHRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    canv.width = Math.floor(pageWRef.current * dpr);
    canv.height = Math.floor(pageHRef.current * dpr);
    canv.style.width = pageWRef.current + 'px';
    canv.style.height = pageHRef.current + 'px';
    const ctx = canv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canv.width, canv.height);
    dibujaOverlayCalibracion(ctx, {
      origen,
      calStart,
      calPreview,
      modoOrigen,
      modoCalX,
      modoCalY,
      cursorPos,
      pageW: pageWRef.current,
      pageH: pageHRef.current,
      scaleM,
      factorX,
      factorY,
      lenX,
      lenY,
      preScaleM,
      isPdf,
    });
    // La etiqueta "→ ref: X m" del texto de arriba se calcula con factorX/factorY/lenX/lenY/
    // isPdf/preScaleM — sin incluirlos en deps, teclear la longitud sin mover el cursor no
    // repintaba la anotación (orig. auditoría).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    origen,
    calStart,
    calPreview,
    modoOrigen,
    modoCalX,
    modoCalY,
    scaleM,
    imgLoaded,
    cursorPos,
    factorX,
    factorY,
    lenX,
    lenY,
    isPdf,
    preScaleM,
  ]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading || !imgLoaded) return;
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setPanning(true);
      const p = getCursorPos(e);
      panStartRef.current = { x: p.x, y: p.y, ox: offset.x, oy: offset.y };
      return;
    }
    if (e.button !== 0) return;
    const { x, y } = getCursorPos(e);
    const pp = canvasToPlane(x, y);

    if (modoOrigen) {
      setOrigen({ x_px: pp.x, y_px: pp.y });
      setModoOrigen(false);
      setHasSaved(false);
      return;
    }

    if (modoCalX || modoCalY) {
      if (!calStart) {
        setCalStart({ x_px: pp.x, y_px: pp.y });
      } else {
        const dx = modoCalX ? pp.x - calStart.x_px : 0;
        const dy = modoCalY ? pp.y - calStart.y_px : 0;
        const distPx = Math.hypot(dx, dy);
        if (distPx < 5) {
          setCalStart(null);
          return;
        }
        const distCm = (distPx / 96) * 2.54;
        if (modoCalX) {
          const lr = parseFloat(lenX);
          const fx = lr / distCm;
          setFactorX(fx);
          setModoCalX(false);
          setCalStart(null);
          setCalPreview(null);
          calcularPromedio(fx, factorY);
          setHasSaved(false);
        } else {
          const lr = parseFloat(lenY);
          const fy = lr / distCm;
          setFactorY(fy);
          setModoCalY(false);
          setCalStart(null);
          setCalPreview(null);
          calcularPromedio(factorX, fy);
          setHasSaved(false);
        }
      }
      return;
    }

    setPanning(true);
    panStartRef.current = { x, y, ox: offset.x, oy: offset.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getCursorPos(e);
    const pp = canvasToPlane(x, y);
    setCursorPos(pp);
    if (panning && panStartRef.current) {
      const panStart = panStartRef.current;
      setOffset({ x: panStart.ox + (x - panStart.x), y: panStart.oy + (y - panStart.y) });
      return;
    }
    if ((modoCalX || modoCalY) && calStart) {
      const pp = canvasToPlane(x, y);
      if (modoCalX) setCalPreview({ x: pp.x, y: calStart.y_px });
      else setCalPreview({ x: calStart.x_px, y: pp.y });
    }
  };

  const onMouseUp = () => {
    if (panning) {
      setPanning(false);
      panStartRef.current = null;
    }
    setCursorPos(null);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { x, y } = getCursorPos(e);
    const d = e.deltaY > 0 ? -0.1 : 0.1;
    const nz = Math.max(0.05, Math.min(8, zoom + d));
    setOffset((o) => ({
      x: x - (x - o.x) * (nz / zoom),
      y: y - (y - o.y) * (nz / zoom),
    }));
    setZoom(nz);
  };

  // Wheel NATIVO no-pasivo (React onWheel es passive → preventDefault avisaba en consola).
  // Sin deps: se re-registra en cada render para leer zoom/setOffset frescos por closure.
  useEffect(() => {
    const el = overlayContRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => onWheel(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  });

  const cursor = () => {
    if (modoOrigen || modoCalX || modoCalY) return 'crosshair';
    if (panning) return 'grabbing';
    return 'grab';
  };

  const guardarConfig = () => {
    if (planNivel === null || planNivel === undefined) {
      showToast('Asigne un nivel antes de guardar (Paso 1)', 'err');
      return;
    }
    if (!origen) {
      showToast('Defina el origen antes de guardar (Paso 2)', 'err');
      return;
    }
    if (!scaleM && !preScaleM) {
      showToast('Calibre al menos un eje antes de guardar', 'err');
      return;
    }
    // El control de "Alcance" se eliminó del modal: toda calibración se guarda con
    // calGlobal=true (ver comentario en handleSaveConfig de PlanosTab).

    // Bloquea guardar si la diferencia de calibración X/Y supera el 5%
    const diffPctVal =
      factorX && factorY && scaleM ? (Math.abs(factorX - factorY) / scaleM) * 100 : 0;
    if (diffPctVal > 5) {
      showToast(
        `No se puede guardar: La diferencia de calibración X/Y (${diffPctVal.toFixed(1)}%) supera el 5%.`,
        'err',
      );
      return;
    }

    // Aviso de primera calibración: si NINGÚN plan del proyecto tiene origen + scaleM guardados
    // aún, esta será la calibración base del proyecto. El alcance ya no se pregunta, así que se
    // muestra un modal de confirmación antes de guardar: el usuario acepta (y se guarda) o
    // cancela (y no se guarda nada). El botón "Usar calibración previa" en PlanosTab propaga
    // esta escala a planes nuevos automáticamente.
    if (esPrimeraCalibracion) {
      setConfirmFirstCal(true);
      return;
    }

    ejecutarGuardado();
  };

  const ejecutarGuardado = () => {
    onSaveConfig({
      planId,
      origen,
      scaleM: scaleM || preScaleM,
      factorX,
      factorY,
      // Alcance ya no se pregunta al usuario: toda calibración aplica a todos los planos del
      // proyecto. Mantener el campo calGlobal=true para no romper `globalCal` / `Usar calibración
      // previa` en PlanosTab (PlanosTab.tsx:289-298), que filtra por calGlobal===true.
      calGlobal: true,
      definedScale,
    });

    showToast('Configuración guardada', 'ok');
    setSaved(true);
    setHasSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => {
      setSaved(false);
      savedTimerRef.current = null;
    }, 2500);
  };

  const diffPct = factorX && factorY && scaleM ? (Math.abs(factorX - factorY) / scaleM) * 100 : 0;

  return (
    <div
      className="fu"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {showProtocolo && <ModalProtocolo onClose={() => setShowProtocolo(false)} />}
      {confirmFirstCal && (
        <ModalPrimeraCalibracion
          onConfirm={() => {
            setConfirmFirstCal(false);
            ejecutarGuardado();
          }}
          onCancel={() => setConfirmFirstCal(false)}
        />
      )}
      {toast && (
        <div
          role="alert"
          style={{ ...PlanoConfigurator_S1, background: TOAST_BG[toast.type] || TOAST_BG.ok }}
        >
          {toast.msg}
        </div>
      )}

      {/* Barra de estado */}
      <div style={PlanoConfigurator_S2}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--txt)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 230,
          }}
        >
          {planName}
        </span>
        {scaleM && (
          <>
            <span style={{ fontSize: 13, color: 'var(--txt2)', fontFamily: 'monospace' }}>
              ✓ 1cm = <strong style={{ color: 'var(--acc)' }}>{scaleM.toFixed(4)}m</strong>
            </span>
            {factorX && factorY && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color: diffPct > 5 ? '#f59e0b' : 'var(--ok)',
                }}
              >
                Δ {diffPct.toFixed(1)}% {diffPct <= 5 ? '✓' : '⚠'}
              </span>
            )}
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--txt4)' }}>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={fitView}
          title="Ajustar vista"
          style={{
            padding: '2px 8px',
            background: 'var(--bg3)',
            border: '1px solid var(--line)',
            borderRadius: 3,
            color: 'var(--txt3)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ⊞ Ajustar
        </button>
      </div>

      {/* Área principal: visor + panel de configuración */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Izquierda: visor interactivo */}
        {/* Superficie de dibujo CAD: interacciones de pointer (drag/pan) inherentes al lienzo; la
            alternativa de teclado es el modelo de interacción completo del editor, fuera de alcance. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={overlayContRef}
          style={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            background: '#0a0e14',
            overflow: 'hidden',
            cursor: cursor(),
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 5,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--txt3)' }}>Cargando plano...</span>
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              left: `${offset.x}px`,
              top: `${offset.y}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            <canvas ref={pdfCanvRef} style={{ display: 'block' }} />
            <canvas
              ref={canvRef}
              style={{ position: 'absolute', top: 0, left: 0, display: 'block' }}
            />
          </div>
        </div>

        {/* Derecha: panel de configuración - compacto */}
        <PanelCalibracion
          cal={{
            origen,
            modoOrigen,
            modoCalX,
            modoCalY,
            lenX,
            lenY,
            factorX,
            factorY,
            scaleM,
            definedScale,
            preScaleM,
          }}
          planNivel={planNivel}
          planId={planId}
          pisos={pisos}
          plans={plans}
          isPdf={isPdf}
          saved={saved}
          hasSaved={hasSaved}
          onUpdateNivel={onUpdateNivel}
          onSetDefinedScale={setDefinedScale}
          onSetPreScale={setPreScaleM}
          onActivarOrigen={activarModoOrigen}
          onQuitarOrigen={() => {
            setOrigen(null);
            setHasSaved(false);
          }}
          onSetLenX={setLenX}
          onSetLenY={setLenY}
          onActivarCalX={activarModoCalX}
          onActivarCalY={activarModoCalY}
          onQuitarFactorX={() => {
            setFactorX(null);
            setLenX('');
            if (factorY) {
              setScaleM(factorY);
              setDefinedScale(factorY);
            } else {
              setScaleM(null);
              setDefinedScale(null);
            }
            setHasSaved(false);
          }}
          onQuitarFactorY={() => {
            setFactorY(null);
            setLenY('');
            if (factorX) {
              setScaleM(factorX);
              setDefinedScale(factorX);
            } else {
              setScaleM(null);
              setDefinedScale(null);
            }
            setHasSaved(false);
          }}
          onGuardar={guardarConfig}
          onMarcarModificado={() => setHasSaved(false)}
        />
      </div>
    </div>
  );
}

const PlanoConfigurator = React.memo(PlanoConfiguratorBase);
export { PlanoConfigurator };
