import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { NETS } from '../../lib/PlanoEngine/PlanoState';
import {
  TRAZOS_PREFIX,
  ISO_COLLAPSED_KEY,
  ISO_ACTIVE_NETS_KEY,
} from '../../constants/storage-keys';
import { loadFromStorage, saveToStorage, loadTrazosFromDB } from '../../services/storageService';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';
import {
  readDrawingAll,
  loadPlanImage,
  type ProjPt,
  project,
  type IsoRamal,
  type IsoBajante,
} from './isometria/geometry';
import { useIsometriaRender } from './isometria/useIsometriaRender';
import { useIsometriaInteraction } from './isometria/useIsometriaInteraction';
import { exportPdf, exportPng } from './isometria/export';
import IsometriaToolbar from './IsometriaToolbar';
import IsometriaSidebar from './IsometriaSidebar';
import type { useWorkAreaState } from '../useWorkAreaState';

interface IsometriaTabProps {
  state: ReturnType<typeof useWorkAreaState>;
}

function IsometriaTabBase({ state }: IsometriaTabProps) {
  const { plans, pisos, profs, proy, redes } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeNets, setActiveNets] = useState<Set<string>>(() => {
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem(ISO_ACTIVE_NETS_KEY) || 'null');
      } catch {
        return null;
      }
    })();
    if (Array.isArray(saved) && saved.length > 0) return new Set(saved);
    if (!plans) return new Set();
    const withData: string[] = [];
    for (const n of NETS) {
      for (const plan of plans) {
        // Hay que pasar por el accessor con prefijo civilflow_ con el que todo escribe
        // (storageService.ts) — un localStorage.getItem directo aquí no tenía ese prefijo y
        // siempre leía una clave que nadie escribe.
        const data = loadFromStorage<{
          ramales?: { net: string }[];
          bajantes?: { net: string }[];
        } | null>(TRAZOS_PREFIX + plan.id, null);
        if (data) {
          if (
            (data.ramales || []).some((r) => r.net === n.id) ||
            (data.bajantes || []).some((b) => b.net === n.id)
          ) {
            withData.push(n.id);
            break;
          }
        }
      }
    }
    return new Set(withData);
  });
  useEffect(() => {
    localStorage.setItem(ISO_ACTIVE_NETS_KEY, JSON.stringify([...activeNets]));
  }, [activeNets]);

  const toggleNet = useCallback((netId: string) => {
    setActiveNets((prev) => {
      const next = new Set(prev);
      if (next.has(netId)) next.delete(netId);
      else next.add(netId);
      return next;
    });
  }, []);

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
  const planImagesRef = useRef<Map<number, { img: HTMLCanvasElement; w: number; h: number }>>(
    new Map(),
  );
  const [renderTick, setRenderTick] = useState(0);
  const [planosCount, setPlanosCount] = useState('0/0');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // readDrawingAll solo lee la caché LOCAL de cada piso (civilflow_trazos_<planId>) — esa caché
  // solo se llena cuando el piso se abrió de verdad en el visor 2D durante esta sesión, o cuando
  // associateBajanteAcrossFloors.ts escribe directamente sobre el piso destino. Un piso que no se
  // abrió en esta sesión (navegador recién iniciado, o el usuario entró directo a Isometría) no
  // tiene caché local alguna, así que sus ramales/bajantes/crossFloorGhosts faltan aquí en
  // silencio — por eso una bajante que cruza pisos puede verse rota/desalineada o no dibujarse
  // nada: los datos de uno de sus extremos (normalmente el ghost o la bajante destino real)
  // aún no están cargados. Prefetch desde Supabase para todo piso sin caché local y luego
  // subir trazosPrefetchTick para que el memo de abajo se re-ejecute.
  const [trazosPrefetchTick, setTrazosPrefetchTick] = useState(0);
  useEffect(() => {
    if (!plans || plans.length === 0) return;
    const missing = plans.filter((p) => loadFromStorage(TRAZOS_PREFIX + p.id, null) == null);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      await Promise.all(
        missing.map(async (p) => {
          const data = await loadTrazosFromDB(String(p.id));
          if (data) saveToStorage(TRAZOS_PREFIX + p.id, data);
        }),
      );
      if (!cancelled) setTrazosPrefetchTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [plans]);

  const sortedNets = useMemo(() => [...activeNets].toSorted(), [activeNets]);
  const result = useMemo(
    () => readDrawingAll(plans || [], sortedNets),
    // trazosPrefetchTick no se lee dentro del callback — es solo una señal de que el efecto de
    // prefetch de arriba acaba de escribir datos frescos en localStorage, que readDrawingAll lee
    // de forma síncrona; sin él en las dependencias este memo nunca se re-ejecutaría al
    // resolverse el fetch asíncrono.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans, sortedNets, trazosPrefetchTick],
  );
  const { dataByNet, scaleMap: readScaleMap, origenMap: readOrigenMap } = result;

  const nptMap = useMemo(() => {
    const m: Record<number, number> = {};
    const pisosArr = pisos || [];
    const defaultSpacingMm = 2700;
    const sorted = pisosArr.toSorted((a, b) => a.n - b.n);
    for (const p of sorted) {
      const floorIdx =
        p.n >= 0 && p.n < 90
          ? p.n
          : p.n === 99
            ? sorted.filter((x) => x.n > 0 && x.n < 90).length + 1
            : -Math.abs(p.n);
      m[p.n] = -floorIdx * defaultSpacingMm;
    }
    return m;
  }, [pisos]);

  const profByNet = useMemo(() => {
    const m: Record<string, number> = {};
    (profs || []).forEach((p) => {
      m[p.id] = p.prof ?? 0;
    });
    return m;
  }, [profs]);

  const [collapsedNets, setCollapsedNets] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(ISO_COLLAPSED_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    localStorage.setItem(ISO_COLLAPSED_KEY, JSON.stringify([...collapsedNets]));
  }, [collapsedNets]);
  const toggleCollapsedNet = useCallback((netId: string) => {
    setCollapsedNets((prev) => {
      const next = new Set(prev);
      if (next.has(netId)) next.delete(netId);
      else next.add(netId);
      return next;
    });
  }, []);

  const tramoTree = useMemo(() => {
    const tree: {
      netId: string;
      netName: string;
      netColor: string;
      niveles: { nivel: number; label: string; ramales: IsoRamal[]; bajantes: IsoBajante[] }[];
    }[] = [];
    for (const n of NETS) {
      if (!activeNets.has(n.id)) continue;
      const netData = dataByNet[n.id];
      if (!netData || (netData.ramales.length === 0 && netData.bajantes.length === 0)) continue;
      const netColor = n.col || '#888';
      const nivelMap: Record<number, { ramales: IsoRamal[]; bajantes: IsoBajante[] }> = {};
      for (const r of netData.ramales) {
        const niv = r.planNivel;
        if (!nivelMap[niv]) nivelMap[niv] = { ramales: [], bajantes: [] };
        nivelMap[niv].ramales.push(r);
      }
      for (const b of netData.bajantes) {
        // Los cross-floor ghosts son marcadores posicionales que reflejan una bajante ORIGEN de
        // otro piso, no un elemento real de este — readDrawingAll los mezcla en el mismo array de
        // bajantes (ver su comentario), así que sin este filtro aparecerían en el árbol como una
        // segunda entrada con el mismo código bajo el piso donde aterricen (p. ej. una bajante
        // real "BAN1" y su ghost entrante, también con código "BAN1", ambos listados bajo
        // el mismo piso).
        if (b._isCrossFloorGhost) continue;
        const niv = b.planNivel;
        if (!nivelMap[niv]) nivelMap[niv] = { ramales: [], bajantes: [] };
        nivelMap[niv].bajantes.push(b);
      }
      const niveles = Object.entries(nivelMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([nivel, data]) => ({
          nivel: Number(nivel),
          label:
            Number(nivel) < 0
              ? `S${Math.abs(Number(nivel))}`
              : Number(nivel) === 99
                ? 'C'
                : `P${Number(nivel)}`,
          ...data,
        }));
      tree.push({ netId: n.id, netName: n.name, netColor, niveles });
    }
    return tree;
  }, [dataByNet, activeNets]);

  const populatedNets = useMemo(() => {
    const netsWithData: string[] = [];
    for (const n of NETS) {
      const nId = typeof n.id === 'string' ? n.id : n.id || '';
      const d = readDrawingAll(plans || [], [nId]);
      const nd = d.dataByNet[nId];
      if (nd && (nd.ramales.length > 0 || nd.bajantes.length > 0)) netsWithData.push(n.id);
    }
    return netsWithData;
    // trazosPrefetchTick: misma lógica que el memo `result` de arriba — fuerza una re-ejecución
    // cuando el efecto de prefetch termina de cachear pisos que aún no tenían datos de trazos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, trazosPrefetchTick]);

  const confirmedPlanos = useMemo(
    () => (plans || []).filter((p) => p.status === 'confirmed' && p.nivel != null),
    [plans],
  );

  const getIsoCoords = useCallback(
    (px: number, py: number, nivel: number) => {
      const plan = confirmedPlanos.find(
        (p) => p.nivel !== null && String(p.nivel) === String(nivel),
      );
      const scaleM = (plan?.scale ? plan.scale / 100 : null) || readScaleMap?.[nivel] || 0.5;
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
      const ox = plan?.origen?.x_px ?? readOrigenMap?.[nivel]?.x_px ?? pageW / 2;
      const oy = plan?.origen?.y_px ?? readOrigenMap?.[nivel]?.y_px ?? pageH / 2;

      const x_m = (px - ox) * ((2.54 * scaleM) / 96);
      const y_m = (py - oy) * ((2.54 * scaleM) / 96);
      const isoScale = 150;
      return {
        x: x_m * isoScale,
        y: y_m * isoScale,
      };
    },
    [confirmedPlanos, readScaleMap, readOrigenMap],
  );

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
        setRenderTick((n) => n + 1);
        setPlanosCount(`${newImages.size}/${confirmedPlanos.length}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmedPlanos, showPlanos]);

  const fitView = useCallback(() => {
    const W = size.w,
      H = size.h;
    if (W < 10 || H < 10) return;
    const cx = W / 2,
      cy = H / 2;
    const pts: ProjPt[] = [];

    for (const [netId, netData] of Object.entries(dataByNet)) {
      if (!activeNets.has(netId)) continue;
      const prof = profByNet[netId] ?? 0;
      for (const r of netData.ramales) {
        // `prof` (Parámetros de Diseño > Materiales por red > "Profundidad de instalación
        // respecto a NPT") se guarda NEGATIVO bajo losa (p. ej. sanitaria -0.70). En esta
        // proyección un z MÁS POSITIVO se renderiza MÁS ABAJO en pantalla (ver project() en
        // geometry.ts: y2 crece con z en el rotX=-45° por defecto), así que la profundidad
        // negativa debe RESTARSE para empujar el trazo hacia abajo — sumarla (comportamiento
        // anterior) lo empujaba hacia arriba.
        const z = (nptMap[r.planNivel] || 0) - prof * 1000;
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
          const parts = parseDescargaEnId(b.descargaEnId, b.planId);
          const targetPlanId = parts[0];
          const targetId = parts[1];
          const targetRamal = netData.ramales.find(
            (rr) => rr.id === targetId && String(rr.planId) === String(targetPlanId),
          );
          if (targetRamal) {
            targetZ = nptMap[targetRamal.planNivel] || 0;
          } else {
            // "Destino" también puede ser otra bajante en un piso inferior, no solo un ramal.
            const targetBajante = netData.bajantes.find(
              (bb) => bb.id === targetId && String(bb.planId) === String(targetPlanId),
            );
            if (targetBajante) targetZ = nptMap[targetBajante.planNivel] || 0;
          }
        }
        if (baseZ === 0 && cimaZ === 0) {
          if (targetZ < currentZ) {
            cimaZ = currentZ;
            baseZ = targetZ;
          } else if (targetZ > currentZ) {
            baseZ = currentZ;
            cimaZ = targetZ;
          } else {
            baseZ = currentZ;
            cimaZ = currentZ + 1000;
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
        const plan = confirmedPlanos.find((p) => p.id === planId);
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
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.sx < minX) minX = p.sx;
      if (p.sx > maxX) maxX = p.sx;
      if (p.sy < minY) minY = p.sy;
      if (p.sy > maxY) maxY = p.sy;
    }
    const bw = maxX - minX || 1,
      bh = maxY - minY || 1;
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
  }, [
    dataByNet,
    activeNets,
    profByNet,
    nptMap,
    rotZ,
    rotX,
    scaleZ,
    zoom,
    offX,
    offY,
    size,
    showPlanos,
    confirmedPlanos,
    getIsoCoords,
    getZPix,
  ]);

  const totals = useMemo(() => {
    let ramales = 0,
      bajantes = 0,
      len = 0;
    for (const nd of Object.values(dataByNet)) {
      for (const r of nd.ramales) {
        ramales++;
        len += r.totalL || 0;
      }
      bajantes += nd.bajantes.filter((b) => !b._isCrossFloorGhost).length;
    }
    return { ramales, bajantes, len: len.toFixed(1) };
  }, [dataByNet]);

  const { cursorStyle, handleMouseDown } = useIsometriaInteraction({
    canvasRef,
    rotX,
    setRotX,
    rotZ,
    setRotZ,
    offX,
    setOffX,
    offY,
    setOffY,
    setZoom,
    setSelTramo,
  });

  useIsometriaRender({
    canvasRef,
    planImagesRef,
    dataByNet,
    activeNets,
    profByNet,
    nptMap,
    pisos,
    rotZ,
    rotX,
    scaleZ,
    zoom,
    offX,
    offY,
    size,
    selTramo,
    showPlanos,
    confirmedPlanos,
    renderTick,
    getIsoCoords,
    getZPix,
  });

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleExportPdf = useCallback(
    () =>
      exportPdf({
        canvasRef,
        size,
        activeNets,
        nets: NETS,
        proyNombre: proy?.nombre,
        rotX,
        rotZ,
        scaleZ,
        zoom,
        totals,
      }),
    [size, activeNets, proy, rotX, rotZ, scaleZ, zoom, totals],
  );

  const handleExportPng = useCallback(
    () => exportPng({ canvasRef, size, proyNombre: proy?.nombre }),
    [size, proy],
  );

  const hasAnyData = useMemo(() => {
    for (const nd of Object.values(dataByNet)) {
      if (nd.ramales.length > 0 || nd.bajantes.some((b) => !b._isCrossFloorGhost)) return true;
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
    <div
      className="fu"
      style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0 }}
    >
      {/* Toolbar */}
      <IsometriaToolbar
        nets={(populatedNets.length === 0
          ? NETS
          : populatedNets.map((nid) => NETS.find((x) => x.id === nid)!).filter(Boolean)
        ).filter((n) => redes.has(n.id))}
        activeNets={activeNets}
        toggleNet={toggleNet}
        showPlanos={showPlanos}
        setShowPlanos={setShowPlanos}
        planosCount={planosCount}
        rotX={rotX}
        setRotX={setRotX}
        rotZ={rotZ}
        setRotZ={setRotZ}
        scaleZ={scaleZ}
        setScaleZ={setScaleZ}
        zoom={zoom}
        setZoom={setZoom}
        fitView={fitView}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        exportRef={exportRef}
        exportPdf={handleExportPdf}
        exportPng={handleExportPng}
      />

      {/* Área principal */}
      <div className="fu" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar de tramos — agrupados por red y luego por piso */}
        <IsometriaSidebar
          tramoTree={tramoTree}
          collapsedNets={collapsedNets}
          toggleCollapsedNet={toggleCollapsedNet}
          selTramo={selTramo}
          setSelTramo={setSelTramo}
          totals={totals}
        />

        {/* Lienzo */}
        <div
          ref={containerRef}
          style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: cursorStyle }}
            onMouseDown={handleMouseDown}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  );
}

const IsometriaTab = React.memo(IsometriaTabBase);
export { IsometriaTab };
