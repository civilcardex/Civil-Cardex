import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { GlobalAlertDialogProvider } from './modules/civilflow/components/GlobalAlertDialogProvider';
import { CivilFlowProviders } from './modules/civilflow/context/CivilFlowProviders';
import PageTransition from './components/landing/PageTransition';

const Fallback = () => (
  <div
    className="flex items-center justify-center min-h-screen"
    role="status"
    aria-live="polite"
    style={{ color: 'var(--on-surface)' }}
  >
    Cargando...
  </div>
);

// Rutas ligeras - import estatico
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import PricingPage from './pages/PricingPage';
import RequireModule from './components/subscriptions/RequireModule';

import NotFound from './pages/NotFound';

const ProfilePage = React.lazy(() => import('./pages/auth/ProfilePage'));

// Rutas pesadas - lazy
const ViewerPage = React.lazy(() => import('./modules/civilflow/pages/ViewerPage'));
const DocsPage = React.lazy(() => import('./modules/civilflow/pages/DocsPage'));
const WorkAreaCivilFlowPage = React.lazy(
  () => import('./modules/civilflow/pages/WorkAreaCivilFlowPage'),
);
const WorkAreaCivilManagerPage = React.lazy(() => import('./pages/WorkAreaCivilManagerPage'));
const CatalogoMaestroPage = React.lazy(() => import('./modules/civilflow/pages/CatalogMasterPage'));
const CompanyPage = React.lazy(() => import('./pages/CompanyPage'));
const CompanyPreviewPage = React.lazy(() => import('./pages/CompanyPreviewPage'));
const ModulePage = React.lazy(() => import('./pages/ModulePage'));

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
                  <Route element={<Layout />}>
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
      </GlobalAlertDialogProvider>
    </AuthProvider>
  );
}

export default App;
