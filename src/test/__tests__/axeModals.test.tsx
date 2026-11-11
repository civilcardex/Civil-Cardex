// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderEnJsdom } from '../render.tsx';
import { expectAxe } from '../axe.ts';
import { ConfirmModal } from '../../components/shared/ConfirmModal.tsx';
import CheckoutModal from '../../components/subscriptions/CheckoutModal.tsx';
import ModuleSelectDialog from '../../components/subscriptions/ModuleSelectDialog.tsx';

// Supabase de mentira: CheckoutModal pide la URL del checkout al montar (open=true) — el
// mock evita red y deja el modal en su estado de error de pasarela (camino real mientras
// las edges Lemon no estén desplegadas).
vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: async () => ({ data: null, error: { message: 'sin pasarela en tests' } }),
    },
  },
}));

// Suscripciones de mentira: ModuleSelectDialog lista módulos según el hook (sin BD aquí).
vi.mock('../../hooks/useSubscriptions.ts', () => ({
  useSuscripciones: () => ({
    rows: [],
    activos: new Set(['flow']),
    loading: false,
    bloqueando: false,
    refetch: () => {},
  }),
}));

describe('axe — modales compartidos', () => {
  // timeout holgado: cada it corre axe-core completo y en cola serial (ver ../axe.ts) —
  // 5s default se queda corto cuando el run previo aún drena.
  it('ConfirmModal (dialog nativo de ModalShell) sin violaciones', { timeout: 15000 }, async () => {
    const { container, unmount } = await renderEnJsdom(
      <ConfirmModal
        title="Eliminar proyecto"
        message="Esta acción no se puede deshacer."
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    await expectAxe(container);
    await unmount();
  });

  it(
    'CheckoutModal en estado de error de pasarela sin violaciones',
    { timeout: 15000 },
    async () => {
      const { container, unmount, flush } = await renderEnJsdom(
        <CheckoutModal open onClose={() => {}} modulos={['flow']} periodo="mensual" />,
      );
      // Dos flushes: el effect lanza la IIFE async del invoke y luego pinta el mensaje.
      await flush();
      await flush();
      expect(container.textContent).toContain('pasarela');
      await expectAxe(container);
      await unmount();
    },
  );

  it(
    'ModuleSelectDialog con un módulo activo (radios) sin violaciones',
    { timeout: 15000 },
    async () => {
      const { container, unmount } = await renderEnJsdom(
        <MemoryRouter>
          <ModuleSelectDialog open onClose={() => {}} onPick={() => {}} />
        </MemoryRouter>,
      );
      expect(container.querySelector('input[type="radio"]')).toBeTruthy();
      await expectAxe(container);
      await unmount();
    },
  );
});
