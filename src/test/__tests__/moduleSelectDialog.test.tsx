// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { renderEnJsdom } from '../render.tsx';
import ModuleSelectDialog from '../../components/subscriptions/ModuleSelectDialog.tsx';
import type { ModuloId } from '../../lib/subscriptions/catalog.ts';

// El catálogo y el servicio importan supabase.ts, que lanza al importar sin VITE_*.
// Las dos suites de perfil son de UI: se aísla el cliente igual que en axeModals.test.tsx.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: async () => ({ data: [], error: null }) }),
  },
}));

// Estado que el diálogo lee del hook (sin BD aquí). Cada test lo fija antes de montar.
const { estadoHook } = vi.hoisted(() => ({
  estadoHook: {
    rows: [] as { id: number; modulo: ModuloId; estado: string; fecha_fin: string }[],
    activos: new Set<ModuloId>(),
    bloqueando: false,
    decidido: true,
  },
}));
vi.mock('../../hooks/useSubscriptions.ts', () => ({
  useSuscripciones: () => estadoHook,
}));

async function montar() {
  const r = await renderEnJsdom(
    <MemoryRouter>
      <ModuleSelectDialog open onClose={() => {}} onPick={() => {}} />
    </MemoryRouter>,
  );
  await r.flush();
  const radios = [...r.container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  return { radios, texto: r.container.textContent ?? '', unmount: r.unmount };
}

describe('ModuleSelectDialog — qué módulos ofrece al crear proyecto', () => {
  it('sin candado de suscripciones ofrece todo el catálogo y no elige por nadie', async () => {
    estadoHook.bloqueando = false;
    estadoHook.activos = new Set();
    const { radios, unmount } = await montar();
    expect(radios.map((r) => r.value)).toEqual(['flow', 'manage']);
    expect(radios.some((r) => r.checked)).toBe(false);
    await unmount();
  });

  it('con candado ofrece solo los módulos vigentes (asiento de empresa incluido)', async () => {
    estadoHook.bloqueando = true;
    estadoHook.activos = new Set(['manage']);
    const { radios, unmount } = await montar();
    expect(radios.map((r) => r.value)).toEqual(['manage']);
    // Un solo disponible → va preseleccionado.
    expect(radios[0].checked).toBe(true);
    await unmount();
  });

  it('con candado y ningún módulo manda a ver planes', async () => {
    estadoHook.bloqueando = true;
    estadoHook.activos = new Set();
    const { radios, texto, unmount } = await montar();
    expect(radios).toHaveLength(0);
    expect(texto).toContain('No tiene módulos activos');
    await unmount();
  });

  it('mientras no se sabe si hay candado no ofrece nada (verificando)', async () => {
    estadoHook.bloqueando = false;
    estadoHook.activos = new Set();
    estadoHook.decidido = false;
    const { radios, texto, unmount } = await montar();
    expect(radios).toHaveLength(0);
    expect(texto).toContain('Verificando suscripciones');
    estadoHook.decidido = true;
    await unmount();
  });
});
