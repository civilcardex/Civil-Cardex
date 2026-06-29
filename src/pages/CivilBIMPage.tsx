import { Link } from 'react-router-dom';
import ModulePageLayout from '../components/ModulePageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

const features = [
  { icon: 'hub', title: 'Interoperabilidad IFC y Revit', desc: 'Importación y exportación bidireccional sin pérdida de metadatos constructivos.', tags: ['.IFC', '.RVT', '.DWG'], span: true, highlight: false },
  { icon: 'timeline', title: 'Coordinación 4D/5D', desc: 'Cronogramas de obra y estimación de costos integrados en tiempo real al modelo.', span: false, highlight: false },
  { icon: 'warning', title: 'Detección de Colisiones', desc: 'Análisis automatizado de interferencias MEP vs Estructura.', span: false, highlight: true },
];

const syncRows = [
  { id: 'P-104A', cat: 'Pilote Cimentación', estado: 'Excavado', desv: '+2.4', desvColor: '#79ff5b', valid: 'OK', validColor: '#79ff5b' },
  { id: 'V-201B', cat: 'Viga Riostra', estado: 'Armado', desv: '-15.2', desvColor: '#ffb4ab', valid: 'REVISIÓN', validColor: '#ffb4ab' },
  { id: 'M-005C', cat: 'Muro Contención', estado: 'Encofrado', desv: '+0.8', desvColor: '#79ff5b', valid: 'OK', validColor: '#79ff5b' },
];

export default function CivilBIMPage() {
  usePageMeta('BIM', 'Modelado BIM para infraestructura civil. Integración IFC, Revit, detección de colisiones y coordinación multidisciplinar.');
  const bimAccent = '#d946ef';
  return (
    <ModulePageLayout title="BIM" mainClassName="flex flex-col w-full">
      <section className="relative w-full flex items-center border-b border-outline-variant overflow-hidden" style={{ minHeight: 600 }}>
          <div className="absolute inset-0 z-0" style={{ opacity: 0.1, backgroundImage: 'radial-gradient(circle at 2px 2px, #849495 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="w-full max-w-7xl px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 z-10 items-center py-20">
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 border border-outline-variant px-3 py-1 w-fit" style={{ background: '#1a1c20' }}>
                <img src="/logos/civilBIMlogo.svg" alt="CivilBIM" className="h-4 w-4 object-contain"  width={16} height={16} loading="lazy" />
                <span className="text-[13px] text-on-surface-variant uppercase tracking-widest" style={{ fontFamily: 'Geist, monospace' }}>Módulo CivilBIM</span>
              </div>
              <h1 className="text-2xl md:text-4xl lg:text-[48px] leading-[56px] font-bold text-on-surface tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
                CivilBIM: El Nexo Digital de la Construcción
              </h1>
              <p className="text-base text-on-surface-variant max-w-xl">
                Integración total de modelos inteligentes en flujos de trabajo es. Conecte diseño, análisis y gestión en un entorno unificado de alta precisión para proyectos de infraestructura civil.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <Link to="/civilflowareatrabajo" className="hidden md:inline-flex border border-outline-variant text-on-surface px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 hover:border-[#d946ef] transition-colors" style={{ fontFamily: 'Geist, monospace', background: '#333539' }}>
                  <span className="material-symbols-outlined text-lg">terminal</span> Iniciar Terminal BIM
                </Link>
                <Link to="/docs" className="border border-outline-variant text-on-surface-variant px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2 hover:text-on-surface transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                  <span className="material-symbols-outlined text-lg">description</span> Documentación API
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 md:gap-4 mt-8 border-t border-outline-variant pt-6">
                <div className="flex flex-col">
                  <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>99.9%</span>
                  <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Precisión Geométrica</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>&lt;10ms</span>
                  <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Latencia Sincronización</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>IFC4</span>
                  <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Soporte Nativo</span>
                </div>
              </div>
            </div>
              <div className="relative h-[300px] lg:h-[500px] w-full flex items-center justify-center">
              <div className="absolute inset-0 border border-outline-variant flex items-center justify-center overflow-hidden" style={{ background: '#1a1c20', boxShadow: `0 0 20px -5px ${bimAccent}` }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined opacity-10" style={{ fontSize: 120, color: bimAccent, fontVariationSettings: "'FILL' 0, 'wght' 200" }}>architecture</span>
                </div>
                <div className="absolute top-4 left-4 text-[10px] text-on-surface-variant flex flex-col gap-1" style={{ fontFamily: 'Geist, monospace' }}>
                  <span>COORD: 34.0522° N, 118.2437° W</span>
                  <span>ELEV: +142.5m ASL</span>
                  <span style={{ color: bimAccent }}>STATUS: SYNCED</span>
                </div>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <div className="w-2 h-2 animate-pulse" style={{ background: '#2ff801' }} />
                  <span className="text-[10px]" style={{ fontFamily: 'Geist, monospace', color: '#2ff801' }}>LIVE DATA</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-20 px-6 lg:px-8" style={{ background: '#111317' }}>
          <div className="max-w-7xl w-full mx-auto flex flex-col gap-12">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Capacidades del Sistema</h2>
              <p className="text-[13px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Módulos de Integración Activos</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[200px]">
              {features.map((f, i) => (
                <div key={i} className={`border p-6 flex flex-col justify-between group transition-colors relative overflow-hidden ${f.span ? 'col-span-1 md:col-span-2 lg:col-span-2' : ''} ${f.highlight ? '' : ''}`} style={{ background: '#1a1c20', borderColor: f.highlight ? bimAccent : '#3a494a', boxShadow: f.highlight ? `0 0 15px -3px ${bimAccent}` : 'none' }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined" style={{ color: bimAccent, fontVariationSettings: "'FILL' 1", fontSize: 20 }}>{f.icon}</span>
                    <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                  </div>
                  <div className="flex flex-col gap-2 z-10">
                    <p className="text-sm text-on-surface-variant">{f.desc}</p>
                    {f.tags && (
                      <div className="flex gap-2 mt-2">
                        {f.tags.map(t => (
                          <span key={t} className="text-[10px] px-2 py-1 border border-outline-variant text-on-surface-variant" style={{ background: '#111317', fontFamily: 'Geist, monospace' }}>{t}</span>
                        ))}
                      </div>
                    )}
                    {f.highlight && (
                      <span className="text-[10px] flex items-center gap-1 mt-1" style={{ fontFamily: 'Geist, monospace', color: '#ffb4ab' }}>
                        <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse" /> AUTO-SCAN ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div className="col-span-1 md:col-span-3 lg:col-span-4 border border-outline-variant flex flex-col overflow-hidden" style={{ background: '#1a1c20' }}>
                <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant" style={{ background: '#0c0e12' }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">table_rows</span>
                    <h3 className="text-[13px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Sincronización Datos de Campo</h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 border" style={{ fontFamily: 'Geist, monospace', color: '#79ff5b', borderColor: '#2ff80133', background: 'rgba(47,248,1,0.1)' }}>LIVE CONNECTION</span>
                </div>
                <div className="flex-grow p-4 flex gap-4 overflow-x-auto">
                  <div className="min-w-[600px] w-full flex flex-col gap-1 text-[12px]" style={{ fontFamily: 'Geist, monospace' }}>
                    <div className="grid grid-cols-5 text-on-surface-variant border-b border-outline-variant pb-1 mb-1 uppercase text-[10px]">
                      <span>ID Elemento</span><span>Categoría</span><span>Estado Terreno</span><span>Desviación (mm)</span><span>Validación</span>
                    </div>
                    {syncRows.map(r => (
                      <div key={r.id} className="grid grid-cols-5 text-on-surface py-1 hover:bg-surface-container transition-colors">
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
            </div>
          </div>
        </section>
    </ModulePageLayout>
  );
}
