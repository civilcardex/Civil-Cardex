import React, { useState, useCallback, useEffect, useRef } from "react";
import { loadPlanCrop, savePlanCrop, type PlanCrop } from "../../utils/planCrop";
import { getPdfjs } from "../../utils/lazyPdfjs";

const hintChipStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 7px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 999, fontSize: 12, whiteSpace: 'nowrap' };
const modalSecondaryBtnStyle: React.CSSProperties = { padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, fontWeight: 700 };
const recortarBtnStyle: React.CSSProperties = { flex: 1, padding: '4px 6px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer', fontSize: 12, fontWeight: 700 };
const quitarBtnStyle: React.CSSProperties = { padding: '4px 6px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: '#ef5350', cursor: 'pointer', fontSize: 12, fontWeight: 700 };

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
    if (!canvas || !pageCanvas) return { x: 0, y: 0 };
    const c = canvas.getBoundingClientRect();
    const sx = clientX - c.left, sy = clientY - c.top;
    const { zoom, offX, offY } = viewRef.current;
    return {
      x: Math.min(1, Math.max(0, (sx - offX) / (pageCanvas.width * zoom))),
      y: Math.min(1, Math.max(0, (sy - offY) / (pageCanvas.height * zoom))),
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
      const canvas = canvasRef.current;
      if (!canvas) return;
      const c = canvas.getBoundingClientRect();
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getBoundingClientRect();
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
            <span key={h.lbl} style={hintChipStyle}>
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
            style={{ ...modalSecondaryBtnStyle, color: '#ef5350' }}>
            Borrar rectángulo
          </button>
        )}
        <button type="button" onClick={onClose}
          style={{ ...modalSecondaryBtnStyle, color: 'var(--txt2)' }}>
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
export function PlanCropPanel({ selectedPlanUrl, planFile }: { selectedPlanUrl: string; planFile: File }) {
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
        <embed key={selectedPlanUrl} src={`${selectedPlanUrl}#toolbar=0`} type="application/pdf" title="Miniatura del plano" aria-label="Miniatura del plano" style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
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
          style={recortarBtnStyle}>
          Recortar
        </button>
        {planCrop && (
          <button type="button" onClick={() => applyCrop(null)}
            style={quitarBtnStyle}>
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
