import { TramosProvider } from '../modules/civilflow/context/TramosContext';
import { ProjectProvider } from '../modules/civilflow/context/ProjectContext';
import { ApparatusProvider } from '../modules/civilflow/context/ApparatusContext';
import { PlansProvider } from '../modules/civilflow/context/PlansContext';
import { AuthProvider } from './AuthContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TramosProvider>
        <ProjectProvider>
          <ApparatusProvider>
            <PlansProvider>
              {children}
            </PlansProvider>
          </ApparatusProvider>
        </ProjectProvider>
      </TramosProvider>
    </AuthProvider>
  );
}
