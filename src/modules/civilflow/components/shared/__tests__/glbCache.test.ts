import { describe, it, expect, beforeEach, vi } from 'vitest';

// LRU por bytes del cache GLB (decisión usuario 2026-09-22: tope 48 MB ≈ catálogo completo —
// con el set activo nunca desaloja; los tests ejercitan el desalojo con topes diminutos).

interface FakeRes {
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

interface Deferred {
  resolve: (r: FakeRes) => void;
  reject: (e: unknown) => void;
}

const pendientes = new Map<string, Deferred[]>();
const fetches: Record<string, number> = {};

function mockFetchConDeferred(): void {
  vi.stubGlobal('fetch', (url: string | URL | Request) => {
    const key = String(url);
    fetches[key] = (fetches[key] ?? 0) + 1;
    return new Promise<FakeRes>((resolve, reject) => {
      const cola = pendientes.get(key) ?? [];
      cola.push({ resolve, reject });
      pendientes.set(key, cola);
    });
  });
}

function responder(url: string, bytes: number): void {
  const d = pendientes.get(url)?.shift();
  if (!d) throw new Error(`sin pending para ${url}`);
  d.resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(bytes) });
}

const veces = (url: string): number => fetches[url] ?? 0;

async function mod(): Promise<typeof import('../glbCache')> {
  return import('../glbCache');
}

beforeEach(async () => {
  vi.resetModules();
  vi.unstubAllGlobals();
  for (const k of Object.keys(fetches)) delete fetches[k];
  pendientes.clear();
  mockFetchConDeferred();
  (await mod())._resetForTests();
});

describe('glbCache LRU', () => {
  it('desaloja la entrada más vieja al superar el tope', async () => {
    const m = await mod();
    m._setMaxBytesForTests(5);
    await responderTrasCargar('a.glb', 2);
    await responderTrasCargar('b.glb', 2);
    // a(2)+b(2)=4 ≤ 5, ambas vivas.
    await responderTrasCargar('c.glb', 2);
    // 6 > 5 → se desaloja la más vieja (a). Re-pedir a = fetch nuevo.
    const antes = veces('a.glb');
    await responderTrasCargar('a.glb', 2);
    expect(veces('a.glb')).toBe(antes + 1);
  });

  it('el hit re-inserta como MRU: el reciente sobrevive al desalojo', async () => {
    const m = await mod();
    m._setMaxBytesForTests(5);
    await responderTrasCargar('a.glb', 2);
    await responderTrasCargar('b.glb', 2);
    await m.cargarGlbBuffer('a.glb'); // hit → a pasa a MRU, b es la más vieja
    await responderTrasCargar('c.glb', 2); // 6 > 5 → evicta b (no a)
    // a sobrevivió: pedirla NO registra fetch (responder lanzaría "sin pending").
    const pa = m.cargarGlbBuffer('a.glb');
    expect(() => responder('a.glb', 2)).toThrow('sin pending');
    await pa;
    // b sí fue evictada: re-fetch.
    const antes = veces('b.glb');
    await responderTrasCargar('b.glb', 2);
    expect(veces('b.glb')).toBe(antes + 1);
  });

  it('single-flight: concurrentes comparten promesa (un solo fetch)', async () => {
    const m = await mod();
    const pa = m.cargarGlbBuffer('s.glb');
    const pb = m.cargarGlbBuffer('s.glb');
    responder('s.glb', 10);
    const [ba, bb] = await Promise.all([pa, pb]);
    expect(ba).toBe(bb);
    expect(veces('s.glb')).toBe(1);
  });

  it('error no queda cacheado: reintenta y sin drift de bytes', async () => {
    const m = await mod();
    m._setMaxBytesForTests(100);
    const p1 = m.cargarGlbBuffer('e.glb');
    // shift: consumir el deferred (igual que haría responder) antes de rechazarlo.
    pendientes.get('e.glb')?.shift()?.reject(new Error('boom'));
    await expect(p1).rejects.toThrow('boom');
    await responderTrasCargar('e.glb', 4);
    expect(veces('e.glb')).toBe(2);
    // 4 + 97 > 100 → evicta e (la más vieja); re-pedirla re-fetchea.
    await responderTrasCargar('g.glb', 97);
    await responderTrasCargar('e.glb', 4);
    expect(veces('e.glb')).toBe(3);
  });

  it('pending no evictable: el desalojo salta entradas sin size', async () => {
    const m = await mod();
    m._setMaxBytesForTests(4);
    const lenta = m.cargarGlbBuffer('lento.glb'); // size 0 hasta resolver
    await responderTrasCargar('otra.glb', 3);
    await responderTrasCargar('grande.glb', 10); // dispara desalojo; lento está pendiente
    responder('lento.glb', 2);
    await lenta;
    expect(veces('lento.glb')).toBe(1); // sobrevivió: sin re-fetch
  });

  async function responderTrasCargar(url: string, bytes: number): Promise<ArrayBuffer> {
    const m = await mod();
    const p = m.cargarGlbBuffer(url);
    responder(url, bytes);
    return p;
  }
});
