import { useState, useEffect } from 'react';
import './styles.css';
import { CivilManagerProvider, useCivilManager } from './context';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { Toast } from './shared/Toast';
import { NavIcon, type NavIconName } from './shared/icons';
import { EditableSection } from './shared/EditLock';
import { ColaboradoresTab } from './catalogs/CollaboratorsTab';
import { CuadrillasTab } from './catalogs/CuadrillasTab';
import { EquiposTab } from './catalogs/EquipmentTab';
import { InsumosTab } from './catalogs/InsumosTab';
import { ProveedoresTab } from './catalogs/SuppliersTab';
import { ConfigTab } from './config/ConfigTab';
import { ApuCatalog } from './apu/ApuCatalog';
import { PresupuestosTab } from './budgets/PresupuestosTab';
import { setAyudaContext } from '../../components/help/helpContext';

type MainSection = 'catalogos' | 'apus' | 'presupuestos';
type CatalogoTab =
  | 'configuracion'
  | 'colaboradores'
  | 'cuadrillas'
  | 'equipment'
  | 'insumos'
  | 'proveedores';

const MAIN_SECTIONS: { id: MainSection; label: string; icon: NavIconName; active: boolean }[] = [
  { id: 'catalogos', label: 'Catálogos', icon: 'catalogos', active: true },
  { id: 'apus', label: 'Análisis de precios unitarios', icon: 'apus', active: true },
  { id: 'presupuestos', label: 'Presupuestos', icon: 'proyectos', active: true },
];

const CATALOGO_TABS: { id: CatalogoTab; label: string; icon: NavIconName }[] = [
  { id: 'configuracion', label: 'Configuración', icon: 'configuracion' },
  { id: 'colaboradores', label: 'Colaboradores', icon: 'colaboradores' },
  { id: 'cuadrillas', label: 'Cuadrillas', icon: 'cuadrilla' },
  { id: 'equipment', label: 'Equipos', icon: 'equipment' },
  { id: 'insumos', label: 'Insumos', icon: 'insumos' },
  { id: 'proveedores', label: 'Proveedores', icon: 'proveedores' },
];

/** Intro de la ayuda contextual por sección (orig. usuario). */
const AYUDA_INTROS_CM: Record<MainSection, string> = {
  catalogos:
    'Bases de datos del proyecto: colaboradores, cuadrillas, equipos, insumos y proveedores que alimentan los análisis de precios.',
  apus: 'Construcción de análisis de precios unitarios: insumos, rendimientos, desperdicios, equipo y estructura AIU.',
  presupuestos:
    'Presupuestos: apus organizados por capítulos con cantidades, subtotales y resumen general.',
};

function CivilManagerShell() {
  const { loaded } = useCivilManager();
  const [mainSection, setMainSection] = useState<MainSection>('catalogos');
  const [catalogoTab, setCatalogoTab] = useState<CatalogoTab>('colaboradores');

  // Ayuda contextual (orig. usuario): sección activa de Civil Manager para el panel de la navbar.
  useEffect(() => {
    const catLabel = CATALOGO_TABS.find((t) => t.id === catalogoTab)?.label || catalogoTab;
    setAyudaContext({
      key: mainSection === 'catalogos' ? `cm:catalogos:${catalogoTab}` : `cm:${mainSection}`,
      modulo: 'Civil Manager',
      seccion:
        mainSection === 'catalogos'
          ? `Catálogos · ${catLabel}`
          : MAIN_SECTIONS.find((s) => s.id === mainSection)?.label || mainSection,
      intro: AYUDA_INTROS_CM[mainSection],
    });
    return () => setAyudaContext(null);
  }, [mainSection, catalogoTab]);

  if (!loaded) {
    return (
      <div className="cm-shell">
        <div className="cm-stub" role="status" aria-live="polite">
          Cargando CivilManager…
        </div>
      </div>
    );
  }

  return (
    <div className="cm-shell">
      <nav className="cm-nav" aria-label="Secciones de CivilManager">
        {MAIN_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={mainSection === s.id ? 'cm-active' : ''}
            disabled={!s.active}
            onClick={() => setMainSection(s.id)}
            aria-current={mainSection === s.id ? 'true' : undefined}
          >
            <NavIcon name={s.icon} size={26} alt="" />
            {s.label}
          </button>
        ))}
      </nav>

      {mainSection === 'catalogos' && (
        <nav className="cm-nav" aria-label="Catálogos">
          {CATALOGO_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={catalogoTab === t.id ? 'cm-active' : ''}
              onClick={() => setCatalogoTab(t.id)}
              aria-current={catalogoTab === t.id ? 'true' : undefined}
            >
              <NavIcon name={t.icon} size={26} alt="" />
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <div className="cm-main">
        {/* Cada pestaña editable se envuelve en EditableSection: botón EDITAR/LISTO arriba a la derecha. */}
        {mainSection === 'catalogos' && catalogoTab === 'configuracion' && (
          <EditableSection>
            <ConfigTab />
          </EditableSection>
        )}
        {mainSection === 'catalogos' && catalogoTab === 'colaboradores' && (
          <EditableSection>
            <ColaboradoresTab />
          </EditableSection>
        )}
        {mainSection === 'catalogos' && catalogoTab === 'cuadrillas' && (
          <EditableSection>
            <CuadrillasTab />
          </EditableSection>
        )}
        {mainSection === 'catalogos' && catalogoTab === 'equipment' && (
          <EditableSection>
            <EquiposTab />
          </EditableSection>
        )}
        {mainSection === 'catalogos' && catalogoTab === 'insumos' && (
          <EditableSection>
            <InsumosTab />
          </EditableSection>
        )}
        {mainSection === 'catalogos' && catalogoTab === 'proveedores' && (
          <EditableSection>
            <ProveedoresTab />
          </EditableSection>
        )}
        {mainSection === 'apus' && (
          <EditableSection>
            <ApuCatalog />
          </EditableSection>
        )}
        {mainSection === 'presupuestos' && (
          <EditableSection>
            <PresupuestosTab />
          </EditableSection>
        )}
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
