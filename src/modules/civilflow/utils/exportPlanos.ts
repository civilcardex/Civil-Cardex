import PlanoEngine from '../lib/PlanoEngine/PlanoEngine.ts';
import { getPdfjs } from './lazyPdfjs';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';
import { loadFromStorage } from '../services/storageService.ts';
import type { PlanItem } from '../context/PlansContext.tsx';
import type { Piso } from '../lib/shared/projectTypes.ts';
import { pisoLbl } from '../constants';
import { sanitizeFileName } from './formatUtils.ts';
import { ExportCancelada } from './reportExportShared.ts';

// Factor de sobremuestreo para el raster de exportación. La página PDF en sí se mantiene
// dimensionada a escala-1 de pdfjs (ver w/h abajo — las coordenadas de elementos persistidas
// están ancladas a eso, siempre la escala activa la primera vez que el dibujo de un plano carga
// en una sesión fresca), pero renderizar los píxeles reales a 3x e incrustar eso en el mismo
// cuadro de página de igual tamaño le da al visor/impresor de PDF detalle real para acercar en
// vez de verse borroso visiblemente pasado el 100%. (Subido de 2x — seguía visiblemente suave a
// niveles normales de zoom del visor PDF como 150-200%.)
const RENDER_SCALE = 3;

/** Elimina del motor de exportación TODO elemento de las redes excluidas, a nivel de datos:
 *  ramales, bajantes, áreas y fantasmas entrepisos. El trazo que no existe ningún renderer lo
 *  puede pintar. Exportado puro para test directo. */
export function filtraRedesParaExport(
  eng: {
    ramales: Array<{ net: string }>;
    bajantes: Array<{ net: string }>;
    areas: Array<{ net?: string }>;
    crossFloorGhosts: Array<{ net: string }>;
    _hiddenNets: Set<string>;
  },
  ocultarNets?: Set<string>,
): void {
  if (!ocultarNets || ocultarNets.size === 0) return;
  eng.ramales = eng.ramales.filter((r) => !ocultarNets.has(r.net));
  eng.bajantes = eng.bajantes.filter((b) => !ocultarNets.has(b.net));
  eng.crossFloorGhosts = eng.crossFloorGhosts.filter((g) => !ocultarNets.has(g.net));
  eng.areas = eng.areas.filter((a) => !a.net || !ocultarNets.has(a.net));
  eng._hiddenNets = new Set(ocultarNets);
}

// Render headless de un plano: rasterizar su página PDF base (pdfjs) más cada elemento dibujado
// sobre ella (PlanoEngine, alimentado con el mismo JSON de trazos persistido que carga el editor
// en pantalla), compuesto en un solo canvas plano. Corre una instancia de PlanoEngine
// desacoplada (nunca montada/visible) — es la misma clase que usa el visor interactivo, solo
// apuntada a un canvas fuera de pantalla para que esto funcione sin que el visor esté abierto.
// El finally libera AMBOS recursos: el engine y el PDFDocumentProxy (sin destroy() el worker
// de pdf.js queda retenido por cada piso exportado — 10 pisos = 10 workers hasta que el
// GC decida).
async function renderPlanoComposite(
  plan: PlanItem,
  pisos: Piso[],
  ocultarNets?: Set<string>,
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  const pdfjsLib = await getPdfjs();
  const buf = await plan.file.arrayBuffer();
  // El destroy() de pdfjs 6 vive en el LOADING TASK (libera documento + worker), no en el proxy.
  const task = pdfjsLib.getDocument({ data: buf });
  const pdf = await task.promise;
  let eng: PlanoEngine | null = null;
  try {
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
    eng = new PlanoEngine(detachedCw, null, drawCanvas);
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
    // Selección de redes del usuario (informes → "Redes a descargar"): filtro a nivel de
    // DATOS (el trazo que no existe ningún renderer lo puede pintar) — el chequeo repartido
    // en _hiddenNets dejaba pasar capas (el PDF imprimía todas las redes igual). La línea
    // _hiddenNets queda como defensa extra para las capas que ya la respetan.
    filtraRedesParaExport(eng, ocultarNets);
    if (import.meta.env.DEV) {
      // Trazas de diagnóstico del filtro (caso "el PDF imprime todas las redes"): el set
      // recibido + lo que quedó vivo en el motor de export por red.
      const porRed: Record<string, number> = {};
      for (const r of eng.ramales) porRed[r.net] = (porRed[r.net] || 0) + 1;
      // eslint-disable-next-line no-console -- diagnóstico del export (solo DEV)
      console.log(
        `[CF-EXPORT] "${plan.name}" ocultar=[${[...(ocultarNets ?? [])].join(',')}] ramalesPorRed=`,
        porRed,
      );
    }
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
    eng?.destroy();
    await task.destroy();
  }
}

/** Descarga TODOS los planos confirmados en un solo PDF (lámina + trazos rasterizados por piso, del nivel mayor al menor), con cancelación entre láminas. */
export async function downloadPlanosPdf(
  plans: PlanItem[],
  pisos: Piso[],
  ocultarNets?: Set<string>,
  shouldCancel?: () => boolean,
): Promise<void> {
  const confirmed = plans
    .filter((p) => p.status === 'confirmed')
    .toSorted((a, b) => (b.nivel ?? 0) - (a.nivel ?? 0));
  if (confirmed.length === 0) throw new Error('No hay planos confirmados para descargar.');

  const { jsPDF } = await import('jspdf');
  let doc: InstanceType<typeof jsPDF> | null = null;

  for (const plan of confirmed) {
    // Punto de cancelación (botón Cancelar, orig. usuario): entre láminas. El yield deja
    // procesar el click antes del raster (la lámina en curso termina, el resto no empieza).
    if (shouldCancel?.()) throw new ExportCancelada();
    await new Promise((r) => setTimeout(r, 0));
    const composite = await renderPlanoComposite(plan, pisos, ocultarNets);
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
  doc.save(`${sanitizeFileName('Planos de red')}.pdf`);
}
