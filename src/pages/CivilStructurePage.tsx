import { Link } from 'react-router-dom';
import ModulePageLayout from '../components/ModulePageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

const features = [
  { num: '01', icon: 'calculate', title: 'Cálculo de Estructuras Complejas', desc: 'Análisis no lineal, pandeo y grandes deformaciones para geometrías singulares.' },
  { num: '02', icon: 'air', title: 'Simulación de Cargas Sísmicas y de Viento', desc: 'Generación automática de espectros de respuesta y perfiles de viento según normativa local. Análisis dinámico temporal e historial en el dominio de las frecuencias.', span: true },
  { num: '03', icon: 'layers', title: 'Interoperabilidad con CivilTerrain', desc: 'Importación directa de mallas de terreno para cálculo de cimentaciones e interacción suelo-estructura.' },
  { num: '04', icon: 'description', title: 'Reportes de Memoria de Cálculo', desc: 'Generación paramétrica de documentación técnica con ecuaciones paso a paso y gráficas de isovalores.' },
];

export default function CivilStructurePage() {
  usePageMeta('Estructuras', 'Diseño estructural avanzado con análisis FEM. Cálculo de cargas sísmicas, viento y cimentaciones según normativa.');
  return (
    <ModulePageLayout title="Estructuras" mainClassName="relative">
      <section className="relative flex items-center border-b border-outline-variant overflow-hidden" style={{ minHeight: 600, background: '#0c0e12' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute top-1/4 left-8 text-[13px] text-outline opacity-50 hidden lg:block" style={{ fontFamily: 'Geist, monospace' }}>
            SYS.INIT: OK<br />LOAD_FACTOR: 1.4<br />MESH_DENSITY: HIGH<br />SOLVER_ITER: 2540
          </div>
          <div className="container mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-3 relative z-10">
            <div className="flex flex-col justify-center gap-6 max-w-2xl py-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary text-primary w-fit" style={{ background: 'rgba(0,245,255,0.1)' }}>
                <img src="/logos/civilStructurelogo.svg" alt="CivilStructure" className="h-4 w-4 object-contain"  width={16} height={16} loading="lazy" />
                <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace' }}>Módulo Estructural</span>
              </div>
              <h1 className="text-xl md:text-3xl lg:text-[36px] text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 700 }}>
                CivilStructure: Análisis de Elementos Finitos sobre Terreno Real
              </h1>
              <p className="text-base text-on-surface-variant">
                Diseño estructural avanzado y simulación física integrada. Analiza puentes, edificaciones y obras civiles complejas con interoperabilidad topográfica directa para cimentaciones precisas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link to="/civilflowareatrabajo" className="hidden md:inline-block bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-all" style={{ fontFamily: 'Geist, monospace' }}>
                  COMENZAR ANÁLISIS
                </Link>
                <button className="border border-primary text-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container transition-all flex items-center gap-2" style={{ fontFamily: 'Geist, monospace' }} onClick={() => {}}>
                  <span className="material-symbols-outlined text-base">download</span> DESCARGAR SDK
                </button>
              </div>
            </div>
            <div className="relative h-[400px] lg:h-auto w-full flex items-center justify-center">
              <div className="w-full h-full border border-outline-variant overflow-hidden relative" style={{ background: '#1e2024' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 120, opacity: 0.15 }}>architecture</span>
                </div>
                <div className="absolute top-4 right-4 border border-outline-variant p-2 text-[13px] text-on-surface flex items-center gap-2" style={{ background: '#282a2e', fontFamily: 'Geist, monospace' }}>
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" /> NODE_STRESS_MAX
                </div>
                <div className="absolute bottom-4 left-4 border border-outline-variant p-2 text-[13px]" style={{ background: '#282a2e', fontFamily: 'Geist, monospace' }}>
                  <span className="text-primary">Fz:</span> 450kN
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 lg:px-8 border-b border-outline-variant">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl font-semibold text-on-surface mb-2" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Capacidades Analíticas</h2>
            <p className="text-on-surface-variant max-w-2xl mb-8">Herramientas de cálculo de grado ingenieril para la validación estructural bajo normativas internacionales.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {features.map((f) => (
                <div key={f.num} className={`border border-outline-variant p-6 flex flex-col justify-between hover:border-primary transition-all group ${f.span ? 'md:col-span-2' : ''}`} style={{ background: '#1e2024' }}>
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 flex items-center justify-center border border-outline-variant group-hover:border-primary transition-colors" style={{ background: '#111317' }}>
                      <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                    </div>
                    <span className="text-[13px] text-outline-variant" style={{ fontFamily: 'Geist, monospace' }}>{f.num}</span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-on-surface mb-2" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                    <p className="text-on-surface-variant text-sm">{f.desc}</p>
                  </div>
                </div>
              ))}
              <div className="border border-outline-variant flex flex-col hidden lg:flex" style={{ background: '#1a1c20' }}>
                <div className="border-b border-outline-variant p-2 flex justify-between items-center" style={{ background: '#1e2024' }}>
                  <span className="text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>NODE_MONITOR</span>
                  <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
                </div>
                <div className="p-4 flex-grow text-[10px] text-outline leading-tight space-y-1" style={{ fontFamily: 'Geist, monospace' }}>
                  <div>&gt; INIT SOLVER ENGINE v4.2.1</div>
                  <div>&gt; MESHING GEOMETRY... [DONE]</div>
                  <div>&gt; APPLYING BOUNDARY COND...</div>
                  <div className="text-primary">&gt; RUNNING EIGENVALUE ANALYSIS</div>
                  <div className="flex justify-between border-t border-outline-variant mt-2 pt-2">
                    <span>MODE_1</span><span>2.45 Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MODE_2</span><span>5.12 Hz</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 lg:px-8 relative overflow-hidden" style={{ background: '#0c0e12' }}>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-2xl font-bold text-on-surface mb-6" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Precisión Analítica para Infraestructura Crítica</h2>
            <p className="text-base text-on-surface-variant mb-8 max-w-2xl mx-auto">
              Únase a los equipos de ingeniería que confían en CivilStructure para validar la seguridad estructural de sus proyectos más exigentes.
            </p>
            <button className="bg-primary text-on-primary px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-all" style={{ fontFamily: 'Geist, monospace', boxShadow: '0 0 15px rgba(0,220,229,0.3)' }}>
              SOLICITAR LICENCIA DE PRUEBA
            </button>
          </div>
        </section>
    </ModulePageLayout>
  );
}
