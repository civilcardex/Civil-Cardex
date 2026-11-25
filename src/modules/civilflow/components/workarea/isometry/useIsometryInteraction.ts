import { useRef, useState, useCallback, useEffect, type RefObject } from 'react';

export interface IsoSegment {
  sx1: number;
  sy1: number;
  sx2: number;
  sy2: number;
  z: number;
  id: string;
  label: string;
  isBaj: boolean;
  netId: string;
}
export type IsoCanvas = HTMLCanvasElement & {
  __isoSegments?: IsoSegment[];
  __isoCx?: number;
  __isoCy?: number;
};

interface UseIsometriaInteractionParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rotX: number;
  setRotX: (v: number) => void;
  rotZ: number;
  setRotZ: (v: number) => void;
  offX: number;
  setOffX: (v: number | ((prev: number) => number)) => void;
  offY: number;
  setOffY: (v: number | ((prev: number) => number)) => void;
  setZoom: (v: number | ((prev: number) => number)) => void;
  zoom: number;
  setSelTramo: (v: string | null | ((prev: string | null) => string | null)) => void;
}

type Punto = { x: number; y: number };
type Camara = { zoom: number; offX: number; offY: number };
type Vista = Camara & { rotX: number; rotZ: number };

/** Describe el centro y la apertura del gesto. Ej.: dedos en x=20 y x=60 → centro x=40. */
export function marcoPunteros(puntos: Iterable<Punto>) {
  const [a, b] = puntos;
  if (!a) return null;
  return b
    ? {
        centro: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distancia: Math.hypot(a.x - b.x, a.y - b.y),
      }
    : { centro: a, distancia: 0 };
}

/** Mantiene el punto bajo los dedos al ampliar y desplazar. Ej.: pellizcar fuera del centro. */
export function zoomAnclado(v: Camara, factor: number, ancla: Punto, delta: Punto): Camara {
  // Mismo rango que el deslizador de IsometriaToolbar (5 %–200 %): gesto, botones y
  // control accesible deben coincidir para que mover el slider no dé un salto.
  const zoom = Math.max(0.05, Math.min(2, v.zoom * factor));
  const f = zoom / v.zoom;
  return {
    zoom,
    offX: ancla.x + delta.x - (ancla.x - v.offX) * f,
    offY: ancla.y + delta.y - (ancla.y - v.offY) * f,
  };
}

export function useIsometriaInteraction({
  canvasRef,
  rotX,
  setRotX,
  rotZ,
  setRotZ,
  offX,
  setOffX,
  offY,
  setOffY,
  zoom,
  setZoom,
  setSelTramo,
}: UseIsometriaInteractionParams) {
  const puntos = useRef(new Map<number, Punto>());
  const base = useRef<{ vista: Vista; centro: Punto; distancia: number; pan: boolean } | null>(
    null,
  );
  const vistaPendiente = useRef<Vista | null>(null);
  // La rueda puede disparar varios eventos antes de que React vuelva a renderizar: la
  // cámara más reciente vive en una ref y se actualiza EN EL MISMO evento (no en el efecto).
  const camaraRueda = useRef({ zoom, offX, offY });
  useEffect(() => {
    camaraRueda.current = { zoom, offX, offY };
  }, [zoom, offX, offY]);
  const movido = useRef(false);
  const raf = useRef<number | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const getTramoAt = useCallback(
    (clientX: number, clientY: number, hit: number) => {
      const canvas = canvasRef.current as IsoCanvas | null;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left,
        my = clientY - rect.top;
      const segs: IsoSegment[] = canvas.__isoSegments || [];
      let best: string | null = null;
      let bestDist = Infinity;
      for (const s of segs) {
        const dx = s.sx2 - s.sx1,
          dy = s.sy2 - s.sy1;
        const len2 = dx * dx + dy * dy;
        let t = ((mx - s.sx1) * dx + (my - s.sy1) * dy) / (len2 || 1);
        t = Math.max(0, Math.min(1, t));
        const px = s.sx1 + t * dx,
          py = s.sy1 + t * dy;
        const d = Math.hypot(mx - px, my - py);
        if (d < hit && d < bestDist) {
          bestDist = d;
          best = s.id;
        }
      }
      return best;
    },
    [canvasRef],
  );

  const aplicar = (vista: Vista) => {
    setRotX(vista.rotX);
    setRotZ(vista.rotZ);
    setOffX(vista.offX);
    setOffY(vista.offY);
    setZoom(vista.zoom);
  };

  const anclar = (vista: Vista, pan: boolean) => {
    const marco = marcoPunteros(puntos.current.values());
    base.current = marco ? { ...marco, vista, pan } : null;
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if ((e.button !== 0 && e.button !== 1) || puntos.current.size >= 2) return;
    if (puntos.current.size && e.pointerType !== 'touch') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!puntos.current.size) {
      movido.current = false;
      vistaPendiente.current = null;
    } else {
      movido.current = true;
      setArrastrando(true);
    }
    puntos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    anclar(
      vistaPendiente.current ?? { rotX, rotZ, offX, offY, zoom },
      e.shiftKey || e.button === 1,
    );
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const inicio = base.current;
    if (!inicio || !puntos.current.has(e.pointerId)) return;
    puntos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const marco = marcoPunteros(puntos.current.values());
    if (!marco) return;
    const dx = marco.centro.x - inicio.centro.x;
    const dy = marco.centro.y - inicio.centro.y;
    if (!movido.current) {
      if (Math.hypot(dx, dy) < (e.pointerType === 'touch' ? 8 : 4)) return;
      movido.current = true;
      setArrastrando(true);
    }
    const v = inicio.vista;
    if (puntos.current.size === 2) {
      const rect = e.currentTarget.getBoundingClientRect();
      const ancla = {
        x: inicio.centro.x - rect.left - rect.width / 2,
        y: inicio.centro.y - rect.top - rect.height / 2,
      };
      vistaPendiente.current = {
        ...zoomAnclado(v, marco.distancia / Math.max(inicio.distancia, 1), ancla, { x: dx, y: dy }),
        rotX: v.rotX,
        rotZ: v.rotZ,
      };
    } else {
      vistaPendiente.current = inicio.pan
        ? { ...v, offX: v.offX + dx, offY: v.offY + dy }
        : {
            ...v,
            rotX: Math.max(-90, Math.min(90, v.rotX + dy * 0.5)),
            rotZ: (((v.rotZ + dx * 0.5) % 360) + 360) % 360,
          };
    }
    if (raf.current === null) {
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        if (vistaPendiente.current) aplicar(vistaPendiente.current);
      });
    }
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>, seleccionar: boolean) => {
    if (!puntos.current.delete(e.pointerId)) return;
    if (puntos.current.size) {
      if (base.current) anclar(vistaPendiente.current ?? base.current.vista, false);
      return;
    }
    base.current = null;
    setArrastrando(false);
    if (seleccionar && !movido.current && e.button === 0 && !e.shiftKey) {
      const hit = getTramoAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 14 : 6);
      setSelTramo((prev) => (prev === hit ? null : hit));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (puntos.current.size) return;
      const rect = canvas.getBoundingClientRect();
      const base = camaraRueda.current;
      const next = zoomAnclado(
        base,
        e.deltaY > 0 ? 0.9 : 1.1,
        { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 },
        { x: 0, y: 0 },
      );
      camaraRueda.current = next;
      setZoom(next.zoom);
      setOffX(next.offX);
      setOffY(next.offY);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasRef, zoom, offX, offY, setZoom, setOffX, setOffY]);

  return {
    cursorStyle: arrastrando ? 'grabbing' : 'grab',
    pointerHandlers: {
      onPointerDown: down,
      onPointerMove: move,
      onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => end(e, true),
      onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => end(e, false),
      onLostPointerCapture: (e: React.PointerEvent<HTMLCanvasElement>) => end(e, false),
    },
  };
}
