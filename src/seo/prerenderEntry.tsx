import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AuthProvider } from '../context/AuthContext';
import LandingPage from '../pages/LandingPage';
import PricingPage from '../pages/PricingPage';
import DocsPage from '../modules/civilflow/pages/DocsPage';
import ModulePage from '../pages/ModulePage';
import TermsPage from '../pages/TermsPage';
import PrivacyPage from '../pages/PrivacyPage';
import CookiesPage from '../pages/CookiesPage';

/** Páginas públicas prerenderizables — las mismas rutas de ROUTE_META (src/seo/routeMeta.ts).
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
export { ROUTE_META, SITE_URL } from './routeMeta';
