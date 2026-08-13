import PlanoEngine from '../lib/PlanoEngine/PlanoEngine';
import { getPdfjs } from './lazyPdfjs';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { PlanItem } from '../context/PlansContext';
import type { Piso } from '../lib/shared/projectTypes';
import { pisoLbl } from '../constants';
import { sanitizeFileName } from './formatUtils';

function fileBase(name: string): string {
  return sanitizeFileName(name);
}

// Factor de sobremuestreo para el raster de exportación. La página PDF en sí se mantiene
// dimensionada a escala-1 de pdfjs (ver w/h abajo — las coordenadas de elementos persistidas
// están ancladas a eso, siempre la escala activa la primera vez que el dibujo de un plano carga
// en una sesión fresca), pero renderizar los píxeles reales a 3x e incrustar eso en el mismo
// cuadro de página de igual tamaño le da al visor/impresor de PDF detalle real para acercar en
// vez de verse borroso visiblemente pasado el 100%. (Subido de 2x — seguía visiblemente suave a
// niveles normales de zoom del visor PDF como 150-200%.)
const RENDER_SCALE = 3;

// Render headless de un plano: rasterizar su página PDF base (pdfjs) más cada elemento dibujado
// sobre ella (PlanoEngine, alimentado con el mismo JSON de trazos persistido que carga el editor
// en pantalla), compuesto en un solo canvas plano. Corre una instancia de PlanoEngine
// desacoplada (nunca montada/visible) — es la misma clase que usa el visor interactivo, solo
// apuntada a un canvas fuera de pantalla para que esto funcione sin que el visor esté abierto.
async function renderPlanoComposite(
  plan: PlanItem,
  pisos: Piso[],
): Promise<{ dataUrl: string; w: number; h: number } | null> {
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
    // Conducir el propio sobremuestreo de PlanoEngine vía dpr (coincide sw/sh exactamente, no
    // solo RENDER_SCALE, así que el canvas de overlay dibujado queda alineado píxel a píxel con
    // el raster de pdfjs de arriba aun después de que ambos fueran redondeados hacia abajo
    // independientemente) — todo lo demás sigue dibujando en coordenadas lógicas w/h.
    eng.dpr = sw / w;
    eng.setPageSize(w, h);
    eng.resizeCanvas(w, h);

    // nivelActual default a null en un engine fresco — renderBajantes.ts (bajantes, montantes,
    // contadores, calentadores) compara el piso propio de cada elemento contra él para decidir si
    // es un "fantasma" de otro piso, así que dejarlo sin fijar hacía que cada uno de esos
    // elementos se renderizara como un fantasma/placeholder adyacente a fantasma en vez de su
    // símbolo real. Fijarlo igual que syncEngine de PdfViewer.tsx hace para el visor en vivo.
    const floorObj = pisos.find((p) => String(p.n) === String(plan.nivel));
    eng.nivelActual = floorObj
      ? { ...floorObj, label: pisoLbl(floorObj.n), npt: Number(floorObj.npt) }
      : null;
    eng.nptLevels = pisos.map((p) => ({ label: pisoLbl(p.n), npt: Number(p.npt) }));

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
    // Colocado en el PDF en el w/h LÓGICO (mismo tamaño de página física que antes) — solo los
    // píxeles que respaldan ese cuadro se volvieron más densos, que es lo que realmente lo
    // nitidez.
    return { dataUrl: out.toDataURL('image/png'), w, h };
  } finally {
    eng.destroy();
  }
}

export async function downloadPlanosPdf(plans: PlanItem[], pisos: Piso[]): Promise<void> {
  const confirmed = plans
    .filter((p) => p.status === 'confirmed')
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
