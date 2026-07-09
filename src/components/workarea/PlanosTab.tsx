import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { saveTrazosToDB, loadFromStorage, saveToStorage } from "../../services/storageService";
import { TRAZOS_PREFIX } from "../../constants/storage-keys";
import { REQ_ITEMS, pisoLbl } from "../../constants";

import { PlanoConfigurator } from "./PlanoConfigurator";
import type { useWorkAreaState } from "../useWorkAreaState";
import ModalProtocolo from "./ModalProtocolo";
import { loadPlanCrop, savePlanCrop, type PlanCrop } from "../../utils/planCrop";
import { getPdfjs } from "../../utils/lazyPdfjs";
const PlanosTab_S1: React.CSSProperties = { padding: '4px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 };
const PlanosTab_S2: React.CSSProperties = { padding: '4px 14px', background: 'rgba(14,204,122,0.12)', border: '1.5px solid rgba(14,204,122,0.3)', borderRadius: 'var(--r)', color: '#0ECC7A', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' };
const PlanosTab_S3: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg)', minHeight: 36 };
const PlanosTab_S4: React.CSSProperties = { padding: '3px 10px', background: 'rgba(0,220,229,0.08)', border: '1px solid rgba(0,220,229,0.3)', borderRadius: 'var(--r)', color: '#00dce5', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' };
const PlanosTab_S5: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,220,229,.12)', border: '3px dashed rgba(0,220,229,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' };
const PlanosTab_S6: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg)', cursor: 'pointer', position: 'relative' };
const PlanosTab_S7: React.CSSProperties = { width: '100%', padding: '10px', background: 'rgba(0,220,229,0.06)', border: '1.5px dashed rgba(0,220,229,0.3)', borderRadius: 'var(--r)', color: '#00dce5', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .15s' };
const PlanosTab_S8: React.CSSProperties = { padding: '7px 10px', fontSize: 12, fontWeight: 700, color: 'var(--txt3)', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: .5 };
const PlanosTab_S9: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--txt4)', textAlign: 'center', lineHeight: 1.6 };
const PlanosTab_S10: React.CSSProperties = { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', listStyle: 'none', margin: 0 };
const PlanosTab_S11: React.CSSProperties = { padding: '1px 6px', background: 'rgba(14,204,122,0.12)', border: '1px solid rgba(14,204,122,0.3)', borderRadius: 'var(--r)', color: '#0ECC7A', cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.15s ease', whiteSpace: 'nowrap' };
const PlanosTab_S12: React.CSSProperties = { padding: '3px 6px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--r)', border: '1px solid var(--line)', background: 'var(--bg3)', color: '#ef5350', cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap' };
const PlanosTab_S13: React.CSSProperties = { padding: '7px 10px', fontSize: 12, fontWeight: 700, color: 'var(--txt3)', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: .5 };
const PlanosTab_S14: React.CSSProperties = { padding: '3px 6px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--r)', border: '1px solid var(--line)', background: 'var(--bg3)', color: '#ef5350', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease', whiteSpace: 'nowrap' };


type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface PlanosTabProps {
  state: WorkAreaState;
}

interface CalibrationData {
  origen: { x_px: number; y_px: number } | null;
  scaleM: number | null;
  factorX: number | null;
  factorY: number | null;
  calGlobal: boolean | null;
  definedScale?: number | null;
}

// Full-screen crop editor — opened from the small panel so there's room to drag a precise
// rectangle. Only affects the isometría; the main preview and the drawing visor are untouched.
// Renders the plan onto a canvas (via pdf.js) instead of an <embed> so the view can be panned
// and zoomed — an <embed> only ever shows the first fit-to-container view of the page, which
// left the crop rectangle stuck to that one region.
function PlanCropModal({ planFile, initialCrop, onClose, onSave }: {
  planFile: File;
  initialCrop: PlanCrop | null;
  onClose: () => void;
  onSave: (crop: PlanCrop) => void;
}) {
  const [rect, setRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    initialCrop ? { x0: initialCrop.x, y0: initialCrop.y, x1: initialCrop.x + initialCrop.w, y1: initialCrop.y + initialCrop.h } : null
  );
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef({ zoom: 1, offX: 0, offY: 0 });
  const dragRef = useRef<{ kind: 'pan' | 'rect' | 'resize'; lastX: number; lastY: number } | null>(null);
  const resizeAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const [hoverCorner, setHoverCorner] = useState(false);
  const [, setTick] = useState(0);
  const rerender = () => setTick(n => n + 1);

  // Load the PDF's first page into an offscreen canvas once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buf = await planFile.arrayBuffer();
        const pdfjsLib = await getPdfjs();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 2 });
        const c = document.createElement('canvas');
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        await page.render({ canvas: c, viewport: vp }).promise;
        if (cancelled) return;
        setPageCanvas(c);
      } catch {
        if (!cancelled) setLoadError('No se pudo cargar el plano.');
      }
    })();
    return () => { cancelled = true; };
  }, [planFile]);

  // Fit the view once the page and container are both ready.
  useEffect(() => {
    if (!pageCanvas || !containerRef.current) return;
    const cw = containerRef.current.clientWidth || 1;
    const ch = containerRef.current.clientHeight || 1;
    const zoom = Math.min(cw / pageCanvas.width, ch / pageCanvas.height) * 0.95;
    viewRef.current = {
      zoom,
      offX: (cw - pageCanvas.width * zoom) / 2,
      offY: (ch - pageCanvas.height * zoom) / 2,
    };
    rerender();
  }, [pageCanvas]);

  const rectNorm = rect ? {
    x: Math.min(rect.x0, rect.x1), y: Math.min(rect.y0, rect.y1),
    w: Math.abs(rect.x1 - rect.x0), h: Math.abs(rect.y1 - rect.y0),
  } : null;

  // Draw the page + crop overlay on every relevant change.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#141416';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (pageCanvas) {
      const { zoom, offX, offY } = viewRef.current;
      ctx.drawImage(pageCanvas, offX, offY, pageCanvas.width * zoom, pageCanvas.height * zoom);
      if (rectNorm) {
        const toScreen = (fx: number, fy: number) => ({
          x: offX + fx * pageCanvas.width * zoom,
          y: offY + fy * pageCanvas.height * zoom,
        });
        const p0 = toScreen(rectNorm.x, rectNorm.y);
        const p1 = toScreen(rectNorm.x + rectNorm.w, rectNorm.y + rectNorm.h);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#F5A623';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
        ctx.setLineDash([]);
        // Corner handles at a fixed screen size (not scaled by zoom) so they stay visible and
        // graspable even when zoomed way out and the rectangle itself is tiny on screen.
        ctx.fillStyle = '#F5A623';
        ctx.strokeStyle = '#141416';
        ctx.lineWidth = 1;
        const hs = 4;
        for (const [hx, hy] of [[p0.x, p0.y], [p1.x, p0.y], [p0.x, p1.y], [p1.x, p1.y]]) {
          ctx.beginPath();
          ctx.rect(hx - hs, hy - hs, hs * 2, hs * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
      // Full-canvas crosshair through the cursor — a fixed OS cursor icon is easy to lose track
      // of once zoomed way out over a busy plan, so draw high-contrast guide lines instead.
      if (hoverRef.current && !isPanning) {
        const { x: hx, y: hy } = hoverRef.current;
        ctx.save();
        ctx.strokeStyle = 'rgba(245,166,35,0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, 0); ctx.lineTo(hx, canvas.height);
        ctx.moveTo(0, hy); ctx.lineTo(canvas.width, hy);
        ctx.stroke();
        ctx.restore();
      }
    }
  });

  const toPageFrac = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const c = canvas!.getBoundingClientRect();
    const sx = clientX - c.left, sy = clientY - c.top;
    const { zoom, offX, offY } = viewRef.current;
    return {
      x: Math.min(1, Math.max(0, (sx - offX) / (pageCanvas!.width * zoom))),
      y: Math.min(1, Math.max(0, (sy - offY) / (pageCanvas!.height * zoom))),
    };
  }, [pageCanvas]);

  // Page-fraction → screen px, using the page's real pixel size (mirrors the draw effect).
  const toScreenPage = useCallback((fx: number, fy: number) => {
    const { zoom, offX, offY } = viewRef.current;
    return { x: offX + fx * (pageCanvas?.width ?? 0) * zoom, y: offY + fy * (pageCanvas?.height ?? 0) * zoom };
  }, [pageCanvas]);

  const CORNER_HIT_PX = 10;
  const rectCorners = useCallback((rn: { x: number; y: number; w: number; h: number }) => ([
    { x: rn.x, y: rn.y, opp: { x: rn.x + rn.w, y: rn.y + rn.h } },
    { x: rn.x + rn.w, y: rn.y, opp: { x: rn.x, y: rn.y + rn.h } },
    { x: rn.x, y: rn.y + rn.h, opp: { x: rn.x + rn.w, y: rn.y } },
    { x: rn.x + rn.w, y: rn.y + rn.h, opp: { x: rn.x, y: rn.y } },
  ]), []);

  const onWheel = useCallback((e: WheelEvent) => {
    if (!pageCanvas || !canvasRef.current) return;
    e.preventDefault();
    const c = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - c.left, my = e.clientY - c.top;
    const { zoom, offX, offY } = viewRef.current;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.min(10, Math.max(0.2, zoom * factor));
    const pageX = (mx - offX) / zoom, pageY = (my - offY) / zoom;
    viewRef.current = { zoom: newZoom, offX: mx - pageX * newZoom, offY: my - pageY * newZoom };
    rerender();
  }, [pageCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pageCanvas) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Middle mouse button (the scroll wheel click) always pans, no matter what — that's the
    // whole point: pan without ever letting go of the crop rectangle you're mid-drawing.
    // preventDefault stops the browser's native middle-click autoscroll icon from taking over.
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      dragRef.current = { kind: 'pan', lastX: e.clientX, lastY: e.clientY };
      return;
    }
    if (e.shiftKey) {
      setIsPanning(true);
      dragRef.current = { kind: 'pan', lastX: e.clientX, lastY: e.clientY };
      return;
    }
    // Grabbing a corner of an existing rectangle resizes it (opposite corner stays put)
    // instead of starting a brand new one.
    if (rectNorm) {
      const c = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - c.left, sy = e.clientY - c.top;
      for (const corner of rectCorners(rectNorm)) {
        const s = toScreenPage(corner.x, corner.y);
        if (Math.hypot(sx - s.x, sy - s.y) <= CORNER_HIT_PX) {
          resizeAnchorRef.current = corner.opp;
          dragRef.current = { kind: 'resize', lastX: e.clientX, lastY: e.clientY };
          return;
        }
      }
    }
    const p = toPageFrac(e.clientX, e.clientY);
    setRect({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    dragRef.current = { kind: 'rect', lastX: e.clientX, lastY: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pageCanvas) return;
    const c = canvasRef.current!.getBoundingClientRect();
    hoverRef.current = { x: e.clientX - c.left, y: e.clientY - c.top };
    if (!dragRef.current) {
      let onCorner = false;
      if (rectNorm) {
        const sx = e.clientX - c.left, sy = e.clientY - c.top;
        onCorner = rectCorners(rectNorm).some(corner => {
          const s = toScreenPage(corner.x, corner.y);
          return Math.hypot(sx - s.x, sy - s.y) <= CORNER_HIT_PX;
        });
      }
      setHoverCorner(onCorner);
      rerender();
      return;
    }
    if (dragRef.current.kind === 'pan') {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      viewRef.current = { ...viewRef.current, offX: viewRef.current.offX + dx, offY: viewRef.current.offY + dy };
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      rerender();
    } else if (dragRef.current.kind === 'resize') {
      const p = toPageFrac(e.clientX, e.clientY);
      const anchor = resizeAnchorRef.current;
      if (anchor) setRect({ x0: anchor.x, y0: anchor.y, x1: p.x, y1: p.y });
    } else {
      const p = toPageFrac(e.clientX, e.clientY);
      setRect(prev => prev ? { ...prev, x1: p.x, y1: p.y } : null);
    }
  };
  const onPointerUp = () => { dragRef.current = null; setIsPanning(false); resizeAnchorRef.current = null; };
  const onPointerLeave = () => { dragRef.current = null; setIsPanning(false); resizeAnchorRef.current = null; hoverRef.current = null; rerender(); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,11,13,0.96)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#F5A623', whiteSpace: 'nowrap' }}>✂ Definir recorte</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { ico: '🖱️', lbl: 'Clic izquierdo', desc: 'dibujar / mover esquina' },
            { ico: '🖲️', lbl: 'Clic central', desc: 'mover el plano' },
            { ico: '🔍', lbl: 'Rueda', desc: 'zoom' },
          ].map(h => (
            <span key={h.lbl} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 7px',
              background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 999,
              fontSize: 12, whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 12 }}>{h.ico}</span>
              <span style={{ color: 'var(--txt)', fontWeight: 600 }}>{h.lbl}</span>
              <span style={{ color: 'var(--txt3)' }}>{h.desc}</span>
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#F5A623', opacity: 0.85 }}>
            <span>ℹ</span> Solo se aplica en la isometría
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {rectNorm && (
          <button type="button" onClick={() => setRect(null)}
            style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: '#ef5350', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Borrar rectángulo
          </button>
        )}
        <button type="button" onClick={onClose}
          style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          Cancelar
        </button>
        <button type="button"
          disabled={!rectNorm || rectNorm.w < 0.02 || rectNorm.h < 0.02}
          onClick={() => { if (rectNorm && rectNorm.w >= 0.02 && rectNorm.h >= 0.02) onSave(rectNorm); }}
          style={{ padding: '5px 14px', background: 'rgba(14,204,122,0.15)', border: '1.5px solid rgba(14,204,122,0.4)', borderRadius: 'var(--r)', color: '#0ECC7A', cursor: rectNorm ? 'pointer' : 'default', opacity: rectNorm ? 1 : 0.5, fontSize: 12, fontWeight: 700 }}>
          ✓ Guardar recorte
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '7px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'rgba(245,166,35,0.06)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#F5A623' }}>
          <span style={{ fontSize: 13 }}>⚠</span>
          <span><strong>Este recorte es global:</strong> se aplicará a todos los planos ya cargados, no solo al que estás viendo ahora.</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--txt3)' }}>
          <span style={{ fontSize: 13 }}>💡</span>
          <span>Recomendación: define el recorte al final, cuando ya hayas cargado todos los planos, para no repetir el ajuste.</span>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 20, display: 'flex' }}>
        <div ref={containerRef} style={{ position: 'relative', flex: 1, background: '#141416', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          {!pageCanvas && !loadError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', fontSize: 13 }}>
              Cargando plano…
            </div>
          )}
          {loadError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef5350', fontSize: 13 }}>
              {loadError}
            </div>
          )}
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: isPanning ? 'grabbing' : (hoverCorner ? 'nwse-resize' : 'crosshair') }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={e => e.preventDefault()}
            onAuxClick={e => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  );
}

// Self-contained crop tool, docked at the bottom-left of "Carga de planos". This only affects
// how the plano renders in the isometría — the main preview here and the drawing visor always
// show the plan complete, uncropped.
function PlanCropPanel({ selectedPlanUrl, planFile }: { selectedPlanUrl: string; planFile: File }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [planCrop, setPlanCropState] = useState<PlanCrop | null>(() => loadPlanCrop());

  const applyCrop = useCallback((crop: PlanCrop | null) => {
    setPlanCropState(crop);
    savePlanCrop(crop);
  }, []);

  return (
    <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>✂ Recorte (isometría)</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 110, background: '#141416', borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--line)' }}>
        <embed key={selectedPlanUrl} src={`${selectedPlanUrl}#toolbar=0`} type="application/pdf" title="Miniatura del plano" style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
        {planCrop && (
          <div style={{
            position: 'absolute', pointerEvents: 'none',
            left: `${planCrop.x * 100}%`, top: `${planCrop.y * 100}%`,
            width: `${planCrop.w * 100}%`, height: `${planCrop.h * 100}%`,
            border: '2px solid #F5A623',
            boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)',
          }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" onClick={() => setModalOpen(true)}
          style={{ flex: 1, padding: '4px 6px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          Recortar
        </button>
        {planCrop && (
          <button type="button" onClick={() => applyCrop(null)}
            style={{ padding: '4px 6px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: '#ef5350', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Quitar
          </button>
        )}
      </div>
      {modalOpen && (
        <PlanCropModal
          planFile={planFile}
          initialCrop={planCrop}
          onClose={() => setModalOpen(false)}
          onSave={crop => { applyCrop(crop); setModalOpen(false); }}
        />
      )}
    </div>
  );
}

function PlanosTab({ state }: PlanosTabProps) {
  const {
    plans, addPlans, removePlan, updatePlan, confirmPlan,
    planDrag, setPlanDrag,
    selectedPlanId, setSelectedPlanId,
    selectedPlan, selectedPlanUrl,
    pendingPlanos, confirmedPlanos,
    pisos, fileRef,
  } = state;

  const navigate = useNavigate();
  const [calibrating, setCalibrating] = useState(false);
  const [showProtocolo, setShowProtocolo] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [calData, setCalData] = useState<Record<number, CalibrationData>>(() => {
    const initial: Record<number, CalibrationData> = {};
    if (plans) {
      for (const p of plans) {
        if (p.origen && p.scale) {
          const sm = p.scale / 100;
          initial[p.id] = {
            origen: p.origen,
            scaleM: sm,
            factorX: p.factorX !== undefined && p.factorX !== null ? p.factorX : sm,
            factorY: p.factorY !== undefined && p.factorY !== null ? p.factorY : sm,
            calGlobal: p.calGlobal !== undefined && p.calGlobal !== null ? p.calGlobal : null,
            definedScale: p.definedScale !== undefined && p.definedScale !== null ? p.definedScale : sm,
          };
        }
      }
    }
    return initial;
  });

  const isCalibrated = useCallback((planId: number) => {
    const cd = calData[planId];
    return cd && cd.origen && cd.scaleM;
  }, [calData]);

  const handleSaveConfig = (config: CalibrationData & { planId: number }) => {
    setCalData(prev => ({ ...prev, [config.planId]: config }));
    if (!(window as any)._planosConfig) (window as any)._planosConfig = {};
    const key = `${selectedPlan?.name || 'plan'}_${config.planId}`;
    (window as any)._planosConfig[key] = {
      nombre: selectedPlan?.name || '',
      origen: config.origen,
      scaleM: config.scaleM,
      factorX: config.factorX,
      factorY: config.factorY,
      calGlobal: config.calGlobal,
      fecha: new Date().toLocaleString('es-CO'),
    };
    updatePlan(config.planId, {
      scale: config.scaleM ? Math.round(config.scaleM * 100) : 100,
      origen: config.origen,
      factorX: config.factorX,
      factorY: config.factorY,
      calGlobal: config.calGlobal,
      definedScale: config.definedScale,
    });

    try {
      const trazosKey = TRAZOS_PREFIX + config.planId;
      const data = loadFromStorage<any>(trazosKey, {});
      data.origen = config.origen;
      if (config.scaleM) {
        data.scaleM = config.scaleM;
      }
      data.factorX = config.factorX;
      data.factorY = config.factorY;
      data.definedScale = config.definedScale;
      saveToStorage(trazosKey, data);
      saveTrazosToDB(String(config.planId), data).catch(e => { if (import.meta.env.DEV) console.error('saveTrazosToDB error:', e); });
    } catch (e) {
      if (import.meta.env.DEV) console.error('Error syncing calibration to Supabase:', e);
    }
  };

  const handleIrADibujo = () => {
    if (!selectedPlan) return;
    const idx = plans.findIndex(p => p.id === selectedPlan.id);
    if (idx >= 0) {
      try {
        localStorage.setItem('civilflow_visor_activeIndex', String(idx));
        localStorage.setItem('civilflow_visor_activePlanId', String(selectedPlan.id));
      } catch {
        // ignore
      }
    }
    navigate('/visor');
  };


  // Calibration mode: full-width PlanoConfigurator with back button
  if (calibrating && selectedPlan) {
    const cal = calData[selectedPlan.id];
    const calDone = cal && cal.origen && cal.scaleM;
    return (
      <div className="fu" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => { setCalibrating(false); }}
            style={PlanosTab_S1}>
            ← VOLVER A CARGA DE PLANOS
          </button>
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedPlan.name}</span>
          {calDone && (
            <span style={{ fontSize: 12, color: 'var(--ok)', marginLeft: 4 }}>✓ Calibrado</span>
          )}
          <div style={{ flex: 1 }} />
          {selectedPlan.nivel !== null && calDone && (
            <button type="button" onClick={() => {
              if (plans.some((x: any) => x.id !== selectedPlan.id && x.status === 'confirmed' && x.nivel === selectedPlan.nivel)) {
                alert('Este nivel ya tiene un plano asociado.');
                return;
              }
              confirmPlan(selectedPlan.id);
              setCalibrating(false);
            }} style={PlanosTab_S2}>
              ✓ CONFIRMAR PLANO
            </button>
          )}
          {(!calDone || selectedPlan.nivel === null || selectedPlan.nivel === undefined) && (
            <span style={{ fontSize: 12, color: 'var(--txt4)', whiteSpace: 'nowrap' }}>
              {!calDone ? 'Define origen y calibración' : 'Asigna un nivel en Paso 0'}
            </span>
          )}
        </div>
        <PlanoConfigurator
          planFile={selectedPlan.file}
          planName={selectedPlan.name}
          planId={selectedPlan.id}
          onSaveConfig={handleSaveConfig}
          onIrADibujo={handleIrADibujo}
          existingCal={cal}
          pisos={pisos}
          plans={plans}
          planNivel={selectedPlan.nivel ?? null}
          onUpdateNivel={(pid, nivel) => updatePlan(pid, { nivel })}
        />
      </div>
    );
  }

  return (
    <div className="fu" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', padding: 0 }}>
      <div style={{ width: 215, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)' }}>
        <div className="card-h" style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'none' }}>
          <h3 className="card-t" style={{ fontSize: 15 }}>
            <img src="/iconos_carga_planos/requisitos_del_plano.svg" alt="Requisitos del plano"  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle', marginRight: 4 }}  loading="lazy" />
            Requisitos del plano
          </h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={() => setShowProtocolo(true)}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              width: '100%', 
              padding: '6px 8px', 
              background: btnHover ? 'rgba(0, 220, 229, 0.1)' : 'var(--bg3)', 
              border: `1.5px solid ${btnHover ? '#00dce5' : 'var(--line)'}`, 
              borderRadius: 'var(--r)', 
              color: btnHover ? '#00dce5' : 'var(--txt2)', 
              cursor: 'pointer', 
              fontSize: 12, 
              fontWeight: btnHover ? 600 : 400,
              transition: 'all .2s ease',
              marginBottom: 4, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 4
            }}>
            📋 Requisitos para carga
          </button>
          {REQ_ITEMS.map(({ ico, icoImg, t, s }) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icoImg ? <img src={icoImg} alt=""  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle' }}  loading="lazy" /> : ico}</span>
              <div><div style={{ fontSize: 14, fontWeight: 500 }}>{t}</div><div style={{ fontSize: 12.5, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.4 }}>{s}</div></div>
            </div>
          ))}
        </div>
        {selectedPlan && selectedPlanUrl && (
          <PlanCropPanel selectedPlanUrl={selectedPlanUrl} planFile={selectedPlan.file} />
        )}
      </div>
      {showProtocolo && <ModalProtocolo onClose={() => setShowProtocolo(false)} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}
        onDragOver={e => { e.preventDefault(); setPlanDrag(true); }}
        onDragLeave={() => setPlanDrag(false)}
        onDrop={e => { e.preventDefault(); setPlanDrag(false); const fl = e.dataTransfer?.files; if (fl && fl.length > 0) addPlans(fl); }}>
        <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) addPlans(e.target.files); e.target.value = ''; }} />

        <div style={PlanosTab_S3}>
          {selectedPlan ? (
            <>
              <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedPlan.name}</span>
              {selectedPlan.nivel !== null && <span style={{ fontSize: 12, padding: '1px 6px', background: 'var(--bg3)', borderRadius: 'var(--r)', color: 'var(--txt3)', flexShrink: 0 }}>{pisoLbl(selectedPlan.nivel)}</span>}
              {isCalibrated(selectedPlan.id) && <span style={{ fontSize: 12, color: 'var(--ok)', flexShrink: 0 }}>✓</span>}
              <div style={{ flex: 1 }} />
              {selectedPlan.status === 'confirmed' && (
                <button type="button" onClick={() => {
                    const idx = plans.findIndex(p => p.id === selectedPlanId);
                    if (idx >= 0) {
                      try {
                        localStorage.setItem('civilflow_visor_activeIndex', String(idx));
                        localStorage.setItem('civilflow_visor_activePlanId', String(selectedPlanId));
                      } catch {
                        // ignore
                      }
                    }
                    navigate('/visor');
                  }}
                  style={PlanosTab_S4}>
                  IR A DIBUJO DE REDES &rarr;
                </button>
              )}
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Vista previa del plano</span>
          )}
        </div>

        {selectedPlan && selectedPlanUrl ? (
          <div style={{ flex: 1, background: '#141416', position: 'relative' }}>
            {planDrag && (
              <div style={PlanosTab_S5}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</span>
              </div>
            )}
            <embed key={selectedPlanUrl} src={`${selectedPlanUrl}#toolbar=0`} type="application/pdf" title="Plano seleccionado" style={{ width: '100%', height: '100%' }} />
          </div>
        ) : (
          <div style={PlanosTab_S6}
            role="button" tabIndex={0} aria-label="Seleccionar archivo de plano"
            onClick={() => fileRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}>
            {planDrag ? (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,220,229,.08)', border: '3px dashed rgba(0,220,229,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 40, opacity: .25 }}>&#x1F4D0;</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt3)' }}>Vista previa del plano</div>
                <div style={{ fontSize: 12, color: 'var(--txt4)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
                  Sube un plano desde el panel derecho o arrastra un PDF aquí
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line)', background: 'var(--bg)' }}>
        <div style={{ padding: '10px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={PlanosTab_S7}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,220,229,0.12)'; e.currentTarget.style.borderColor = 'rgba(0,220,229,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,220,229,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,220,229,0.3)'; }}>
            <img src="/iconos_carga_planos/subir_plano.svg" alt="Subir plano"  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle', marginRight: 4 }}  loading="lazy" /> SUBIR PLANO
          </button>
        </div>

        <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}
          onDragOver={e => { e.preventDefault(); setPlanDrag(true); }}
          onDragLeave={() => setPlanDrag(false)}
          onDrop={e => { e.preventDefault(); setPlanDrag(false); const fl = e.dataTransfer?.files; if (fl && fl.length > 0) addPlans(fl); }}>
          <div style={PlanosTab_S8}>
            <img src="/iconos_carga_planos/pendientes.svg" alt="Pendientes"  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle' }}  loading="lazy" />
            Pendientes {pendingPlanos.length > 0 && `(${pendingPlanos.length})`}
          </div>
          {pendingPlanos.length === 0 ? (
            <div style={PlanosTab_S9}
              role="button" tabIndex={0} aria-label="Subir planos"
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}>
              {planDrag ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</div>
              ) : (
                <>
                  <div style={{ fontSize: 24, opacity: .3 }}>&#x1F4D0;</div>
                  <span>Arrastra PDFs aquí o haz clic para subir varios planos</span>
                </>
              )}
            </div>
          ) : (
            <ul role="list" style={PlanosTab_S10}>
              {pendingPlanos.map((p: any) => {
                const calOk = isCalibrated(p.id);
                const isSelected = selectedPlanId === p.id;
                return (
                  <li key={p.id}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--r)',
                      border: isSelected ? '1px solid rgba(0, 220, 229, 0.35)' : '1px solid var(--line)',
                      background: isSelected ? 'rgba(0, 220, 229, 0.03)' : 'transparent',
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.15s ease',
                    }}>
                    
                    {/* Left Side: Info and Confirm */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} title={p.name}>
                          {p.name}
                        </span>
                        {p.nivel !== null && (
                          <span style={{ fontSize: 12, padding: '1px 5px', background: 'var(--bg3)', borderRadius: 'var(--r)', color: 'var(--txt3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {pisoLbl(p.nivel)}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                          {calOk ? (
                            <span style={{ color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ fontSize: 12 }}>●</span> Calibrado</span>
                              {p.definedScale ? <span style={{ color: 'var(--txt3)' }}>Diseño 1:{Math.round(p.definedScale * 100)}</span> : null}
                              <span style={{ color: 'var(--txt2)' }}>| Calibrada 1:{Math.round(p.scale/100 * 100)}</span>
                            </span>
                          ) : (
                            <span style={{ color: '#F5A623', display: 'flex', alignItems: 'center', gap: 2 }}>
                              <span style={{ fontSize: 12 }}>●</span> Sin calibrar
                            </span>
                          )}
                        </div>

                        {calOk && p.nivel !== null && p.nivel !== undefined && (
                          <button type="button"
                            onClick={() => {
                              if (plans.some((x: any) => x.id !== p.id && x.status === 'confirmed' && x.nivel === p.nivel)) {
                                alert('Este nivel ya tiene un plano asociado.');
                                return;
                              }
                              confirmPlan(p.id);
                            }}
                            style={PlanosTab_S11}
                          >
                            CONFIRMAR
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right Side: Horizontal row of 3 text buttons */}
                    <div style={{ display: 'flex', flexDirection: 'row', gap: 3, flexShrink: 0 }}>
                      <button type="button"
                        onClick={() => { setSelectedPlanId(p.id); setCalibrating(false); }}
                        style={{
                          padding: '3px 6px',
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 'var(--r)',
                          border: '1px solid var(--line)',
                          background: isSelected && !calibrating ? 'rgba(0, 220, 229, 0.12)' : 'var(--bg3)',
                          color: isSelected && !calibrating ? '#00dce5' : 'var(--txt2)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap'
                        }}
                        title="Vista previa"
                      >
                        VER
                      </button>

                      <button type="button"
                        onClick={() => { setSelectedPlanId(p.id); setCalibrating(true); }}
                        style={{
                          padding: '3px 6px',
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 'var(--r)',
                          border: '1px solid var(--line)',
                          background: isSelected && calibrating ? 'rgba(245, 166, 35, 0.12)' : 'var(--bg3)',
                          color: isSelected && calibrating ? '#F5A623' : 'var(--txt2)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap'
                        }}
                        title="Calibrar plano"
                      >
                        CALIBRAR
                      </button>

                      <button type="button"
                        onClick={() => {
                          removePlan(p.id);
                          if (selectedPlanId === p.id) {
                            setSelectedPlanId(null);
                          }
                        }}
                        style={PlanosTab_S12}
                        title="Eliminar plano"
                      >
                        ELIMINAR
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={PlanosTab_S13}>
            <img src="/iconos_carga_planos/cargados.svg" alt="Cargados"  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle' }}  loading="lazy" />
            Cargados {confirmedPlanos.length > 0 && `(${confirmedPlanos.length})`}
          </div>
          {confirmedPlanos.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--txt3)', fontSize: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{'\u{1F4CB}'}</div>
                Aún no hay planos cargados
              </div>
            </div>
          ) : (
            <ul role="list" style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}>
              {confirmedPlanos.map((p: any) => (
                <li key={p.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--line)', background: selectedPlanId === p.id ? 'rgba(27,110,243,.08)' : 'transparent', transition: 'background .1s' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--txt3)', display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                      {p.nivel !== null && <span>{pisoLbl(p.nivel)}</span>}
                      {p.scale ? (
                        <>
                          <span style={{ color: 'var(--line)' }}>|</span>
                          {p.definedScale ? <span>Diseño 1:{Math.round(p.definedScale * 100)}</span> : null}
                          {p.definedScale ? <span style={{ color: 'var(--line)' }}>|</span> : null}
                          <span style={{ color: 'var(--txt2)' }}>Calibrada 1:{Math.round(p.scale)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedPlanId(p.id)}
                    style={{ padding: '3px 6px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--r)', border: '1px solid var(--line)', background: selectedPlanId === p.id ? 'rgba(0, 220, 229, 0.12)' : 'var(--bg3)', color: selectedPlanId === p.id ? '#00dce5' : 'var(--txt2)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease', whiteSpace: 'nowrap' }} title="Vista previa">
                    VER
                  </button>
                  <button type="button" onClick={() => removePlan(p.id)}
                    style={PlanosTab_S14} title="Eliminar">
                    ELIMINAR
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
export default React.memo(PlanosTab);