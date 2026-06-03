import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import WorkAreaCivilFlowPage from './pages/WorkAreaCivilFlowPage'
import ProfilePage from './pages/ProfilePage'
import DocsPage from './pages/DocsPage'
import PricingPage from './pages/PricingPage'
import ViewerPage from './pages/ViewerPage'
import CivilFlowPage from './pages/CivilFlowPage'
import CivilStructurePage from './pages/CivilStructurePage'
import CivilTerrainPage from './pages/CivilTerrainPage'
import CivilBIMPage from './pages/CivilBIMPage'
import CivilManagePage from './pages/CivilManagePage'
import CivilMEPPage from './pages/CivilMEPPage'
import CivilRoadsPage from './pages/CivilRoadsPage'
import CatalogoMaestroPage from './pages/CatalogMasterPage'
import { PlanosProvider } from './context/PlanosContext'
import { SanitarioProvider } from './context/SanitarioContext'

function App() {
  return (
    <SanitarioProvider>
      <PlanosProvider>
        <div className="min-h-screen bg-surface-bg text-on-surface font-sans">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/planos" element={<Navigate to="/civilflowareatrabajo" replace />} />
            <Route path="/visor" element={<ViewerPage />} />
            <Route path="/civilflow" element={<CivilFlowPage />} />
            <Route path="/civilstructure" element={<CivilStructurePage />} />
            <Route path="/civilterrain" element={<CivilTerrainPage />} />
            <Route path="/civilbim" element={<CivilBIMPage />} />
            <Route path="/civilmanage" element={<CivilManagePage />} />
            <Route path="/civilmep" element={<CivilMEPPage />} />
            <Route path="/civilroads" element={<CivilRoadsPage />} />
            <Route element={<Layout />}>
              <Route path="/civilflowareatrabajo" element={<WorkAreaCivilFlowPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/catalogomaestro" element={<CatalogoMaestroPage />} />
            </Route>
            <Route path="/dashboard" element={<Navigate to="/civilflowareatrabajo" replace />} />
          </Routes>
        </div>
      </PlanosProvider>
    </SanitarioProvider>
  )
}

export default App
