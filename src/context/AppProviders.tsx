import { AuthProvider } from './AuthContext';
import { GlobalAlertDialogProvider } from '../modules/civilflow/components/GlobalAlertDialogProvider';

// CivilFlow-specific state (Tramos/Project/Apparatus/Plans) moved to CivilFlowProviders,
// scoped in App.tsx to only the routes that use the CAD engine — see CivilFlowProviders.tsx.
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GlobalAlertDialogProvider>{children}</GlobalAlertDialogProvider>
    </AuthProvider>
  );
}
