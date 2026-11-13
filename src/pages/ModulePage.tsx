import { useState, type ComponentType } from 'react';
import ModulePageLayout from '../components/ModulePageLayout.tsx';
import FlowHero from '../modules/civilflow/components/modulePage/FlowHero.tsx';
import ManageHero from '../components/modulePage/ManageHero.tsx';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { metaDeRuta } from '../seo/routeMeta.ts';
import { MODULES_DATA } from './moduleData.ts';
import ProjectCreateDialog from '../modules/civilflow/components/shared/ProjectCreateDialog.tsx';
import ProjectCreateDialogCM from '../modules/civilmanager/components/shared/ProjectCreateDialogCM.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Link, useNavigate } from 'react-router-dom';
import { useSuscripciones } from '../hooks/useSubscriptions.ts';

interface ModulePageProps {
  moduleId: 'flow' | 'structure' | 'terrain' | 'manage' | 'roads';
}

interface HeroProps {
  cfg: NonNullable<(typeof MODULES_DATA)[keyof typeof MODULES_DATA]>;
  onCtaClick?: () => void;
}

const HERO_BY_LAYOUT: Record<string, ComponentType<HeroProps>> = {
  flow: FlowHero,
  manage: ManageHero,
};

// Columnas de la tabla de especificaciones (orden fijo, espejo de Spec en moduleData).
const SPECS_COLS = [
  'Parámetro',
  'Red Hidráulica',
  'Saneamiento',
  'Red de Gas',
  'Ventilación',
  'Contra Incendio',
];

/** Página pública de cada módulo (hero + features + specs + normas + CTA "Nuevo proyecto" con gating de suscripción). Ej: /civilflow pinta MODULES_DATA.flow con FlowHero. */
export default function ModulePage({ moduleId }: ModulePageProps) {
  const cfg = MODULES_DATA[moduleId];
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activos, bloqueando } = useSuscripciones();
  // Seat-aware: activos = filas propias ∪ puestos de empresa (mis_accesos).
  const tieneModulo = (id: 'flow' | 'manage') => activos.has(id);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateCM, setShowCreateCM] = useState(false);
  // Las metas salen de la fuente ÚNICA (ROUTE_META): el prerender usa la misma tabla, así que
  // el crawler y el navegador ven lo mismo.
  // ROUTE_META cubre las 5 rutas de módulo (test routeMeta): el fallback es '' por si
  // cfg no existe (ruta desconocida), no duplica metas.
  const rutaMeta = metaDeRuta(cfg?.ruta ?? '') ?? { title: '', description: '' };
  usePageMeta(rutaMeta.title, rutaMeta.description);
  const softwareAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: cfg?.title ? `${cfg.title} Module` : 'Civil Cardex Module',
    description: cfg?.description || '',
    applicationCategory: 'EngineeringApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  if (!cfg) return null;

  // Módulos SIN construir (ped. usuario): pantalla única «En construcción» al entrar a su
  // landing (y a cualquier ruta relativa — todas caen aquí). Sin hero ni specs fabricadas;
  // el H1 y el SoftwareApplication JSON-LD se conservan para el SEO prerenderizado.
  if (moduleId !== 'flow' && moduleId !== 'manage') {
    return (
      <ModulePageLayout
        title={cfg.title}
        mainClassName="flex flex-col"
        moduleId={moduleId}
        fitViewport
      >
        <script type="application/ld+json">{JSON.stringify(softwareAppJsonLd)}</script>
        <section className="relative flex flex-col items-center justify-center text-center gap-5 flex-1 px-6">
          <div className="module-badge inline-flex items-center gap-2 px-3 py-1 border">
            <img
              src={cfg.logo}
              alt=""
              className="h-4 w-4 object-contain"
              width={16}
              height={16}
              loading="lazy"
            />
            <span className="module-accent-text font-geist-mono text-[13px] uppercase">
              {cfg.badgeLabel}
            </span>
          </div>
          <h1 className="font-hanken text-3xl md:text-5xl font-bold tracking-tight">{cfg.title}</h1>
          <p className="text-base text-on-surface-variant max-w-xl leading-relaxed">
            {cfg.description}
          </p>
          <span className="font-geist-mono inline-flex items-center gap-2 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] border border-outline-variant text-on-surface">
            <span className="module-accent-icon material-symbols-outlined text-base!">
              construction
            </span>
            En construcción
          </span>
          <Link
            to="/"
            className="font-geist-mono text-[12px] font-bold uppercase tracking-[0.08em] text-primary hover:underline"
          >
            ← Volver al inicio
          </Link>
        </section>
      </ModulePageLayout>
    );
  }

  const Hero = HERO_BY_LAYOUT[cfg.customLayout ?? 'flow'];

  return (
    <ModulePageLayout title={cfg.title} mainClassName="flex flex-col w-full" moduleId={moduleId}>
      <script type="application/ld+json">{JSON.stringify(softwareAppJsonLd)}</script>
      {/* Hero Section */}
      <Hero
        cfg={cfg}
        onCtaClick={
          moduleId === 'flow'
            ? () => {
                // Sin sesión → login llevando el destino: LoginPage vuelve a ESTE módulo
                // tras autenticar (location.state.from; sin estado iría a /perfil).
                if (!user) {
                  navigate('/login', { state: { from: `/modulo/${moduleId}` } });
                  return;
                }
                if (bloqueando && !tieneModulo('flow')) {
                  navigate('/pricing?modulo=flow');
                  return;
                }
                setShowCreate(true);
              }
            : moduleId === 'manage'
              ? () => {
                  if (!user) {
                    navigate('/login', { state: { from: `/modulo/${moduleId}` } });
                    return;
                  }
                  if (bloqueando && !tieneModulo('manage')) {
                    navigate('/pricing?modulo=manage');
                    return;
                  }
                  setShowCreateCM(true);
                }
              : undefined
        }
      />

      {/* Features / Details Section */}
      <section
        className={
          cfg.customLayout === 'manage'
            ? 'module-features-manage py-20 px-6 lg:px-8'
            : 'module-features-default w-full px-6 lg:px-8 py-20 border-b border-outline-variant'
        }
      >
        <div className="flex flex-col gap-2 mb-12">
          <h2 className="font-hanken text-xl font-semibold text-on-surface">
            Capacidades del sistema
          </h2>
          <p className="font-geist-mono text-[13px] text-outline uppercase">
            Módulos de integración activos
          </p>
        </div>

        <ul
          className={`list-reset ${
            cfg.customLayout === 'manage'
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-5 auto-rows-[320px]'
              : 'grid grid-cols-1 md:grid-cols-3 gap-3'
          }`}
        >
          {cfg.features.map((f, i) => {
            const isSpan = f.span
              ? cfg.customLayout === 'manage'
                ? 'md:col-span-2'
                : 'col-span-1 md:col-span-2 lg:col-span-2'
              : '';
            return (
              <li
                key={i}
                className={`module-feature ${
                  cfg.customLayout === 'manage' ? 'module-feature-manage' : ''
                } border p-6 flex flex-col justify-between group transition-all relative overflow-hidden ${isSpan}`}
              >
                <div className="z-10 flex flex-col gap-4">
                  <div
                    className={`module-feature-icon ${
                      cfg.customLayout === 'manage'
                        ? 'w-16 h-16 flex items-center justify-center border group-hover:border-primary transition-colors'
                        : 'w-12 h-12 flex items-center justify-center border group-hover:border-primary transition-colors'
                    }`}
                  >
                    <span
                      className={`module-fill-icon ${
                        cfg.customLayout === 'manage'
                          ? 'material-symbols-outlined text-3xl!'
                          : 'material-symbols-outlined'
                      }`}
                    >
                      {f.icon}
                    </span>
                  </div>
                  <h3
                    className={`font-hanken ${
                      cfg.customLayout === 'manage'
                        ? 'text-xl font-semibold text-on-surface'
                        : 'text-lg font-semibold text-on-surface'
                    }`}
                  >
                    {f.title}
                  </h3>
                  <p
                    className={
                      cfg.customLayout === 'manage'
                        ? 'text-base text-on-surface-variant w-full'
                        : 'text-sm text-on-surface-variant w-full'
                    }
                  >
                    {f.desc}
                  </p>
                </div>

                {f.badge && (
                  <div className="z-10 mt-4 border-t border-outline-variant pt-4">
                    <span className="font-geist-mono text-[13px] flex items-center gap-2">
                      {f.badgeColor && (
                        <span className="w-1.5 h-1.5" style={{ background: f.badgeColor }} />
                      )}{' '}
                      {f.badge}
                    </span>
                  </div>
                )}

                {/* Custom feature-specific widgets */}
                {cfg.customLayout === 'manage' && f.title.includes('Costos') && (
                  <div className="module-accent-text font-geist-mono flex items-end gap-2 font-bold text-[13px]">
                    <span className="material-symbols-outlined text-sm! animate-pulse">
                      sensors
                    </span>{' '}
                    Live Data Feed Active
                  </div>
                )}
                {cfg.customLayout === 'manage' && f.title.includes('Cronogramas') && (
                  <div className="module-bars w-full h-2 mt-4 flex overflow-hidden">
                    <div className="module-bar-a w-1/3" />
                    <div className="module-bar-b w-1/2" />
                    <div className="module-bar-c w-1/6" />
                  </div>
                )}
              </li>
            );
          })}

          {/* Extra block for layouts */}
          {cfg.customLayout === 'structure' && (
            <li className="module-structure-block border border-outline-variant flex flex-col hidden lg:flex">
              <div className="module-structure-head border-b border-outline-variant p-2 flex justify-between items-center">
                <span className="font-geist-mono text-[13px] text-on-surface-variant">
                  NODE_MONITOR
                </span>
                <span className="w-2 h-2 bg-[var(--ok)] rounded-full animate-pulse" />
              </div>
              <div className="module-console p-4 flex-grow text-[10px] text-outline leading-tight space-y-1">
                <div>&gt; INIT SOLVER ENGINE v4.2.1</div>
                <div>&gt; MESHING GEOMETRY... [DONE]</div>
                <div>&gt; APPLYING BOUNDARY COND...</div>
                <div className="module-console-accent text-primary">
                  &gt; RUNNING EIGENVALUE ANALYSIS
                </div>
                <div className="flex justify-between border-t border-outline-variant mt-2 pt-2">
                  <span>MODE_1</span>
                  <span>2.45 Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>MODE_2</span>
                  <span>5.12 Hz</span>
                </div>
              </div>
            </li>
          )}
        </ul>

        {/* Specifications table section (Only for Flow) */}
        {cfg.specs && (
          <section className="py-12 px-6 lg:px-8 max-w-6xl mx-auto">
            <h2 className="font-hanken text-xl font-semibold text-on-surface border-b border-outline-variant pb-4 mb-6">
              ESPECIFICACIONES DEL MÓDULO
            </h2>
            <div className="module-specs border border-outline-variant overflow-auto">
              <table className="w-full text-left text-sm min-w-[600px]">
                <caption className="sr-only">Especificaciones del módulo</caption>
                <thead className="module-specs-head border-b border-outline-variant">
                  <tr>
                    {SPECS_COLS.map((c) => (
                      <th
                        key={c}
                        scope="col"
                        className="font-geist-mono p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-on-surface-variant">
                  {cfg.specs.map((s, i) => (
                    <tr
                      key={i}
                      className="border-b border-outline-variant/50 hover:bg-surface-container-highest transition-colors"
                    >
                      <td className="font-geist-mono p-4 text-[13px]">{s.param}</td>
                      <td className="p-4">{s.hid}</td>
                      <td className="p-4">{s.san}</td>
                      <td className="p-4">{s.gas}</td>
                      <td className="p-4">{s.vent ?? '—'}</td>
                      <td className="p-4">{s.rci ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      {/* Call To Action bottom block */}
      {cfg.customLayout === 'flow' ? null : cfg.customLayout === 'structure' ? (
        <section className="module-cta py-20 px-6 lg:px-8 relative overflow-hidden">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="font-hanken text-2xl font-bold text-on-surface mb-6">
              Precisión Analítica para Infraestructura Crítica
            </h2>
            <p className="text-base text-on-surface-variant mb-8 max-w-2xl mx-auto">
              Únase a los equipos de ingeniería que confían en CivilStructure para validar la
              seguridad estructural de sus proyectos más exigentes.
            </p>
          </div>
        </section>
      ) : null}
      <ProjectCreateDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <ProjectCreateDialogCM open={showCreateCM} onClose={() => setShowCreateCM(false)} />
    </ModulePageLayout>
  );
}
