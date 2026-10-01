import { describe, expect, it, vi } from 'vitest';
// Mock del cliente de Supabase: estas pruebas son puras y no tocan red.
vi.mock('../../supabase', () => ({
  supabase: {
    from: () => ({ select: async () => ({ data: [], error: null }) }),
  },
}));

import { estaActiva, modulosActivos, type SuscripcionRow } from '../suscripcionesService';

function fila(overrides: Partial<SuscripcionRow>): SuscripcionRow {
  return {
    id: 1,
    modulo: 'flow',
    periodo: 'mensual',
    estado: 'activa',
    fecha_fin: new Date(Date.now() + 86_400_000).toISOString(), // +1 día
    ...overrides,
  };
}

describe('estaActiva', () => {
  it('vigente si fecha_fin es futura', () => {
    expect(estaActiva(fila({}))).toBe(true);
  });

  it('vencida si fecha_fin pasó', () => {
    const r = fila({ fecha_fin: new Date(Date.now() - 3_600_000).toISOString() });
    expect(estaActiva(r)).toBe(false);
  });

  it('el instante exacto de vencimiento ya NO está activa', () => {
    const ahora = new Date();
    expect(estaActiva(fila({ fecha_fin: ahora.toISOString() }), ahora)).toBe(false);
  });

  it('cancelada nunca está activa aunque no haya vencido', () => {
    expect(estaActiva(fila({ estado: 'cancelada' }))).toBe(false);
  });
});

describe('modulosActivos', () => {
  it('devuelve solo los módulos con suscripción vigente', () => {
    const rows = [
      fila({ id: 1, modulo: 'flow' }),
      fila({ id: 2, modulo: 'manage', fecha_fin: new Date(Date.now() - 1000).toISOString() }),
    ];
    const activos = modulosActivos(rows);
    expect(activos.has('flow')).toBe(true);
    expect(activos.has('manage')).toBe(false);
  });

  it('conjunto vacío sin filas', () => {
    expect(modulosActivos([]).size).toBe(0);
  });
});

describe('suscripcionesHabilitadas', () => {
  // El flag vive en cache a nivel de módulo (single-flight): cada test importa
  // una instancia fresca vía resetModules para aislar la caché.
  it('lee el flag de la BD y cachea un solo RPC', async () => {
    vi.resetModules();
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.doMock('../../supabase', () => ({ supabase: { rpc, from: () => ({}) } }));
    const svc = await import('../suscripcionesService');
    const [a, b] = await Promise.all([
      svc.suscripcionesHabilitadas(),
      svc.suscripcionesHabilitadas(),
    ]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('error de RPC → false: sin confirmación de la BD el cliente nunca bloquea', async () => {
    vi.resetModules();
    vi.doMock('../../supabase', () => ({
      supabase: { rpc: async () => ({ data: null, error: { message: 'boom' } }), from: () => ({}) },
    }));
    const svc = await import('../suscripcionesService');
    expect(await svc.suscripcionesHabilitadas()).toBe(false);
  });

  it('fallo transitorio de RPC NO se cachea: el próximo fetch reintenta', async () => {
    vi.resetModules();
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      .mockResolvedValueOnce({ data: true, error: null });
    vi.doMock('../../supabase', () => ({ supabase: { rpc, from: () => ({}) } }));
    const svc = await import('../suscripcionesService');
    await expect(svc.suscripcionesHabilitadas()).resolves.toBe(false);
    await expect(svc.suscripcionesHabilitadas()).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('false legítimo (flag apagado) SÍ se cachea: no re-consulta', async () => {
    vi.resetModules();
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    vi.doMock('../../supabase', () => ({ supabase: { rpc, from: () => ({}) } }));
    const svc = await import('../suscripcionesService');
    await expect(svc.suscripcionesHabilitadas()).resolves.toBe(false);
    await expect(svc.suscripcionesHabilitadas()).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
