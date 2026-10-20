/**
 * Stubs de DOM que jsdom no trae y que los componentes de la app usan:
 *  - ResizeObserver (useStickyThead2Offset, tablas con cabecera pegajosa)
 *  - window.matchMedia (diseño responsive)
 *  - canvas 2D: jsdom no implementa getContext('2d') -> un Proxy no-op con measureText
 *
 * Se aplican solo en los tests que declaran `// @vitest-environment jsdom`.
 */

/** Contexto 2D falso: cualquier llamada es un no-op; measureText devuelve un ancho fijo. */
function contexto2DFalso(): CanvasRenderingContext2D {
  const noop = () => {};
  const stub = {
    canvas: null as unknown as HTMLCanvasElement,
    measureText: (t: string) => ({
      width: t.length * 6,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getLineDash: () => [],
    isPointInPath: () => false,
  };
  return new Proxy(stub as unknown as CanvasRenderingContext2D, {
    get(target, prop) {
      if (prop in target) return (target as unknown as Record<string | symbol, unknown>)[prop];
      // Cualquier método del contexto que no exista en el stub: no-op.
      return noop;
    },
    set() {
      return true;
    },
  });
}

export function aplicarStubsDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g.ResizeObserver) {
    g.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
  const w = globalThis as unknown as {
    matchMedia?: unknown;
    requestAnimationFrame?: unknown;
    cancelAnimationFrame?: unknown;
  };
  if (typeof w.matchMedia !== 'function') {
    w.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (typeof w.requestAnimationFrame !== 'function') {
    w.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number;
    w.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
  const proto = (
    globalThis as unknown as { HTMLCanvasElement?: { prototype: Record<string, unknown> } }
  ).HTMLCanvasElement?.prototype;
  if (proto) {
    // Siempre se sobrescribe: jsdom SÍ tiene getContext pero sin el paquete `canvas` devuelve
    // null y avisa por consola (los componentes que dibujan se romperían).
    proto.getContext = () => contexto2DFalso();
  }
}
