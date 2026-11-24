// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTrazosToDB, setActiveProyectoId } from '../storageService.ts';
import { arbitrarCarga } from '../storage/strokesDb.ts';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, rpc },
}));
const draft = { ramales: [{ id: 'r1', net: 'san' }], bajantes: [], areas: [] };

describe('el guardado LWW de trazos (sin reloj de versión)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveProyectoId('11111111-1111-4111-8111-111111111111');
    rpc.mockReset();
  });

  it('saveTrazosToDB llama save_plano_data SIN p_updated_at (el local siempre pisa)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await saveTrazosToDB('1', draft);
    await saveTrazosToDB('1', draft);
    const saves = rpc.mock.calls.filter(([fn]) => fn === 'save_plano_data');
    expect(saves).toHaveLength(2);
    for (const [, args] of saves) {
      expect(args.p_plano_id).toBe(1);
      expect('p_updated_at' in args).toBe(false);
    }
  });

  it('una escritura en cola no se envía con el proyecto que acaba de abrirse', async () => {
    const enCola = saveTrazosToDB('1', draft);
    setActiveProyectoId('22222222-2222-4222-8222-222222222222');
    await enCola;
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('civilflow_plano_borrador_rescate_u1:1')!)).toEqual(
      draft,
    );
  });

  it('un error de rpc no revienta la cola (queda en el diario y sigue)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sin conexión' } });
    await expect(saveTrazosToDB('1', draft)).resolves.toBeUndefined();
    await expect(saveTrazosToDB('1', draft)).resolves.toBeUndefined();
  });
});

describe('arbitrarCarga (anti-vacío + ts, sin versión)', () => {
  const bd = { ...draft, ts: 2000 };
  const local = { ...draft, ts: 1000 };

  it('el doc de ts MAYOR gana al abrir el piso', () => {
    expect(arbitrarCarga(local, bd, 1000, 2000)).toBe('bd');
    expect(arbitrarCarga(local, { ...bd, ts: 500 }, 1000, 500)).toBe('local-ts');
  });

  it('las reglas anti-vacío van primero: un vacío nunca pisa contenido', () => {
    expect(arbitrarCarga(local, { ramales: [] }, 1000, 9999)).toBe('local-contenido');
    expect(arbitrarCarga(null, bd, null, 2000)).toBe('bd');
  });

  it('ts igual → nada (el autosave de la próxima edición sube el local)', () => {
    expect(arbitrarCarga(local, { ...bd, ts: 1000 }, 1000, 1000)).toBe('nada');
    expect(arbitrarCarga({ ramales: [] }, { ramales: [] }, 0, 0)).toBe('nada');
  });
});
