import { useState } from 'react';
import './styles.css';
import { CivilManagerProvider, useCivilManager } from './context';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { Toast } from './shared/Toast';
import { NavIcon, type NavIconName } from './shared/icons';
import { ColaboradoresTab } from './catalogos/ColaboradoresTab';
import { CuadrillasTab } from './catalogos/CuadrillasTab';
import { EquiposTab } from './catalogos/EquiposTab';
import { InsumosTab } from './catalogos/InsumosTab';
import { ProveedoresTab } from './catalogos/ProveedoresTab';
import { ConfigTab } from './config/ConfigTab';
import { ApuCatalog } from './apu/ApuCatalog';
import { PresupuestosTab } from './presupuestos/PresupuestosTab';
import { ProgramacionStub } from './stubs/ProgramacionStub';
import { ControlCostosStub } from './stubs/ControlCostosStub';
import { ReportesStub } from './stubs/ReportesStub';

type MainSection = 'catalogos' | 'apus' | 'presupuestos' | 'programacion' | 'control_costos' | 'reportes';
type CatalogoTab = 'configuracion' | 'colaboradores' | 'cuadrillas' | 'equipos' | 'insumos' | 'proveedores';

const MAIN_SECTIONS: { id: MainSection; label: string; icon: NavIconName; active: boolean }[] = [
  { id: 'catalogos', label: 'Catálogos', icon: 'catalogos', active: true },
  { id: 'apus', label: 'APUs', icon: 'apus', active: true },
  { id: 'presupuestos', label: 'Presupuestos', icon: 'proyectos', active: true },
  { id: 'programacion', label: 'Programación', icon: 'programacion', active: false },
  { id: 'control_costos', label: 'Control de Costos', icon: 'control_costes', active: false },
  { id: 'reportes', label: 'Reportes', icon: 'reportes', active: false },
];

const CATALOGO_TABS: { id: CatalogoTab; label: string; icon: NavIconName }[] = [
  { id: 'configuracion', label: 'Configuración', icon: 'configuracion' },
  { id: 'colaboradores', label: 'Colaboradores', icon: 'colaboradores' },
  { id: 'cuadrillas', label: 'Cuadrillas', icon: 'cuadrilla' },
  { id: 'equipos', label: 'Equipos', icon: 'equipos' },
  { id: 'insumos', label: 'Insumos', icon: 'insumos' },
  { id: 'proveedores', label: 'Proveedores', icon: 'proveedores' },
];

function CivilManagerShell() {
  const { loaded } = useCivilManager();
  const [mainSection, setMainSection] = useState<MainSection>('catalogos');
  const [catalogoTab, setCatalogoTab] = useState<CatalogoTab>('colaboradores');

  if (!loaded) {
    return (
      <div className="cm-shell">
        <div className="cm-stub" role="status" aria-live="polite">Cargando CivilManager…</div>
      </div>
    );
  }

  return (
    <div className="cm-shell">
      <nav className="cm-nav" aria-label="Secciones de CivilManager">
        {MAIN_SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            className={mainSection === s.id ? 'cm-active' : ''}
            disabled={!s.active}
            onClick={() => setMainSection(s.id)}
            aria-current={mainSection === s.id ? 'true' : undefined}
          >
            <NavIcon name={s.icon} alt="" />
            {s.label}
          </button>
        ))}
      </nav>

      {mainSection === 'catalogos' && (
        <nav className="cm-nav" aria-label="Catálogos">
          {CATALOGO_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={catalogoTab === t.id ? 'cm-active' : ''}
              onClick={() => setCatalogoTab(t.id)}
              aria-current={catalogoTab === t.id ? 'true' : undefined}
            >
              <NavIcon name={t.icon} alt="" />
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <div className="cm-main">
        {mainSection === 'catalogos' && catalogoTab === 'configuracion' && <ConfigTab />}
        {mainSection === 'catalogos' && catalogoTab === 'colaboradores' && <ColaboradoresTab />}
        {mainSection === 'catalogos' && catalogoTab === 'cuadrillas' && <CuadrillasTab />}
        {mainSection === 'catalogos' && catalogoTab === 'equipos' && <EquiposTab />}
        {mainSection === 'catalogos' && catalogoTab === 'insumos' && <InsumosTab />}
        {mainSection === 'catalogos' && catalogoTab === 'proveedores' && <ProveedoresTab />}
        {mainSection === 'apus' && <ApuCatalog />}
        {mainSection === 'presupuestos' && <PresupuestosTab />}
        {mainSection === 'programacion' && <ProgramacionStub />}
        {mainSection === 'control_costos' && <ControlCostosStub />}
        {mainSection === 'reportes' && <ReportesStub />}
      </div>
    </div>
  );
}

export default function WorkAreaCivilManager() {
  return (
    <CivilManagerProvider>
      <CivilManagerShell />
      <Toast />
      <ConfirmDialog />
    </CivilManagerProvider>
  );
}
