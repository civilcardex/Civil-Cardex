import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppProviders } from './context/AppProviders'

// Rutas ligeras - import estático
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PricingPage from './pages/PricingPage'
import ViewerPage from './pages/ViewerPage'
import ProfilePage from './pages/ProfilePage'
import NotFound from './pages/NotFound'

// Rutas pesadas - lazy
const DocsPage = React.lazy(() => import('./pages/DocsPage'))
const WorkAreaCivilFlowPage = React.lazy(() => import('./pages/WorkAreaCivilFlowPage'))
const CatalogoMaestroPage = React.lazy(() => import('./pages/CatalogMasterPage'))
const CivilFlowPage = React.lazy(() => import('./pages/CivilFlowPage'))
const CivilStructurePage = React.lazy(() => import('./pages/CivilStructurePage'))
const CivilTerrainPage = React.lazy(() => import('./pages/CivilTerrainPage'))
const CivilBIMPage = React.lazy(() => import('./pages/CivilBIMPage'))
const CivilManagePage = React.lazy(() => import('./pages/CivilManagePage'))
const CivilMEPPage = React.lazy(() => import('./pages/CivilMEPPage'))
const CivilRoadsPage = React.lazy(() => import('./pages/CivilRoadsPage'))

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
        <div id="app-content" className="min-h-screen bg-surface-bg text-on-surface font-sans" role="main">
          <Routes>
            {/* Rutas públicas ligeras */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/visor" element={<ViewerPage />} />

            {/* Rutas lazy públicas */}
            <Route path="/docs" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><DocsPage /></Suspense>} />
            <Route path="/civilflow" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><CivilFlowPage /></Suspense>} />
            <Route path="/civilstructure" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><CivilStructurePage /></Suspense>} />
            <Route path="/civilterrain" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><CivilTerrainPage /></Suspense>} />
            <Route path="/civilbim" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><CivilBIMPage /></Suspense>} />
            <Route path="/civilmanage" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><CivilManagePage /></Suspense>} />
            <Route path="/civilmep" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><CivilMEPPage /></Suspense>} />
            <Route path="/civilroads" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><CivilRoadsPage /></Suspense>} />

            {/* Redirects */}
            <Route path="/planos" element={<Navigate to="/civilflowareatrabajo" replace />} />
            <Route path="/dashboard" element={<Navigate to="/civilflowareatrabajo" replace />} />

            {/* Rutas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/civilflowareatrabajo" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><WorkAreaCivilFlowPage /></Suspense>} />
                <Route path="/perfil" element={<ProfilePage />} />
                <Route path="/catalogomaestro" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{color:'var(--on-surface)'}}>Cargando...</div>}><CatalogoMaestroPage /></Suspense>} />
              </Route>
            </Route>

            {/* 404 catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </AppProviders>
  )
}

export default App
