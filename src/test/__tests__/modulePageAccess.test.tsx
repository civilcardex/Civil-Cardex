// @vitest-environment jsdom
import { act } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModulePage from '../../pages/ModulePage.tsx';
import { renderEnJsdom } from '../render.tsx';

const { verificarAccesoModulo, auth, suscripciones } = vi.hoisted(() => ({
  verificarAccesoModulo: vi.fn<() => Promise<boolean | null>>(),
  auth: { user: { id: 'usuario' } as { id: string } | null, loading: false },
  suscripciones: { bloqueando: true, decidido: true },
}));

vi.mock('../../context/AuthContext.tsx', () => ({ useAuth: () => auth }));
vi.mock('../../hooks/useSubscriptions.ts', () => ({ useSuscripciones: () => suscripciones }));
vi.mock('../../lib/subscriptions/subscriptionsService.ts', () => ({ verificarAccesoModulo }));
vi.mock('../../components/ModulePageLayout.tsx', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('../../modules/civilflow/components/shared/ProjectCreateDialog.tsx', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>Formulario Civil Flow</div> : null),
}));
vi.mock('../../modules/civilmanager/components/shared/ProjectCreateDialogCM.tsx', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>Formulario Civil Manager</div> : null),
}));

function RutaActual() {
  const { pathname, search, state } = useLocation();
  return <output>{[pathname + search, state?.from].filter(Boolean).join(' ')}</output>;
}

async function montarLanding(modulo: 'flow' | 'manage') {
  const ruta = modulo === 'flow' ? '/civilflow' : '/civilmanager';
  const render = await renderEnJsdom(
    <MemoryRouter initialEntries={[ruta]}>
      <ModulePage moduleId={modulo} />
      <RutaActual />
    </MemoryRouter>,
  );
  const boton = render.container.querySelector<HTMLButtonElement>(
    'button.flow-cta, button.mh-cta',
  )!;
  return { ...render, boton, click: () => act(async () => boton.click()) };
}

describe('Inicio de proyecto desde las páginas de módulo', () => {
  beforeEach(() => {
    auth.user = { id: 'usuario' };
    suscripciones.decidido = true;
    suscripciones.bloqueando = true;
    verificarAccesoModulo.mockReset();
  });

  it.each(['flow', 'manage'] as const)(
    'muestra el texto y dirige %s sin acceso a sus precios',
    async (modulo) => {
      verificarAccesoModulo.mockResolvedValue(false);
      const { container, boton, click, unmount } = await montarLanding(modulo);
      try {
        expect(boton.textContent).toContain('Iniciar nuevo proyecto');
        expect(boton.querySelector('[aria-hidden="true"]')?.textContent).toBe('rocket_launch');
        await click();
        expect(verificarAccesoModulo).toHaveBeenCalledWith(modulo);
        expect(container.querySelector('output')?.textContent).toBe(`/pricing?modulo=${modulo}`);
        expect(container.textContent).not.toContain('Formulario Civil');
      } finally {
        await unmount();
      }
    },
  );

  it('espera la decisión del control y abre el diálogo solo tras confirmar el acceso', async () => {
    suscripciones.decidido = false;
    const pendiente = await montarLanding('manage');
    expect(pendiente.boton.disabled).toBe(true);
    await pendiente.click();
    expect(verificarAccesoModulo).not.toHaveBeenCalled();
    await pendiente.unmount();

    suscripciones.decidido = true;
    verificarAccesoModulo.mockResolvedValueOnce(null).mockResolvedValueOnce(true);
    const { container, click, unmount } = await montarLanding('manage');
    try {
      await click();
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('suscripción');
      expect(container.textContent).not.toContain('Formulario Civil Manager');
      await click();
      expect(container.textContent).toContain('Formulario Civil Manager');
    } finally {
      await unmount();
    }
  });

  it('envía al login con la ruta pública de regreso', async () => {
    auth.user = null;
    const { container, click, unmount } = await montarLanding('flow');
    try {
      await click();
      expect(container.querySelector('output')?.textContent).toBe('/login /civilflow');
      expect(verificarAccesoModulo).not.toHaveBeenCalled();
    } finally {
      await unmount();
    }
  });
});
