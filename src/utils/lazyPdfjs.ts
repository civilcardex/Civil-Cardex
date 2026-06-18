let cached: any = null;
let promise: Promise<any> | null = null;

export function getPdfjs(): Promise<any> {
  if (cached) return Promise.resolve(cached);
  if (!promise) {
    promise = import('pdfjs-dist').then(mod => {
      mod.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      cached = mod;
      return mod;
    });
  }
  return promise;
}
