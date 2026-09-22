// Caché module-level de GLBs descargados (ArrayBuffer por URL) — patrón lazyPdfjs: map +
// single-flight, ahora con eviction LRU POR BYTES. Al desmontar/remontar los visores 3D
// (cambio de sub-pestaña de isometría) la carga repite fetch+parse completos (13+ MB); con
// la caché la re-entrada no toca red y el parse es lo único que corre. Los buffers no se
// disposean con la escena — la caché sobrevive a los montajes. Tope 48 MB ≈ 1.2× el catálogo
// completo (~41 MB): con el set activo nunca se desaloja nada — techo de seguridad ante
// assets que crezcan, no fricción (decisión usuario 2026-09-22).

const MAX_BYTES_DEFAULT = 48 * 1024 * 1024;

interface Entry {
  promise: Promise<ArrayBuffer>;
  /** byteLength real; 0 mientras la descarga está pendiente (no se sabe aún). */
  size: number;
}

interface EstadoCache {
  entradas: Map<string, Entry>;
  bytes: number;
  maxBytes: number;
}

const estado: EstadoCache = { entradas: new Map(), bytes: 0, maxBytes: MAX_BYTES_DEFAULT };

/** Suelta las entradas más viejas (orden de inserción del Map = LRU) hasta bajar del tope.
 *  Nunca toca la URL que acaba de resolver (recién usada) ni pendings (size 0: su .then
 *  sumaría bytes de un buffer sin dueño — drift del contador). */
function desalojar(excepto: string): void {
  for (const [k, e] of estado.entradas) {
    if (estado.bytes <= estado.maxBytes) break;
    if (k === excepto || e.size === 0) continue;
    estado.entradas.delete(k);
    estado.bytes -= e.size;
  }
}

/** Descarga (una sola vez) el GLB de `url` y entrega su ArrayBuffer. Llamadas concurrentes
 *  comparten la misma promesa; errores no quedan cacheados (el siguiente intento reintenta). */
export function cargarGlbBuffer(url: string): Promise<ArrayBuffer> {
  const hit = estado.entradas.get(url);
  if (hit) {
    // Re-insertar = mover al final del Map: hit reciente, desaloja último.
    estado.entradas.delete(url);
    estado.entradas.set(url, hit);
    return hit.promise;
  }
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`GLB ${res.status}: ${url}`);
      return res.arrayBuffer();
    })
    .then((buf) => {
      const e = estado.entradas.get(url);
      if (e) e.size = buf.byteLength; // contar al resolverse, nunca en pending
      estado.bytes += buf.byteLength;
      desalojar(url);
      return buf;
    })
    .catch((e: unknown) => {
      const e2 = estado.entradas.get(url);
      if (e2) estado.bytes -= e2.size; // sin drift si alguien contó antes del fallo
      estado.entradas.delete(url); // un fallo transitorio no queda cacheado
      throw e;
    });
  estado.entradas.set(url, { promise, size: 0 });
  return promise;
}

/** SOLO TESTS: fija el tope de bytes (p. ej. unos pocos para ejercitar el desalojo). */
export function _setMaxBytesForTests(maxBytes: number): void {
  estado.maxBytes = maxBytes;
}

/** SOLO TESTS: vacía la caché y el contador (estado module-level entre tests). */
export function _resetForTests(): void {
  estado.entradas.clear();
  estado.bytes = 0;
  estado.maxBytes = MAX_BYTES_DEFAULT;
}
