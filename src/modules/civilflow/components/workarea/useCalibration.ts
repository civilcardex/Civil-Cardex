import { useState, useCallback, useEffect, type RefObject } from "react";

export interface ExistingCal {
  origen: { x_px: number; y_px: number } | null;
  scaleM: number | null;
  factorX: number | null;
  factorY: number | null;
  calGlobal: boolean | null;
  definedScale?: number | null;
}

interface UseCalibrationParams {
  zoom: number;
  offset: { x: number; y: number };
  overlayContRef: RefObject<HTMLDivElement | null>;
  isPdf: boolean;
  existingCal?: ExistingCal | null;
  showToast: (msg: string, type?: 'err' | 'ok' | 'warn') => void;
}

export function useCalibration({ zoom, offset, overlayContRef, isPdf, existingCal, showToast }: UseCalibrationParams) {
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

  const [preScaleM, setPreScaleM] = useState<number | null>(() => {
    if (existingCal?.definedScale) return existingCal.definedScale * (96 / (isPdf ? 72 : 96));
    if (existingCal?.scaleM) return existingCal.scaleM;
    return null;
  });

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
      const f = fx || fy;
      setScaleM(f);
    }
  }, [showToast]);

  const activarModoOrigen = () => {
    setModoOrigen(prev => !prev);
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
  }, [overlayContRef]);

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

  return {
    origen, setOrigen,
    modoOrigen, setModoOrigen,
    modoCalX, setModoCalX,
    modoCalY, setModoCalY,
    calStart, setCalStart,
    calPreview, setCalPreview,
    lenX, setLenX,
    lenY, setLenY,
    factorX, setFactorX,
    factorY, setFactorY,
    scaleM, setScaleM,
    definedScale, setDefinedScale,
    calGlobal, setCalGlobal,
    preScaleM, setPreScaleM,
    canvasToPlane, calcularPromedio,
    activarModoOrigen, activarModoCalX, activarModoCalY,
    getCursorPos,
  };
}
