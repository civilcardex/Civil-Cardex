import { beforeEach, expect, it, vi } from 'vitest';
import { fetchCmProyectoById, fetchCmProyectos } from '../services/cmProjectsService.ts';

const { limit, or, eq, maybeSingle } = vi.hoisted(() => ({
  limit: vi.fn(),
  or: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain = { limit, or, eq, order: () => chain };
        or.mockReturnValue(chain);
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
  limit.mockReset();
  or.mockReset();
  eq.mockReset().mockReturnValue({ maybeSingle });
  maybeSingle.mockReset();
});

it('trae 1.000 proyectos por cursor sin repetir ni saltar fechas empatadas', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => row(1000 - i));
  for (let start = 0; start < rows.length; start += 50) {
    limit.mockResolvedValueOnce({ data: rows.slice(start, start + 51), error: null });
  }
  let page = await fetchCmProyectos();
  expect(limit).toHaveBeenCalledExactlyOnceWith(51);
  expect(or).not.toHaveBeenCalled();
  const loaded = [...page.rows];
  while (page.next) {
    const cursor = page.next;
    page = await fetchCmProyectos(cursor);
    expect(or).toHaveBeenLastCalledWith(
      `created_at.lt.2026-01-01,and(created_at.eq.2026-01-01,id.lt.${cursor.id})`,
    );
    loaded.push(...page.rows);
  }
  expect(loaded).toEqual(rows);
});

it('una inserción antes del cursor no desplaza el comienzo de la página siguiente', async () => {
  const rows = Array.from({ length: 60 }, (_, i) => row(90 - i));
  limit.mockImplementation(async (size: number) => {
    const filter = or.mock.calls.at(-1)?.[0] as string | undefined;
    const boundary = filter ? Number(/id\.lt\.(\d+)\)$/.exec(filter)?.[1]) : Infinity;
    return {
      data: rows.filter((project) => Number(project.id) < boundary).slice(0, size),
      error: null,
    };
  });
  const first = await fetchCmProyectos();
  rows.unshift(row(91));
  const second = await fetchCmProyectos(first.next ?? undefined);
  expect(second.rows).toEqual(rows.slice(51));
  expect(second.next).toBeNull();
});

it('abre proyecto 201 por identificador y distingue ausencia de error de transporte', async () => {
  maybeSingle.mockResolvedValueOnce({ data: row(201), error: null });
  maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'sin conexión' } });
  expect(await fetchCmProyectoById('201')).toEqual(row(201));
  expect(await fetchCmProyectoById('ausente')).toBeNull();
  await expect(fetchCmProyectoById('201')).rejects.toThrow('sin conexión');
  expect(eq).toHaveBeenCalledWith('id', '201');
  expect(limit).not.toHaveBeenCalled();
});
