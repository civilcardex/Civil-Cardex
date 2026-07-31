import React, { useState, useRef, useCallback, useEffect } from 'react';
import { pisoLbl } from '../../constants';
import ModalProtocolo from './ModalProtocolo';
import type { Piso } from '../useWorkAreaState';
import type { PlanItem } from '../../context/PlansContext';
import { useCalibration, type ExistingCal } from './useCalibration';
import { usePlanFileLoader } from './usePlanFileLoader';
import {
  TOAST_BG,
  PlanoConfigurator_S1,
  PlanoConfigurator_S2,
  PlanoConfigurator_S3,
  PlanoConfigurator_S4,
  PlanoConfigurator_S5,
  PlanoConfigurator_S6,
  PlanoConfigurator_S7,
  PlanoConfigurator_S8,
  PlanoConfigurator_S9,
  PlanoConfigurator_S10,
  PlanoConfigurator_S11,
  PlanoConfigurator_bannerBase,
  PlanoConfigurator_stepHeader,
  PlanoConfigurator_origenBtn,
  PlanoConfigurator_trazarBtn,
  PlanoConfigurator_S12,
  PlanoConfigurator_S13,
} from './PlanoConfigurator.styles';

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
  pisos: Piso[];
  plans: PlanItem[];
  planNivel: number | null;
  onUpdateNivel: (planId: number, nivel: number | null) => void;
}

function PlanoConfiguratorBase({
  planFile,
  planName,
  planId,
  onSaveConfig,
  existingCal,
  pisos,
  plans,
  planNivel,
  onUpdateNivel,
}: PlanoConfiguratorProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [showProtocolo, setShowProtocolo] = useState(false);
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
    calGlobal,
    setCalGlobal,
    preScaleM,
    setPreScaleM,
    canvasToPlane,
    calcularPromedio,
    activarModoOrigen,
    activarModoCalX,
    activarModoCalY,
    getCursorPos,
  } = useCalibration({ zoom, offset, overlayContRef, isPdf, existingCal, showToast });

  // Overlay render
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

    if (origen) {
      const { x_px, y_px } = origen;
      ctx.save();
      // Dotted axes (gray, across entire canvas in plane coords)
      ctx.strokeStyle = 'rgba(170,175,185,0.4)';
      ctx.lineWidth = 0.7;
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(0, y_px);
      ctx.lineTo(pageWRef.current, y_px);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x_px, 0);
      ctx.lineTo(x_px, pageHRef.current);
      ctx.stroke();
      ctx.setLineDash([]);
      // Solid cross marker (orange, zoom-aware size)
      const sz = 14;
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#F5A623';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x_px - sz, y_px);
      ctx.lineTo(x_px + sz, y_px);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x_px, y_px - sz);
      ctx.lineTo(x_px, y_px + sz);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // (0,0) label with background
      ctx.font = '700 11px monospace';
      const labelW = ctx.measureText('(0,0)').width + 10;
      const labelH = 18;
      ctx.fillStyle = 'rgba(17,19,23,0.85)';
      ctx.beginPath();
      ctx.roundRect(x_px + 8, y_px - labelH - 4, labelW, labelH, 4);
      ctx.fill();
      ctx.fillStyle = '#F5A623';
      ctx.fillText('(0,0)', x_px + 13, y_px - 6);
      ctx.restore();
    }

    if (calStart) {
      const csColor = modoCalX ? '#4D8FF7' : '#0ECC7A';
      ctx.strokeStyle = csColor;
      ctx.lineWidth = 1.5;
      const cs = 5;
      ctx.beginPath();
      ctx.moveTo(calStart.x_px - cs, calStart.y_px);
      ctx.lineTo(calStart.x_px + cs, calStart.y_px);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(calStart.x_px, calStart.y_px - cs);
      ctx.lineTo(calStart.x_px, calStart.y_px + cs);
      ctx.stroke();
    }

    if (calPreview && calStart) {
      const color = modoCalX ? '#4D8FF7' : '#0ECC7A';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(calStart.x_px, calStart.y_px);
      ctx.lineTo(calPreview.x, calPreview.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const dx = modoCalX ? calPreview.x - calStart.x_px : 0;
      const dy = modoCalY ? calPreview.y - calStart.y_px : 0;
      const distPx = Math.hypot(dx, dy);
      const internalDistCm = (distPx / 96) * 2.54;
      const displayDistCm = (distPx / (isPdf ? 72 : 96)) * 2.54;

      const baseFactor = modoCalX ? factorY || scaleM || preScaleM : factorX || scaleM || preScaleM;
      const isFirstCalib = !baseFactor;
      const refVal = modoCalX ? parseFloat(lenX) : parseFloat(lenY);

      let txt = '';
      let refTxt = '';

      if (isFirstCalib) {
        txt = `${displayDistCm.toFixed(2)} cm`;
      } else {
        txt = `${(internalDistCm * baseFactor).toFixed(2)} m`;
        if (!isNaN(refVal) && refVal > 0) {
          refTxt = `→ ref: ${refVal.toFixed(2)} m`;
        }
      }

      ctx.font = '600 11px monospace';
      ctx.fillStyle = color;
      const tx =
        calPreview.x + (calPreview.x > calStart.x_px ? 8 : -8 - ctx.measureText(txt).width);
      const ty = calPreview.y + (calPreview.y > calStart.y_px ? 18 : -4);
      ctx.fillText(txt, tx, ty);

      if (refTxt) {
        ctx.font = '600 10px monospace';
        ctx.fillStyle = color + 'aa';
        const refTx =
          calPreview.x + (calPreview.x > calStart.x_px ? 8 : -8 - ctx.measureText(refTxt).width);
        ctx.fillText(refTxt, refTx, ty + 14);
      }

      if (modoCalX || modoCalY) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(calPreview.x, calPreview.y - 10);
        ctx.lineTo(calPreview.x, calPreview.y + 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        const ps = 5;
        ctx.beginPath();
        ctx.moveTo(calPreview.x - ps, calPreview.y);
        ctx.lineTo(calPreview.x + ps, calPreview.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(calPreview.x, calPreview.y - ps);
        ctx.lineTo(calPreview.x, calPreview.y + ps);
        ctx.stroke();
      }
    }

    const showCrosshair = (modoOrigen || modoCalX || modoCalY) && !calStart && cursorPos;
    if (showCrosshair) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,220,229,0.4)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(0, cursorPos.y);
      ctx.lineTo(pageWRef.current, cursorPos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cursorPos.x, 0);
      ctx.lineTo(cursorPos.x, pageHRef.current);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,220,229,0.9)';
      ctx.lineWidth = 1.5;
      const xs = 6;
      ctx.beginPath();
      ctx.moveTo(cursorPos.x - xs, cursorPos.y);
      ctx.lineTo(cursorPos.x + xs, cursorPos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cursorPos.x, cursorPos.y - xs);
      ctx.lineTo(cursorPos.x, cursorPos.y + xs);
      ctx.stroke();
      ctx.restore();
    }

    if (modoOrigen || modoCalX || modoCalY) {
      let txt = '';
      if (modoOrigen) txt = '📍 Clic en la intersección de ejes';
      else if (modoCalX && !calStart) txt = 'Clic en el primer extremo de la línea horizontal';
      else if (modoCalX && calStart) txt = 'Clic en el segundo extremo de la línea X';
      else if (modoCalY && !calStart) txt = 'Clic en el primer extremo de la línea vertical';
      else if (modoCalY && calStart) txt = 'Clic en el segundo extremo de la línea Y';
      if (txt) {
        ctx.font = '600 12px monospace';
        const m = ctx.measureText(txt);
        const pw = m.width + 20;
        const ph = 24;
        ctx.fillStyle = 'rgba(17,19,23,0.85)';
        ctx.beginPath();
        ctx.roundRect(12, 12, pw, ph, 6);
        ctx.fill();
        ctx.fillStyle = '#e2e2e8';
        ctx.fillText(txt, 22, 30);
      }
    }
    // Overlay repaint deliberately keys off the drawn values only (not factorX/factorY/lenX/
    // lenY/isPdf/preScaleM, which feed the label text computed inline above) — pre-existing
    // behavior carried over unchanged from before this effect was split out of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen, calStart, calPreview, modoOrigen, modoCalX, modoCalY, scaleM, imgLoaded, cursorPos]);

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

  const onWheel = (e: React.WheelEvent) => {
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

  const cursor = () => {
    if (modoOrigen || modoCalX || modoCalY) return 'crosshair';
    if (panning) return 'grabbing';
    return 'grab';
  };

  const tieneOrigen = origen !== null;

  const escalaDisponible = scaleM !== null || preScaleM !== null;

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
    if (escalaDisponible && calGlobal === null) {
      showToast('Seleccione si la calibración aplica a todos los planos o plano por plano', 'err');
      return;
    }

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

    onSaveConfig({
      planId,
      origen,
      scaleM: scaleM || preScaleM,
      factorX,
      factorY,
      calGlobal,
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
      {toast && (
        <div
          role="alert"
          style={{ ...PlanoConfigurator_S1, background: TOAST_BG[toast.type] || TOAST_BG.ok }}
        >
          {toast.msg}
        </div>
      )}

      {/* Status bar */}
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

      {/* Main area: viewer + config panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Interactive viewer */}
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
          onWheel={onWheel}
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

        {/* Right: Configuration panel - compact */}
        <div
          style={{
            width: 230,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--line)',
            background: 'var(--bg)',
            overflowY: 'auto',
          }}
        >
          {/* Header Banner - changes color when floor calibration is complete */}
          {(() => {
            const pisoCompletado =
              planNivel !== null &&
              tieneOrigen &&
              (scaleM !== null || preScaleM !== null) &&
              calGlobal !== null &&
              hasSaved;
            return (
              <div
                style={{
                  ...PlanoConfigurator_bannerBase,
                  background: pisoCompletado ? 'rgba(14,204,122,0.15)' : 'rgba(245,158,11,0.08)',
                  color: pisoCompletado ? 'var(--ok)' : '#F5A623',
                  border: `1px solid ${pisoCompletado ? 'var(--ok)' : 'rgba(245,158,11,0.2)'}`,
                }}
              >
                {pisoCompletado ? '✓ Calibración Completada' : '⚠ Calibración Pendiente'}
              </div>
            );
          })()}

          {/* Step 1: Level */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
            <div
              style={{
                ...PlanoConfigurator_stepHeader,
                color: planNivel !== null ? 'var(--ok)' : 'var(--txt3)',
              }}
            >
              <span>1. Asignar nivel</span>
              {planNivel !== null && <span style={{ color: 'var(--ok)' }}>✓</span>}
            </div>
            <select
              value={planNivel ?? ''}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                onUpdateNivel(planId, v);
                setHasSaved(false);
              }}
              aria-label="Seleccionar nivel de plano"
              style={PlanoConfigurator_S3}
            >
              <option value="">— Nivel —</option>
              {pisos
                .toSorted((a, b) => b.n - a.n)
                .map((s) => {
                  const ocupado = plans.some(
                    (x) => x.id !== planId && x.status === 'confirmed' && x.nivel === s.n,
                  );
                  return (
                    <option key={s.id} value={s.n} disabled={ocupado}>
                      {pisoLbl(s.n)} ({s.npt} m){ocupado ? ' (ocupado)' : ''}
                    </option>
                  );
                })}
            </select>

            {/* Escala - definida y calibrada side-by-side */}
            <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: definedScale ? 'var(--ok)' : 'var(--txt3)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Escala definida
                </div>
                <select
                  value={definedScale ? Math.round(definedScale * 100) : ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    if (val) {
                      const dScale = val / 100;
                      setDefinedScale(dScale);
                      setPreScaleM(dScale * (96 / (isPdf ? 72 : 96)));
                      setHasSaved(false);
                    } else {
                      setDefinedScale(null);
                      setPreScaleM(null);
                      setHasSaved(false);
                    }
                  }}
                  aria-label="Seleccionar escala definida del plano"
                  style={PlanoConfigurator_S4}
                >
                  <option value="">— Escala —</option>
                  {(() => {
                    const PREDEF = [50, 75, 100, 125, 150, 200, 250, 500];
                    const calVal = definedScale ? Math.round(definedScale * 100) : 0;
                    const hasCal = calVal > 0 && !PREDEF.includes(calVal);
                    const opts = hasCal ? [...PREDEF, calVal].sort((a, b) => a - b) : PREDEF;
                    return opts.map((v) => (
                      <option key={v} value={v}>
                        1:{v}
                      </option>
                    ));
                  })()}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: scaleM ? 'var(--ok)' : 'var(--txt3)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Escala calibrada
                </div>
                {scaleM ? (
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--acc)',
                      fontFamily: 'monospace',
                      padding: '5px 0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    1:{Math.round(scaleM * 100)}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--txt4)',
                      padding: '5px 0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    — Sin calibrar
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Origin */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
            <div
              style={{
                ...PlanoConfigurator_stepHeader,
                color: tieneOrigen ? 'var(--ok)' : 'var(--txt3)',
              }}
            >
              <span>2. Definir origen</span>
              {tieneOrigen && <span style={{ color: 'var(--ok)' }}>✓</span>}
            </div>
            <button
              type="button"
              onClick={activarModoOrigen}
              style={{
                ...PlanoConfigurator_origenBtn,
                background: modoOrigen ? 'rgba(245,166,35,0.15)' : 'var(--bg3)',
                border: `1.5px solid ${modoOrigen ? '#F5A623' : 'var(--line)'}`,
                color: modoOrigen ? '#F5A623' : 'var(--txt2)',
              }}
            >
              📍 Definir origen en plano
            </button>
            {origen && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--ok)', fontFamily: 'monospace' }}>
                  ✓ ({origen.x_px.toFixed(0)}, {origen.y_px.toFixed(0)}) px
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOrigen(null);
                    setHasSaved(false);
                  }}
                  style={PlanoConfigurator_S5}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Step 3 & 4: Calibrate X and Y */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              gap: 8,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  ...PlanoConfigurator_stepHeader,
                  color: factorX !== null ? 'var(--ok)' : 'var(--txt3)',
                }}
              >
                <span>3. Cal X</span>
                {factorX !== null && <span style={{ color: 'var(--ok)' }}>✓</span>}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="(m)"
                  value={lenX}
                  onChange={(e) => setLenX(e.target.value.replace(/,/g, '.'))}
                  aria-label="Longitud del eje X (m)"
                  disabled={modoCalX}
                  style={PlanoConfigurator_S6}
                />
                <button
                  type="button"
                  onClick={activarModoCalX}
                  style={{
                    ...PlanoConfigurator_trazarBtn,
                    background: modoCalX ? 'rgba(77,143,247,0.15)' : 'var(--bg3)',
                    border: `1.5px solid ${modoCalX ? '#4D8FF7' : 'var(--line)'}`,
                    color: modoCalX ? '#4D8FF7' : 'var(--txt2)',
                  }}
                >
                  {modoCalX ? 'Cancelar' : 'Trazar'}
                </button>
              </div>
              {factorX && (
                <div style={PlanoConfigurator_S7}>
                  ✓ {factorX.toFixed(4)}
                  <button
                    type="button"
                    onClick={() => {
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
                    style={PlanoConfigurator_S8}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  ...PlanoConfigurator_stepHeader,
                  color: factorY !== null ? 'var(--ok)' : 'var(--txt3)',
                }}
              >
                <span>4. Cal Y</span>
                {factorY !== null && <span style={{ color: 'var(--ok)' }}>✓</span>}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="(m)"
                  value={lenY}
                  onChange={(e) => setLenY(e.target.value.replace(/,/g, '.'))}
                  aria-label="Longitud del eje Y (m)"
                  disabled={modoCalY}
                  style={PlanoConfigurator_S9}
                />
                <button
                  type="button"
                  onClick={activarModoCalY}
                  style={{
                    ...PlanoConfigurator_trazarBtn,
                    background: modoCalY ? 'rgba(14,204,122,0.15)' : 'var(--bg3)',
                    border: `1.5px solid ${modoCalY ? '#0ECC7A' : 'var(--line)'}`,
                    color: modoCalY ? '#0ECC7A' : 'var(--txt2)',
                  }}
                >
                  {modoCalY ? 'Cancelar' : 'Trazar'}
                </button>
              </div>
              {factorY && (
                <div style={PlanoConfigurator_S10}>
                  ✓ {factorY.toFixed(4)}
                  <button
                    type="button"
                    onClick={() => {
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
                    style={PlanoConfigurator_S11}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scope */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
            <div
              style={{
                ...PlanoConfigurator_stepHeader,
                color: calGlobal !== null ? 'var(--ok)' : 'var(--txt3)',
              }}
            >
              <span>5. Alcance</span>
              {calGlobal !== null && <span style={{ color: 'var(--ok)' }}>✓</span>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <label style={PlanoConfigurator_S12}>
                <input
                  type="radio"
                  name="calGlobal"
                  checked={calGlobal === true}
                  onChange={() => {
                    setCalGlobal(true);
                    setHasSaved(false);
                  }}
                />
                Todos
              </label>
              <label style={PlanoConfigurator_S13}>
                <input
                  type="radio"
                  name="calGlobal"
                  checked={calGlobal === false}
                  onChange={() => {
                    setCalGlobal(false);
                    setHasSaved(false);
                    showToast(
                      'Calibración por piso: cada plano puede quedar a una escala distinta y eso puede desalinear la isometría. Se recomienda "Todos".',
                      'warn',
                    );
                  }}
                />
                Por piso
              </label>
            </div>
            {calGlobal === false && (
              <div
                style={{
                  marginTop: 6,
                  padding: '6px 8px',
                  borderLeft: '2px solid var(--warn, #F5A623)',
                  background: 'rgba(245,166,35,0.08)',
                  borderRadius: 'var(--r)',
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: 'var(--txt2)',
                }}
              >
                Con calibración por piso, cada plano puede quedar a una escala distinta — eso puede
                afectar la alineación de la isometría. Se recomienda usar{' '}
                <strong style={{ color: 'var(--txt)' }}>Todos</strong>.
              </div>
            )}
          </div>

          {/* Actions */}
          <div
            style={{
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <button
              type="button"
              onClick={guardarConfig}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: saved ? 'rgba(14,204,122,0.15)' : 'var(--acc)',
                border: saved ? '1.5px solid #0ECC7A' : 'none',
                borderRadius: 'var(--r)',
                color: saved ? '#0ECC7A' : '#fff',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                transition: 'background-color .15s, border-color .15s, color .15s',
              }}
            >
              {saved ? '✓ Configuración guardada' : '💾 Guardar configuración'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PlanoConfigurator = React.memo(PlanoConfiguratorBase);
export { PlanoConfigurator };
