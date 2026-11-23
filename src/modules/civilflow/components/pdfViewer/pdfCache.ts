import type { PDFDocumentProxy } from 'pdfjs-dist';

export function liberarPdf(pdf: PDFDocumentProxy): void {
  void pdf.loadingTask.destroy().catch(() => {
    /* la tarea ya podía estar cancelada */
  });
}

/** Caché de planos visitados: tres documentos o 48 MiB de archivos, sin expulsar el plano activo. */
export function crearCachePdf(maxDocs = 3, maxBytes = 48 * 1024 * 1024) {
  const cache = new Map<File, PDFDocumentProxy>();
  return {
    get(file: File) {
      const pdf = cache.get(file);
      if (pdf) {
        cache.delete(file);
        cache.set(file, pdf);
      }
      return pdf;
    },
    put(file: File, pdf: PDFDocumentProxy) {
      const anterior = cache.get(file);
      if (anterior && anterior !== pdf) liberarPdf(anterior);
      cache.delete(file);
      cache.set(file, pdf);
      let bytes = [...cache.keys()].reduce((total, key) => total + key.size, 0);
      for (const [key, doc] of cache) {
        if (cache.size <= maxDocs && bytes <= maxBytes) break;
        if (key === file) continue;
        cache.delete(key);
        bytes -= key.size;
        liberarPdf(doc);
      }
    },
    clear() {
      for (const doc of cache.values()) liberarPdf(doc);
      cache.clear();
    },
  };
}
