import { expect, it, vi } from 'vitest';
import { crearCachePdf } from './pdfCache.ts';
import type { PDFDocumentProxy } from 'pdfjs-dist';

it('expulsa los PDF menos recientes, conserva el activo y libera los restantes', () => {
  const cache = crearCachePdf(2, 4);
  const a = new File(['aa'], 'a.pdf');
  const b = new File(['bb'], 'b.pdf');
  const c = new File(['ccc'], 'c.pdf');
  const doc = () =>
    ({
      loadingTask: { destroy: vi.fn().mockResolvedValue(undefined) },
    }) as unknown as PDFDocumentProxy;
  const [aDoc, bDoc, cDoc] = [doc(), doc(), doc()];
  cache.put(a, aDoc);
  cache.put(b, bDoc);
  expect(cache.get(a)).toBe(aDoc);
  cache.put(c, cDoc);
  expect(cache.get(b)).toBeUndefined();
  expect(bDoc.loadingTask.destroy).toHaveBeenCalledOnce();
  expect(aDoc.loadingTask.destroy).toHaveBeenCalledOnce();
  expect(cache.get(c)).toBe(cDoc);
  cache.clear();
  expect(cDoc.loadingTask.destroy).toHaveBeenCalledOnce();
});
