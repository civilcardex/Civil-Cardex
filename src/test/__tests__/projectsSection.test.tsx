// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderEnJsdom } from '../render.tsx';
import { ProjectsSection } from '../../pages/auth/ProjectsSection.tsx';
import type { SuscripcionRow } from '../../lib/subscriptions/subscriptionsService.ts';

// subscriptionsService importa supabase.ts: sin las VITE_* el módulo lanza al importarse.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: async () => ({ data: [], error: null }) }),
  },
}));

const AHORA = new Date('2026-11-25T12:00:00Z');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
});
afterEach(() => vi.useRealTimers());

// H-05 (plan de remediación 2026-11-25): la lista de suscripciones se ordena por el INSTANTE
// de fecha_fin (no por días redondeados) sobre una COPIA, y dos vencimientos idénticos
// conservan el orden de entrada.

const base = {
  user_id: 'u1',
  puestos: 1,
  txn_id: null,
  created_at: '2026-01-01T00:00:00Z',
} as const;

const fila = (id: string, modulo: 'flow' | 'manage', fecha_fin: string): SuscripcionRow =>
  ({ id, modulo, estado: 'activa', fecha_fin, ...base }) as unknown as SuscripcionRow;

const PROPS_BASE = {
  proyectosOpen: true,
  onToggleOpen: () => {},
  proyectos: [],
  cmProyectos: [],
  cmListError: false,
  onRetryList: () => {},
  proyLoading: false,
  filtroModulo: 'todos' as const,
  onFiltroModulo: () => {},
  user: { id: 'u1' },
  onNuevoSelector: () => {},
  errorApertura: null,
  openingId: null,
  cmOpeningId: null,
  onOpenCf: () => {},
  onOpenCm: () => {},
  onDeleteCf: () => {},
  onDeleteCm: () => {},
};

/** Etiquetas de suscripción en el orden renderizado (nombre de módulo por <li>). */
async function ordenRenderizado(rows: SuscripcionRow[]) {
  const { container, unmount } = await renderEnJsdom(
    <ProjectsSection {...PROPS_BASE} subsRows={rows} />,
  );
  try {
    return [...container.querySelectorAll('li')].map(
      (li) => li.querySelector('.font-semibold')?.textContent,
    );
  } finally {
    await unmount();
  }
}

describe('orden de suscripciones por vencimiento (H-05)', () => {
  it('la que vence antes primero, dentro del mismo tramo de días', async () => {
    // Ambas a 3 días de ahora (mismo intervalo de días redondeados): manda el instante.
    const pronto = new Date(AHORA.getTime() + 3 * 86_400_000).toISOString();
    const tarde = new Date(AHORA.getTime() + 3 * 86_400_000 + 5 * 3_600_000).toISOString();
    expect(await ordenRenderizado([fila('b', 'manage', tarde), fila('a', 'flow', pronto)])).toEqual(
      ['Civil Flow', 'Civil Manager'],
    );
  });

  it('dos vencimientos idénticos conservan el orden de entrada (copia estable)', async () => {
    const igual = new Date(AHORA.getTime() + 10 * 86_400_000).toISOString();
    expect(
      await ordenRenderizado([fila('f1', 'flow', igual), fila('m1', 'manage', igual)]),
    ).toEqual(['Civil Flow', 'Civil Manager']);
  });
});
