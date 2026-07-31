import type { ReactNode } from 'react';
import { TramosProvider } from './TramosContext';
import { ProjectProvider } from './ProjectContext';
import { ApparatusProvider } from './ApparatusContext';
import { PlansProvider } from './PlansContext';

// Scoped to the routes that actually use the CAD engine (/visor, /civilflowareatrabajo) instead of
// mounting globally via AppProviders — every other route (marketing stubs, other modules) used to
// pay for this state without ever reading it.
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
