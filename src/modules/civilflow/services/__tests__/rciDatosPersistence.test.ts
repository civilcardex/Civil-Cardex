import { describe, it, expect, beforeEach, vi } from 'vitest';

// PERSISTENCIA RCI (Fase 5): el estado del motor (RciState) sobrevive entre sesiones vía
// cf_rci_datos_proyecto (1:1 con el proyecto).
//
// Qué se verifica:
//  A) saveRciDatos → loadRciDatos: round-trip fiel del estado (simulando la serialización
//     jsonb real de la BD, que no conserva undefined).
//  B) load sin fila (proyecto recién creado) → null, sin throw.
//  C) Migración aún sin aplicar (tabla/función ausente: PGRST205/PGRST202) → load null y
//     save false, SIN throw y SIN alarma al canal de guardados (el cliente sigue funcionando).
//  D) Blob guardado que NO parece un RciState (dato viejo/otra fase) → null, sin crashear.

const { mockFrom, mockRpc, mockGetSession, alertas } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  alertas: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('../storageService.ts', () => ({
  emitBdSaveError: alertas,
}));

import { loadRciDatos, saveRciDatos } from '../projectDataService.ts';
import { ejemploVerificacion } from '../../lib/rci/index.ts';

type Err = { message: string; code?: string };

/** BD simulada: una fila 1:1 con el proyecto (PK proyecto_id). */
let fila: { datos: unknown } | null = null;
let errorDeLectura: Err | null = null;

beforeEach(() => {
  fila = null;
  errorDeLectura = null;
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockGetSession.mockReset();
  alertas.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  mockFrom.mockImplementation((_tabla: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: fila, error: errorDeLectura }),
      }),
    }),
  }));
  // El RPC real guarda p_datos tal cual en la columna datos (jsonb) — la simulación pasa por
  // JSON para replicar que jsonb no conserva undefined.
  mockRpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'save_rci_datos') {
      fila = { datos: JSON.parse(JSON.stringify(args.p_datos)) };
      return { error: null };
    }
    return { error: { message: `rpc desconocido: ${name}` } };
  });
});

describe('persistencia RCI por proyecto', () => {
  it('A: save + load devuelven el mismo RciState (round-trip vía jsonb)', async () => {
    const estado = ejemploVerificacion();
    await expect(saveRciDatos('p1', estado)).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith(
      'save_rci_datos',
      expect.objectContaining({ p_proyecto_id: 'p1' }),
    );
    const loaded = await loadRciDatos('p1');
    expect(loaded).toEqual(JSON.parse(JSON.stringify(estado)));
    // La alarma de guardado jamás suena en un guardado exitoso.
    expect(alertas).not.toHaveBeenCalled();
  });

  it('B: load sin fila → null', async () => {
    await expect(loadRciDatos('p-vacio')).resolves.toBeNull();
  });

  it('C: tabla/función ausente (migración sin aplicar) → null/false sin throw ni alarma', async () => {
    errorDeLectura = {
      code: 'PGRST205',
      message: "Could not find the table 'public.cf_rci_datos_proyecto' in the schema cache",
    };
    await expect(loadRciDatos('p1')).resolves.toBeNull();
    mockRpc.mockResolvedValue({
      error: {
        code: 'PGRST202',
        message:
          'Could not find the function public.save_rci_datos(uuid, jsonb) in the schema cache',
      },
    });
    await expect(saveRciDatos('p1', ejemploVerificacion())).resolves.toBe(false);
    // devError limpio: el canal de alertas de guardados NO suena en este camino.
    expect(alertas).not.toHaveBeenCalled();
  });

  it('D: blob que no parece un RciState → null (sin crashear con datos viejos)', async () => {
    fila = { datos: { hola: 'mundo' } };
    await expect(loadRciDatos('p1')).resolves.toBeNull();
    fila = { datos: 'no-soy-objeto' };
    await expect(loadRciDatos('p1')).resolves.toBeNull();
  });

  it('E: error real de guardado (no ausencia) SÍ avisa al canal de guardados', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'no_autorizado' } });
    await expect(saveRciDatos('p1', ejemploVerificacion())).resolves.toBe(false);
    expect(alertas).toHaveBeenCalledWith('save-rci', 'no_autorizado');
  });
});
