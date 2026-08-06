import type { ReactNode } from 'react';
import { TramosProvider } from './TramosContext';
import { ProjectProvider } from './ProjectContext';
import { ApparatusProvider } from './ApparatusContext';
import { PlansProvider } from './PlansContext';

// Limitado a las rutas que realmente usan el motor CAD (/visor, /civilflowareatrabajo) en lugar de
// montarse globalmente vía AppProviders — antes, cualquier otra ruta (stubs de marketing, otros
// módulos) pagaba por este estado sin llegar a leerlo nunca.
export function CivilFlowProviders({ children }: { children: ReactNode }) {
  return (
    <TramosProvider>
      <ProjectProvider>
        <ApparatusProvider>
          <PlansProvider>{children}</PlansProvider>
        </ApparatusProvider>
      </ProjectProvider>
    </TramosProvider>
  );
}
