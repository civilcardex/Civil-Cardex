import type * as PdfjsDist from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let cached: typeof PdfjsDist | null = null;
let promise: Promise<typeof PdfjsDist> | null = null;

export function getPdfjs(): Promise<typeof PdfjsDist> {
  if (cached) return Promise.resolve(cached);
  if (!promise) {
    promise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = workerUrl;
      cached = mod;
      return mod;
    });
  }
  return promise;
}
