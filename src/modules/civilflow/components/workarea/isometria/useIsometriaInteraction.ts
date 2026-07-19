import { useRef, useState, useCallback, useEffect, type RefObject } from "react";

export interface IsoSegment { sx1: number; sy1: number; sx2: number; sy2: number; z: number; id: string; label: string; isBaj: boolean; netId: string }
export type IsoCanvas = HTMLCanvasElement & { __isoSegments?: IsoSegment[]; __isoCx?: number; __isoCy?: number };

interface UseIsometriaInteractionParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rotX: number; setRotX: (v: number) => void;
  rotZ: number; setRotZ: (v: number) => void;
  offX: number; setOffX: (v: number | ((prev: number) => number)) => void;
  offY: number; setOffY: (v: number | ((prev: number) => number)) => void;
  setZoom: (v: number | ((prev: number) => number)) => void;
  setSelTramo: (v: string | null | ((prev: string | null) => string | null)) => void;
}

export function useIsometriaInteraction({
  canvasRef, rotX, setRotX, rotZ, setRotZ, offX, setOffX, offY, setOffY, setZoom, setSelTramo,
}: UseIsometriaInteractionParams) {
  const dragRef = useRef<{ mode: 'rot' | 'pan'; sx: number; sy: number; rx0: number; rz0: number; ox0: number; oy0: number } | null>(null);
  const [cursorStyle, setCursorStyle] = useState('grab');

  // Deliberately runs every render (dragRef is a ref, not a reactive dependency) — setState
  // bails out when the value is unchanged, so this isn't an infinite loop, just a plain sync.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCursorStyle(dragRef.current ? 'grabbing' : 'grab'); });

  const getTramoAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current as IsoCanvas | null;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left, my = clientY - rect.top;
    const segs: IsoSegment[] = canvas.__isoSegments || [];
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
  }, [canvasRef]);

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
  }, [rotX, rotZ, offX, offY, getTramoAt, setSelTramo]);

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
  }, [setRotX, setRotZ, setOffX, setOffY]);

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
  }, [canvasRef, setZoom, setOffX, setOffY]);

  return { cursorStyle, handleMouseDown, getTramoAt };
}
