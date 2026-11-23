// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTrazosFromDB, saveTrazosToDB, setActiveProyectoId } from '../storageService.ts';
import {
  aceptarVersionDePlano,
  arbitrarCarga,
  resetConcurrenciaParaTest,
} from '../storage/strokesDb.ts';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, rpc },
}));
const base = '2026-01-01T00:00:00Z';
const newer = '2026-01-01T00:00:01Z';
const draft = { ramales: [{ id: 'r1', net: 'san' }], bajantes: [], areas: [] };
const plana = (updated_at: string) => ({ data: { plano: { updated_at } }, error: null });

describe('el guardado liga el reloj al plano y a su borrador', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveProyectoId('11111111-1111-4111-8111-111111111111');
    resetConcurrenciaParaTest();
    rpc.mockReset();
  });

  async function load(plan: string, token: string) {
    rpc.mockResolvedValueOnce(plana(token));
    const remote = await loadTrazosFromDB(plan);
    expect(remote).not.toBeNull();
    return remote!;
  }

  it('dos guardados propios consecutivos usan el reloj comprometido, sin cruzar planos', async () => {
    aceptarVersionDePlano(await load('1', base), null);
    aceptarVersionDePlano(await load('2', newer), null);
    rpc.mockResolvedValue({ data: newer, error: null });
    await saveTrazosToDB('1', draft);
    await saveTrazosToDB('1', draft);
    expect(rpc.mock.calls.slice(2).map(([fn, args]) => [fn, args.p_updated_at])).toEqual([
      ['save_plano_data_versioned', base],
      ['save_plano_data_versioned', newer],
    ]);
  });

  it.each(['conflicto_concurrencia', 'PGRST202'])(
    'no degrada ante %s ni ante una lectura de fondo',
    async (message) => {
      aceptarVersionDePlano(await load('1', base), null);
      rpc.mockResolvedValue({ data: null, error: { message } });
      await saveTrazosToDB('1', draft);
      const remote = await load('1', newer);
      await saveTrazosToDB('1', draft);
      const saves = rpc.mock.calls.filter(([name]) => name.startsWith('save'));
      expect(saves.map(([fn, args]) => [fn, args.p_updated_at])).toEqual([
        ['save_plano_data_versioned', base],
        ['save_plano_data_versioned', base],
      ]);
      expect(aceptarVersionDePlano(remote, draft)).toBe('nueva');
      expect(JSON.parse(localStorage.getItem('civilflow_plano_borrador_rescate_u1:1')!)).toEqual(
        draft,
      );
    },
  );

  // H-01: el caso exacto del usuario existente — caché local con contenido, BD con la MISMA
  // ts y SIN clave de versión persistida (navegador fresco / storage limpiado). La aceptación
  // corre SIEMPRE (antes del arbitraje): sin base persistida declara 'nueva', archiva el
  // borrador y fija el reloj → el autosave ya sube (antes: nada fijaba el reloj jamás).
  it('carga sin reloj persistido acepta la versión y el autosave sube', async () => {
    const localDoc = { ...draft, ts: 1000 };
    const remote = await load('1', base);
    expect(aceptarVersionDePlano(remote, localDoc)).toBe('nueva');
    expect(JSON.parse(localStorage.getItem('civilflow_plano_borrador_rescate_u1:1')!)).toEqual(
      localDoc,
    );
    rpc.mockResolvedValueOnce({ data: newer, error: null });
    await saveTrazosToDB('1', draft);
    const save = rpc.mock.calls.find(([name]) => name === 'save_plano_data_versioned');
    expect(save?.[1].p_updated_at).toBe(base);
  });

  // Variante con reloj persistido coherente (recarga en el MISMO equipo): 'misma' y el
  // autosave sube con la versión base sin chocar.
  it('carga con reloj persistido coherente queda en misma y el autosave sube', async () => {
    // saveToStorage escribe JSON: la clave persistida viaja entrecomillada.
    localStorage.setItem('civilflow_plano_version_u1:1', JSON.stringify(base));
    const remote = await load('1', base);
    expect(aceptarVersionDePlano(remote, { ...draft, ts: 1000 })).toBe('misma');
    rpc.mockResolvedValueOnce({ data: newer, error: null });
    await saveTrazosToDB('1', draft);
    const save = rpc.mock.calls.find(([name]) => name === 'save_plano_data_versioned');
    expect(save?.[1].p_updated_at).toBe(base);
  });
});

describe('arbitrarCarga (con la versión ya aceptada)', () => {
  const bd = { ...draft, ts: 2000 };
  const local = { ...draft, ts: 1000 };

  it('una nube NUEVA con contenido local fuerza BD (el borrador ya quedó archivado)', () => {
    expect(arbitrarCarga('nueva', local, bd, 1000, 2000)).toBe('bd');
    expect(arbitrarCarga('nueva', local, { ...bd, ts: 1000 }, 1000, 1000)).toBe('bd');
  });

  it('misma versión conserva las reglas anti-vacío y el ts', () => {
    expect(arbitrarCarga('misma', local, { ramales: [] }, 1000, 9999)).toBe('local-contenido');
    expect(arbitrarCarga('misma', null, bd, null, 2000)).toBe('bd');
    // ts de BD MAYOR → BD (la regla de ts solo la voltea la local MÁS nueva).
    expect(arbitrarCarga('misma', local, bd, 1000, 2000)).toBe('bd');
    // ts IGUAL → nadie gana ('nada'): el reloj ya quedó fijado por la aceptación y el
    // autosave de la siguiente edición sube sin chocar.
    expect(arbitrarCarga('misma', local, { ...bd, ts: 1000 }, 1000, 1000)).toBe('nada');
    expect(arbitrarCarga('misma', local, { ...bd, ts: 500 }, 1000, 500)).toBe('local-ts');
    // Sin doc local la BD manda (nada que perder); dos vacíos → nada que hacer.
    expect(arbitrarCarga('misma', null, bd, null, 2000)).toBe('bd');
    expect(arbitrarCarga('misma', { ramales: [] }, { ramales: [] }, 0, 0)).toBe('nada');
  });
});
