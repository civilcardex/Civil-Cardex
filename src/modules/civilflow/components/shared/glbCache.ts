// Caché module-level de GLBs descargados (ArrayBuffer por URL) — patrón lazyPdfjs: map +
// single-flight. Al desmontar/remontar los visores 3D (cambio de sub-pestaña de isometría)
// la carga repite fetch+parse completos (13+ MB); con la caché la re-entrada no toca red y
// el parse es lo único que corre (instantáneo frente a la descarga). Los bytes JS no se
// disposean con la escena — la caché sobrevive a todos los montajes de la sesión.
// SIN EVICTION (ponytail, deliberado): catálogo fijo de 25 URLs (~32 MB techo; ~41 MB si epc
// se suma). Alternar sub-pestañas es el caso de uso y siempre re-visita el mismo set — una
// política LRU no ahorraría nada real hoy.

const cache = new Map<string, Promise<ArrayBuffer>>();

/** Descarga (una sola vez) el GLB de `url` y entrega su ArrayBuffer. Llamadas concurrentes
 *  comparten la misma promesa; errores no quedan cacheados (el siguiente intento reintenta). */
export function cargarGlbBuffer(url: string): Promise<ArrayBuffer> {
  const hit = cache.get(url);
  if (hit) return hit;
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`GLB ${res.status}: ${url}`);
      return res.arrayBuffer();
    })
    .catch((e) => {
      cache.delete(url); // un fallo transitorio no queda cacheado
      throw e;
    });
  cache.set(url, promise);
  return promise;
}
