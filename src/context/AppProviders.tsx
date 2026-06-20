import { TramosProvider } from './TramosContext';
import { ProjectProvider } from './ProjectContext';
import { ApparatusProvider } from './ApparatusContext';
import { PlansProvider } from './PlansContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TramosProvider>
      <ProjectProvider>
        <ApparatusProvider>
          <PlansProvider>
            {children}
          </PlansProvider>
        </ApparatusProvider>
      </ProjectProvider>
    </TramosProvider>
  );
}
