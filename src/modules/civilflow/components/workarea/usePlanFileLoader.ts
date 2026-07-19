import { useState, useRef, useEffect, type RefObject } from "react";
import { getPdfjs } from "../../utils/lazyPdfjs";
import { devError } from "../../../../utils/devError";

interface UsePlanFileLoaderParams {
  planFile: File;
  pageWRef: RefObject<number>;
  pageHRef: RefObject<number>;
  onLoaded: () => void;
}

export function usePlanFileLoader({ planFile, pageWRef, pageHRef, onLoaded }: UsePlanFileLoaderParams) {
  const isPdf = planFile.type === 'application/pdf' || planFile.name.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpe?g|webp|bmp|gif)$/i.test(planFile.name);

  const [loading, setLoading] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);

  const pdfCanvRef = useRef<HTMLCanvasElement | null>(null);

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
        const canv = pdfCanvRef.current;
        if (!canv) return;
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
        requestAnimationFrame(() => onLoaded());
      };
      img.onerror = () => { setLoading(false); URL.revokeObjectURL(url); };
      img.src = url;
      return;
    }

    if (isPdf) {
      let cancelled = false;
      (async () => {
        try {
          const pdfjsLib = await getPdfjs();
          const data = await planFile.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data }).promise;
          if (cancelled) return;
          const page = await pdf.getPage(1);
          const vp = page.getViewport({ scale: 1 });
          const canv = pdfCanvRef.current;
          if (!canv) return;
          canv.width = Math.floor(vp.width * dpr);
          canv.height = Math.floor(vp.height * dpr);
          canv.style.width = vp.width + 'px';
          canv.style.height = vp.height + 'px';
          const ctx = canv.getContext('2d');
          if (!ctx) return;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = false;
          await page.render({ canvas: canv as HTMLCanvasElement, viewport: vp }).promise;
          pageWRef.current = vp.width;
          pageHRef.current = vp.height;
          setImgLoaded(true);
          setLoading(false);
          requestAnimationFrame(() => onLoaded());
        } catch (e) {
          if (!cancelled) { devError('Error loading PDF:', e); setLoading(false); }
        }
      })();
      return () => { cancelled = true; };
    }
    // Non-PDF fallback path of an async file-loading effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(false);
    // Deliberately keyed off planFile only — isPdf/isImage are derived from it, and
    // onLoaded/pageWRef/pageHRef are stable refs/callbacks, not reactive triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFile]);

  return { isPdf, isImage, loading, imgLoaded, pdfCanvRef };
}
