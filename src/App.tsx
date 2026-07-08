import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppProviders } from './context/AppProviders'
import PageTransition from './components/landing/PageTransition'

const Fallback = () => (
  <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite"
    style={{color:'var(--on-surface)'}}>Cargando...</div>
);

// Rutas ligeras - import estatico
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PricingPage from './pages/PricingPage'

import NotFound from './pages/NotFound'

const ProfilePage = React.lazy(() => import('./pages/ProfilePage'))

// Rutas pesadas - lazy
const ViewerPage = React.lazy(() => import('./pages/ViewerPage'))
const DocsPage = React.lazy(() => import('./pages/DocsPage'))
const WorkAreaCivilFlowPage = React.lazy(() => import('./pages/WorkAreaCivilFlowPage'))
const CatalogoMaestroPage = React.lazy(() => import('./pages/CatalogMasterPage'))
const ModulePage = React.lazy(() => import('./pages/ModulePage'))

function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <a href="#app-content" className="skip-link"
          style={{ position: 'absolute', left: '-9999px', zIndex: 9999 }}
          onFocus={(e) => { e.currentTarget.style.left = '16px'; e.currentTarget.style.top = '16px'; }}
          onBlur={(e) => { e.currentTarget.style.left = '-9999px'; }}>
          Saltar al contenido principal
        </a>
        <main id="app-content" className="min-h-screen bg-surface-bg text-on-surface font-sans flex flex-col">
          <PageTransition>
            {(displayLocation) => (
              <Routes location={displayLocation}>
                {/* Rutas públicas ligeras */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/visor" element={<Suspense fallback={<Fallback />}><ViewerPage /></Suspense>} />

                {/* Rutas lazy públicas */}
                <Route path="/docs" element={<Suspense fallback={<Fallback />}><DocsPage /></Suspense>} />
                <Route path="/civilflow" element={<Suspense fallback={<Fallback />}><ModulePage moduleId="flow" /></Suspense>} />
                <Route path="/civilstructure" element={<Suspense fallback={<Fallback />}><ModulePage moduleId="structure" /></Suspense>} />
                <Route path="/civilterrain" element={<Suspense fallback={<Fallback />}><ModulePage moduleId="terrain" /></Suspense>} />
                <Route path="/civilbim" element={<Suspense fallback={<Fallback />}><ModulePage moduleId="bim" /></Suspense>} />
                <Route path="/civilmanage" element={<Suspense fallback={<Fallback />}><ModulePage moduleId="manage" /></Suspense>} />
                <Route path="/civilmep" element={<Suspense fallback={<Fallback />}><ModulePage moduleId="mep" /></Suspense>} />
                <Route path="/civilroads" element={<Suspense fallback={<Fallback />}><ModulePage moduleId="roads" /></Suspense>} />

                {/* Redirects */}
                <Route path="/planos" element={<Navigate to="/civilflowareatrabajo" replace />} />
                <Route path="/dashboard" element={<Navigate to="/civilflowareatrabajo" replace />} />

                {/* Rutas protegidas */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/civilflowareatrabajo" element={<Suspense fallback={<Fallback />}><WorkAreaCivilFlowPage /></Suspense>} />
                    <Route path="/perfil" element={<Suspense fallback={<Fallback />}><ProfilePage /></Suspense>} />
                    <Route path="/catalogomaestro" element={<Suspense fallback={<Fallback />}><CatalogoMaestroPage /></Suspense>} />
                  </Route>
                </Route>

                {/* 404 catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            )}
          </PageTransition>
        </main>
      </ErrorBoundary>
    </AppProviders>
  )
}

export default App
