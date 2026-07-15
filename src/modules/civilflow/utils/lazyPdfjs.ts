import type * as PdfjsDist from 'pdfjs-dist';

let cached: typeof PdfjsDist | null = null;
let promise: Promise<typeof PdfjsDist> | null = null;

export function getPdfjs(): Promise<typeof PdfjsDist> {
  if (cached) return Promise.resolve(cached);
  if (!promise) {
    promise = import('pdfjs-dist').then(mod => {
      mod.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      cached = mod;
      return mod;
    });
  }
  return promise;
}
