import { describe, expect, it, vi } from 'vitest';
// Mock del cliente de Supabase: estas pruebas son puras y no tocan red.
vi.mock('../../supabase', () => ({
  supabase: {
    from: () => ({ select: async () => ({ data: [], error: null }) }),
  },
}));

import {
  diasParaVencer,
  estaActiva,
  modulosActivos,
  vigenciaDe,
  type SuscripcionRow,
} from '../subscriptionsService.ts';

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

describe('vigenciaDe (cuánto le queda a una suscripción)', () => {
  const ahora = new Date('2026-11-24T12:00:00Z');
  const enDias = (dias: number) => new Date(ahora.getTime() + dias * 86_400_000).toISOString();

  it('dice los días que faltan y la fecha; tono normal si faltan más de 7', () => {
    const v = vigenciaDe({ estado: 'activa', fecha_fin: enDias(23) }, ahora);
    expect(v.texto).toMatch(/^Vence en 23 días · /);
    expect(v.tono).toBe('ok');
  });

  it('tono ambar cuando vence en 7 días o menos (y singular con 1)', () => {
    expect(vigenciaDe({ estado: 'activa', fecha_fin: enDias(7) }, ahora).tono).toBe('ambar');
    expect(vigenciaDe({ estado: 'activa', fecha_fin: enDias(1) }, ahora).texto).toMatch(
      /^Vence en 1 día · /,
    );
  });

  it('menos de 24 h: «Vence hoy» solo si es el mismo día local de la fecha mostrada', () => {
    const v = vigenciaDe({ estado: 'activa', fecha_fin: enDias(0.5) }, ahora);
    expect(v.tono).toBe('ambar');
    expect(v.texto).toMatch(/^Vence (hoy|en menos de 24 horas) · /);
  });

  it('dos horas después de vencer dice «menos de 24 horas», nunca «hace 1 día»', () => {
    const v = vigenciaDe({ estado: 'activa', fecha_fin: enDias(-0.08) }, ahora);
    expect(v.tono).toBe('rojo');
    expect(v.texto).toMatch(/^Venci(ó|o) (hoy|hace menos de 24 horas) · /);
  });

  it('vencida: cuántos días hace venció, en rojo', () => {
    const v = vigenciaDe({ estado: 'activa', fecha_fin: enDias(-3) }, ahora);
    expect(v.tono).toBe('rojo');
    expect(v.texto).toMatch(/^Venció hace 3 días · /);
  });

  it('cancelada aunque la fecha de fin aún no llegó', () => {
    const v = vigenciaDe({ estado: 'cancelada', fecha_fin: enDias(10) }, ahora);
    expect(v.tono).toBe('rojo');
    expect(v.texto).toMatch(/^Cancelada · /);
  });
});

describe('diasParaVencer', () => {
  it('toma la fecha de fin más próxima', () => {
    const ahora = new Date('2026-11-24T12:00:00Z');
    const enDias = (dias: number) => new Date(ahora.getTime() + dias * 86_400_000).toISOString();
    expect(diasParaVencer([enDias(20), enDias(3), enDias(300)], ahora)).toBe(3);
  });
});

describe('suscripcionesHabilitadas', () => {
  // El flag vive en cache a nivel de módulo (single-flight): cada test importa
  // una instancia fresca vía resetModules para aislar la caché.
  it('lee el flag de la BD y cachea un solo RPC', async () => {
    vi.resetModules();
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.doMock('../../supabase', () => ({ supabase: { rpc, from: () => ({}) } }));
    const svc = await import('../subscriptionsService.ts');
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
    const svc = await import('../subscriptionsService.ts');
    expect(await svc.suscripcionesHabilitadas()).toBe(false);
  });

  it('fallo transitorio de RPC NO se cachea: el próximo fetch reintenta', async () => {
    vi.resetModules();
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      .mockResolvedValueOnce({ data: true, error: null });
    vi.doMock('../../supabase', () => ({ supabase: { rpc, from: () => ({}) } }));
    const svc = await import('../subscriptionsService.ts');
    await expect(svc.suscripcionesHabilitadas()).resolves.toBe(false);
    await expect(svc.suscripcionesHabilitadas()).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('false legítimo (flag apagado) SÍ se cachea: no re-consulta', async () => {
    vi.resetModules();
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    vi.doMock('../../supabase', () => ({ supabase: { rpc, from: () => ({}) } }));
    const svc = await import('../subscriptionsService.ts');
    await expect(svc.suscripcionesHabilitadas()).resolves.toBe(false);
    await expect(svc.suscripcionesHabilitadas()).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
