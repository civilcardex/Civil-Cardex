import React, { Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import Layout from './layouts/Layout.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { GlobalAlertDialogProvider } from './modules/civilflow/components/GlobalAlertDialogProvider.tsx';
import { CivilFlowProviders } from './modules/civilflow/context/CivilFlowProviders.tsx';
import { CargandoProyecto } from './modules/civilflow/components/shared/LoadingProject';
import PageTransition from './components/landing/PageTransition.tsx';

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
      <GlobalAlertDialogProvider>
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
          <PageTransition>
            {(displayLocation) => (
              <Routes location={displayLocation}>
                {/* Rutas públicas ligeras */}
                <Route
                  path="/"
                  element={
                    <Lazy>
                      <LandingPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/login"
                  element={
                    <Lazy>
                      <LoginPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <Lazy>
                      <RegisterPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/restablecer"
                  element={
                    <Lazy>
                      <ResetPasswordPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/terminos"
                  element={
                    <Lazy>
                      <TermsPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/privacidad"
                  element={
                    <Lazy>
                      <PrivacyPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/cookies"
                  element={
                    <Lazy>
                      <CookiesPage />
                    </Lazy>
                  }
                />
                <Route
                  path="/pricing"
                  element={
                    <Lazy>
                      <PricingPage />
                    </Lazy>
                  }
                />
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

                {/* Rutas lazy públicas */}
                <Route
                  path="/docs"
                  element={
                    <Guarded>
                      <DocsPage />
                    </Guarded>
                  }
                />
                <Route
                  path="/civilflow"
                  element={
                    <Guarded>
                      <ModulePage moduleId="flow" />
                    </Guarded>
                  }
                />
                <Route
                  path="/civilstructure"
                  element={
                    <Guarded>
                      <ModulePage moduleId="structure" />
                    </Guarded>
                  }
                />
                <Route
                  path="/civilterrain"
                  element={
                    <Guarded>
                      <ModulePage moduleId="terrain" />
                    </Guarded>
                  }
                />
                <Route
                  path="/civilmanager"
                  element={
                    <Guarded>
                      <ModulePage moduleId="manage" />
                    </Guarded>
                  }
                />
                <Route
                  path="/civilroads"
                  element={
                    <Guarded>
                      <ModulePage moduleId="roads" />
                    </Guarded>
                  }
                />

                {/* Redirects */}
                <Route path="/visor/*" element={<Navigate to="/dibujoRedes" replace />} />
                <Route path="/planos" element={<Navigate to="/civilflowareatrabajo" replace />} />
                <Route
                  path="/dashboard"
                  element={<Navigate to="/civilflowareatrabajo" replace />}
                />

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
            )}
          </PageTransition>
        </div>
        {/* Consentimiento de cookies: visible en toda la app hasta decidir. */}
        <CookieBanner />
      </GlobalAlertDialogProvider>
    </AuthProvider>
  );
}

export default App;
