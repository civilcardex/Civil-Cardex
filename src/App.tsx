import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './layouts/Disposicion.tsx';
import { ErrorBoundary } from './components/ErrorLimite.tsx';
import { ProtectedRoute } from './components/ProtectedRuta.tsx';
import { AuthProvider } from './context/AutenticacionContexto.tsx';
import { GlobalAlertDialogProvider } from './modules/civilflow/components/GlobalAlertaDialogoProveedor.tsx';
import { CivilFlowProviders } from './modules/civilflow/context/CivilFlujoProviders.tsx';
import { CargandoProyecto } from './modules/civilflow/components/shared/CargandoProyecto';
import PageTransition from './components/landing/PaginaTransicion.tsx';

// Una sola pantalla de carga en toda la app: el Suspense y el gate de datos usan la MISMA pieza
// (CargandoProyecto), así abrir un proyecto no encadena dos pantallas distintas. El texto nombra
// lo que se está abriendo —el visor carga el PDF (planos y redes), el resto un proyecto— y lo
// elige la ruta para que el fallback de React y el preload de index.html digan lo mismo.
const Fallback = () => {
  const { pathname } = useLocation();
  return pathname.startsWith('/visor') ? (
    <CargandoProyecto texto="Cargando planos y redes…" />
  ) : (
    <CargandoProyecto />
  );
};

// Rutas ligeras - import estatico
import LandingPage from './pages/InicioPagina.tsx';
import LoginPage from './pages/auth/IngresarPagina.tsx';
import RegisterPage from './pages/auth/RegistroPagina.tsx';
import ResetPasswordPage from './pages/auth/ReiniciaContrasenaPagina.tsx';
import TermsPage from './pages/TerminosPagina.tsx';
import PrivacyPage from './pages/PrivacidadPagina.tsx';
import CookiesPage from './pages/GalletasPagina.tsx';
import CookieBanner from './components/GalletaBanner.tsx';
import PricingPage from './pages/PreciosPagina.tsx';
import RequireModule from './components/subscriptions/RequireModulo.tsx';

import NotFound from './pages/NotEncontrado.tsx';

const ProfilePage = React.lazy(() => import('./pages/auth/PerfilPagina.tsx'));

// Rutas pesadas - lazy
const ViewerPage = React.lazy(() => import('./modules/civilflow/pages/ViewerPagina.tsx'));
const DocsPage = React.lazy(() => import('./modules/civilflow/pages/DocsPagina.tsx'));
const WorkAreaCivilFlowPage = React.lazy(
  () => import('./modules/civilflow/pages/TrabajoAreaCivilFlujoPagina.tsx'),
);
const WorkAreaCivilManagerPage = React.lazy(
  () => import('./pages/TrabajoAreaCivilGestorPagina.tsx'),
);
const CatalogoMaestroPage = React.lazy(
  () => import('./modules/civilflow/pages/CatalogoMasterPagina.tsx'),
);
const CompanyPage = React.lazy(() => import('./pages/EmpresaPagina.tsx'));
const CompanyPreviewPage = React.lazy(() => import('./pages/EmpresaVistaPreviaPagina.tsx'));
const ModulePage = React.lazy(() => import('./pages/ModuloPagina.tsx'));

function App() {
  return (
    <AuthProvider>
      <GlobalAlertDialogProvider>
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
                    <ErrorBoundary>
                      <LandingPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/login"
                  element={
                    <ErrorBoundary>
                      <LoginPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <ErrorBoundary>
                      <RegisterPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/restablecer"
                  element={
                    <ErrorBoundary>
                      <ResetPasswordPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/terminos"
                  element={
                    <ErrorBoundary>
                      <TermsPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/privacidad"
                  element={
                    <ErrorBoundary>
                      <PrivacyPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/cookies"
                  element={
                    <ErrorBoundary>
                      <CookiesPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/pricing"
                  element={
                    <ErrorBoundary>
                      <PricingPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/visor/:proyectoId?"
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
                    <ErrorBoundary>
                      <Suspense fallback={<Fallback />}>
                        <DocsPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/civilflow"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<Fallback />}>
                        <ModulePage moduleId="flow" />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/civilstructure"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<Fallback />}>
                        <ModulePage moduleId="structure" />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/civilterrain"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<Fallback />}>
                        <ModulePage moduleId="terrain" />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/civilbim"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<Fallback />}>
                        <ModulePage moduleId="bim" />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/civilmanager"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<Fallback />}>
                        <ModulePage moduleId="manage" />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/civilmep"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<Fallback />}>
                        <ModulePage moduleId="mep" />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/civilroads"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<Fallback />}>
                        <ModulePage moduleId="roads" />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />

                {/* Redirects */}
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
                      path="/civilflowareatrabajo/:proyectoId?"
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
                      path="/civilmanagerareatrabajo/:proyectoId?"
                      element={
                        <RequireModule modulo="manage">
                          <ErrorBoundary>
                            <Suspense fallback={<Fallback />}>
                              <WorkAreaCivilManagerPage />
                            </Suspense>
                          </ErrorBoundary>
                        </RequireModule>
                      }
                    />
                    <Route
                      path="/perfil"
                      element={
                        <ErrorBoundary>
                          <Suspense fallback={<Fallback />}>
                            <ProfilePage />
                          </Suspense>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/empresa"
                      element={
                        <ErrorBoundary>
                          <Suspense fallback={<Fallback />}>
                            <CompanyPage />
                          </Suspense>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/catalogomaestro"
                      element={
                        <ErrorBoundary>
                          <Suspense fallback={<Fallback />}>
                            <CatalogoMaestroPage />
                          </Suspense>
                        </ErrorBoundary>
                      }
                    />
                  </Route>
                </Route>

                {/* SOLO DESARROLLO: preview de /empresa con datos falsos (borrar) — fuera del bundle de prod la ruta cae al 404 */}
                {import.meta.env.DEV && (
                  <Route
                    path="/empresa-preview"
                    element={
                      <Suspense fallback={<Fallback />}>
                        <CompanyPreviewPage />
                      </Suspense>
                    }
                  />
                )}

                {/* 404 catch-all */}
                <Route
                  path="*"
                  element={
                    <ErrorBoundary>
                      <NotFound />
                    </ErrorBoundary>
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
