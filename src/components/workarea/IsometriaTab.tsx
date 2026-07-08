import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { getPdfjs } from "../../utils/lazyPdfjs";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { TRAZOS_PREFIX } from "../../constants/storage-keys";
import { loadFromStorage } from "../../services/storageService";
import { loadPDF } from "../../services/idbStorage";
const IsometriaTab_S1: React.CSSProperties = { padding: '3px 8px', fontSize: 12, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid #3a494a', cursor: 'pointer', background: '#1e2024', color: '#b9caca' };
const IsometriaTab_S2: React.CSSProperties = { padding: '3px 8px', fontSize: 12, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid #3a494a', cursor: 'pointer', background: '#1e2024', color: '#b9caca' };
const IsometriaTab_S3: React.CSSProperties = { padding: '3px 8px', fontSize: 12, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid #3a494a', cursor: 'pointer', background: '#1e2024', color: '#b9caca' };
const IsometriaTab_S4: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, display: 'flex', flexDirection: 'column', minWidth: 80 };
const IsometriaTab_S5: React.CSSProperties = { padding: '4px 8px', fontSize: 12, fontFamily: 'Geist,monospace', border: 'none', background: 'transparent', color: '#b9caca', cursor: 'pointer', textAlign: 'left' };
const IsometriaTab_S6: React.CSSProperties = { padding: '4px 8px', fontSize: 12, fontFamily: 'Geist,monospace', border: 'none', background: 'transparent', color: '#b9caca', cursor: 'pointer', textAlign: 'left' };
const IsometriaTab_S7: React.CSSProperties = { padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #2a3a3b', fontFamily: 'Geist,monospace', userSelect: 'none', };


const ISO_NETS_KEY = 'civilflow_iso_activeNets';

interface ProjPt { sx: number; sy: number }

function project(
  x: number, y: number, z: number,
  rotZDeg: number, rotXDeg: number,
  scaleZ: number, zoom: number,
  offX: number, offY: number,
  cx: number, cy: number
): ProjPt {
  const rZ = rotZDeg * Math.PI / 180;
  const rX = rotXDeg * Math.PI / 180;
  const x1 = x * Math.cos(rZ) - y * Math.sin(rZ);
  const y1 = x * Math.sin(rZ) + y * Math.cos(rZ);
  const y2 = y1 * Math.cos(rX) - z * scaleZ * Math.sin(rX);
  return { sx: x1 * zoom + offX + cx, sy: y2 * zoom + offY + cy };
}

function readDrawingAll(plans: any[], netIds: string[]) {
  const dataByNet: Record<string, { ramales: any[]; bajantes: any[] }> = {};
  for (const nid of netIds) dataByNet[nid] = { ramales: [], bajantes: [] };
  const scaleMap: Record<number, number> = {};
  const origenMap: Record<number, { x_px: number; y_px: number }> = {};
  for (const plan of plans) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    const data = (typeof raw === 'string') ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    if (!data) continue;
    if (data.scaleM) scaleMap[plan.nivel] = data.scaleM;
    if (data.origen) origenMap[plan.nivel] = data.origen;
    for (const netId of netIds) {
      for (const r of (data.ramales || [])) {
        if (r.net === netId && r.tipo === 'ramal')
          dataByNet[netId].ramales.push({ ...r, planNivel: plan.nivel, planId: String(plan.id) });
      }
      for (const b of (data.bajantes || [])) {
        if (b.net === netId)
          dataByNet[netId].bajantes.push({ ...b, planNivel: plan.nivel, planId: String(plan.id) });
      }
    }
  }
  return { dataByNet, scaleMap, origenMap };
}

async function loadPlanImage(plan: any): Promise<{ nivel: number; img: HTMLCanvasElement; w: number; h: number } | null> {
  try {
    const file = await loadPDF(plan.id);
    if (!file) return null;
    const buf = await file.arrayBuffer();
    const pdfjsLib = await getPdfjs();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 1.5 });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    await page.render({ canvas: c, viewport: vp }).promise;
    return { nivel: plan.nivel, img: c, w: vp.width, h: vp.height };
  } catch {
    return null;
  }
}

function IsometriaTabBase({ state }: any) {
  const { plans, pisos, profs, proy } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'rot' | 'pan'; sx: number; sy: number; rx0: number; rz0: number; ox0: number; oy0: number } | null>(null);

  const [activeNets, _setActiveNets] = useState<Set<string>>(() => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem(ISO_NETS_KEY) || 'null'); } catch { return null; } })();
    if (Array.isArray(saved) && saved.length > 0) return new Set(saved);
    if (!state.plans) return new Set();
    const withData: string[] = [];
    for (const n of NETS) {
      for (const plan of state.plans) {
        const raw = localStorage.getItem(TRAZOS_PREFIX + plan.id);
        if (raw) {
          try {
            const data = JSON.parse(raw);
            if ((data.ramales || []).some((r: any) => r.net === n.id) || (data.bajantes || []).some((b: any) => b.net === n.id)) {
              withData.push(n.id);
              break;
            }
          } catch { /* empty */ }
        }
      }
    }
    return new Set(withData);
  });
  const setActiveNets = useCallback((fn: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    _setActiveNets(prev => {
      const next = typeof fn === 'function' ? (fn as (prev: Set<string>) => Set<string>)(prev) : fn;
      localStorage.setItem(ISO_NETS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleNet = useCallback((netId: string) => {
    setActiveNets(prev => {
      const next = new Set(prev);
      if (next.has(netId)) next.delete(netId); else next.add(netId);
      return next;
    });
  }, [setActiveNets]);

  const [rotX, setRotX] = useState(-45);
  const [rotZ, setRotZ] = useState(45);
  const [scaleZ, setScaleZ] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [selTramo, setSelTramo] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [showPlanos, setShowPlanos] = useState(true);
  const planImagesRef = useRef<Map<any, { img: HTMLCanvasElement; w: number; h: number }>>(new Map());
  const [renderTick, setRenderTick] = useState(0);
  const [cursorStyle, setCursorStyle] = useState('grab');
  const [planosCount, setPlanosCount] = useState('0/0');
  useEffect(() => { setCursorStyle(dragRef.current ? 'grabbing' : 'grab'); });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sortedNets = useMemo(() => [...activeNets].sort(), [activeNets]);
  const result = useMemo(() => readDrawingAll(plans || [], sortedNets), [plans, sortedNets]);
  const { dataByNet, scaleMap: readScaleMap, origenMap: readOrigenMap } = result;

  const nptMap = useMemo(() => {
    const m: Record<number, number> = {};
    const pisosArr = pisos || [];
    const defaultSpacingMm = 2700;
    const sorted = [...pisosArr].sort((a: any, b: any) => a.n - b.n);
    for (const p of sorted) {
      const floorIdx = p.n >= 0 && p.n < 90 ? p.n : p.n === 99 ? (sorted.filter((x: any) => x.n > 0 && x.n < 90).length + 1) : -(Math.abs(p.n));
      m[p.n] = floorIdx * defaultSpacingMm;
    }
    return m;
  }, [pisos]);

  const profByNet = useMemo(() => {
    const m: Record<string, number> = {};
    (profs || []).forEach((p: any) => { m[p.id] = p.prof ?? 0; });
    return m;
  }, [profs]);

  const [collapsedNets, _setCollapsedNets] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('civilflow_iso_collapsed') || '[]')); }
    catch { return new Set(); }
  });
  const toggleCollapsedNet = useCallback((netId: string) => {
    _setCollapsedNets(prev => {
      const next = new Set(prev);
      if (next.has(netId)) next.delete(netId); else next.add(netId);
      localStorage.setItem('civilflow_iso_collapsed', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const tramoTree = useMemo(() => {
    const tree: { netId: string; netName: string; netColor: string; niveles: { nivel: number; label: string; ramales: any[]; bajantes: any[] }[] }[] = [];
    for (const n of NETS) {
      if (!activeNets.has(n.id)) continue;
      const netData = dataByNet[n.id];
      if (!netData || (netData.ramales.length === 0 && netData.bajantes.length === 0)) continue;
      const netColor = n.col || '#888';
      const nivelMap: Record<number, { ramales: any[]; bajantes: any[] }> = {};
      for (const r of netData.ramales) {
        const niv = r.planNivel;
        if (!nivelMap[niv]) nivelMap[niv] = { ramales: [], bajantes: [] };
        nivelMap[niv].ramales.push(r);
      }
      for (const b of netData.bajantes) {
        const niv = b.planNivel;
        if (!nivelMap[niv]) nivelMap[niv] = { ramales: [], bajantes: [] };
        nivelMap[niv].bajantes.push(b);
      }
      const niveles = Object.entries(nivelMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([nivel, data]) => ({
          nivel: Number(nivel),
          label: Number(nivel) < 0 ? `S${Math.abs(Number(nivel))}` : Number(nivel) === 99 ? 'C' : `P${Number(nivel)}`,
          ...data,
        }));
      tree.push({ netId: n.id, netName: n.name, netColor, niveles });
    }
    return tree;
  }, [dataByNet, activeNets]);

  const populatedNets = useMemo(() => {
    const netsWithData: string[] = [];
    for (const n of NETS) {
      const nId = typeof n.id === 'string' ? n.id : (n.id || '');
      const d = readDrawingAll(plans || [], [nId]);
      const nd = d.dataByNet[nId];
      if (nd && (nd.ramales.length > 0 || nd.bajantes.length > 0)) netsWithData.push(n.id);
    }
    return netsWithData;
  }, [plans]);

  const confirmedPlanos = useMemo(() => (plans || []).filter((p: any) => p.status === 'confirmed' && p.nivel != null), [plans]);

  const getIsoCoords = useCallback((px: number, py: number, nivel: number) => {
    const plan = confirmedPlanos.find((p: any) => p.nivel !== null && String(p.nivel) === String(nivel));
    const scaleM = (plan?.scale ? plan.scale / 100 : null) || plan?.scaleM || readScaleMap?.[nivel] || 0.5;
    const planData = plan ? planImagesRef.current.get(plan.id) : null;
    const scale = 1.5;
    let pageW = 842;
    let pageH = 595;
    if (planData) {
      pageW = planData.w / scale;
      pageH = planData.h / scale;
    } else {
      for (const [, pd] of planImagesRef.current) {
        pageW = pd.w / scale;
        pageH = pd.h / scale;
        break;
      }
    }
    const ox = plan?.origen?.x_px ?? readOrigenMap?.[nivel]?.x_px ?? (pageW / 2);
    const oy = plan?.origen?.y_px ?? readOrigenMap?.[nivel]?.y_px ?? (pageH / 2);

    const x_m = (px - ox) * (2.54 * scaleM / 96);
    const y_m = (py - oy) * (2.54 * scaleM / 96);
    const isoScale = 150;
    return {
      x: x_m * isoScale,
      y: y_m * isoScale
    };
  }, [confirmedPlanos, readScaleMap, readOrigenMap]);

  const getZPix = useCallback((zMm: number, _nivel?: number) => {
    const zMeters = zMm / 1000;
    const isoScale = 150;
    return zMeters * isoScale;
  }, []);

  useEffect(() => {
    if (!showPlanos) return;
    let cancelled = false;
    (async () => {
      const newImages = new Map<number, { img: HTMLCanvasElement; w: number; h: number }>();
      for (const plan of confirmedPlanos) {
        if (cancelled) break;
        const existing = planImagesRef.current.get(plan.id);
        if (existing) {
          newImages.set(plan.id, existing);
          continue;
        }
        const result = await loadPlanImage(plan);
        if (result && !cancelled) {
          newImages.set(plan.id, result);
        }
      }
      if (!cancelled) {
        planImagesRef.current = newImages;
        setRenderTick(n => n + 1);
        setPlanosCount(`${newImages.size}/${confirmedPlanos.length}`);
      }
    })();
    return () => { cancelled = true; };
  }, [confirmedPlanos, showPlanos]);

  const fitView = useCallback(() => {
    const W = size.w, H = size.h;
    if (W < 10 || H < 10) return;
    const cx = W / 2, cy = H / 2;
    const pts: ProjPt[] = [];

    for (const [netId, netData] of Object.entries(dataByNet)) {
      if (!activeNets.has(netId)) continue;
      const prof = profByNet[netId] ?? 0;
      for (const r of netData.ramales) {
        const z = (nptMap[r.planNivel] || 0) + prof * 1000;
        const z_pix = getZPix(z, r.planNivel);
        for (const p of r.pts) {
          const iso = getIsoCoords(p[0], p[1], r.planNivel);
          pts.push(project(iso.x, iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
        }
      }
      for (const b of netData.bajantes) {
        const prof2 = profByNet[b.net] ?? 0;
        let baseZ = ((b.nptBase || 0) + prof2) * 1000;
        let cimaZ = ((b.nptCima || 0) + prof2) * 1000;
        const currentZ = nptMap[b.planNivel] || 0;
        let targetZ = currentZ;
        if (b.descargaEnId) {
          const parts = b.descargaEnId.includes('|') ? b.descargaEnId.split('|') : [b.planId, b.descargaEnId];
          const targetPlanId = parts[0];
          const targetId = parts[1];
          const targetRamal = netData.ramales.find((rr: any) => rr.id === targetId && String(rr.planId) === String(targetPlanId));
          if (targetRamal) {
            targetZ = nptMap[targetRamal.planNivel] || 0;
          }
        }
        if (baseZ === 0 && cimaZ === 0) {
          if (targetZ < currentZ) {
            cimaZ = currentZ; baseZ = targetZ;
          } else if (targetZ > currentZ) {
            baseZ = currentZ; cimaZ = targetZ;
          } else {
            baseZ = currentZ; cimaZ = currentZ + 1000;
          }
        }
        const baseZ_pix = getZPix(baseZ, b.planNivel);
        const cimaZ_pix = getZPix(cimaZ, b.planNivel);
        const iso = getIsoCoords(b.x, b.y, b.planNivel);
        pts.push(project(iso.x, iso.y, baseZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
        pts.push(project(iso.x, iso.y, cimaZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
      }
    }

    if (showPlanos && planImagesRef.current.size > 0) {
      for (const [planId, planData] of planImagesRef.current) {
        const plan = confirmedPlanos.find((p: any) => p.id === planId);
        if (!plan || plan.nivel == null) continue;
        const z = nptMap[plan.nivel] || 0;
        const z_pix = getZPix(z, plan.nivel);
        const imgW = planData.w;
        const imgH = planData.h;
        const scale = 1.5;
        const pageW = imgW / scale;
        const pageH = imgH / scale;
        const tl_iso = getIsoCoords(0, 0, plan.nivel);
        const tr_iso = getIsoCoords(pageW, 0, plan.nivel);
        const bl_iso = getIsoCoords(0, pageH, plan.nivel);
        const br_iso = getIsoCoords(pageW, pageH, plan.nivel);
        pts.push(project(tl_iso.x, tl_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
        pts.push(project(tr_iso.x, tr_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
        pts.push(project(bl_iso.x, bl_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
        pts.push(project(br_iso.x, br_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
      }
    }

    if (pts.length === 0) return false;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.sx < minX) minX = p.sx;
      if (p.sx > maxX) maxX = p.sx;
      if (p.sy < minY) minY = p.sy;
      if (p.sy > maxY) maxY = p.sy;
    }
    const bw = maxX - minX || 1, bh = maxY - minY || 1;
    const pad = 60;
    const newZoom = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh) * zoom;
    const cx_screen = (minX + maxX) / 2;
    const cy_screen = (minY + maxY) / 2;
    const cx_unzoomed = (cx_screen - offX - W / 2) / zoom;
    const cy_unzoomed = (cy_screen - offY - H / 2) / zoom;
    const newOffX = -cx_unzoomed * newZoom;
    const newOffY = -cy_unzoomed * newZoom;
    setZoom(Math.max(0.1, Math.min(10, newZoom)));
    setOffX(newOffX);
    setOffY(newOffY);
    return true;
  }, [dataByNet, activeNets, profByNet, nptMap, rotZ, rotX, scaleZ, zoom, offX, offY, size, showPlanos, confirmedPlanos, getIsoCoords, getZPix]);

  const resetView = useCallback(() => {
    setRotX(-45); setRotZ(45); setScaleZ(1); setZoom(1); setOffX(0); setOffY(0);
  }, []);

  const totals = useMemo(() => {
    let ramales = 0, bajantes = 0, len = 0;
    for (const nd of Object.values(dataByNet)) {
      for (const r of nd.ramales) { ramales++; len += r.totalL || 0; }
      bajantes += nd.bajantes.length;
    }
    return { ramales, bajantes, len: len.toFixed(1) };
  }, [dataByNet]);

  const exportPdf = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || size.w < 10) return;
    const { jsPDF } = await import('jspdf');
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFontSize(16);
    doc.text('Civil Flow', 15, 15);
    doc.setFontSize(11);
    const netNames = [...activeNets].map(id => NETS.find(n => n.id === id)?.name).filter(Boolean).join(', ');
    doc.text(`Proyecto: ${proy?.nombre || '—'}`, 15, 23);
    doc.text(`Redes: ${netNames || '—'}`, 15, 31);

    doc.setDrawColor(180, 180, 180);
    doc.line(14, 35, pageW - 14, 35);

    const margin = 14;
    const usableW = pageW - margin * 2;
    const aspect = canvas.width / canvas.height;
    let imgW = usableW;
    let imgH = usableW / aspect;
    const maxImgH = pageH - 40 - margin;
    if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * aspect; }
    const imgX = margin + (usableW - imgW) / 2;
    const imgY = 40 + (maxImgH - imgH) / 2;
    doc.addImage(dataUrl, 'PNG', imgX, imgY, imgW, imgH);

    doc.setFontSize(9);
    doc.text(`Vista: rotX=${rotX}° rotZ=${rotZ}° scaleZ=${scaleZ.toFixed(1)} zoom=${Math.round(zoom * 100)}%`, margin, pageH - 8);
    const dateStr = new Date().toLocaleDateString('es-CO');
    doc.text(`Tramos: ${totals.ramales} · Bajantes: ${totals.bajantes} · Long: ${totals.len}m`, pageW / 2, pageH - 8, { align: 'center' } as any);
    doc.text(dateStr, pageW - margin, pageH - 8, { align: 'right' } as any);

    doc.save(`civilflow_isometria_${(proy?.nombre || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
  }, [activeNets, proy, rotX, rotZ, scaleZ, zoom, size, totals]);

  const exportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w < 10) return;
    const link = document.createElement('a');
    link.download = `civilflow_isometria_${(proy?.nombre || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toLocaleDateString('es-CO').replace(/\//g, '-')}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  }, [proy, size]);

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = size.w, H = size.h;
    const dpr = devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;

    const segments: { sx1: number; sy1: number; sx2: number; sy2: number; z: number; id: string; label: string; isBaj: boolean; netId: string }[] = [];

    // Draw planos as semi-transparent background sheets
    if (showPlanos && planImagesRef.current.size > 0) {
      for (const [planId, planData] of planImagesRef.current) {
        const plan = confirmedPlanos.find((p: any) => p.id === planId);
        if (!plan || plan.nivel == null) continue;
        const z = nptMap[plan.nivel] || 0;
        const z_pix = getZPix(z, plan.nivel);
        const img = planData.img;
        const imgW = planData.w;
        const imgH = planData.h;
        const scale = 1.5;
        const pageW = imgW / scale;
        const pageH = imgH / scale;
        const tl_iso = getIsoCoords(0, 0, plan.nivel);
        const tr_iso = getIsoCoords(pageW, 0, plan.nivel);
        const bl_iso = getIsoCoords(0, pageH, plan.nivel);
        const label_iso = getIsoCoords(pageW / 2, -30, plan.nivel);

        const tl = project(tl_iso.x, tl_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        const tr = project(tr_iso.x, tr_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        const bl = project(bl_iso.x, bl_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        const ax = (tr.sx - tl.sx) / imgW * dpr;
        const ay = (tr.sy - tl.sy) / imgW * dpr;
        const bx = (bl.sx - tl.sx) / imgH * dpr;
        const by = (bl.sy - tl.sy) / imgH * dpr;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.setTransform(ax, ay, bx, by, tl.sx * dpr, tl.sy * dpr);
        ctx.drawImage(img, 0, 0, imgW, imgH);
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#5a6a6b';
        ctx.lineWidth = 1 / (zoom || 1);
        ctx.strokeRect(0.5, 0.5, imgW - 1, imgH - 1);
        ctx.restore();
        const midPt = project(label_iso.x, label_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        ctx.save();
        ctx.fillStyle = '#5a6a6bcc';
        ctx.font = `bold ${Math.max(10, 11 * zoom)}px Geist,monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const pisoLabel = plan.nivel < 0 ? `S${Math.abs(plan.nivel)}` : plan.nivel === 99 ? 'C' : `P${plan.nivel}`;
        ctx.fillText(pisoLabel, midPt.sx, midPt.sy);
        ctx.restore();
      }
    }

    // Draw each active network
    for (const [netId, netData] of Object.entries(dataByNet)) {
      if (!activeNets.has(netId)) continue;
      const netColor = NETS.find(n => n.id === netId)?.col || '#888';
      const prof = profByNet[netId] ?? 0;

      ctx.strokeStyle = netColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      for (const r of netData.ramales) {
        const z = (nptMap[r.planNivel] || 0) + prof * 1000;
        const z_pix = getZPix(z, r.planNivel);
        const pts = r.pts;
        if (pts.length < 2) continue;
        const selKey = `${netId}:${r.planId}:${r.id}`;
        const isSel = selKey === selTramo;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const iso = getIsoCoords(pts[i][0], pts[i][1], r.planNivel);
          const pr = project(iso.x, iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
          if (i === 0) ctx.moveTo(pr.sx, pr.sy); else ctx.lineTo(pr.sx, pr.sy);
        }
        ctx.strokeStyle = isSel ? '#FFEB3B' : netColor;
        ctx.lineWidth = isSel ? 3.5 : 2;
        ctx.stroke();

        for (let i = 1; i < pts.length; i++) {
          const iso1 = getIsoCoords(pts[i - 1][0], pts[i - 1][1], r.planNivel);
          const iso2 = getIsoCoords(pts[i][0], pts[i][1], r.planNivel);
          const a = project(iso1.x, iso1.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
          const b = project(iso2.x, iso2.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
          segments.push({ sx1: a.sx, sy1: a.sy, sx2: b.sx, sy2: b.sy, z: z_pix, id: selKey, label: r.label || r.id, isBaj: false, netId });
        }

        if (isSel) {
          const midI = Math.floor(pts.length / 2);
          const isoMid = getIsoCoords(pts[midI][0], pts[midI][1], r.planNivel);
          const mp = project(isoMid.x, isoMid.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
          ctx.fillStyle = '#FFEB3B';
          ctx.font = 'bold 11px Geist,monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const lbl = `${r.label || r.id} L=${r.totalL}m`;
          ctx.fillText(lbl, mp.sx, mp.sy - 8);
        }
      }

      for (const b of netData.bajantes) {
        const profB = profByNet[b.net] ?? 0;
        const currentZ = nptMap[b.planNivel] || 0;
        let targetZ = currentZ;

        let targetRamal = null;
        if (b.descargaEnId) {
          const parts = b.descargaEnId.includes('|') ? b.descargaEnId.split('|') : [b.planId, b.descargaEnId];
          const targetPlanId = parts[0];
          const targetId = parts[1];
          targetRamal = netData.ramales.find((rr: any) => rr.id === targetId && String(rr.planId) === String(targetPlanId));
          if (targetRamal) {
            targetZ = nptMap[targetRamal.planNivel] || 0;
          }
        }

        const lo = Math.min(currentZ, targetZ);
        const hi = Math.max(currentZ, targetZ);
        const baseZ = (lo === hi ? lo : lo) + profB * 1000;
        const cimaZ = (lo === hi ? hi + 1000 : hi) + profB * 1000;

        const baseZ_pix = getZPix(baseZ, b.planNivel);
        const cimaZ_pix = getZPix(cimaZ, b.planNivel);
        const iso = getIsoCoords(b.x, b.y, b.planNivel);
        const pBase = project(iso.x, iso.y, baseZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        const pCima = project(iso.x, iso.y, cimaZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        const selKey = `${netId}:${b.planId}:${b.id}`;
        const isSel = selKey === selTramo;

        ctx.beginPath();
        ctx.moveTo(pBase.sx, pBase.sy);
        ctx.lineTo(pCima.sx, pCima.sy);
        ctx.strokeStyle = isSel ? '#FFEB3B' : netColor;
        ctx.lineWidth = isSel ? 3.5 : 2;
        ctx.stroke();
        segments.push({ sx1: pBase.sx, sy1: pBase.sy, sx2: pCima.sx, sy2: pCima.sy, z: (baseZ_pix + cimaZ_pix) / 2, id: selKey, label: b.code || b.id, isBaj: true, netId });

        if (targetRamal && targetRamal.pts.length > 0) {
          const rIso = getIsoCoords(targetRamal.pts[0][0], targetRamal.pts[0][1], targetRamal.planNivel);
          const rZ_pix = getZPix(targetZ, targetRamal.planNivel);
          const rProj = project(rIso.x, rIso.y, rZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
          const connectionPoint = (targetZ === baseZ) ? pBase : pCima;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(connectionPoint.sx, connectionPoint.sy);
          ctx.lineTo(rProj.sx, rProj.sy);
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }

        if (isSel) {
          const mid = { sx: (pBase.sx + pCima.sx) / 2, sy: (pBase.sy + pCima.sy) / 2 };
          const dInches = b.dNominal ? Math.round(Number(b.dNominal) / 25.4) : 0;
          const lbl1 = dInches > 0 ? `${b.code || b.id}:${dInches}"` : `${b.code || b.id}`;
          const dirText = b.direccion === 'sube' ? 'Sube' : b.direccion === 'baja' ? 'Baja' : '';
          ctx.fillStyle = '#FFEB3B';
          ctx.font = 'bold 11px Geist,monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(lbl1, mid.sx, mid.sy - 8);
          if (dirText) {
            ctx.font = '10px Geist,monospace';
            ctx.fillText(dirText, mid.sx, mid.sy - 8 + 13);
          }
        }
      }
    }

    // Axis indicator (bottom-left)
    const axCx = 50, axCy = H - 50;
    const axLen = 25;
    const axisColors = ['#ff4444', '#44ff44', '#4488ff'];
    const axisLabels = ['X', 'Y', 'Z'];
    const axisDirs: [number, number, number][] = [[axLen, 0, 0], [0, axLen, 0], [0, 0, axLen]];
    for (let i = 0; i < 3; i++) {
      const from = project(0, 0, 0, rotZ, rotX, scaleZ, zoom, offX - cx + axCx, offY - cy + axCy, 0, 0);
      const to = project(axisDirs[i][0], axisDirs[i][1], axisDirs[i][2], rotZ, rotX, scaleZ, zoom, offX - cx + axCx, offY - cy + axCy, 0, 0);
      ctx.beginPath();
      ctx.moveTo(from.sx, from.sy);
      ctx.lineTo(to.sx, to.sy);
      ctx.strokeStyle = axisColors[i];
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = axisColors[i];
      ctx.font = 'bold 10px Geist,monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(axisLabels[i], to.sx, to.sy - 3);
    }
    ctx.fillStyle = '#5a6a6b';
    ctx.font = '9px Geist,monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${rotX}°/${rotZ}° z${scaleZ.toFixed(1)}`, 6, 6);

    // Store segments for hit testing
    (canvas as any).__isoSegments = segments;
    (canvas as any).__isoCx = W / 2;
    (canvas as any).__isoCy = H / 2;
  }, [dataByNet, activeNets, profByNet, nptMap, pisos, rotZ, rotX, scaleZ, zoom, offX, offY, size, selTramo, showPlanos, confirmedPlanos, renderTick, getIsoCoords, getZPix]);

  const getTramoAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left, my = clientY - rect.top;
    const segs: any[] = (canvas as any).__isoSegments || [];
    const hit = 6;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const s of segs) {
      const dx = s.sx2 - s.sx1, dy = s.sy2 - s.sy1;
      const len2 = dx * dx + dy * dy;
      let t = ((mx - s.sx1) * dx + (my - s.sy1) * dy) / (len2 || 1);
      t = Math.max(0, Math.min(1, t));
      const px = s.sx1 + t * dx, py = s.sy1 + t * dy;
      const d = Math.hypot(mx - px, my - py);
      if (d < hit && d < bestDist) { bestDist = d; best = s.id; }
    }
    return best;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { e.preventDefault(); return; }
    if (e.shiftKey || e.button === 1) {
      dragRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, rx0: rotX, rz0: rotZ, ox0: offX, oy0: offY };
      return;
    }
    const hit = getTramoAt(e.clientX, e.clientY);
    if (hit) { setSelTramo(prev => prev === hit ? null : hit); return; }
    setSelTramo(null);
    dragRef.current = { mode: 'rot', sx: e.clientX, sy: e.clientY, rx0: rotX, rz0: rotZ, ox0: offX, oy0: offY };
  }, [rotX, rotZ, offX, offY, getTramoAt]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (d.mode === 'rot') {
        setRotZ(d.rz0 + dx * 0.5);
        setRotX(Math.max(-90, Math.min(90, d.rx0 + dy * 0.5)));
      } else {
        setOffX(d.ox0 + dx);
        setOffY(d.oy0 + dy);
      }
    };
    const handleMouseUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => {
        const newZ = Math.max(0.05, Math.min(20, z * factor));
        const actF = newZ / z;
        if (actF !== 1) {
          setOffX(ox => (mx - cx) - (mx - ox - cx) * actF);
          setOffY(oy => (my - cy) - (my - oy - cy) * actF);
        }
        return newZ;
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const hasAnyData = useMemo(() => {
    for (const nd of Object.values(dataByNet)) {
      if (nd.ramales.length > 0 || nd.bajantes.length > 0) return true;
    }
    return false;
  }, [dataByNet]);

  const fittedRef = useRef(false);
  useEffect(() => {
    if (!fittedRef.current && (hasAnyData || (showPlanos && planImagesRef.current.size > 0))) {
      if (showPlanos && confirmedPlanos.length > 0 && planImagesRef.current.size === 0) return;
      const t = setTimeout(() => {
        if (fitView()) {
          fittedRef.current = true;
        }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [dataByNet, hasAnyData, showPlanos, confirmedPlanos.length, renderTick, fitView]);

  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#0d0f12', borderBottom: '1px solid #3a494a', flexWrap: 'wrap' }}>
        <img src="/isometria.svg" alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e2e8', fontFamily: 'Geist,monospace', marginRight: 12 }}>Isometría</span>

        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {(populatedNets.length === 0 ? NETS : populatedNets.map(nid => NETS.find(x => x.id === nid)!).filter(Boolean)).map(n => {
            const isOn = activeNets.has(n.id);
            return (
              <button type="button" key={n.id} onClick={() => toggleNet(n.id)} aria-pressed={isOn} style={{
                padding: '3px 8px', fontSize: 12, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid', cursor: 'pointer',
                background: isOn ? n.col + '33' : '#1e2024',
                borderColor: isOn ? n.col : '#3a494a',
                color: isOn ? n.col : '#849495',
                fontWeight: isOn ? 600 : 400,
              }}>{n.emoji} {n.lbl}</button>
            );
          })}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', cursor: 'pointer', marginLeft: 8, padding: '3px 8px', borderRadius: 3, border: `1px solid ${showPlanos ? '#4D8FF7' : '#3a494a'}`, background: showPlanos ? 'rgba(77,143,247,.15)' : 'transparent' }}>
          <input type="checkbox" checked={showPlanos} onChange={e => setShowPlanos(e.target.checked)} style={{ accentColor: '#4D8FF7', margin: 0 }} />
          Planos ({planosCount})
        </label>

        <div style={{ flex: 1 }} />

        <label style={{ fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
          Giro vertical 
          <button type="button" onClick={() => setRotX(-30)} style={{ padding: '2px 4px', fontSize: 12, borderRadius: 2, border: '1px solid #3a494a', cursor: 'pointer', background: rotX === -30 ? '#4D8FF7' : '#1e2024', color: rotX === -30 ? '#fff' : '#b9caca' }}>-30°</button>
          <button type="button" onClick={() => setRotX(-45)} style={{ padding: '2px 4px', fontSize: 12, borderRadius: 2, border: '1px solid #3a494a', cursor: 'pointer', background: rotX === -45 ? '#4D8FF7' : '#1e2024', color: rotX === -45 ? '#fff' : '#b9caca' }}>-45°</button>
          <input type="range" min={-90} max={90} value={rotX} onChange={e => setRotX(Number(e.target.value))} style={{ width: 60 }} />
          <span style={{ width: 28, textAlign: 'right' }}>{rotX}°</span>
        </label>
        <label style={{ fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
          Giro horizontal 
          <button type="button" onClick={() => setRotZ(30)} style={{ padding: '2px 4px', fontSize: 12, borderRadius: 2, border: '1px solid #3a494a', cursor: 'pointer', background: rotZ === 30 ? '#4D8FF7' : '#1e2024', color: rotZ === 30 ? '#fff' : '#b9caca' }}>30°</button>
          <button type="button" onClick={() => setRotZ(45)} style={{ padding: '2px 4px', fontSize: 12, borderRadius: 2, border: '1px solid #3a494a', cursor: 'pointer', background: rotZ === 45 ? '#4D8FF7' : '#1e2024', color: rotZ === 45 ? '#fff' : '#b9caca' }}>45°</button>
          <input type="range" min={0} max={360} value={rotZ} onChange={e => setRotZ(Number(e.target.value))} style={{ width: 60 }} />
          <span style={{ width: 32, textAlign: 'right' }}>{rotZ}°</span>
        </label>
        <label style={{ fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
          Distancia entre pisos <input type="range" min={0.1} max={5} step={0.1} value={scaleZ} onChange={e => setScaleZ(Number(e.target.value))} style={{ width: 50 }} />
          <span style={{ width: 24, textAlign: 'right' }}>{scaleZ.toFixed(1)}</span>
        </label>
        <label style={{ fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
          Zoom <input type="range" min={5} max={200} value={Math.round(zoom * 100)} onChange={e => setZoom(Number(e.target.value) / 100)} style={{ width: 50 }} />
          <span style={{ width: 36, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
        </label>

        <button type="button" onClick={resetView} title="Reiniciar vista" style={IsometriaTab_S1}>⟲</button>
        <button type="button" onClick={fitView} title="Encuadrar todo" style={IsometriaTab_S2}>⊞</button>
        <div ref={exportRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button type="button" onClick={() => setShowExportMenu(p => !p)} title="Descargar" style={IsometriaTab_S3}>⬇ Descargar</button>
          {showExportMenu && (
            <div style={IsometriaTab_S4}>
              <button type="button" onClick={() => { setShowExportMenu(false); exportPdf(); }} style={IsometriaTab_S5}>PDF</button>
              <button type="button" onClick={() => { setShowExportMenu(false); exportPng(); }} style={IsometriaTab_S6}>PNG</button>
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="fu" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Tramos sidebar — grouped by network then floor */}
        <div style={{ width: 200, flexShrink: 0, background: '#0d0f12', borderRight: '1px solid #3a494a', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px 6px', fontSize: 12, color: '#849495', fontFamily: 'Geist,monospace', textTransform: 'uppercase', letterSpacing: 1 }}>
            Isometría
          </div>
          {tramoTree.length === 0 && (
            <div style={{ padding: '20px 12px', fontSize: 12, color: '#5a6a6b', fontFamily: 'Geist,monospace', textAlign: 'center' }}>
              Sin datos
            </div>
          )}
          {tramoTree.map(net => {
            const isCollapsed = collapsedNets.has(net.netId);
            const netRamales = net.niveles.reduce((s, nv) => s + nv.ramales.length, 0);
            const netBajantes = net.niveles.reduce((s, nv) => s + nv.bajantes.length, 0);
            return (
              <div key={net.netId}>
                <div role="button" tabIndex={0} aria-label={`Alternar visibilidad de red ${net.netId}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleCollapsedNet(net.netId);}}} onClick={() => toggleCollapsedNet(net.netId)} style={IsometriaTab_S7}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: net.netColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: net.netColor, fontWeight: 700, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{net.netName}</span>
                  <span style={{ fontSize: 12, color: '#5a6a6b', whiteSpace: 'nowrap' }}>{netRamales + netBajantes}</span>
                  <span style={{ fontSize: 12, color: '#5a6a6b', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .15s' }}>▾</span>
                </div>
                {!isCollapsed && net.niveles.map(nv => (
                  <div key={nv.nivel}>
                    <div style={{ padding: '3px 10px 2px 20px', fontSize: 12, color: '#5a6a6b', fontFamily: 'Geist,monospace', fontWeight: 600, letterSpacing: 0.5 }}>
                      {nv.label}
                    </div>
                    <ul style={{listStyle:'none',margin:0,padding:0}}>
                    {nv.ramales.map(r => {
                      const selKey = `${net.netId}:${r.planId}:${r.id}`;
                      const isSel = selKey === selTramo;
                      return (
                        <li key={selKey} role="button" tabIndex={0} aria-label={`Seleccionar ${selKey}`} aria-current={isSel ? 'page' : undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelTramo(prev => prev === selKey ? null : selKey);}}} onClick={() => setSelTramo(prev => prev === selKey ? null : selKey)} style={{
                          padding: '3px 10px 3px 26px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          background: isSel ? '#2563EB22' : 'transparent',
                          borderLeft: isSel ? '2px solid ' + net.netColor : '2px solid transparent',
                          fontFamily: 'Geist,monospace', fontSize: 12,
                        }}>
                          <span style={{ color: net.netColor, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                          <span style={{ fontSize: 12, color: '#5a6a6b' }}>L={r.totalL}m</span>
                        </li>
                      );
                    })}
                    </ul>
                    <ul style={{listStyle:'none',margin:0,padding:0}}>
                    {nv.bajantes.map(b => {
                      const selKey = `${net.netId}:${b.planId}:${b.id}`;
                      const isSel = selKey === selTramo;
                      const dInches = b.dNominal ? Math.round(Number(b.dNominal) / 25.4) : 0;
                      const lbl = dInches > 0 ? `${b.code || b.id}:${dInches}"` : (b.code || b.id);
                      return (
                        <li key={selKey} role="button" tabIndex={0} aria-label={`Seleccionar ${selKey}`} aria-current={isSel ? 'page' : undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelTramo(prev => prev === selKey ? null : selKey);}}} onClick={() => setSelTramo(prev => prev === selKey ? null : selKey)} style={{
                          padding: '3px 10px 3px 26px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          background: isSel ? '#2563EB22' : 'transparent',
                          borderLeft: isSel ? '2px solid ' + net.netColor : '2px solid transparent',
                          fontFamily: 'Geist,monospace', fontSize: 12,
                        }}>
                          <span style={{ color: net.netColor, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lbl}</span>
                          {!(b.tipo === 'contador' || b.tipo === 'calentador') && <span style={{ fontSize: 12, color: '#5a6a6b' }}>h={b.hVert}m</span>}
                        </li>
                      );
                    })}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })}
          <div style={{ marginTop: 'auto', padding: '8px 12px', borderTop: '1px solid #3a494a', fontSize: 12, color: '#5a6a6b', fontFamily: 'Geist,monospace' }}>
            Tramos: {totals.ramales} · Bajantes: {totals.bajantes} · Long: {totals.len}m
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: cursorStyle }}
            onMouseDown={handleMouseDown}
            onContextMenu={e => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  );
}

const IsometriaTab = React.memo(IsometriaTabBase);
export { IsometriaTab };
