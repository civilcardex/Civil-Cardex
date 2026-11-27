import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from '../src/context/AuthContext.tsx';
import { CivilFlowProviders } from '../src/modules/civilflow/context/CivilFlowProviders.tsx';
import ProjectCreateDialog from '../src/modules/civilflow/components/shared/ProjectCreateDialog.tsx';
import DesignParameters from '../src/modules/civilflow/components/DesignParameters.tsx';
import InfoTab from '../src/modules/civilflow/components/workarea/InfoTab.tsx';
import PlansTab from '../src/modules/civilflow/components/workarea/PlansTab.tsx';
import { useWorkAreaState } from '../src/modules/civilflow/components/useWorkAreaState.ts';
import CatalogMasterPage from '../src/modules/civilflow/pages/CatalogMasterPage.tsx';
import WorkAreaCivilFlow from '../src/modules/civilflow/components/WorkAreaCivilFlow.tsx';
import { supabase } from '../src/lib/supabase.ts';

const proyectoId = 'c1a00000-1111-4111-8111-000000000001';
const user = { id: 'c1a00000-1111-4111-8111-000000000002' };
const key = 'fixture-cf-proyecto';
const read = () => JSON.parse(sessionStorage.getItem(key) ?? 'null');
const redesScroll = new URLSearchParams(location.search).has('redes-scroll');

export async function stubCivilFlowSetup() {
  if (redesScroll) {
    await import('../src/index.css');
    Object.defineProperty(supabase, 'from', {
      value: (table: string) => {
        const data = table === 'cf_proyectos' ? [{ id: proyectoId, user_id: user.id }] : [];
        const result = Promise.resolve({ data, error: null });
        return Object.assign(result, {
          select() {
            return this;
          },
          order() {
            return this;
          },
          eq() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
        });
      },
    });
  }
  Object.defineProperty(supabase.auth, 'getSession', {
    value: async () => ({ data: { session: { user } }, error: null }),
  });
  Object.defineProperty(supabase.auth, 'getUser', {
    value: async () => ({ data: { user }, error: null }),
  });
  Object.defineProperty(supabase.auth, 'onAuthStateChange', {
    value: () => ({ data: { subscription: { unsubscribe() {} } } }),
  });
  Object.defineProperty(supabase, 'storage', {
    value: { from: () => ({ upload: async () => ({ error: null }) }) },
  });
  Object.defineProperty(supabase, 'rpc', {
    value: async (name: string, args: Record<string, string>) => {
      if (name === 'save_proyecto') {
        const { p_nombre: nombre, p_pais: pais, p_uso: uso } = args;
        sessionStorage.setItem(key, JSON.stringify({ proyecto_general: { nombre, pais, uso } }));
        return { data: { id: proyectoId, nombre, user_id: user.id }, error: null };
      }
      if (name === 'save_cf_network_material') {
        const data = read();
        data.proyecto_general[`mat_${args.p_red}`] = args.p_material;
        sessionStorage.setItem(key, JSON.stringify(data));
      }
      return { data: name === 'get_proyecto_data' ? read() : null, error: null };
    },
  });
}

function Workspace() {
  const state = useWorkAreaState('info');
  const [tab, setTab] = useState('info');
  return (
    <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <nav aria-label="Configuración de prueba">
        <button type="button" onClick={() => setTab('info')}>
          Información general
        </button>
        <button type="button" onClick={() => setTab('datos')}>
          Parámetros de diseño
        </button>
        <button type="button" onClick={() => setTab('planos')}>
          Carga de planos
        </button>
      </nav>
      {tab === 'datos' ? (
        <DesignParameters redes={new Set(['san', 'gas', 'rci'])} />
      ) : tab === 'planos' ? (
        <PlansTab state={state} />
      ) : (
        <InfoTab state={state} />
      )}
    </main>
  );
}

export function CivilFlowSetupFixture() {
  const workspace = (
    <CivilFlowProviders>
      {redesScroll ? (
        <main style={{ height: '100dvh' }}>
          <WorkAreaCivilFlow tabInicial="redes" />
        </main>
      ) : (
        <Workspace />
      )}
    </CivilFlowProviders>
  );
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/e2e/tablet.html"
            element={
              redesScroll || read() ? workspace : <ProjectCreateDialog open onClose={() => {}} />
            }
          />
          <Route path="/civilflowareatrabajo/*" element={workspace} />
          <Route path="/catalogomaestro" element={<CatalogMasterPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
