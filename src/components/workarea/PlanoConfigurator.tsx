import React, { useState, useRef, useEffect, useCallback } from "react";
import { pisoLbl } from "../../constants";
import ModalProtocolo from "./ModalProtocolo";

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
  existingCal?: {
    origen: { x_px: number; y_px: number } | null;
    scaleM: number | null;
    factorX: number | null;
    factorY: number | null;
    calGlobal: boolean | null;
    definedScale?: number | null;
  } | null;
  pisos: any[];
  plans: any[];
  planNivel: number | null;
  onUpdateNivel: (planId: number, nivel: number | null) => void;
}

function PlanoConfiguratorBase({
  planFile, planName, planId, onSaveConfig, onIrADibujo, existingCal,
  pisos, plans, planNivel, onUpdateNivel,
}: PlanoConfiguratorProps) {

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [origen, setOrigen] = useState<{ x_px: number; y_px: number } | null>(existingCal?.origen || null);
  const [modoOrigen, setModoOrigen] = useState(false);

  const [modoCalX, setModoCalX] = useState(false);
  const [modoCalY, setModoCalY] = useState(false);
  const [calStart, setCalStart] = useState<{ x_px: number; y_px: number } | null>(null);
  const [calPreview, setCalPreview] = useState<{ x: number; y: number } | null>(null);
  const [lenX, setLenX] = useState('');
  const [lenY, setLenY] = useState('');
  const [factorX, setFactorX] = useState<number | null>(existingCal?.factorX ?? null);
  const [factorY, setFactorY] = useState<number | null>(existingCal?.factorY ?? null);
  const [scaleM, setScaleM] = useState<number | null>(existingCal?.scaleM || null);
  const [definedScale, setDefinedScale] = useState<number | null>(existingCal?.definedScale || existingCal?.scaleM || null);
  const [calGlobal, setCalGlobal] = useState<boolean | null>(existingCal?.calGlobal ?? null);

  const isPdf = planFile.type === 'application/pdf' || planFile.name.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpe?g|webp|bmp|gif)$/i.test(planFile.name);

  const [preScaleM, setPreScaleM] = useState<number | null>(() => {
    if (existingCal?.definedScale) return existingCal.definedScale * (96 / (isPdf ? 72 : 96));
    if (existingCal?.scaleM) return existingCal.scaleM;
    return null;
  });
  const [showProtocolo, setShowProtocolo] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!existingCal);
  const [toast, setToast] = useState<{ msg: string; type: 'err' | 'ok' | 'warn' } | null>(null);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const overlayContRef = useRef<HTMLDivElement | null>(null);
  const canvRef = useRef<HTMLCanvasElement | null>(null);
  const pdfCanvRef = useRef<HTMLCanvasElement | null>(null);
  const pageWRef = useRef(0);
  const pageHRef = useRef(0);

  const showToast = useCallback((msg: string, type: 'err' | 'ok' | 'warn' = 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const canvasToPlane = useCallback((cx: number, cy: number) => ({
    x: (cx - offset.x) / zoom,
    y: (cy - offset.y) / zoom,
  }), [zoom, offset]);

  const calcularPromedio = useCallback((fx: number | null, fy: number | null) => {
    if (fx && fy) {
      const f = (fx + fy) / 2;
      setScaleM(f);
      const diff = Math.abs(fx - fy) / f * 100;
      if (diff > 5) {
        showToast(`Diferencia X/Y = ${diff.toFixed(1)}% - Posible distorsión. Re-exportar a 300 DPI`, 'warn');
      }
    } else if (fx || fy) {
      const f = fx || fy!;
      setScaleM(f);
    }
  }, [showToast]);

  const activarModoOrigen = () => {
    setModoOrigen(!modoOrigen);
    setModoCalX(false);
    setModoCalY(false);
    setCalStart(null);
    setCalPreview(null);
  };

  const activarModoCalX = () => {
    if (modoCalX) { setModoCalX(false); setCalStart(null); setCalPreview(null); return; }
    if (!definedScale && !scaleM && !factorX && !factorY && !preScaleM) {
      showToast('Seleccione primero la "Escala definida" aproximada del plano', 'err');
      return;
    }
    const lr = parseFloat(lenX);
    if (!lr || lr <= 0) { showToast('Ingrese la longitud real X', 'err'); return; }
    setModoCalX(true);
    setModoCalY(false);
    setModoOrigen(false);
    setCalStart(null);
    setCalPreview(null);
  };

  const activarModoCalY = () => {
    if (modoCalY) { setModoCalY(false); setCalStart(null); setCalPreview(null); return; }
    if (!definedScale && !scaleM && !factorX && !factorY && !preScaleM) {
      showToast('Seleccione primero la "Escala definida" aproximada del plano', 'err');
      return;
    }
    const lr = parseFloat(lenY);
    if (!lr || lr <= 0) { showToast('Ingrese la longitud real Y', 'err'); return; }
    setModoCalY(true);
    setModoCalX(false);
    setModoOrigen(false);
    setCalStart(null);
    setCalPreview(null);
  };

  const getCursorPos = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const el = overlayContRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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

  // Listen for Escape key to cancel active calibration/origin modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modoCalX) { setModoCalX(false); setCalStart(null); setCalPreview(null); }
        if (modoCalY) { setModoCalY(false); setCalStart(null); setCalPreview(null); }
        if (modoOrigen) { setModoOrigen(false); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modoCalX, modoCalY, modoOrigen]);

  // Load image/PDF
  useEffect(() => {
    if (!planFile || !pdfCanvRef.current) return;
    setLoading(true);
    setImgLoaded(false);
    const dpr = window.devicePixelRatio || 1;

    if (isImage) {
      const img = new Image();
      const url = URL.createObjectURL(planFile);
      img.onload = () => {
        const canv = pdfCanvRef.current!;
        canv.width = img.width;
        canv.height = img.height;
        canv.style.width = img.width + 'px';
        canv.style.height = img.height + 'px';
        const ctx = canv.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        pageWRef.current = img.width;
        pageHRef.current = img.height;
        setImgLoaded(true);
        setLoading(false);
        URL.revokeObjectURL(url);
        requestAnimationFrame(() => fitView());
      };
      img.onerror = () => { setLoading(false); URL.revokeObjectURL(url); };
      img.src = url;
      return;
    }

    if (isPdf) {
      let cancelled = false;
      (async () => {
        try {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
          const data = await planFile.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data }).promise;
          if (cancelled) return;
          const page = await pdf.getPage(1);
          const vp = page.getViewport({ scale: 1 });
          const canv = pdfCanvRef.current!;
          canv.width = Math.floor(vp.width * dpr);
          canv.height = Math.floor(vp.height * dpr);
          canv.style.width = vp.width + 'px';
          canv.style.height = vp.height + 'px';
          const ctx = canv.getContext('2d')!;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = false;
          await page.render({ canvas: canv as HTMLCanvasElement, viewport: vp }).promise;
          pageWRef.current = vp.width;
          pageHRef.current = vp.height;
          setImgLoaded(true);
          setLoading(false);
          requestAnimationFrame(() => fitView());
        } catch (e) {
          if (!cancelled) { if (import.meta.env.DEV) console.error('Error loading PDF:', e); setLoading(false); }
        }
      })();
      return () => { cancelled = true; };
    }
    setLoading(false);
  }, [planFile]);

  // Overlay render
  useEffect(() => {
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
      ctx.strokeStyle = 'rgba(170,175,185,0.4)'; ctx.lineWidth = 0.7;
      ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.moveTo(0, y_px); ctx.lineTo(pageWRef.current, y_px); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x_px, 0); ctx.lineTo(x_px, pageHRef.current); ctx.stroke();
      ctx.setLineDash([]);
      // Solid cross marker (orange, zoom-aware size)
      const sz = 14;
      ctx.strokeStyle = '#F5A623'; ctx.lineWidth = 2;
      ctx.shadowColor = '#F5A623'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(x_px - sz, y_px); ctx.lineTo(x_px + sz, y_px); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x_px, y_px - sz); ctx.lineTo(x_px, y_px + sz); ctx.stroke();
      // Center dot
      ctx.fillStyle = '#F5A623';
      ctx.beginPath(); ctx.arc(x_px, y_px, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // (0,0) label with background
      ctx.font = '700 11px monospace';
      const labelW = ctx.measureText('(0,0)').width + 10;
      const labelH = 18;
      ctx.fillStyle = 'rgba(17,19,23,0.85)';
      ctx.beginPath(); ctx.roundRect(x_px + 8, y_px - labelH - 4, labelW, labelH, 4); ctx.fill();
      ctx.fillStyle = '#F5A623';
      ctx.fillText('(0,0)', x_px + 13, y_px - 6);
      ctx.restore();
    }

    if (calStart) {
      ctx.fillStyle = modoCalX ? '#4D8FF7' : '#0ECC7A';
      ctx.beginPath(); ctx.arc(calStart.x_px, calStart.y_px, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (calPreview && calStart) {
      const color = modoCalX ? '#4D8FF7' : '#0ECC7A';
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(calStart.x_px, calStart.y_px); ctx.lineTo(calPreview.x, calPreview.y); ctx.stroke();
      ctx.setLineDash([]);
      const dx = modoCalX ? (calPreview.x - calStart.x_px) : 0;
      const dy = modoCalY ? (calPreview.y - calStart.y_px) : 0;
      const distPx = Math.hypot(dx, dy);
      const internalDistCm = distPx / 96 * 2.54;
      const displayDistCm = distPx / (isPdf ? 72 : 96) * 2.54;

      const baseFactor = modoCalX ? (factorY || scaleM || preScaleM) : (factorX || scaleM || preScaleM);
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
      const tx = calPreview.x + (calPreview.x > calStart.x_px ? 8 : -8 - ctx.measureText(txt).width);
      const ty = calPreview.y + (calPreview.y > calStart.y_px ? 18 : -4);
      ctx.fillText(txt, tx, ty);

      if (refTxt) {
        ctx.font = '600 10px monospace';
        ctx.fillStyle = color + 'aa';
        const refTx = calPreview.x + (calPreview.x > calStart.x_px ? 8 : -8 - ctx.measureText(refTxt).width);
        ctx.fillText(refTxt, refTx, ty + 14);
      }

      if (modoCalX || modoCalY) {
        ctx.strokeStyle = color; ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(calPreview.x, calPreview.y - 10); ctx.lineTo(calPreview.x, calPreview.y + 10); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(calPreview.x, calPreview.y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    const showCrosshair = (modoOrigen || modoCalX || modoCalY) && !calStart && cursorPos;
    if (showCrosshair) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,220,229,0.4)'; ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(0, cursorPos.y); ctx.lineTo(pageWRef.current, cursorPos.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cursorPos.x, 0); ctx.lineTo(cursorPos.x, pageHRef.current); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,220,229,0.6)';
      ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, 3, 0, Math.PI * 2); ctx.fill();
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
        ctx.beginPath(); ctx.roundRect(12, 12, pw, ph, 6); ctx.fill();
        ctx.fillStyle = '#e2e2e8';
        ctx.fillText(txt, 22, 30);
      }
    }
  }, [origen, calStart, calPreview, modoOrigen, modoCalX, modoCalY, scaleM, imgLoaded, cursorPos]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading || !imgLoaded) return;
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setPanning(true);
      const p = getCursorPos(e);
      setPanStart({ x: p.x, y: p.y, ox: offset.x, oy: offset.y });
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
        const dx = modoCalX ? (pp.x - calStart.x_px) : 0;
        const dy = modoCalY ? (pp.y - calStart.y_px) : 0;
        const distPx = Math.hypot(dx, dy);
        if (distPx < 5) { setCalStart(null); return; }
        const distCm = distPx / 96 * 2.54;
        if (modoCalX) {
          const lr = parseFloat(lenX);
          const fx = lr / distCm;
          setFactorX(fx);
          setModoCalX(false);
          setCalStart(null); setCalPreview(null);
          calcularPromedio(fx, factorY);
          setHasSaved(false);
        } else {
          const lr = parseFloat(lenY);
          const fy = lr / distCm;
          setFactorY(fy);
          setModoCalY(false);
          setCalStart(null); setCalPreview(null);
          calcularPromedio(factorX, fy);
          setHasSaved(false);
        }
      }
      return;
    }

    setPanning(true);
    setPanStart({ x, y, ox: offset.x, oy: offset.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getCursorPos(e);
    const pp = canvasToPlane(x, y);
    setCursorPos(pp);
    if (panning && panStart) {
      setOffset({ x: panStart.ox + (x - panStart.x), y: panStart.oy + (y - panStart.y) });
      return;
    }
    if ((modoCalX || modoCalY) && calStart) {
      const pp = canvasToPlane(x, y);
      if (modoCalX) setCalPreview({ x: pp.x, y: calStart.y_px });
      else setCalPreview({ x: calStart.x_px, y: pp.y });
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (panning) { setPanning(false); setPanStart(null); }
    setCursorPos(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const { x, y } = getCursorPos(e as any);
    const d = e.deltaY > 0 ? -0.1 : 0.1;
    const nz = Math.max(0.05, Math.min(8, zoom + d));
    setOffset(o => ({
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
  const tieneCal = factorX !== null || factorY !== null;
  const escalaDisponible = scaleM !== null || preScaleM !== null;

  const guardarConfig = () => {
    if (planNivel === null || planNivel === undefined) { showToast('Asigne un nivel antes de guardar (Paso 1)', 'err'); return; }
    if (!origen) { showToast('Defina el origen antes de guardar (Paso 2)', 'err'); return; }
    if (!scaleM && !preScaleM) { showToast('Calibre al menos un eje antes de guardar', 'err'); return; }
    if (escalaDisponible && calGlobal === null) {
      showToast('Seleccione si la calibración aplica a todos los planos o plano por plano', 'err');
      return;
    }

    // Bloquea guardar si la diferencia de calibración X/Y supera el 5%
    const diffPctVal = factorX && factorY && scaleM ? Math.abs(factorX - factorY) / scaleM * 100 : 0;
    if (diffPctVal > 5) {
      showToast(`No se puede guardar: La diferencia de calibración X/Y (${diffPctVal.toFixed(1)}%) supera el 5%.`, 'err');
      return;
    }

    onSaveConfig({ planId, origen, scaleM: scaleM || preScaleM, factorX, factorY, calGlobal, definedScale });
    showToast('Configuración guardada', 'ok');
    setSaved(true);
    setHasSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const irADibujo = () => {
    if (!origen) { showToast('Defina el origen antes de ir a dibujo', 'err'); return; }
    if (!scaleM) { showToast('Calibre al menos un eje antes de ir a dibujo', 'err'); return; }
    onIrADibujo();
  };

  const diffPct = factorX && factorY && scaleM ? Math.abs(factorX - factorY) / scaleM * 100 : 0;

  const TOAST_BG: Record<string, string> = { err: 'rgba(211,47,47,0.9)', warn: 'rgba(245,158,11,0.9)', ok: 'rgba(14,204,122,0.9)' };

  return (
    <div className="fu" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {showProtocolo && <ModalProtocolo onClose={() => setShowProtocolo(false)} />}
      {toast && (
        <div role="alert" style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
          padding: '6px 14px', fontSize: 11, fontWeight: 600, textAlign: 'center',
          background: TOAST_BG[toast.type] || TOAST_BG.ok,
          color: '#fff',
        }}>{toast.msg}</div>
      )}

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg)', minHeight: 36, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250 }}>{planName}</span>
        {scaleM && (
          <>
            <span style={{ fontSize: 13, color: 'var(--txt2)', fontFamily: 'monospace' }}>
              ✓ 1cm = <strong style={{ color: 'var(--acc)' }}>{scaleM.toFixed(4)}m</strong>
            </span>
            {factorX && factorY && (
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: diffPct > 5 ? '#f59e0b' : 'var(--ok)' }}>
                Δ {diffPct.toFixed(1)}% {diffPct <= 5 ? '✓' : '⚠'}
              </span>
            )}
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--txt4)' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={fitView} title="Ajustar vista" style={{ padding: '2px 8px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--txt3)', cursor: 'pointer', fontSize: 11 }}>
          ⊞ Ajustar
        </button>
      </div>

      {/* Main area: viewer + config panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Interactive viewer */}
        <div ref={overlayContRef}
          style={{
            flex: 1, minWidth: 0, position: 'relative',
            background: '#0a0e14', overflow: 'hidden', cursor: cursor(),
          }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onWheel={onWheel}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
              <span style={{ fontSize: 13, color: 'var(--txt3)' }}>Cargando plano...</span>
            </div>
          )}
          <div style={{
            position: 'absolute', left: `${offset.x}px`, top: `${offset.y}px`,
            transform: `scale(${zoom})`, transformOrigin: 'top left',
            pointerEvents: 'none',
          }}>
            <canvas ref={pdfCanvRef} style={{ display: 'block' }} />
            <canvas ref={canvRef} style={{ position: 'absolute', top: 0, left: 0, display: 'block' }} />
          </div>
        </div>

        {/* Right: Configuration panel - compact */}
        <div style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line)', background: 'var(--bg)', overflowY: 'auto' }}>
          {/* Step 1: Level */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Asignar nivel
            </div>
            <select value={planNivel ?? ''} onChange={e => {
              const v = e.target.value ? Number(e.target.value) : null;
              onUpdateNivel(planId, v);
              setHasSaved(false);
            }}
              style={{ width: '100%', padding: '5px 6px', fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer' }}>
              <option value="">— Seleccionar nivel —</option>
              {[...pisos].sort((a: any, b: any) => b.n - a.n).map((s: any) => {
                const ocupado = plans.some((x: any) => x.id !== planId && x.status === 'confirmed' && x.nivel === s.n);
                return <option key={s.id} value={s.n} disabled={ocupado}>{pisoLbl(s.n)} ({s.npt} m){ocupado ? ' (ocupado)' : ''}</option>;
              })}
            </select>
            
            {/* Escala - definida y calibrada side-by-side */}
            <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, whiteSpace: 'nowrap' }}>
                  Escala definida
                </div>
                <select
                  value={definedScale ? Math.round(definedScale * 100) : ''}
                  onChange={e => {
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
                  style={{ width: '100%', padding: '5px 6px', fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer' }}
                >
                  <option value="">— Escala —</option>
                  {(() => {
                    const PREDEF = [50, 75, 100, 125, 150, 200, 250, 500];
                    const calVal = definedScale ? Math.round(definedScale * 100) : 0;
                    const hasCal = calVal > 0 && !PREDEF.includes(calVal);
                    const opts = hasCal ? [...PREDEF, calVal].sort((a, b) => a - b) : PREDEF;
                    return opts.map(v => (
                      <option key={v} value={v}>1:{v}</option>
                    ));
                  })()}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, whiteSpace: 'nowrap' }}>
                  Escala calibrada
                </div>
                {scaleM ? (
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)', fontFamily: 'monospace', padding: '5px 0', whiteSpace: 'nowrap' }}>
                    1:{Math.round(scaleM * 100)}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--txt4)', padding: '5px 0', whiteSpace: 'nowrap' }}>— Sin calibrar</div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Origin */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Definir origen
            </div>
            <button onClick={activarModoOrigen}
              style={{
                width: '100%', padding: '6px 8px', fontSize: 12, fontWeight: 600,
                background: modoOrigen ? 'rgba(245,166,35,0.15)' : 'var(--bg3)',
                border: `1.5px solid ${modoOrigen ? '#F5A623' : 'var(--line)'}`,
                borderRadius: 'var(--r)', color: modoOrigen ? '#F5A623' : 'var(--txt2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all .15s',
              }}>
              📍 Definir origen en plano
            </button>
            {origen && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--ok)', fontFamily: 'monospace' }}>
                  ✓ ({origen.x_px.toFixed(0)}, {origen.y_px.toFixed(0)}) px
                </span>
                <button onClick={() => { setOrigen(null); setHasSaved(false); }}
                  style={{ padding: '0 4px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 11, lineHeight: '16px' }}>
                  ✕
                </button>
              </div>
            )}
          </div>



          {/* Step 3 & 4: Calibrate X and Y */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Calibrar X
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="text" inputMode="decimal" placeholder="(m)" value={lenX} onChange={e => setLenX(e.target.value.replace(/,/g, '.'))}
                  disabled={modoCalX}
                  style={{ flex: 1, minWidth: 0, padding: '5px 4px', fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt)', fontFamily: 'monospace' }} />
                <button onClick={activarModoCalX}
                  style={{
                    padding: '5px 6px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                    background: modoCalX ? 'rgba(77,143,247,0.15)' : 'var(--bg3)',
                    border: `1.5px solid ${modoCalX ? '#4D8FF7' : 'var(--line)'}`,
                    borderRadius: 'var(--r)', color: modoCalX ? '#4D8FF7' : 'var(--txt2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .15s',
                  }}>
                  {modoCalX ? 'Cancelar' : 'Trazar'}
                </button>
              </div>
              {factorX && (
                <div style={{ marginTop: 3, fontSize: 10, color: 'var(--ok)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  ✓ {factorX.toFixed(4)}
                  <button onClick={() => { setFactorX(null); setLenX(''); if (factorY) { setScaleM(factorY); setDefinedScale(factorY); } else { setScaleM(null); setDefinedScale(null); } setHasSaved(false); }}
                    style={{ padding: '0 4px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 10, lineHeight: '14px' }}>✕</button>
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Calibrar Y
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="text" inputMode="decimal" placeholder="(m)" value={lenY} onChange={e => setLenY(e.target.value.replace(/,/g, '.'))}
                  disabled={modoCalY}
                  style={{ flex: 1, minWidth: 0, padding: '5px 4px', fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt)', fontFamily: 'monospace' }} />
                <button onClick={activarModoCalY}
                  style={{
                    padding: '5px 6px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                    background: modoCalY ? 'rgba(14,204,122,0.15)' : 'var(--bg3)',
                    border: `1.5px solid ${modoCalY ? '#0ECC7A' : 'var(--line)'}`,
                    borderRadius: 'var(--r)', color: modoCalY ? '#0ECC7A' : 'var(--txt2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .15s',
                  }}>
                  {modoCalY ? 'Cancelar' : 'Trazar'}
                </button>
              </div>
              {factorY && (
                <div style={{ marginTop: 3, fontSize: 10, color: 'var(--ok)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  ✓ {factorY.toFixed(4)}
                  <button onClick={() => { setFactorY(null); setLenY(''); if (factorX) { setScaleM(factorX); setDefinedScale(factorX); } else { setScaleM(null); setDefinedScale(null); } setHasSaved(false); }}
                    style={{ padding: '0 4px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 10, lineHeight: '14px' }}>✕</button>
                </div>
              )}
            </div>
          </div>

          {/* Scope */}
          {(tieneCal || preScaleM !== null) && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Alcance
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: 'var(--bg3)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, color: 'var(--txt2)' }}>
                  <input type="radio" name="calGlobal" checked={calGlobal === true} onChange={() => { setCalGlobal(true); setHasSaved(false); }} />
                  Todos los pisos
                </label>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: 'var(--bg3)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, color: 'var(--txt2)' }}>
                  <input type="radio" name="calGlobal" checked={calGlobal === false} onChange={() => { setCalGlobal(false); setHasSaved(false); }} />
                  Por piso
                </label>
              </div>
            </div>
          )}

          {/* Actions & Verification */}
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--line)' }}>
            {/* Checklist - grid 3 cols */}
            <div style={{ padding: '4px 0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Verificación
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                <Chk done={planNivel !== null} label="Nivel" />
                <Chk done={tieneOrigen} label="Origen" />
                <Chk done={factorX !== null} label="Cal X" />
                <Chk done={factorY !== null} label="Cal Y" />
                <Chk done={escalaDisponible} label="Escala" />
                <Chk done={calGlobal !== null} label="Alcance" />
                <Chk done={hasSaved} label="Guardado" />
              </div>
            </div>

            <button onClick={guardarConfig}
              style={{
                width: '100%', padding: '6px 8px',
                background: saved ? 'rgba(14,204,122,0.15)' : 'var(--acc)',
                border: saved ? '1.5px solid #0ECC7A' : 'none',
                borderRadius: 'var(--r)', color: saved ? '#0ECC7A' : '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .15s',
              }}>
              {saved ? '✓ Configuración guardada' : '💾 Guardar configuración'}
            </button>

            <button onClick={() => setShowProtocolo(true)}
              style={{ width: '100%', padding: '6px 8px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer', fontSize: 12, transition: 'all .15s' }}>
              📋 Requisitos para carga de planos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chk({ done, label }: { done: boolean; label: string }) {
  return (
    <span style={{ fontSize: 11, color: done ? 'var(--ok)' : 'var(--txt4)', display: 'flex', alignItems: 'center', gap: 3 }}>
      {done ? '✅' : '⬜'} {label}
    </span>
  );
}

const PlanoConfigurator = React.memo(PlanoConfiguratorBase);
export { PlanoConfigurator };
