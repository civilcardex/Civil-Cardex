import { useEffect, useState, type ReactNode } from 'react';
import { TramosProvider } from './TramosContext.tsx';
import { ProjectProvider } from './ProjectContext.tsx';
import { ApparatusProvider } from './ApparatusContext.tsx';
import { PlansProvider } from './PlansContext.tsx';

// Limitado a las rutas que realmente usan el motor CAD (/visor, /civilflowareatrabajo) en lugar de
// montarse globalmente vía AppProviders — antes, cualquier otra ruta (stubs de marketing, otros
// módulos) pagaba por este estado sin llegar a leerlo nunca.

// Re-monta el subtree (key de generación) cuando el proyecto activo cambia SIN recargar el
// navegador: WorkAreaCivilFlow adopta un id único válido y dispara 'civilflow_proyecto_activo';
// los providers re-nacen leyendo el storage recién escrito (mismo contrato del hand-off del
// deep-link, pero SPA).
/** Árbol de providers del motor CAD (Tramos → Project → Apparatus → Plans) montado solo en las rutas que lo usan. Ej: al cambiar de proyecto dispara 'civilflow_proyecto_activo' y re-monta todo con el storage nuevo. */
export function CivilFlowProviders({ children }: { children: ReactNode }) {
  const [gen, setGen] = useState(0);
  useEffect(() => {
    const remontar = () => setGen((g) => g + 1);
    window.addEventListener('civilflow_proyecto_activo', remontar);
    return () => window.removeEventListener('civilflow_proyecto_activo', remontar);
  }, []);
  return (
    <TramosProvider key={gen}>
      <ProjectProvider>
        <ApparatusProvider>
          <PlansProvider>{children}</PlansProvider>
        </ApparatusProvider>
      </ProjectProvider>
    </TramosProvider>
  );
}
