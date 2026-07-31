import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppProviders } from './context/AppProviders';
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
import PricingPage from './pages/PricingPage';

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
const ModulePage = React.lazy(() => import('./pages/ModulePage'));

function App() {
  return (
    <AppProviders>
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
                path="/pricing"
                element={
                  <ErrorBoundary>
                    <PricingPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/visor"
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
                path="/civilmanage"
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
              <Route path="/dashboard" element={<Navigate to="/civilflowareatrabajo" replace />} />

              {/* Rutas protegidas */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route
                    path="/civilflowareatrabajo"
                    element={
                      <ErrorBoundary>
                        <CivilFlowProviders>
                          <Suspense fallback={<Fallback />}>
                            <WorkAreaCivilFlowPage />
                          </Suspense>
                        </CivilFlowProviders>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/civilmanageareatrabajo"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<Fallback />}>
                          <WorkAreaCivilManagerPage />
                        </Suspense>
                      </ErrorBoundary>
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
    </AppProviders>
  );
}

export default App;
