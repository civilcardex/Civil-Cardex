import PlanoEngine from '../lib/PlanoEngine/PlanoEngine';
import { getPdfjs } from './lazyPdfjs';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { PlanItem } from '../context/PlansContext';
import type { Piso } from '../components/useWorkAreaState';
import { pisoLbl } from '../constants';

function fileBase(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
}

// Supersampling factor for the export raster. The PDF page itself stays sized at pdfjs scale-1
// (see w/h below — persisted element coordinates are anchored to that, always the scale active
// the first time a plan's drawing loads in a fresh session), but rendering the actual pixels at
// 3x and embedding that into the same-size page box gives the PDF viewer/printer real detail to
// zoom into instead of visibly blurring past 100%. (Bumped from 2x — still visibly soft at normal
// PDF-viewer zoom levels like 150-200%.)
const RENDER_SCALE = 3;

// Headless render of one plan: rasterize its base PDF page (pdfjs) plus every element drawn on
// it (PlanoEngine, fed with the same persisted trazos JSON the on-screen editor loads), composited
// into a single flat canvas. Runs a detached PlanoEngine instance (never mounted/visible) — it's
// the same class the interactive visor uses, just pointed at an offscreen canvas so this works
// without the visor being open.
async function renderPlanoComposite(plan: PlanItem, pisos: Piso[]): Promise<{ dataUrl: string; w: number; h: number } | null> {
  const pdfjsLib = await getPdfjs();
  const buf = await plan.file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const w = Math.floor(viewport.width);
  const h = Math.floor(viewport.height);
  const scaledViewport = page.getViewport({ scale: RENDER_SCALE });
  const sw = Math.floor(scaledViewport.width);
  const sh = Math.floor(scaledViewport.height);

  const pdfCanvas = document.createElement('canvas');
  pdfCanvas.width = sw;
  pdfCanvas.height = sh;
  await page.render({ canvas: pdfCanvas, viewport: scaledViewport }).promise;

  const drawCanvas = document.createElement('canvas');
  drawCanvas.width = sw;
  drawCanvas.height = sh;

  const detachedCw = document.createElement('div');
  const eng = new PlanoEngine(detachedCw, null, drawCanvas);
  try {
    // Drive PlanoEngine's own supersampling via dpr (matches sw/sh exactly, not just RENDER_SCALE,
    // so the drawn-overlay canvas lines up pixel-for-pixel with the pdfjs raster above even after
    // both got independently floored) — everything else keeps drawing in logical w/h coordinates.
    eng.dpr = sw / w;
    eng.setPageSize(w, h);
    eng.resizeCanvas(w, h);

    // nivelActual defaults to null on a fresh engine — renderBajantes.ts (bajantes, montantes,
    // contadores, calentadores) compares every element's own floor against it to decide whether
    // it's a "ghost" from another floor, so leaving it unset made every single one of those
    // elements render as a ghost/ghost-adjacent placeholder instead of its real symbol. Set it the
    // same way PdfViewer.tsx's syncEngine does for the live visor.
    const floorObj = pisos.find(p => String(p.n) === String(plan.nivel));
    eng.nivelActual = floorObj ? { ...floorObj, label: pisoLbl(floorObj.n), npt: Number(floorObj.npt) } : null;
    eng.nptLevels = pisos.map(p => ({ label: pisoLbl(p.n), npt: Number(p.npt) }));

    const raw = loadFromStorage<unknown>(TRAZOS_PREFIX + plan.id, null);
    if (raw) eng.loadWork(typeof raw === 'string' ? raw : JSON.stringify(raw));
    eng.zoom = 1;
    eng.offX = 0;
    eng.offY = 0;
    eng.render();

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(pdfCanvas, 0, 0);
    ctx.drawImage(drawCanvas, 0, 0);
    // Placed into the PDF at the LOGICAL w/h (same physical page size as before) — only the pixel
    // data backing that box got denser, which is what actually sharpens it.
    return { dataUrl: out.toDataURL('image/png'), w, h };
  } finally {
    eng.destroy();
  }
}

export async function downloadPlanosPdf(plans: PlanItem[], pisos: Piso[]): Promise<void> {
  const confirmed = plans
    .filter(p => p.status === 'confirmed')
    .toSorted((a, b) => (b.nivel ?? 0) - (a.nivel ?? 0));
  if (confirmed.length === 0) throw new Error('No hay planos confirmados para descargar.');

  const { jsPDF } = await import('jspdf');
  let doc: InstanceType<typeof jsPDF> | null = null;

  for (const plan of confirmed) {
    const composite = await renderPlanoComposite(plan, pisos);
    if (!composite) continue;
    const { dataUrl, w, h } = composite;
    const orientation = w >= h ? 'landscape' : 'portrait';
    if (!doc) {
      doc = new jsPDF({ orientation, unit: 'px', format: [w, h] });
    } else {
      doc.addPage([w, h], orientation);
    }
    doc.addImage(dataUrl, 'PNG', 0, 0, w, h);
  }

  if (!doc) throw new Error('No se pudo generar ningún plano.');
  doc.save(`${fileBase('Planos de red')}.pdf`);
}
