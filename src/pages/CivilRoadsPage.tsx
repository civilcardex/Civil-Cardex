import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileOnlyMessage from '../components/MobileOnlyMessage';
import { usePageMeta } from '../hooks/usePageMeta';

const accent = '#FFC107';

const features = [
  { icon: 'design_services', title: 'Diseño Geométrico de Alineamientos', desc: 'Trazado avanzado de plantas, perfiles longitudinales y secciones transversales con actualizaciones dinámicas en el modelo 3D. Cumplimiento normativo automatizado.', span: 'md:col-span-8' },
  { icon: 'traffic', title: 'Simulación de Tráfico e Impacto Vial', desc: 'Analice flujos vehiculares, capacidad de intersecciones y tiempos de semaforización integrados en el diseño.', span: 'md:col-span-4' },
  { icon: 'layers', title: 'Generación Automática de Perfiles', desc: 'Creación instantánea de secciones típicas y cálculo de volúmenes de corte y relleno con alta precisión.', span: 'md:col-span-4' },
  { icon: 'emoji_objects', title: 'Integración con Señalización e Iluminación Inteligente', desc: 'Posicione elementos de seguridad vial, señalética y redes de iluminación con análisis de luminancia y cobertura en tiempo real.', span: 'md:col-span-8' },
];

const metrics = [
  { label: 'Alineamiento Horizontal', value: 'OK / 100%' },
  { label: 'Cálculo de Volúmenes', value: 'Procesando...' },
  { label: 'Impacto Ambiental (CO2)', value: '-14.2%', isAccent: true },
];

const CivilRoadsPage: React.FC = () => {
  usePageMeta('Vías');
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111317', color: '#e2e2e8' }}>
      <Navbar />
      <MobileOnlyMessage />
      <main className="flex-grow pt-16 flex flex-col relative z-0">
        <section className="relative w-full flex items-center overflow-hidden border-b border-outline-variant" style={{ minHeight: 700 }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #0F1115, rgba(15,17,21,0.8), transparent)' }} />
          <div className="relative z-10 w-full px-6 lg:px-8 grid grid-cols-12 gap-3 mt-16 md:mt-0">
            <div className="col-span-12 md:col-span-6 lg:col-span-5 flex flex-col justify-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 w-fit border" style={{ background: '#1A1D23', borderColor: accent }}>
                <img src="/logos/civilRoadslogo.webp" alt="CivilRoads" className="h-4 w-4 object-contain" />
                <span className="text-[13px] uppercase" style={{ fontFamily: 'Geist, monospace', color: accent }}>CivilRoads Module</span>
              </div>
              <h1 className="text-2xl md:text-4xl lg:text-[48px] leading-[1.1] font-bold text-on-background tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
                Infraestructura Vial de <span style={{ color: accent }}>Alta Precisión</span>.
              </h1>
              <p className="text-base text-on-surface-variant max-w-md">
                Diseño geométrico de carreteras y urbanismo sobre gemelos digitales.
              </p>
              <div className="pt-8 flex flex-col sm:flex-row gap-4">
                <Link to="/civilflowareatrabajo" className="hidden md:inline-flex bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 hover:bg-primary/90 transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                  Iniciar Diseño <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
                <Link to="/docs" className="border border-outline text-on-background px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container-highest transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                  Ver Documentación
                </Link>
              </div>
              <div className="mt-12 flex gap-8 border-t border-outline-variant pt-4">
                <div>
                  <p className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase mb-1" style={{ fontFamily: 'Geist, monospace' }}>Precisión</p>
                  <p className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>Sub-milimétrica</p>
                </div>
                <div>
                  <p className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase mb-1" style={{ fontFamily: 'Geist, monospace' }}>Simulación</p>
                  <p className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>Tiempo Real</p>
                </div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-6 lg:col-start-7 hidden md:flex items-center justify-center">
              <div className="p-8 w-full max-w-lg relative border" style={{ background: 'linear-gradient(135deg, rgba(26,29,35,0.8), rgba(26,29,35,0.4))', backdropFilter: 'blur(12px)', borderColor: 'rgba(51,56,66,0.5)' }}>
                <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }} />
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl font-bold text-on-background" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Live Metrics View</h3>
                  <span className="material-symbols-outlined text-outline">data_usage</span>
                </div>
                <div className="space-y-4">
                  {metrics.map((m, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-outline-variant pb-2">
                      <span className="text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>{m.label}</span>
                      <span className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: m.isAccent ? accent : '#00dce5' }}>{m.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 h-32 w-full border border-outline-variant relative overflow-hidden" style={{ background: '#0c0e12' }}>
                  <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#3a494a 1px, transparent 1px)', backgroundSize: '8px 8px', opacity: 0.3 }} />
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path d="M0,80 Q25,20 50,50 T100,20" fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    <circle cx="50" cy="50" fill="#00dce5" r="3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 lg:px-8" style={{ background: '#0F1115' }}>
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-4xl lg:text-[32px] font-bold text-on-background mb-2" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Capacidades del Módulo</h2>
            <p className="text-base text-on-surface-variant mt-2 max-w-2xl mb-12">Herramientas especializadas para el diseño integral de infraestructuras viales y espacios urbanos.</p>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {features.map((f, i) => (
                <div key={i} className={`${f.span} border p-8 relative overflow-hidden group hover:border-outline transition-colors`} style={{ background: '#1A1D23', borderColor: '#333842' }}>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <div className="w-12 h-12 flex items-center justify-center border mb-6 group-hover:border-primary transition-colors" style={{ background: '#333539', borderColor: '#3a494a' }}>
                        <span className="material-symbols-outlined" style={{ color: '#00dce5', fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                      </div>
                      <h3 className="text-xl font-bold text-on-background mb-3" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                      <p className="text-base text-on-surface-variant max-w-xl">{f.desc}</p>
                    </div>
                    {f.title.includes('Diseño Geométrico') && (
                      <div className="mt-8 flex items-center gap-2 uppercase cursor-pointer hover:underline" style={{ fontFamily: 'Geist, monospace', fontSize: 11, fontWeight: 700, color: '#00dce5' }}>
                        Explorar Herramientas <span className="material-symbols-outlined text-sm">arrow_outward</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CivilRoadsPage;
