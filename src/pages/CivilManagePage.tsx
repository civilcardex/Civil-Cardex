import React from 'react';
import { Link } from 'react-router-dom';
import ModulePageLayout from '../components/ModulePageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

const accent = '#f59e0b';

const features = [
  { icon: 'account_balance_wallet', title: 'Control de Costos en Tiempo Real', desc: 'Monitoreo de desviaciones presupuestales con alertas tempranas. Análisis de valor ganado (EVM) integrado con modelos BIM.', span: true },
  { icon: 'calendar_month', title: 'Gestión de Cronogramas', desc: 'Gantt dinámico con dependencias complejas y análisis de ruta crítica.', span: false },
  { icon: 'lab_profile', title: 'Reportes Automatizados', desc: 'Generación de informes gerenciales con un clic, exportables a múltiples formatos.', span: false },
  { icon: 'api', title: 'Integración ERP y Sistemas', desc: 'Conectores nativos para SAP, Oracle y sistemas financieros legacy. Sincronización bidireccional segura y auditable.', span: true, tags: ['REST API', 'GraphQL', 'Webhooks'] },
];

export default function CivilManagePage() {
  usePageMeta('Gestión', 'Gestión de proyectos de ingeniería civil: presupuestos, cronogramas, control de costos y reportes automatizados.');
  return (
    <ModulePageLayout title="Gestión" description="Gestión financiera y operativa optimizada para infraestructura crítica." mainClassName="flex flex-col relative z-10">
      <section className="relative pt-24 pb-16 px-6 lg:px-8 overflow-hidden flex flex-col items-center justify-center text-center" style={{ minHeight: 600, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${accent}0D, #111317)` }} />
          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-6">
            <div className="flex items-center justify-center w-16 h-16 border mb-4" style={{ background: '#282a2e', borderColor: '#3a494a', boxShadow: `0 0 15px ${accent}33` }}>
              <img src="/logos/civilManagelogo.webp" alt="CivilManage" className="h-10 w-10 object-contain"  width={40} height={40} loading="lazy" />
            </div>
            <h1 className="text-4xl md:text-6xl text-primary font-bold tracking-tight leading-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              CivilManage: <br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${accent}, #fef08a)` }}>Control Total</span> sobre el Ciclo de Vida del Proyecto
            </h1>
            <p className="text-base text-on-surface-variant max-w-2xl">
              Gestión financiera y operativa optimizada para infraestructura crítica. Integra presupuestos, cronogramas y análisis de riesgos en un dashboard táctico.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link to="/civilflowareatrabajo" className="hidden md:inline-flex px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2" style={{ fontFamily: 'Geist, monospace', background: accent, color: '#111317' }}>
                <span className="material-symbols-outlined text-sm">rocket_launch</span> INICIAR DEPLOYMENT
              </Link>
              <Link to="/docs" className="border border-outline-variant text-on-surface px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2 hover:border-primary transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                <span className="material-symbols-outlined text-sm">terminal</span> VER DOCUMENTACIÓN API
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 lg:px-8" style={{ background: '#1a1c20' }}>
          <div className="max-w-7xl mx-auto">
            <h2 className="text-xl font-semibold text-primary mb-2" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Capacidades de Gestión</h2>
            <p className="text-sm text-on-surface-variant mb-12">Módulos integrados para el control operativo.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 auto-rows-[250px]">
              {features.map((f, i) => (
                <div key={i} className={`border p-6 flex flex-col justify-between hover:border-primary transition-colors group relative overflow-hidden ${f.span ? 'md:col-span-2' : ''}`} style={{ background: '#1e2024', borderColor: '#3a494a' }}>
                  <div>
                    <div className="w-10 h-10 border flex items-center justify-center mb-4" style={{ background: '#111317', borderColor: '#3a494a' }}>
                      <span className="material-symbols-outlined" style={{ color: accent, fontVariationSettings: "'FILL' 1", fontSize: 20 }}>{f.icon}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-primary mb-2" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                    <p className="text-sm text-on-surface-variant max-w-md">{f.desc}</p>
                  </div>
                  {f.tags && (
                    <div className="flex gap-2 mt-4 text-[13px] text-outline" style={{ fontFamily: 'Geist, monospace' }}>
                      {f.tags.map(t => (
                        <span key={t} className="px-2 py-1 border border-outline-variant" style={{ background: '#111317' }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {f.title.includes('Costos') && (
                    <div className="flex items-end gap-2 font-bold text-[13px]" style={{ fontFamily: 'Geist, monospace', color: accent }}>
                      <span className="material-symbols-outlined text-sm animate-pulse">sensors</span> Live Data Feed Active
                    </div>
                  )}
                  {f.title.includes('Cronogramas') && (
                    <div className="w-full h-2 mt-4 flex overflow-hidden" style={{ background: '#111317' }}>
                      <div className="w-1/3" style={{ background: '#3a494a' }} />
                      <div className="w-1/2" style={{ background: accent }} />
                      <div className="w-1/6" style={{ background: '#37393e' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
    </ModulePageLayout>
  );
}
