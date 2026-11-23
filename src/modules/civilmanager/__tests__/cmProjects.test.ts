import { beforeEach, expect, it, vi } from 'vitest';
import { fetchCmProyectoById, fetchCmProyectos } from '../services/cmProjectsService.ts';

const { range, eq, maybeSingle } = vi.hoisted(() => ({
  range: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain = { range, eq, order: () => chain };
        return chain;
      },
    }),
  },
}));
const row = (n: number) => ({
  id: String(n),
  nombre: `Proyecto ${n}`,
  codigo: String(n),
  created_at: '2026-01-01',
});
beforeEach(() => {
  range.mockReset();
  eq.mockReset().mockReturnValue({ maybeSingle });
  maybeSingle.mockReset();
});

it('pide la segunda página en vez de truncar el listado en proyecto 200', async () => {
  range.mockResolvedValueOnce({
    data: Array.from({ length: 200 }, (_, i) => row(i + 1)),
    error: null,
  });
  range.mockResolvedValueOnce({ data: [row(201)], error: null });
  expect((await fetchCmProyectos()).at(-1)).toEqual(row(201));
  expect(range.mock.calls).toEqual([
    [0, 199],
    [200, 399],
  ]);
});

it('abre proyecto 201 por identificador y distingue ausencia de error de transporte', async () => {
  maybeSingle.mockResolvedValueOnce({ data: row(201), error: null });
  maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'sin conexión' } });
  expect(await fetchCmProyectoById('201')).toEqual(row(201));
  expect(await fetchCmProyectoById('ausente')).toBeNull();
  await expect(fetchCmProyectoById('201')).rejects.toThrow('sin conexión');
  expect(eq).toHaveBeenCalledWith('id', '201');
  expect(range).not.toHaveBeenCalled();
});
