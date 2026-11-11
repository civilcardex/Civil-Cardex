import React, { Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import Layout from './layouts/Layout.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { GlobalAlertDialog } from './modules/civilflow/components/GlobalAlertDialog.tsx';
import { CivilFlowProviders } from './modules/civilflow/context/CivilFlowProviders.tsx';
import { CargandoProyecto } from './modules/civilflow/components/shared/LoadingProject';

// Una sola pantalla de carga en toda la app: el Suspense y el gate de datos usan la MISMA pieza
// (CargandoProyecto), así abrir un proyecto no encadena dos pantallas distintas. El texto nombra
// lo que se está abriendo —el visor carga el PDF (planos y redes), el resto un proyecto— y lo
// elige la ruta para que el fallback de React y el preload de index.html digan lo mismo.
const Fallback = () => {
  const { pathname } = useLocation();
  return pathname.startsWith('/dibujoRedes') || pathname.startsWith('/visor') ? (
    <CargandoProyecto texto="Cargando planos y redes…" />
  ) : (
    <CargandoProyecto />
  );
};

// ponytail: Lazy/Guarded son tipos DISTINCTOS en la misma posición de ruta — navegar entre
// una ruta estática y una lazy REMONTA la frontera de error (limpia hasError). Intencional:
// el comportamiento original reutilizaba la instancia y arrastraba el estado de error entre
// rutas hasta pulsar Reintentar.
/** Envoltura de ruta ESTÁTICA (import directo): solo frontera de error, sin Suspense.
 *  Ej: / -> <Lazy><LandingPage /></Lazy>. */
function Lazy({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

/** Envoltura de ruta LAZY: frontera de error + Suspense con el fallback único.
 *  Ej: /docs -> <Guarded><DocsPage /></Guarded>. */
function Guarded({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

// Rutas ligeras - import estatico
import LandingPage from './pages/LandingPage.tsx';
import LoginPage from './pages/auth/LoginPage.tsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.tsx';
import TermsPage from './pages/TermsPage.tsx';
import PrivacyPage from './pages/PrivacyPage.tsx';
import CookiesPage from './pages/CookiesPage.tsx';
import CookieBanner from './components/CookieBanner.tsx';
import PricingPage from './pages/PricingPage.tsx';
import RequireModule from './components/subscriptions/RequireModule.tsx';

import NotFound from './pages/NotFound.tsx';

const ProfilePage = React.lazy(() => import('./pages/auth/ProfilePage.tsx'));

// Rutas pesadas - lazy
const ViewerPage = React.lazy(() => import('./modules/civilflow/pages/ViewerPage.tsx'));
const DocsPage = React.lazy(() => import('./modules/civilflow/pages/DocsPage.tsx'));
const HunterNtc1500Page = React.lazy(() => import('./pages/learn/HunterNtc1500Page.tsx'));
const SanTractiveForcePage = React.lazy(() => import('./pages/learn/SanTractiveForcePage.tsx'));
const LearnIndexPage = React.lazy(() => import('./pages/learn/LearnIndexPage.tsx'));
const WorkAreaCivilFlowPage = React.lazy(
  () => import('./modules/civilflow/pages/WorkAreaCivilFlowPage.tsx'),
);
const WorkAreaCivilManagerPage = React.lazy(() => import('./pages/WorkAreaCivilManagerPage.tsx'));
const CatalogoMaestroPage = React.lazy(
  () => import('./modules/civilflow/pages/CatalogMasterPage.tsx'),
);
const CompanyPage = React.lazy(() => import('./pages/CompanyPage.tsx'));
const ModulePage = React.lazy(() => import('./pages/ModulePage.tsx'));

/** Sube al inicio SOLO en navegación nueva (PUSH/REPLACE, sin él /pricing heredaba la posición
 *  de la landing). En atrás/adelante (POP) el navegador ya restaura la posición y forzarla al
 *  tope la perdía.
 *  Ej: landing → /pricing sube; Atrás vuelve a la landing donde estabas. */
function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, navType]);
  return null;
}

/** Tabla de rutas de toda la app: públicas estáticas, privadas lazy tras ProtectedRoute + ErrorBoundary por ruta y áreas gated por RequireModule. Ej: /civilflowareatrabajo exige sesión y asiento de 'flow'. */
function App() {
  return (
    <AuthProvider>
      <GlobalAlertDialog />
      <ScrollToTop />
      <a
        href="#app-content"
        className="skip-link"
        style={{ position: 'absolute', left: '-9999px', zIndex: 9999 }}
        onFocus={(e) => {
          e.currentTarget.style.left = '16px';
          e.currentTarget.style.top = '16px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
        }}
      >
        Saltar al contenido principal
      </a>
      <div
        id="app-content"
        className="min-h-screen bg-surface-bg text-on-surface font-sans flex flex-col"
      >
        {/* page-fade: el fade corre al montar (sin key por pathname — la remontaba el redirect cosmético). */}
        <div className="page-fade">
          <Routes>
            {/* Rutas públicas ligeras */}
            <Route
              path="/"
              element={
                <Lazy>
                  <LandingPage />
                </Lazy>
              }
            />
            {/* Rutas ligeras (import directo + Lazy: frontera de error sin Suspense) */}
            {(
              [
                ['/login', LoginPage],
                ['/register', RegisterPage],
                ['/restablecer', ResetPasswordPage],
                ['/terminos', TermsPage],
                ['/privacidad', PrivacyPage],
                ['/cookies', CookiesPage],
                ['/pricing', PricingPage],
              ] as const
            ).map(([path, Pagina]) => (
              <Route
                key={path}
                path={path}
                element={
                  <Lazy>
                    <Pagina />
                  </Lazy>
                }
              />
            ))}
            <Route
              path="/dibujoRedes/:proyectoId?"
              element={
                <ErrorBoundary>
                  <CivilFlowProviders>
                    <Suspense fallback={<Fallback />}>
                      <ViewerPage />
                    </Suspense>
                  </CivilFlowProviders>
                </ErrorBoundary>
              }
            />

            {/* Rutas lazy públicas (envoltura idéntica → mapa; las de envoltura distinta van aparte) */}
            <Route
              path="/docs"
              element={
                <Guarded>
                  <DocsPage />
                </Guarded>
              }
            />
            {(
              [
                ['/civilflow', 'flow'],
                ['/civilstructure', 'structure'],
                ['/civilterrain', 'terrain'],
                ['/civilmanager', 'manage'],
                ['/civilroads', 'roads'],
              ] as const
            ).map(([path, modulo]) => (
              <Route
                key={path}
                path={path}
                element={
                  <Guarded>
                    <ModulePage moduleId={modulo} />
                  </Guarded>
                }
              />
            ))}
            {(
              [
                ['/aprende', LearnIndexPage],
                ['/aprende/hunter-ntc-1500', HunterNtc1500Page],
                ['/aprende/fuerza-tractiva-sanitaria', SanTractiveForcePage],
              ] as const
            ).map(([path, Pagina]) => (
              <Route
                key={path}
                path={path}
                element={
                  <Guarded>
                    <Pagina />
                  </Guarded>
                }
              />
            ))}

            {/* Redirects */}
            <Route path="/visor/*" element={<Navigate to="/dibujoRedes" replace />} />
            <Route path="/planos" element={<Navigate to="/civilflowareatrabajo" replace />} />
            <Route path="/dashboard" element={<Navigate to="/civilflowareatrabajo" replace />} />

            {/* Rutas protegidas */}
            <Route element={<ProtectedRoute />}>
              {/* El Layout (con su Navbar) va DENTRO de una frontera: las fronteras de las
                      rutas hijas solo cubren su `element`, así que una excepción en el Navbar
                      desmontaba el árbol entero -> pantalla en blanco sin "Reintentar". */}
              <Route
                element={
                  <ErrorBoundary>
                    <Layout />
                  </ErrorBoundary>
                }
              >
                <Route
                  path="/civilflowareatrabajo/*"
                  element={
                    <RequireModule modulo="flow">
                      <ErrorBoundary>
                        <CivilFlowProviders>
                          <Suspense fallback={<Fallback />}>
                            <WorkAreaCivilFlowPage />
                          </Suspense>
                        </CivilFlowProviders>
                      </ErrorBoundary>
                    </RequireModule>
                  }
                />
                <Route
                  path="/civilmanagerareatrabajo/*"
                  element={
                    <RequireModule modulo="manage">
                      <Guarded>
                        <WorkAreaCivilManagerPage />
                      </Guarded>
                    </RequireModule>
                  }
                />
                <Route
                  path="/perfil"
                  element={
                    <Guarded>
                      <ProfilePage />
                    </Guarded>
                  }
                />
                <Route
                  path="/empresa"
                  element={
                    <Guarded>
                      <CompanyPage />
                    </Guarded>
                  }
                />
                <Route
                  path="/catalogomaestro"
                  element={
                    <Guarded>
                      <CatalogoMaestroPage />
                    </Guarded>
                  }
                />
              </Route>
            </Route>

            {/* 404 catch-all */}
            <Route
              path="*"
              element={
                <Lazy>
                  <NotFound />
                </Lazy>
              }
            />
          </Routes>
        </div>
      </div>
      {/* Consentimiento de cookies: visible en toda la app hasta decidir. */}
      <CookieBanner />
    </AuthProvider>
  );
}

export default App;
