import { useState, useEffect } from 'react';
import './styles.css';
import { CivilManagerProvider, useCivilManager } from './context.tsx';
import { ConfirmDialog } from './shared/ConfirmDialog.tsx';
import { Toast } from './shared/Toast.tsx';
import { NavIcon, type NavIconName } from './shared/icons.tsx';
import { EditableSection } from './shared/EditLock.tsx';

import { ColaboradoresTab } from './catalogs/CollaboratorsTab.tsx';
import { CuadrillasTab } from './catalogs/CrewsTab.tsx';
import { EquiposTab } from './catalogs/EquipmentTab.tsx';
import { InsumosTab } from './catalogs/InsumosTab.tsx';
import { ProveedoresTab } from './catalogs/SuppliersTab.tsx';
import { ConfigTab } from './config/ConfigTab.tsx';
import { ApuCatalog } from './apu/ApuCatalog.tsx';
import { PresupuestosTab } from './budgets/BudgetsTab.tsx';
import { setAyudaContext } from '../../components/help/helpContext.ts';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CM_CATALOGOS,
  CM_SECCIONES,
  parseManagerSplat,
  rutaManager,
} from '../../modules/civilflow/components/workarea/tabRoute.ts';
import { useTour } from '../../components/tour/useTour.tsx';

type MainSection = 'catalogos' | 'apus' | 'presupuestos';
type CatalogoTab =
  'configuracion' | 'colaboradores' | 'cuadrillas' | 'equipos' | 'insumos' | 'proveedores';

const MAIN_SECTIONS: { id: MainSection; label: string; icon: NavIconName; active: boolean }[] = [
  { id: 'catalogos', label: 'Catálogos', icon: 'catalogos', active: true },
  { id: 'apus', label: 'Análisis de precios unitarios', icon: 'apus', active: true },
  { id: 'presupuestos', label: 'Presupuestos', icon: 'proyectos', active: true },
];

const CATALOGO_TABS: { id: CatalogoTab; label: string; icon: NavIconName }[] = [
  { id: 'configuracion', label: 'Configuración', icon: 'configuracion' },
  { id: 'colaboradores', label: 'Colaboradores', icon: 'colaboradores' },
  { id: 'cuadrillas', label: 'Cuadrillas', icon: 'cuadrilla' },
  { id: 'equipos', label: 'Equipos', icon: 'equipos' },
  { id: 'insumos', label: 'Insumos', icon: 'insumos' },
  { id: 'proveedores', label: 'Proveedores', icon: 'proveedores' },
];

/** Intro de la ayuda contextual por sección (pedido del cliente). */
const AYUDA_INTROS_CM: Record<MainSection, string> = {
  catalogos:
    'Bases de datos del proyecto: colaboradores, cuadrillas, equipos, insumos y proveedores que alimentan los análisis de precios.',
  apus: 'Construcción de análisis de precios unitarios: insumos, rendimientos, desperdicios, equipo y estructura AIU.',
  presupuestos:
    'Presupuestos: apus organizados por capítulos con cantidades, subtotales y resumen general.',
};

function CivilManagerShell() {
  const { loaded } = useCivilManager();
  const navigate = useNavigate();
  const { '*': splat } = useParams<{ '*': string }>();
  const url = parseManagerSplat(splat);
  const [mainSection, setMainSectionState] = useState<MainSection>(
    url.seccion && CM_SECCIONES.includes(url.seccion) ? (url.seccion as MainSection) : 'catalogos',
  );
  const [catalogoTab, setCatalogoTabState] = useState<CatalogoTab>(
    url.catalogoTab && CM_CATALOGOS.includes(url.catalogoTab)
      ? (url.catalogoTab as CatalogoTab)
      : 'colaboradores',
  );
  // La URL es la verdad: setters delegan en navigate (back/adelante funcionan).
  const setMainSection = (id: MainSection): void => {
    setMainSectionState(id);
    navigate(rutaManager(url.proyectoId, id, url.catalogoTab));
  };
  const setCatalogoTab = (id: CatalogoTab): void => {
    setCatalogoTabState(id);
    navigate(rutaManager(url.proyectoId, mainSection, id));
  };

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

  // Hook ANTES del early return (reglas-de-hooks); `loaded` lo pospone hasta el shell real.
  // Tour por SECCIÓN/SUB-SECCIÓN (ped. usuario): Catálogos tiene uno por cada catálogo.
  const tour = useTour(
    mainSection === 'catalogos' ? `cm:catalogos:${catalogoTab}` : `cm:${mainSection}`,
    loaded,
  );
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
      {tour}
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

      {/* Contenedor del ciclo de pestañas. NOTA: cada pestaña se auto-envuelve en su
          PROPIO EditableSection y ese provider (el más cercano) es el que gobierna su
          useEditable — este wrapper del shell es contenedor/estética. key por pestaña
          remonta y resetea el estado EDITAR/LISTO. dim={false}: la opacidad la maneja
          cada tabla con DimEnLectura.
          ⚠️ Si algún useEditable() futuro vive FUERA del provider de una pestaña,
          resolverá editing=false SIN botón EDITAR que lo libere — el shell no pinta
          toggle. */}
      <div className="cm-main">
        <EditableSection key={mainSection + ':' + catalogoTab} dim={false}>
          {mainSection === 'catalogos' && catalogoTab === 'configuracion' && <ConfigTab />}
          {mainSection === 'catalogos' && catalogoTab === 'colaboradores' && <ColaboradoresTab />}
          {mainSection === 'catalogos' && catalogoTab === 'cuadrillas' && <CuadrillasTab />}
          {mainSection === 'catalogos' && catalogoTab === 'equipos' && <EquiposTab />}
          {mainSection === 'catalogos' && catalogoTab === 'insumos' && <InsumosTab />}
          {mainSection === 'catalogos' && catalogoTab === 'proveedores' && <ProveedoresTab />}
          {mainSection === 'apus' && <ApuCatalog />}
          {mainSection === 'presupuestos' && <PresupuestosTab />}
        </EditableSection>
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
