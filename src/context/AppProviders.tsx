import { TramosProvider } from './TramosContext';
import { ProjectProvider } from './ProjectContext';
import { ApparatusProvider } from './ApparatusContext';
import { PlansProvider } from './PlansContext';
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
