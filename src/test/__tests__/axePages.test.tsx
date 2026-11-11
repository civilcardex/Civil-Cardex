// @vitest-environment jsdom
import { describe, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderEnJsdom } from '../render.tsx';
import { expectAxe } from '../axe.ts';
import LandingPage from '../../pages/LandingPage.tsx';
import PricingPage from '../../pages/PricingPage.tsx';
import NotFound from '../../pages/NotFound.tsx';
import LoginPage from '../../pages/auth/LoginPage.tsx';
import RegisterPage from '../../pages/auth/RegisterPage.tsx';
import ResetPasswordPage from '../../pages/auth/ResetPasswordPage.tsx';
import CompanyPage from '../../pages/CompanyPage.tsx';

// Sesión de mentira: Navbar (Pricing/Login/Register/Reset) y CompanyPage leen useAuth —
// sin proveedor real ni red. user null = visitante / estado vacío de /empresa.
vi.mock('../../context/AuthContext.tsx', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null, loading: false }),
}));

// Suscripciones de mentira: PricingPage/CompanyPage pintan planes/estado según el hook
// (sin BD aquí). CompanyPage con rows vacío + user null renderiza su estado vacío (smoke).
vi.mock('../../hooks/useSubscriptions.ts', () => ({
  useSuscripciones: () => ({
    rows: [],
    activos: new Set(['flow']),
    loading: false,
    bloqueando: false,
    refetch: () => {},
  }),
}));

// Supabase de mentira: PricingPage y CompanyPage importan el cliente (solo tocan la red
// con ?ref= en la URL o RPCs de empresa, que estos tests no disparan) — sin .env de tests
// no puede ni crearse el real.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: async () => ({ data: null, error: { message: 'sin red en tests' } }),
    },
  },
}));

// Timeout holgado por it: axe-core completo + cola serial (ver ../axe.ts) supera el
// default de 5s cuando el run previo aún drena.
describe('axe — páginas públicas', () => {
  it('LandingPage sin violaciones', { timeout: 15000 }, async () => {
    const { container, unmount } = await renderEnJsdom(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    await expectAxe(container);
    await unmount();
  });

  it('PricingPage sin violaciones', { timeout: 15000 }, async () => {
    const { container, unmount } = await renderEnJsdom(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>,
    );
    await expectAxe(container);
    await unmount();
  });

  it('NotFound sin violaciones', { timeout: 15000 }, async () => {
    const { container, unmount } = await renderEnJsdom(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    await expectAxe(container);
    await unmount();
  });

  it('LoginPage sin violaciones', { timeout: 15000 }, async () => {
    const { container, unmount } = await renderEnJsdom(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await expectAxe(container);
    await unmount();
  });

  it('RegisterPage sin violaciones', { timeout: 15000 }, async () => {
    const { container, unmount } = await renderEnJsdom(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    await expectAxe(container);
    await unmount();
  });

  it(
    'ResetPasswordPage sin violaciones (llegada sin hash: formulario de pedir correo)',
    { timeout: 15000 },
    async () => {
      const { container, unmount } = await renderEnJsdom(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );
      await expectAxe(container);
      await unmount();
    },
  );

  it(
    'CompanyPage sin violaciones (user null: estado vacío de la página)',
    { timeout: 15000 },
    async () => {
      const { container, unmount } = await renderEnJsdom(
        <MemoryRouter>
          <CompanyPage />
        </MemoryRouter>,
      );
      await expectAxe(container);
      await unmount();
    },
  );
});
