import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { NETS } from "../../lib/PlanoEngine";
import { TRAZOS_PREFIX } from "../../constants/storage-keys";
import { loadFromStorage } from "../../services/storageService";
import { loadPDF } from "../../services/idbStorage";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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

function readDrawing(plans: any[], net: string) {
  const ramales: any[] = [];
  const bajantes: any[] = [];
  const scaleMap: Record<number, number> = {};
  const origenMap: Record<number, { x_px: number; y_px: number }> = {};
  for (const plan of plans) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    const data = (typeof raw === 'string') ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    if (!data) continue;
    if (data.scaleM) {
      scaleMap[plan.nivel] = data.scaleM;
    }
    if (data.origen) {
      origenMap[plan.nivel] = data.origen;
    }
    for (const r of (data.ramales || [])) {
      if (r.net === net && r.tipo === 'ramal')
        ramales.push({ ...r, planNivel: plan.nivel, planId: String(plan.id) });
    }
    for (const b of (data.bajantes || [])) {
      if (b.net === net)
        bajantes.push({ ...b, planNivel: plan.nivel, planId: String(plan.id) });
    }
  }
  return { ramales, bajantes, scaleMap, origenMap };
}

async function loadPlanImage(plan: any): Promise<{ nivel: number; img: HTMLCanvasElement; w: number; h: number } | null> {
  try {
    const file = await loadPDF(plan.id);
    if (!file) return null;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 1.5 });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    const ctx = c.getContext('2d')!;
    await page.render({ canvas: c, viewport: vp }).promise;
    return { nivel: plan.nivel, img: c, w: vp.width, h: vp.height };
  } catch {
    return null;
  }
}

export default function IsometriaTab({ state }: any) {
  const { plans, pisos } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'rot' | 'pan'; sx: number; sy: number; rx0: number; rz0: number; ox0: number; oy0: number } | null>(null);

  const [activeNet, setActiveNet] = useState('san');
  const [rotX, setRotX] = useState(-25);
  const [rotZ, setRotZ] = useState(45);
  const [scaleZ, setScaleZ] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [selTramo, setSelTramo] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [showPlanos, setShowPlanos] = useState(true);
  const planImagesRef = useRef<Map<any, { img: HTMLCanvasElement; w: number; h: number }>>(new Map());
  const [renderTick, setRenderTick] = useState(0);

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

  const data = useMemo(() => readDrawing(plans || [], activeNet), [plans, activeNet]);

  const nptMap = useMemo(() => {
    const m: Record<number, number> = {};
    const pisosArr = pisos || [];
    for (const p of pisosArr) m[p.n] = (p.npt || 0) * 1000;
    // If all NPT values are equal (or all zero), generate fallback Z offsets
    // based on floor number so the scaleZ slider can separate floors visually
    const vals = Object.values(m);
    const allSame = vals.length > 1 && vals.every(v => v === vals[0]);
    if (allSame) {
      const defaultSpacingMm = 2700; // 2.7 m default floor-to-floor
      for (const p of pisosArr) {
        const floorIdx = p.n >= 0 && p.n < 90 ? p.n : p.n === 99 ? (pisosArr.filter((x: any) => x.n > 0 && x.n < 90).length + 1) : -(Math.abs(p.n));
        m[p.n] = floorIdx * defaultSpacingMm;
      }
    }
    return m;
  }, [pisos]);

  const netColor = NETS.find(n => n.id === activeNet)?.col || '#888';

  const populatedNets = useMemo(() => {
    const netsWithData: string[] = [];
    for (const n of NETS) {
      const d = readDrawing(plans || [], n.id);
      if (d.ramales.length > 0 || d.bajantes.length > 0) netsWithData.push(n.id);
    }
    return netsWithData;
  }, [plans]);

  const confirmedPlanos = useMemo(() => (plans || []).filter((p: any) => p.status === 'confirmed' && p.nivel != null), [plans]);

  const getIsoCoords = useCallback((px: number, py: number, nivel: number) => {
    const plan = confirmedPlanos.find((p: any) => p.nivel !== null && String(p.nivel) === String(nivel));
    const scaleM = (plan?.scale ? plan.scale / 100 : null) || plan?.scaleM || data.scaleMap?.[nivel] || 0.5;
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
    const ox = plan?.origen?.x_px ?? data.origenMap?.[nivel]?.x_px ?? (pageW / 2);
    const oy = plan?.origen?.y_px ?? data.origenMap?.[nivel]?.y_px ?? (pageH / 2);
    
    // Convert to meters relative to origin, then multiply by 150 (isoScale)
    const x_m = (px - ox) * (2.54 * scaleM / 96);
    const y_m = (py - oy) * (2.54 * scaleM / 96);
    const isoScale = 150;
    return {
      x: x_m * isoScale,
      y: y_m * isoScale
    };
  }, [confirmedPlanos, data.scaleMap, data.origenMap]);

  const getZPix = useCallback((zMm: number, nivel: number) => {
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
      }
    })();
    return () => { cancelled = true; };
  }, [confirmedPlanos, showPlanos]);

  const fitView = useCallback(() => {
    const W = size.w, H = size.h;
    if (W < 10 || H < 10) return;
    const cx = W / 2, cy = H / 2;
    let pts: ProjPt[] = [];
    
    // Add network points
    for (const r of data.ramales) {
      const z = nptMap[r.planNivel] || 0;
      const z_pix = getZPix(z, r.planNivel);
      for (const p of r.pts) {
        const iso = getIsoCoords(p[0], p[1], r.planNivel);
        pts.push(project(iso.x, iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
      }
    }
    for (const b of data.bajantes) {
      const baseZ = (b.nptBase || 0) * 1000;
      const cimaZ = (b.nptCima || 0) * 1000;
      const baseZ_pix = getZPix(baseZ, b.planNivel);
      const cimaZ_pix = getZPix(cimaZ, b.planNivel);
      const iso = getIsoCoords(b.x, b.y, b.planNivel);
      pts.push(project(iso.x, iso.y, baseZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
      pts.push(project(iso.x, iso.y, cimaZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy));
    }
    
    // Add plan corners if visible
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

    if (pts.length === 0) return;
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
    const newOffX = (W / 2 - (minX + maxX) / 2) / (zoom || 1) * zoom;
    const newOffY = (H / 2 - (minY + maxY) / 2) / (zoom || 1) * zoom;
    setZoom(Math.max(0.1, Math.min(10, newZoom)));
    setOffX(newOffX);
    setOffY(newOffY);
  }, [data, nptMap, rotZ, rotX, scaleZ, zoom, offX, offY, size, showPlanos, confirmedPlanos, getIsoCoords, getZPix]);

  const resetView = useCallback(() => {
    setRotX(-25); setRotZ(45); setScaleZ(1); setZoom(1); setOffX(0); setOffY(0);
  }, []);

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

    if (data.ramales.length === 0 && data.bajantes.length === 0) {
      ctx.fillStyle = '#5a6a6b';
      ctx.font = '14px Geist,monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No hay datos para la red ' + (NETS.find(n => n.id === activeNet)?.name || activeNet), cx, cy);
      return;
    }

    const segments: { sx1: number; sy1: number; sx2: number; sy2: number; z: number; id: string; label: string; isBaj: boolean }[] = [];

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

        // 4 corners in isometric space: TL, TR, BL
        const tl = project(tl_iso.x, tl_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        const tr = project(tr_iso.x, tr_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        const bl = project(bl_iso.x, bl_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        // Affine transform: map image rect (0,0)-(imgW,imgH) to screen quad using TL, TR, BL
        // Multiply by dpr because setTransform replaces the DPR scale set by ctx.scale(dpr,dpr)
        const ax = (tr.sx - tl.sx) / imgW * dpr;
        const ay = (tr.sy - tl.sy) / imgW * dpr;
        const bx = (bl.sx - tl.sx) / imgH * dpr;
        const by = (bl.sy - tl.sy) / imgH * dpr;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.setTransform(ax, ay, bx, by, tl.sx * dpr, tl.sy * dpr);
        ctx.drawImage(img, 0, 0, imgW, imgH);
        // Quad outline
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = netColor;
        ctx.lineWidth = 1 / (zoom || 1);
        ctx.strokeRect(0.5, 0.5, imgW - 1, imgH - 1);
        ctx.restore();
        // Floor label
        const midPt = project(label_iso.x, label_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        ctx.save();
        ctx.fillStyle = netColor + 'cc';
        ctx.font = `bold ${Math.max(10, 11 * zoom)}px Geist,monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const pisoLabel = plan.nivel < 0 ? `S${Math.abs(plan.nivel)}` : plan.nivel === 99 ? 'C' : `P${plan.nivel}`;
        ctx.fillText(pisoLabel, midPt.sx, midPt.sy);
        ctx.restore();
      }
    }

    ctx.strokeStyle = netColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (const r of data.ramales) {
      const z = nptMap[r.planNivel] || 0;
      const z_pix = getZPix(z, r.planNivel);
      const pts = r.pts;
      if (pts.length < 2) continue;
      const isSel = `${r.planId}:${r.id}` === selTramo;
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
        segments.push({ sx1: a.sx, sy1: a.sy, sx2: b.sx, sy2: b.sy, z: z_pix, id: `${r.planId}:${r.id}`, label: r.label || r.id, isBaj: false });
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

    for (const b of data.bajantes) {
      let baseZ = (b.nptBase || 0) * 1000;
      let cimaZ = (b.nptCima || 0) * 1000;
      
      const currentZ = nptMap[b.planNivel] || 0;
      let targetZ = currentZ;

      let targetRamal = null;
      if (b.descargaEnId) {
        const parts = b.descargaEnId.includes('|') ? b.descargaEnId.split('|') : [b.planId, b.descargaEnId];
        const targetPlanId = parts[0];
        const targetId = parts[1];
        targetRamal = data.ramales.find((rr: any) => rr.id === targetId && String(rr.planId) === String(targetPlanId));
        if (targetRamal) {
          targetZ = nptMap[targetRamal.planNivel] || 0;
        }
      }

      // If manual NPTs are 0, infer heights from the floors it connects
      if (baseZ === 0 && cimaZ === 0) {
        if (targetZ < currentZ) {
          cimaZ = currentZ;
          baseZ = targetZ;
        } else if (targetZ > currentZ) {
          baseZ = currentZ;
          cimaZ = targetZ;
        } else {
          // No valid connection or same floor, just give it a default 1m height
          baseZ = currentZ;
          cimaZ = currentZ + 1000;
        }
      }

      const baseZ_pix = getZPix(baseZ, b.planNivel);
      const cimaZ_pix = getZPix(cimaZ, b.planNivel);
      const iso = getIsoCoords(b.x, b.y, b.planNivel);
      const pBase = project(iso.x, iso.y, baseZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
      const pCima = project(iso.x, iso.y, cimaZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
      const isSel = `${b.planId}:${b.id}` === selTramo;
      
      // Draw the bajante's vertical pipe
      ctx.beginPath();
      ctx.moveTo(pBase.sx, pBase.sy);
      ctx.lineTo(pCima.sx, pCima.sy);
      ctx.strokeStyle = isSel ? '#FFEB3B' : netColor;
      ctx.lineWidth = isSel ? 3.5 : 2;
      ctx.stroke();
      segments.push({ sx1: pBase.sx, sy1: pBase.sy, sx2: pCima.sx, sy2: pCima.sy, z: (baseZ_pix + cimaZ_pix) / 2, id: `${b.planId}:${b.id}`, label: b.code || b.id, isBaj: true });

      // Draw connection to target ramal if it exists
      if (targetRamal && targetRamal.pts.length > 0) {
        const rIso = getIsoCoords(targetRamal.pts[0][0], targetRamal.pts[0][1], targetRamal.planNivel);
        const rZ_pix = getZPix(targetZ, targetRamal.planNivel);
        const rProj = project(rIso.x, rIso.y, rZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        
        // Use the bajante's base or cima depending on where the target is
        const connectionPoint = (targetZ === baseZ) ? pBase : pCima;
        
        // Connect horizontally from the bajante drop to the ramal
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(connectionPoint.sx, connectionPoint.sy);
        ctx.lineTo(rProj.sx, rProj.sy);
        ctx.strokeStyle = '#0ECC7A'; // green connection line
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
  }, [data, pisos, rotZ, rotX, scaleZ, zoom, offX, offY, size, selTramo, netColor, nptMap, activeNet, showPlanos, confirmedPlanos, renderTick, getIsoCoords, getZPix]);

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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.05, Math.min(20, z * factor)));
  }, []);

  const fittedRef = useRef(false);
  useEffect(() => {
    if (!fittedRef.current && (data.ramales.length > 0 || data.bajantes.length > 0)) {
      fittedRef.current = true;
      const t = setTimeout(fitView, 100);
      return () => clearTimeout(t);
    }
  }, [data]);

  const tramoList = useMemo(() => {
    const items: { id: string; label: string; type: 'ramal' | 'bajante'; extra: string; nivel: number; selKey: string }[] = [];
    for (const r of data.ramales) items.push({ id: r.id, label: r.label || r.id, type: 'ramal', extra: `L=${r.totalL}m`, nivel: r.planNivel, selKey: `${r.planId}:${r.id}` });
    for (const b of data.bajantes) {
      const dInches = b.dNominal ? Math.round(Number(b.dNominal) / 25.4) : 0;
      const lbl = dInches > 0 ? `${b.code || b.id}:${dInches}"` : (b.code || b.id);
      items.push({ id: b.id, label: lbl, type: 'bajante', extra: `h=${b.hVert}m`, nivel: b.planNivel, selKey: `${b.planId}:${b.id}` });
    }
    return items;
  }, [data]);

  const totalLen = useMemo(() => {
    let sum = 0;
    for (const r of data.ramales) sum += r.totalL || 0;
    return sum.toFixed(1);
  }, [data]);

  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#0d0f12', borderBottom: '1px solid #3a494a', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, marginRight: 4 }}>📐</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e2e8', fontFamily: 'Geist,monospace', marginRight: 12 }}>Isometría</span>

        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {populatedNets.length === 0 ? NETS.map(n => (
            <button key={n.id} onClick={() => setActiveNet(n.id)} style={{
              padding: '3px 8px', fontSize: 11, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid', cursor: 'pointer',
              background: activeNet === n.id ? n.col + '33' : '#1e2024',
              borderColor: activeNet === n.id ? n.col : '#3a494a',
              color: activeNet === n.id ? n.col : '#849495',
              fontWeight: activeNet === n.id ? 600 : 400,
            }}>{n.emoji} {n.lbl}</button>
          )) : populatedNets.map(nid => {
            const n = NETS.find(x => x.id === nid)!;
            return (
              <button key={n.id} onClick={() => setActiveNet(n.id)} style={{
                padding: '3px 8px', fontSize: 11, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid', cursor: 'pointer',
                background: activeNet === n.id ? n.col + '33' : '#1e2024',
                borderColor: activeNet === n.id ? n.col : '#3a494a',
                color: activeNet === n.id ? n.col : '#849495',
                fontWeight: activeNet === n.id ? 600 : 400,
              }}>{n.emoji} {n.lbl}</button>
            );
          })}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#849495', fontFamily: 'Geist,monospace', cursor: 'pointer', marginLeft: 8, padding: '3px 8px', borderRadius: 3, border: `1px solid ${showPlanos ? '#4D8FF7' : '#3a494a'}`, background: showPlanos ? 'rgba(77,143,247,.15)' : 'transparent' }}>
          <input type="checkbox" checked={showPlanos} onChange={e => setShowPlanos(e.target.checked)} style={{ accentColor: '#4D8FF7', margin: 0 }} />
          Planos ({planImagesRef.current.size}/{confirmedPlanos.length})
        </label>

        <div style={{ flex: 1 }} />

        <label style={{ fontSize: 10, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
          Giro vertical <input type="range" min={-90} max={90} value={rotX} onChange={e => setRotX(Number(e.target.value))} style={{ width: 60 }} />
          <span style={{ width: 28, textAlign: 'right' }}>{rotX}°</span>
        </label>
        <label style={{ fontSize: 10, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
          Giro horizontal <input type="range" min={0} max={360} value={rotZ} onChange={e => setRotZ(Number(e.target.value))} style={{ width: 60 }} />
          <span style={{ width: 32, textAlign: 'right' }}>{rotZ}°</span>
        </label>
        <label style={{ fontSize: 10, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
          Distancia entre pisos <input type="range" min={0.1} max={5} step={0.1} value={scaleZ} onChange={e => setScaleZ(Number(e.target.value))} style={{ width: 50 }} />
          <span style={{ width: 24, textAlign: 'right' }}>{scaleZ.toFixed(1)}</span>
        </label>
        <label style={{ fontSize: 10, color: '#849495', fontFamily: 'Geist,monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
          Zoom <input type="range" min={5} max={200} value={Math.round(zoom * 100)} onChange={e => setZoom(Number(e.target.value) / 100)} style={{ width: 50 }} />
          <span style={{ width: 36, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
        </label>

        <button onClick={resetView} title="Reiniciar vista" style={{ padding: '3px 8px', fontSize: 10, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid #3a494a', cursor: 'pointer', background: '#1e2024', color: '#b9caca' }}>⟲</button>
        <button onClick={fitView} title="Encuadrar todo" style={{ padding: '3px 8px', fontSize: 10, fontFamily: 'Geist,monospace', borderRadius: 3, border: '1px solid #3a494a', cursor: 'pointer', background: '#1e2024', color: '#b9caca' }}>⊞</button>
      </div>

      {/* Main area */}
      <div className="fu" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Tramos sidebar */}
        <div style={{ width: 200, flexShrink: 0, background: '#0d0f12', borderRight: '1px solid #3a494a', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px 6px', fontSize: 10, color: '#849495', fontFamily: 'Geist,monospace', textTransform: 'uppercase', letterSpacing: 1 }}>
            {NETS.find(n => n.id === activeNet)?.name || activeNet}
          </div>
          {tramoList.length === 0 && (
            <div style={{ padding: '20px 12px', fontSize: 11, color: '#5a6a6b', fontFamily: 'Geist,monospace', textAlign: 'center' }}>
              Sin datos
            </div>
          )}
          {tramoList.map(item => {
            const floorLabel = item.nivel < 0 ? `S${Math.abs(item.nivel)}` : item.nivel === 99 ? 'C' : `P${item.nivel}`;
            return (
              <div key={item.selKey} onClick={() => setSelTramo(prev => prev === item.selKey ? null : item.selKey)} style={{
                padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                background: selTramo === item.selKey ? '#2563EB22' : 'transparent',
                borderLeft: selTramo === item.selKey ? '3px solid ' + netColor : '3px solid transparent',
                fontFamily: 'Geist,monospace',
              }}>
                <span style={{ fontSize: 9, color: '#5a6a6b', minWidth: 22, fontWeight: 500 }}>{floorLabel}</span>
                <span style={{ fontSize: 11, color: netColor, fontWeight: 600 }}>{item.label}</span>
                <span style={{ fontSize: 9, color: '#5a6a6b', marginLeft: 'auto' }}>{item.extra}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 'auto', padding: '8px 12px', borderTop: '1px solid #3a494a', fontSize: 10, color: '#5a6a6b', fontFamily: 'Geist,monospace' }}>
            Tramos: {tramoList.length} · Long: {totalLen}m
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: dragRef.current ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onContextMenu={e => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  );
}
