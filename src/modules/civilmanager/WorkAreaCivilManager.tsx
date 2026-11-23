import { useEffect, useRef } from 'react';
import './styles.css';
import { CivilManagerProvider, useCivilManager } from './context.tsx';
import { ConfirmDialog } from './shared/ConfirmDialog.tsx';
import { Toast } from './shared/Toast.tsx';
import { NavIcon, type NavIconName } from './shared/icons.tsx';
import { EditableSection } from './shared/EditLock.tsx';

import { ColaboradoresTab } from './catalogs/CollaboratorsTab.tsx';
import { CuadrillasTab } from './catalogs/CrewsTab.tsx';
import { EquiposTab } from './catalogs/EquipmentTab.tsx';
import { InsumosTab } from './catalogs/SuppliesTab.tsx';
import { ProveedoresTab } from './catalogs/SuppliersTab.tsx';
import { ConfigTab } from './config/ConfigTab.tsx';
import { ApuCatalog } from './apu/ApuCatalog.tsx';
import { PresupuestosTab } from './budgets/BudgetsTab.tsx';
import { setAyudaContext } from '../../components/help/helpContext.ts';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

const MAIN_SECTIONS: { id: MainSection; label: string; icon: NavIconName }[] = [
  { id: 'catalogos', label: 'Catálogos', icon: 'catalogos' },
  { id: 'apus', label: 'Análisis de precios unitarios', icon: 'apus' },
  { id: 'presupuestos', label: 'Presupuestos', icon: 'proyectos' },
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
  const {
    loaded,
    loadError,
    conflictoBorrador,
    resolverConflicto,
    avisoLegado,
    descartarAvisoLegado,
  } = useCivilManager();
  const navigate = useNavigate();
  const { '*': splat } = useParams<{ '*': string }>();
  const url = parseManagerSplat(splat);
  const mainSection: MainSection =
    url.seccion && CM_SECCIONES.includes(url.seccion) ? (url.seccion as MainSection) : 'catalogos';
  const catalogoTab: CatalogoTab =
    url.catalogoTab && CM_CATALOGOS.includes(url.catalogoTab)
      ? (url.catalogoTab as CatalogoTab)
      : 'colaboradores';
  const sectionNav = useRef<HTMLElement>(null);
  const catalogNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const bars = [sectionNav.current, catalogNav.current].filter((nav) => nav !== null);
    function revealActive(nav: HTMLElement) {
      const current = nav.querySelector('[aria-current="true"]');
      if (!current) return;
      const visible = nav.getBoundingClientRect();
      const item = current.getBoundingClientRect();
      if (item.left < visible.left) nav.scrollLeft += item.left - visible.left;
      else if (item.right > visible.right) nav.scrollLeft += item.right - visible.right;
    }
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => bars.forEach(revealActive));
    bars.forEach((nav) => {
      revealActive(nav);
      observer?.observe(nav);
    });
    return () => observer?.disconnect();
  }, [loaded, mainSection, catalogoTab]);
  // La URL es la verdad: setters delegan en navigate (back/adelante funcionan).
  const setMainSection = (id: MainSection): void => {
    navigate(rutaManager(url.proyectoId, id, url.catalogoTab));
  };
  const setCatalogoTab = (id: CatalogoTab): void => {
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
    loaded && !loadError,
  );
  if (loadError) {
    return (
      <div className="cm-stub">
        <p role="alert">No se pudo abrir CivilManager. {loadError}</p>
        <button type="button" className="cm-btn" onClick={() => window.location.reload()}>
          Reintentar
        </button>{' '}
        <Link to="/perfil">Volver al perfil</Link>
      </div>
    );
  }
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
      {/* Banner de conflicto de versiones (H-02): el borrador pendiente ganó al cargar y cada
       *  guardado vuelve a chocar — aquí el usuario ELIGE qué versión manda. Nada se pierde:
       *  'nube' archiva el borrador bajo clave de rescate en IDB. */}
      {conflictoBorrador ? (
        <div className="cm-conflicto" role="alert">
          <p>
            Otro dispositivo guardó una versión más reciente de este proyecto. Tu borrador está a
            salvo en este navegador: elige qué versión manda.
          </p>
          <div className="cm-conflicto-acciones">
            <button
              type="button"
              className="cm-btn cm-btn-primary"
              onClick={() => void resolverConflicto('borrador')}
            >
              Subir mi borrador (reemplaza la nube)
            </button>
            <button type="button" className="cm-btn" onClick={() => void resolverConflicto('nube')}>
              Usar la versión de la nube (archiva mi borrador)
            </button>
          </div>
        </div>
      ) : null}
      {/* Respaldo legado detectado (H-08): aviso informativo, el registro IDB no se toca. */}
      {avisoLegado && !conflictoBorrador ? (
        <div className="cm-conflicto" role="status">
          <p>
            Hay un respaldo anterior de CivilManager en este navegador (creado sin proyecto activo).
            No se borró: sigue el procedimiento de recuperación en docs/save-rollout.md antes de
            eliminar datos del navegador.
          </p>
          <div className="cm-conflicto-acciones">
            <button type="button" className="cm-btn" onClick={descartarAvisoLegado}>
              Entendido
            </button>
          </div>
        </div>
      ) : null}
      <nav ref={sectionNav} className="cm-nav" aria-label="Secciones de CivilManager">
        {MAIN_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={mainSection === s.id ? 'cm-active' : ''}
            onClick={() => setMainSection(s.id)}
            aria-current={mainSection === s.id ? 'true' : undefined}
          >
            <NavIcon name={s.icon} size={26} alt="" />
            {s.label}
          </button>
        ))}
      </nav>

      {mainSection === 'catalogos' && (
        <nav ref={catalogNav} className="cm-nav" aria-label="Catálogos">
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

/** Shell del área de trabajo CM (Civil Manager): sidebar de secciones (catálogos, APU (Análisis de Precios Unitarios), presupuestos) con navegación por URL y sincronía de contexto de ayuda/tour. Ej: /civilmanagerareatrabajo/catalogos/insumos abre esa tab. */
export default function WorkAreaCivilManager() {
  return (
    <CivilManagerProvider>
      <CivilManagerShell />
      <Toast />
      <ConfirmDialog />
    </CivilManagerProvider>
  );
}
