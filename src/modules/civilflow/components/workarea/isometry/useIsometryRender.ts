import { useEffect, type RefObject } from 'react';
import { loadPlanCrop } from '../../../utils/planoCrop.ts';
import type { IsoRamal, IsoBajante } from './geometry';
import type { IsoCanvas, IsoSegment } from './useIsometryInteraction.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';

import { pintaLaminasFondo } from './painters/planSheets.ts';
import { pintaCanales } from './painters/channels.ts';
import { pintaRedes } from './painters/networks.ts';
import { pintaEjes } from './painters/axes.ts';
import type { VistaIso } from './painters/isoView.ts';

/**
 * Orquestador del pintado isométrico: prepara el lienzo (ctx, dpr, fondo) y delega cada pase a
 * un pintor de painters/, SIEMPRE en el mismo orden — el orden de pintado es regla de negocio
 * (lo último dibujado queda encima). Ej: los canales van ANTES de las redes para que la cara
 * opaca de la canaleta no tape los bajantes que caen dentro.
 *
 * Orden: 1) láminas de fondo → 2) canales → 3) redes (ramales + bajantes) → 4) ejes/rótulo.
 */
interface UseIsometriaRenderParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  planImagesRef: RefObject<Map<number, { img: HTMLCanvasElement; w: number; h: number }>>;
  dataByNet: Record<string, { ramales: IsoRamal[]; bajantes: IsoBajante[] }>;
  activeNets: Set<string>;
  profByNet: Record<string, number>;
  nptMap: Record<number, number>;
  pisos: unknown;
  rotZ: number;
  rotX: number;
  scaleZ: number;
  zoom: number;
  offX: number;
  offY: number;
  size: { w: number; h: number };
  selTramo: string | null;
  confirmedPlanos: PlanItem[];
  renderTick: number;
  getIsoCoords: (px: number, py: number, nivel: number) => { x: number; y: number };
  getZPix: (zMm: number, nivel?: number) => number;
  /** Pisos visibles (orig. usuario): null = todos. Bajantes con asociación cuyo otro extremo está en un piso visible se dibujan igual. */
  pisosVisibles?: Set<number> | null;
}

export function useIsometriaRender({
  pisosVisibles = null,
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
  confirmedPlanos,
  renderTick,
  getIsoCoords,
  getZPix,
}: UseIsometriaRenderParams) {
  useEffect(() => {
    const canvas = canvasRef.current as IsoCanvas | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = size.w,
      H = size.h;
    const dpr = devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(0, 0, W, H);
    const planCrop = loadPlanCrop();

    const vista: VistaIso = { rotZ, rotX, scaleZ, zoom, offX, offY, cx: W / 2, cy: H / 2 };

    const segments: IsoSegment[] = [];

    // ORDEN DE PINTADO (regla de negocio, NO reordenar): lo último dibujado queda encima.
    // 1) Láminas de fondo (PDF por piso, semitransparentes).
    pintaLaminasFondo({
      ctx,
      dpr,
      planImages: planImagesRef.current,
      confirmedPlanos,
      pisosVisibles,
      nptMap,
      planCrop,
      vista,
      getIsoCoords,
      getZPix,
    });
    // 2) Canales — su cara opaca taparía bajantes si se dibujaran después de su red.
    pintaCanales({
      ctx,
      dataByNet,
      activeNets,
      profByNet,
      nptMap,
      selTramo,
      vista,
      getIsoCoords,
      getZPix,
    });
    // 3) Redes: ramales + bajantes de todas las redes activas (llenar `segments` aquí).
    pintaRedes({
      ctx,
      dataByNet,
      activeNets,
      profByNet,
      nptMap,
      selTramo,
      pisosVisibles,
      confirmedPlanos,
      segments,
      vista,
      getIsoCoords,
      getZPix,
    });
    // 4) Ejes XYZ + rótulo de rotación (encima de todo, esquinas).
    pintaEjes({ ctx, H, vista });

    // Guarda los segmentos para la prueba de aciertos (hit testing)
    canvas.__isoSegments = segments;
    canvas.__isoCx = W / 2;
    canvas.__isoCy = H / 2;
  }, [
    pisosVisibles,
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
    confirmedPlanos,
    renderTick,
    getIsoCoords,
    getZPix,
  ]);
}
