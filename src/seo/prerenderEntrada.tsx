import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AuthProvider } from '../context/AutenticacionContexto.tsx';
import LandingPage from '../pages/InicioPagina.tsx';
import PricingPage from '../pages/PreciosPagina.tsx';
import DocsPage from '../modules/civilflow/pages/DocsPagina.tsx';
import ModulePage from '../pages/ModuloPagina.tsx';
import TermsPage from '../pages/TerminosPagina.tsx';
import PrivacyPage from '../pages/PrivacidadPagina.tsx';
import CookiesPage from '../pages/GalletasPagina.tsx';

/** Páginas públicas prerenderizables — las mismas rutas de ROUTE_META (src/seo/rutaMeta.ts).
 *  Import DIRECTO (no lazy): renderToString de un lazy renderiza el fallback vacío. */
const PAGES: Record<string, React.ReactNode> = {
  '/': <LandingPage />,
  '/pricing': <PricingPage />,
  '/docs': <DocsPage />,
  '/civilflow': <ModulePage moduleId="flow" />,
  '/civilstructure': <ModulePage moduleId="structure" />,
  '/civilterrain': <ModulePage moduleId="terrain" />,
  '/civilbim': <ModulePage moduleId="bim" />,
  '/civilmanager': <ModulePage moduleId="manage" />,
  '/civilmep': <ModulePage moduleId="mep" />,
  '/civilroads': <ModulePage moduleId="roads" />,
  '/terminos': <TermsPage />,
  '/privacidad': <PrivacyPage />,
  '/cookies': <CookiesPage />,
};

/** Render SSR de una ruta pública. Sin datos de usuario (AuthProvider arranca sin sesión,
 *  los efectos no corren en renderToString) — el HTML nunca contiene nada user-specific. */
export function renderPage(url: string): string {
  const el = PAGES[url];
  if (!el) return '';
  return renderToString(
    <AuthProvider>
      <StaticRouter location={url}>{el}</StaticRouter>
    </AuthProvider>,
  );
}

// El prerender también lee la tabla de metas desde este mismo bundle.
export { ROUTE_META, SITE_URL } from './rutaMeta.ts';
