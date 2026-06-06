import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'

// Rutas ligeras - import estático
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PricingPage from './pages/PricingPage'
import ViewerPage from './pages/ViewerPage'
import ProfilePage from './pages/ProfilePage'
import { PlanosProvider } from './context/PlansContext'
import { TramosProvider } from './context/TramosContext'
import { ProjectProvider } from './context/ProjectContext'
import { ApparatusProvider } from './context/ApparatusContext'
import { RainwaterProvider } from './context/RainwaterContext'

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

function Cargando() {
  return <div className="flex items-center justify-center min-h-screen" style={{ color: 'var(--on-surface)' }}>Cargando...</div>
}

function App() {
  return (
    <TramosProvider>
      <ProjectProvider>
        <ApparatusProvider>
          <RainwaterProvider>
        <PlanosProvider>
          <ErrorBoundary>
          <div className="min-h-screen bg-surface-bg text-on-surface font-sans">
            <Routes>
              {/* Rutas públicas ligeras */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/visor" element={<ViewerPage />} />

              {/* Rutas lazy públicas */}
              <Route path="/docs" element={<Suspense fallback={<Cargando />}><DocsPage /></Suspense>} />
              <Route path="/civilflow" element={<Suspense fallback={<Cargando />}><CivilFlowPage /></Suspense>} />
              <Route path="/civilstructure" element={<Suspense fallback={<Cargando />}><CivilStructurePage /></Suspense>} />
              <Route path="/civilterrain" element={<Suspense fallback={<Cargando />}><CivilTerrainPage /></Suspense>} />
              <Route path="/civilbim" element={<Suspense fallback={<Cargando />}><CivilBIMPage /></Suspense>} />
              <Route path="/civilmanage" element={<Suspense fallback={<Cargando />}><CivilManagePage /></Suspense>} />
              <Route path="/civilmep" element={<Suspense fallback={<Cargando />}><CivilMEPPage /></Suspense>} />
              <Route path="/civilroads" element={<Suspense fallback={<Cargando />}><CivilRoadsPage /></Suspense>} />

              {/* Redirects */}
              <Route path="/planos" element={<Navigate to="/civilflowareatrabajo" replace />} />
              <Route path="/dashboard" element={<Navigate to="/civilflowareatrabajo" replace />} />

              {/* Rutas protegidas */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/civilflowareatrabajo" element={<Suspense fallback={<Cargando />}><WorkAreaCivilFlowPage /></Suspense>} />
                  <Route path="/perfil" element={<ProfilePage />} />
                  <Route path="/catalogomaestro" element={<Suspense fallback={<Cargando />}><CatalogoMaestroPage /></Suspense>} />
                </Route>
              </Route>
            </Routes>
          </div>
        </ErrorBoundary>
      </PlanosProvider>
          </RainwaterProvider>
        </ApparatusProvider>
      </ProjectProvider>
    </TramosProvider>
  )
}

export default App
