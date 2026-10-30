// Caché de PDFs ya parseados, por archivo: re-parsear el MISMO File en cada cambio de piso
// era el retraso entero del switch (ped. usuario: "todo cargado antes de que se abra
// totalmente el visor y cambio de piso sin ningún spinner"). Los proxy de pdf.js son
// reutilizables para getPage/render. El precalentamiento parsea el resto de los planos
// INMEDIATAMENTE tras el primer render, y el estado queda expuesto por suscripción para que
// el overlay de primera entrada del visor no se levante hasta que TODO esté en memoria.
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPdfjs } from '../../utils/lazyPdfjs.ts';

const cache = new Map<File, PDFDocumentProxy>();
let calentado = false;
// Arranca en TRUE (nada pendiente): solo un calentamiento real (≥2 pisos) la baja a false.
let calentamientoHecho = true;
// Primer piso del visor totalmente cargado (pre-paint + raster + arbitración local-vs-BD +
// corrección de escala): el overlay de primera entrada no se levanta hasta que el piso que
// se abre por defecto quedó ASENTADO — sin esto se veía «elementos desplazados → salto →
// acomodados» justo al entrar (orig. usuario 2026-10-22).
let primerPisoListo = false;
const oyentes = new Set<() => void>();

/** Se entera de los cambios del calentamiento/primer piso (el overlay del visor escucha). Ej: suscribirse → callback al aterrizar el PDF del piso 2. */
export function suscribirCalentamiento(cb: () => void): () => void {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/** ¿Ya se puede levantar el overlay de primera entrada? Exige calentamiento completo Y primer piso asentado. */
export function calentamientoListo(): boolean {
  return calentamientoHecho && primerPisoListo;
}

function avisar(): void {
  oyentes.forEach((l) => l());
}

/** El loader lo llama cuando el primer piso terminó de asentarse (idempotente). */
export function marcarPrimerPisoCargado(): void {
  if (primerPisoListo) return;
  primerPisoListo = true;
  avisar();
}

function marcarCalentamiento(hecho: boolean): void {
  calentamientoHecho = hecho;
  avisar();
}

/** Proxy pdf.js del archivo si ya está parseado; undefined = parsear en vivo. */
export function pdfDeCache(file: File): PDFDocumentProxy | undefined {
  return cache.get(file);
}

/** Guarda el proxy parseado (reutilizable para getPage/render en cambios de piso). */
export function pdfACache(file: File, pdf: PDFDocumentProxy): void {
  cache.set(file, pdf);
}

/** Parsea los PDFs de todos los planos (en cuanto termina el primer render) — una sola vez por sesión. */
export function calentarPdfs(files: Array<{ file: File }>): void {
  if (calentado) return;
  calentado = true;
  if (files.length < 2) {
    // Sin pisos que calentar el flag de primer piso no puede bloquear el velo (un solo
    // piso marca su raster en renderPage; cero planos → nada se moverá jamás).
    marcarPrimerPisoCargado();
    return;
  }
  marcarCalentamiento(false);
  // Tope de seguridad: si algún PDF se atasca, el overlay no puede quedarse para siempre.
  const tope = window.setTimeout(() => marcarCalentamiento(true), 20000);
  void (async () => {
    try {
      const pdfjsLib = await getPdfjs();
      for (const f of files) {
        if (cache.has(f.file)) continue;
        try {
          const buf = await f.file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          cache.set(f.file, pdf);
        } catch {
          /* best-effort: el switch de ese piso parseará en vivo como siempre */
        }
      }
    } finally {
      window.clearTimeout(tope);
      marcarCalentamiento(true);
    }
  })();
}
