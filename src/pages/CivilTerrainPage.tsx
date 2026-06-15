import React from 'react';
import { Link } from 'react-router-dom';
import ModulePageLayout from '../components/ModulePageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

const features = [
  { icon: 'cloud_sync', title: 'Procesamiento de Nubes de Puntos LiDAR', desc: 'Ingesta masiva de datos LiDAR con filtrado automatizado de ruido y clasificación de terreno. Algoritmos optimizados para manejar millones de puntos con latencia mínima.', badge: 'CAPACITY: >50M pts/sec', span: false },
  { icon: 'layers', title: 'Cálculo de Volúmenes de Corte y Relleno', desc: 'Comparación instantánea entre superficies existentes y de diseño. Generación de mallas de diferencias y reportes volumétricos precisos mediante el método de áreas promedio o prismas.', span: true },
  { icon: 'architecture', title: 'Generación de Curvas de Nivel de Alta Densidad', desc: 'Extracción topológica con control absoluto sobre intervalos, suavizado y etiquetado automático. Interpolación TIN adaptativa para representar quiebres críticos del terreno.', span: false },
  { icon: 'route', title: 'Integración con CivilRoads para trazado vial', desc: 'Sincronización bidireccional con el módulo de diseño vial. Las actualizaciones del modelo de terreno se reflejan instantáneamente en los perfiles longitudinales y secciones transversales.', span: true },
];

export default function CivilTerrainPage() {
  usePageMeta('Terreno');
  return (
    <ModulePageLayout title="Terreno" description="Modelado Digital de Elevación de Próxima Generación." mainClassName="pt-20 px-6 lg:px-8 pb-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <section className="relative z-10 flex flex-col md:flex-row items-center gap-12 mb-24 max-w-7xl mx-auto">
          <div className="md:w-1/2 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-outline-variant w-fit" style={{ background: '#282a2e' }}>
              <img src="/logos/civilTerrainlogo.webp" alt="CivilTerrain" className="h-4 w-4 object-contain" />
              <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace', color: '#79ff5b' }}>Módulo CivilTerrain</span>
            </div>
            <h1 className="text-xl md:text-3xl lg:text-[36px] font-bold text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              Modelado Digital de Elevación de Próxima Generación
            </h1>
            <p className="text-base text-on-surface-variant max-w-xl">
              Herramientas avanzadas para topografía, cálculo preciso de movimiento de tierras y análisis  de alta densidad, integradas en un flujo de trabajo brutalmente eficiente.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link to="/civilflowareatrabajo" className="hidden md:inline-block bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-colors border border-primary" style={{ fontFamily: 'Geist, monospace' }}>
                Iniciar Prueba Gratuita
              </Link>
              <Link to="/docs" className="bg-transparent text-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container-highest transition-colors border border-primary" style={{ fontFamily: 'Geist, monospace' }}>
                Ver Documentación Técnica
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 w-full h-[400px] border border-outline-variant relative overflow-hidden group" style={{ background: '#1e2024' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 120, opacity: 0.15 }}>terrain</span>
            </div>
            <div className="absolute top-4 left-4 flex flex-col gap-1">
              <span className="text-[13px] text-primary px-2 py-1 backdrop-blur-sm border border-outline-variant" style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.8)' }}>ELEV: +1452.34m</span>
              <span className="text-[13px] text-secondary px-2 py-1 backdrop-blur-sm border border-outline-variant" style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.8)' }}>SLOPE: 12.4%</span>
            </div>
            <div className="absolute bottom-4 right-4">
              <span className="text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>RENDER ENGINE v2.4.1</span>
            </div>
          </div>
        </section>

        <section className="relative z-10 max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-primary mb-8 border-b border-outline-variant pb-4" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Capacidades Técnicas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {features.map((f, i) => (
              <div key={i} className={`border border-outline-variant p-6 hover:border-primary transition-colors flex flex-col gap-4 group ${f.span ? 'md:col-span-2' : ''}`} style={{ background: '#1a1c20' }}>
                <div className="h-12 w-12 flex items-center justify-center border group-hover:border-primary transition-colors" style={{ background: '#333539', borderColor: '#3a494a' }}>
                  <span className="material-symbols-outlined text-primary text-2xl">{f.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                <p className="text-sm text-on-surface-variant flex-grow">{f.desc}</p>
                {f.badge && (
                  <div className="mt-auto pt-4 border-t" style={{ borderColor: '#333539' }}>
                    <span className="text-[13px] text-outline" style={{ fontFamily: 'Geist, monospace' }}>{f.badge}</span>
                  </div>
                )}
                {f.title.includes('Volúmenes') && (
                  <div className="mt-4 border border-outline-variant p-4 grid grid-cols-2 gap-4" style={{ background: '#111317' }}>
                    <div>
                      <div className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant mb-1 uppercase" style={{ fontFamily: 'Geist, monospace' }}>Volumen de Corte</div>
                      <div className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#ffb4ab' }}>45,230.5 m³</div>
                    </div>
                    <div>
                      <div className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant mb-1 uppercase" style={{ fontFamily: 'Geist, monospace' }}>Volumen de Relleno</div>
                      <div className="text-[13px] text-primary" style={{ fontFamily: 'Geist, monospace' }}>38,105.2 m³</div>
                    </div>
                  </div>
                )}
                {f.title.includes('CivilRoads') && (
                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-secondary rounded-full" />
                    <span className="text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Seamless Sync Active</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
    </ModulePageLayout>
  );
}
