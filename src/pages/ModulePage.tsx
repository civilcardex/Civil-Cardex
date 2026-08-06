import { useState } from 'react';
import ModulePageLayout from '../components/ModulePageLayout';
import { usePageMeta } from '../hooks/usePageMeta';
import { MODULES_DATA } from './moduleData';
import { HERO_BY_LAYOUT } from '../components/modulePage/heroByLayout';
import ProjectCreateDialog from '../modules/civilflow/components/shared/ProjectCreateDialog';
import { useAuth } from '../context/AuthContext';
const ModulePage_S1: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

interface ModulePageProps {
  moduleId: 'flow' | 'structure' | 'terrain' | 'bim' | 'manage' | 'mep' | 'roads';
}

export default function ModulePage({ moduleId }: ModulePageProps) {
  const cfg = MODULES_DATA[moduleId];
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  usePageMeta(cfg?.metaTitle ?? '', cfg?.metaDesc ?? '');
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

  const Hero = HERO_BY_LAYOUT[cfg.customLayout ?? 'roads'];

  return (
    <ModulePageLayout
      title={cfg.title}
      mainClassName={
        cfg.customLayout === 'terrain'
          ? 'pt-20 px-6 lg:px-8 pb-12 relative overflow-hidden'
          : cfg.customLayout === 'roads'
            ? 'flex flex-col relative z-0'
            : 'flex flex-col w-full'
      }
    >
      <script type="application/ld+json">{JSON.stringify(softwareAppJsonLd)}</script>
      {/* Hero Section */}
      <Hero
        cfg={cfg}
        onCtaClick={
          moduleId === 'flow'
            ? () => {
                if (!user) {
                  setShowLoginAlert(true);
                  return;
                }
                setShowCreate(true);
              }
            : undefined
        }
      />

      {/* Features / Details Section */}
      <section
        className={
          cfg.customLayout === 'terrain'
            ? 'relative z-10 max-w-7xl mx-auto'
            : cfg.customLayout === 'roads'
              ? 'py-20 px-6 lg:px-8'
              : cfg.customLayout === 'manage'
                ? 'py-20 px-6 lg:px-8'
                : 'w-full px-6 lg:px-8 py-20 border-b border-outline-variant'
        }
        style={
          cfg.customLayout === 'roads'
            ? { background: '#0F1115' }
            : cfg.customLayout === 'manage'
              ? { background: '#1a1c20' }
              : cfg.customLayout === 'terrain'
                ? {}
                : { background: '#111317' }
        }
      >
        {cfg.customLayout === 'terrain' ? (
          <h2
            className="text-xl font-bold text-primary mb-8 border-b border-outline-variant pb-4"
            style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
          >
            Capacidades Técnicas
          </h2>
        ) : cfg.customLayout === 'roads' ? (
          <>
            <h2
              className="text-2xl md:text-4xl lg:text-[32px] font-bold text-on-background mb-2"
              style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Capacidades del Módulo
            </h2>
            <p className="text-base text-on-surface-variant mt-2 max-w-2xl mb-12">
              Herramientas especializadas para el diseño integral de infraestructuras viales y
              espacios urbanos.
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-2 mb-12">
            <h2
              className="text-xl font-semibold text-on-surface"
              style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              {cfg.customLayout === 'mep' ? 'Capacidades del Módulo' : 'Capacidades del sistema'}
            </h2>
            <p
              className="text-[13px] text-outline uppercase"
              style={{ fontFamily: 'Geist, monospace' }}
            >
              {cfg.customLayout === 'mep'
                ? 'SYS.MEP.FEATURES // ANALYTICS'
                : 'Módulos de integración activos'}
            </p>
          </div>
        )}

        <div
          className={
            cfg.customLayout === 'mep'
              ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[250px]'
              : cfg.customLayout === 'roads'
                ? 'grid grid-cols-1 md:grid-cols-12 gap-3'
                : cfg.customLayout === 'manage'
                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-5 auto-rows-[320px]'
                  : 'grid grid-cols-1 md:grid-cols-3 gap-3'
          }
        >
          {cfg.features.map((f, i) => {
            const isSpan =
              cfg.customLayout === 'roads'
                ? f.span
                : f.span
                  ? cfg.customLayout === 'mep'
                    ? f.span
                    : cfg.customLayout === 'manage'
                      ? 'md:col-span-2'
                      : 'col-span-1 md:col-span-2 lg:col-span-2'
                  : '';
            return (
              <div
                key={i}
                className={`border p-6 flex flex-col justify-between group transition-all relative overflow-hidden ${isSpan} ${f.highlight ? '' : ''}`}
                style={{
                  background:
                    cfg.customLayout === 'manage'
                      ? `linear-gradient(155deg, #1e2128 0%, #1a1c20 55%, ${cfg.accent}14 100%)`
                      : cfg.customLayout === 'mep'
                        ? f.span
                          ? '#1e2024'
                          : '#1a1c20'
                        : '#1a1c20',
                  borderColor: f.highlight ? cfg.accent : '#3a494a',
                  boxShadow: f.highlight ? `0 0 15px -3px ${cfg.accent}` : 'none',
                }}
              >
                <div className="z-10 flex flex-col gap-4">
                  <div
                    className={
                      cfg.customLayout === 'manage'
                        ? 'w-16 h-16 flex items-center justify-center border group-hover:border-primary transition-colors'
                        : 'w-12 h-12 flex items-center justify-center border group-hover:border-primary transition-colors'
                    }
                    style={{
                      background: '#111317',
                      borderColor: '#3a494a',
                      color: cfg.accent,
                    }}
                  >
                    <span
                      className={
                        cfg.customLayout === 'manage'
                          ? 'material-symbols-outlined text-3xl'
                          : 'material-symbols-outlined'
                      }
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {f.icon}
                    </span>
                  </div>
                  <h3
                    className={
                      cfg.customLayout === 'manage'
                        ? 'text-xl font-semibold text-on-surface'
                        : 'text-lg font-semibold text-on-surface'
                    }
                    style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
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

                  {f.tags && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {f.tags.map((t) => (
                        <span
                          key={t}
                          className={
                            cfg.customLayout === 'manage'
                              ? 'text-[12px] px-3 py-1.5 border border-outline-variant text-on-surface-variant'
                              : 'text-[10px] px-2 py-1 border border-outline-variant text-on-surface-variant'
                          }
                          style={{ background: '#111317', fontFamily: 'Geist, monospace' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {f.highlight && cfg.customLayout !== 'manage' && (
                    <span
                      className="text-[10px] flex items-center gap-1 mt-1"
                      style={{ fontFamily: 'Geist, monospace', color: '#ffb4ab' }}
                    >
                      <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse" /> AUTO-SCAN
                      ACTIVE
                    </span>
                  )}
                </div>

                {f.badge && (
                  <div className="z-10 mt-4 border-t border-outline-variant pt-4">
                    <span
                      className="text-[13px] flex items-center gap-2"
                      style={{ fontFamily: 'Geist, monospace', color: f.badgeColor || 'inherit' }}
                    >
                      {f.badgeColor && (
                        <span className="w-1.5 h-1.5" style={{ background: f.badgeColor }} />
                      )}{' '}
                      {f.badge}
                    </span>
                  </div>
                )}
                {f.terminal && (
                  <div
                    className="mt-auto text-[13px] text-outline bg-surface p-2 border border-outline-variant"
                    style={{ fontFamily: 'Geist, monospace', color: '#8AB4D6' }}
                  >
                    {f.terminal.map((line, j) => (
                      <div key={j}>&gt; {line}</div>
                    ))}
                  </div>
                )}
                {f.autoSize && (
                  <div className="mt-auto flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ color: '#79ff5b' }}
                    >
                      check_box
                    </span>
                    <span
                      className="text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase"
                      style={{ fontFamily: 'Geist, monospace' }}
                    >
                      AUTO-SIZE ON
                    </span>
                  </div>
                )}

                {/* Custom feature-specific widgets */}
                {cfg.customLayout === 'terrain' && f.title.includes('Volúmenes') && (
                  <div
                    className="mt-4 border border-outline-variant p-4 grid grid-cols-2 gap-4"
                    style={{ background: '#111317' }}
                  >
                    <div>
                      <div
                        className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant mb-1 uppercase"
                        style={{ fontFamily: 'Geist, monospace' }}
                      >
                        Volumen de Corte
                      </div>
                      <div
                        className="text-[13px]"
                        style={{ fontFamily: 'Geist, monospace', color: '#ffb4ab' }}
                      >
                        45,230.5 m³
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant mb-1 uppercase"
                        style={{ fontFamily: 'Geist, monospace' }}
                      >
                        Volumen de Relleno
                      </div>
                      <div
                        className="text-[13px] text-primary"
                        style={{ fontFamily: 'Geist, monospace', color: 'var(--acc)' }}
                      >
                        38,105.2 m³
                      </div>
                    </div>
                  </div>
                )}
                {cfg.customLayout === 'terrain' && f.title.includes('CivilRoads') && (
                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-secondary rounded-full" />
                    <span
                      className="text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase"
                      style={{ fontFamily: 'Geist, monospace' }}
                    >
                      Seamless Sync Active
                    </span>
                  </div>
                )}
                {cfg.customLayout === 'manage' && f.title.includes('Costos') && (
                  <div
                    className="flex items-end gap-2 font-bold text-[13px]"
                    style={{ fontFamily: 'Geist, monospace', color: cfg.accent }}
                  >
                    <span className="material-symbols-outlined text-sm animate-pulse">sensors</span>{' '}
                    Live Data Feed Active
                  </div>
                )}
                {cfg.customLayout === 'manage' && f.title.includes('Cronogramas') && (
                  <div
                    className="w-full h-2 mt-4 flex overflow-hidden"
                    style={{ background: '#111317' }}
                  >
                    <div className="w-1/3" style={{ background: '#3a494a' }} />
                    <div className="w-1/2" style={{ background: cfg.accent }} />
                    <div className="w-1/6" style={{ background: '#37393e' }} />
                  </div>
                )}
                {cfg.customLayout === 'roads' && f.title.includes('Diseño Geométrico') && (
                  <div
                    className="mt-8 flex items-center gap-2 uppercase cursor-pointer hover:underline"
                    style={{
                      fontFamily: 'Geist, monospace',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#00dce5',
                    }}
                  >
                    Explorar Herramientas{' '}
                    <span className="material-symbols-outlined text-sm">arrow_outward</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Extra block for layouts */}
          {cfg.customLayout === 'structure' && (
            <div
              className="border border-outline-variant flex flex-col hidden lg:flex"
              style={{ background: '#1a1c20' }}
            >
              <div
                className="border-b border-outline-variant p-2 flex justify-between items-center"
                style={{ background: '#1e2024' }}
              >
                <span
                  className="text-[13px] text-on-surface-variant"
                  style={{ fontFamily: 'Geist, monospace' }}
                >
                  NODE_MONITOR
                </span>
                <span
                  className="w-2 h-2 bg-secondary rounded-full animate-pulse"
                  style={{ background: 'var(--ok)' }}
                />
              </div>
              <div
                className="p-4 flex-grow text-[10px] text-outline leading-tight space-y-1"
                style={{ fontFamily: 'Geist, monospace', color: 'var(--txt3)' }}
              >
                <div>&gt; INIT SOLVER ENGINE v4.2.1</div>
                <div>&gt; MESHING GEOMETRY... [DONE]</div>
                <div>&gt; APPLYING BOUNDARY COND...</div>
                <div className="text-primary" style={{ color: 'var(--acc)' }}>
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
            </div>
          )}
        </div>

        {/* Sync table inside features container for BIM */}
        {cfg.syncRows && (
          <div
            className="mt-6 border border-outline-variant flex flex-col overflow-hidden w-full"
            style={{ background: '#1a1c20' }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b border-outline-variant"
              style={{ background: '#0c0e12' }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-base">
                  table_rows
                </span>
                <h3
                  className="text-[13px] text-on-surface-variant uppercase"
                  style={{ fontFamily: 'Geist, monospace' }}
                >
                  Sincronización Datos de Campo
                </h3>
              </div>
              <span
                className="text-[10px] px-2 py-0.5 border"
                style={{
                  fontFamily: 'Geist, monospace',
                  color: '#79ff5b',
                  borderColor: '#2ff80133',
                  background: 'rgba(47,248,1,0.1)',
                }}
              >
                LIVE CONNECTION
              </span>
            </div>
            <div className="flex-grow p-4 flex gap-4 overflow-x-auto">
              <div
                className="min-w-[600px] w-full flex flex-col gap-1 text-[12px]"
                style={{ fontFamily: 'Geist, monospace' }}
              >
                <div className="grid grid-cols-5 text-on-surface-variant border-b border-outline-variant pb-1 mb-1 uppercase text-[10px]">
                  <span>ID Elemento</span>
                  <span>Categoría</span>
                  <span>Estado Terreno</span>
                  <span>Desviación (mm)</span>
                  <span>Validación</span>
                </div>
                {cfg.syncRows.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-5 text-on-surface py-1 hover:bg-surface-container transition-colors"
                  >
                    <span style={{ color: '#00dce5' }}>{r.id}</span>
                    <span>{r.cat}</span>
                    <span>{r.estado}</span>
                    <span style={{ color: r.desvColor }}>{r.desv}</span>
                    <span style={{ color: r.validColor }}>{r.valid}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Specifications table section (Only for Flow) */}
        {cfg.specs && (
          <section className="py-12 px-6 lg:px-8 max-w-6xl mx-auto">
            <h2
              className="text-xl font-semibold text-on-surface border-b border-outline-variant pb-4 mb-6"
              style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              ESPECIFICACIONES DEL MÓDULO
            </h2>
            <div
              className="border border-outline-variant overflow-auto"
              style={{ background: '#1e2024' }}
            >
              <table className="w-full text-left text-sm min-w-[600px]">
                <caption style={ModulePage_S1}>Especificaciones del módulo</caption>
                <thead
                  className="border-b border-outline-variant"
                  style={{ background: '#282a2e' }}
                >
                  <tr>
                    <th
                      scope="col"
                      className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase"
                      style={{ fontFamily: 'Geist, monospace' }}
                    >
                      Parámetro
                    </th>
                    <th
                      scope="col"
                      className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase"
                      style={{ fontFamily: 'Geist, monospace' }}
                    >
                      Red Hidráulica
                    </th>
                    <th
                      scope="col"
                      className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase"
                      style={{ fontFamily: 'Geist, monospace' }}
                    >
                      Saneamiento
                    </th>
                    <th
                      scope="col"
                      className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase"
                      style={{ fontFamily: 'Geist, monospace' }}
                    >
                      Red de Gas
                    </th>
                  </tr>
                </thead>
                <tbody className="text-on-surface-variant">
                  {cfg.specs.map((s, i) => (
                    <tr
                      key={i}
                      className="border-b border-outline-variant/50 hover:bg-surface-container-highest transition-colors"
                    >
                      <td className="p-4 text-[13px]" style={{ fontFamily: 'Geist, monospace' }}>
                        {s.param}
                      </td>
                      <td className="p-4">{s.hid}</td>
                      <td className="p-4">{s.san}</td>
                      <td className="p-4">{s.gas}</td>
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
        <section
          className="py-20 px-6 lg:px-8 relative overflow-hidden"
          style={{ background: '#0c0e12' }}
        >
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2
              className="text-2xl font-bold text-on-surface mb-6"
              style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Precisión Analítica para Infraestructura Crítica
            </h2>
            <p className="text-base text-on-surface-variant mb-8 max-w-2xl mx-auto">
              Únase a los equipos de ingeniería que confían en CivilStructure para validar la
              seguridad estructural de sus proyectos más exigentes.
            </p>
            <button
              type="button"
              className="bg-primary text-on-primary px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-all"
              style={{
                fontFamily: 'Geist, monospace',
                background: cfg.accent,
                boxShadow: `0 0 15px ${cfg.accent}4d`,
                color: '#000',
              }}
            >
              SOLICITAR LICENCIA DE PRUEBA
            </button>
          </div>
        </section>
      ) : null}
      <ProjectCreateDialog open={showCreate} onClose={() => setShowCreate(false)} />
      {showLoginAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10,11,14,0.75)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e222b 0%, #15181f 100%)',
              padding: 24,
              borderRadius: 12,
              minWidth: 320,
              maxWidth: 420,
              border: '1px solid rgba(245,166,35,0.25)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 15px rgba(245,166,35,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#F5A623',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                paddingBottom: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>⚠️</span> Sesión requerida
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#a9b8bd',
                lineHeight: 1.6,
                fontFamily: "'Geist', sans-serif",
                margin: '4px 0 16px',
              }}
            >
              Debes iniciar sesión para crear un proyecto.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                // autoFocus intencional: alerta es overlay custom sin gestión de foco propia — sin
                // autoFocus el foco no entraría al diálogo. Migrar a <dialog> nativo en un pase futuro.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onClick={() => setShowLoginAlert(false)}
                style={{
                  padding: '8px 18px',
                  background: 'linear-gradient(135deg, #F5A623 0%, #d48b11 100%)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#111317',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  fontFamily: "'Geist', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  boxShadow: '0 4px 12px rgba(245,166,35,0.25)',
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </ModulePageLayout>
  );
}
