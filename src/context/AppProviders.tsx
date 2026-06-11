import { TramosProvider } from './TramosContext';
import { ProjectProvider } from './ProjectContext';
import { ApparatusProvider } from './ApparatusContext';
import { RainwaterProvider } from './RainwaterContext';
import { PlansProvider } from './PlansContext';
import { EPProvider } from './EPContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TramosProvider>
      <ProjectProvider>
        <ApparatusProvider>
          <RainwaterProvider>
            <PlansProvider>
              <EPProvider>
                {children}
              </EPProvider>
            </PlansProvider>
          </RainwaterProvider>
        </ApparatusProvider>
      </ProjectProvider>
    </TramosProvider>
  );
}
