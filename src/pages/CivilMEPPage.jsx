import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const features = [
  { icon: 'account_tree', title: 'Ruteo Inteligente de Tuberías y Ductos', desc: 'Algoritmos de pathfinding para el trazado automático evitando colisiones estructurales. Optimización de material basada en parámetros de fricción y caída de presión.', span: 'lg:col-span-2 lg:row-span-2', badge: 'STATUS: OPTIMAL' },
  { icon: 'bolt', title: 'Análisis de Cargas', desc: 'Simulación térmica y eléctrica en tiempo real.', span: '', terminal: ['LOAD_ELEC: ACTIVE', 'LOAD_THERM: CALC...'] },
  { icon: 'settings_overscan', title: 'Dimensionamiento', desc: 'Selección automática de equipos según normativa.', span: '', autoSize: true },
  { icon: 'architecture', title: 'Documentación de Planos de Taller', desc: 'Extracción automatizada de isométricos, listados de materiales (BOM) y detalles constructivos directamente del modelo federado.', span: 'md:col-span-2 lg:col-span-2' },
];

export default function CivilMEPPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111317', color: '#e2e2e8' }}>
      <Navbar />
      <main className="flex-grow pt-16 flex flex-col w-full max-w-[1440px] mx-auto">
        <section className="relative w-full flex flex-col lg:flex-row items-center px-6 lg:px-8 py-16 gap-12 overflow-hidden border-b border-outline-variant" style={{ background: '#1a1c20', minHeight: 600 }}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative z-10 w-full lg:w-1/2 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 border border-outline-variant px-3 py-1 w-max" style={{ background: '#111317' }}>
              <span className="w-2 h-2 bg-primary-fixed-dim animate-pulse" style={{ background: '#00dce5' }} />
              <img src="/logos/civilMEPlogo.webp" alt="CivilMEP" className="h-4 w-4 object-contain" />
              <span className="text-[13px] uppercase" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>Module: CivilMEP</span>
            </div>
            <h1 className="text-[48px] leading-[1.1] font-bold text-on-background tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              Diseño Inteligente de <br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, #00dce5, #79ff5b)' }}>Instalaciones Especiales</span>
            </h1>
            <p className="text-base text-on-surface-variant max-w-xl">
              Modelado avanzado de sistemas mecánicos, eléctricos e hidrosanitarios. Diseñado para workflows de alta densidad y precisión .
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <Link to="/civilflowareatrabajo" className="text-on-primary px-8 py-3 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2" style={{ fontFamily: 'Geist, monospace', background: '#00dce5' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>precision_manufacturing</span> INICIAR MODELADO
              </Link>
              <Link to="/docs" className="border border-outline-variant text-on-surface px-8 py-3 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2 hover:border-primary transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>data_object</span> VER DOCS API
              </Link>
            </div>
            <div className="mt-8 border border-outline-variant w-full max-w-md" style={{ background: '#0c0e12' }}>
              <div className="flex justify-between border-b border-outline-variant px-4 py-2">
                <span className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>ENGINE</span>
                <span className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>CIVIL-X v4.2</span>
              </div>
              <div className="flex justify-between px-4 py-2" style={{ background: 'rgba(26,28,32,0.5)' }}>
                <span className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>LOD SUPPORT</span>
                <span className="text-[13px] text-on-surface" style={{ fontFamily: 'Geist, monospace' }}>LOD 100 - LOD 500</span>
              </div>
            </div>
          </div>
          <div className="relative w-full lg:w-1/2 h-[400px] lg:h-[600px] flex items-center justify-center">
            <div className="absolute top-10 right-10 z-20 border border-outline-variant p-3 flex flex-col gap-1" style={{ background: 'rgba(51,53,57,0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 0 15px rgba(0,220,229,0.15)' }}>
              <span className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>SYSTEM PRESSURE</span>
              <span className="text-lg font-bold" style={{ fontFamily: 'Geist, monospace', color: '#79ff5b' }}>124.5 PSI</span>
            </div>
            <div className="absolute bottom-20 left-0 z-20 border border-outline-variant p-3 flex flex-col gap-1" style={{ background: 'rgba(51,53,57,0.8)', backdropFilter: 'blur(8px)' }}>
              <span className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>FLOW RATE</span>
              <span className="text-lg font-bold" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>450 GPM</span>
            </div>
            <div className="relative z-10 w-full h-full border border-outline-variant overflow-hidden group" style={{ background: '#111317' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 120, opacity: 0.15 }}>valve</span>
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,220,229,0.1)', mixBlendMode: 'overlay' }} />
            </div>
          </div>
        </section>

        <section className="w-full px-6 lg:px-8 py-20 flex flex-col gap-12 border-b border-outline-variant">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Capacidades del Módulo</h2>
            <p className="text-[13px] text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>SYS.MEP.FEATURES // ANALYTICS</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[250px]">
            {features.map((f, i) => (
              <div key={i} className={`border border-outline-variant p-6 flex flex-col justify-between hover:border-primary transition-colors group relative overflow-hidden ${f.span || ''}`} style={{ background: f.span ? '#1e2024' : '#1a1c20' }}>
                <div className="z-10 flex flex-col gap-4">
                  <div className={`w-12 border border-outline-variant flex items-center justify-center text-primary ${f.span ? 'bg-surface' : 'bg-surface-container-highest'}`} style={{ width: f.span ? 48 : 40, height: f.span ? 48 : 40, color: '#00dce5' }}>
                    <span className="material-symbols-outlined">{f.icon}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                  <p className="text-sm text-on-surface-variant max-w-sm">{f.desc}</p>
                </div>
                {f.badge && (
                  <div className="z-10 mt-4 border-t border-outline-variant pt-4">
                    <span className="text-[13px] flex items-center gap-2" style={{ fontFamily: 'Geist, monospace', color: '#79ff5b' }}>
                      <span className="w-1.5 h-1.5" style={{ background: '#79ff5b' }} /> {f.badge}
                    </span>
                  </div>
                )}
                {f.terminal && (
                  <div className="mt-auto text-[13px] text-outline bg-surface p-2 border border-outline-variant" style={{ fontFamily: 'Geist, monospace' }}>
                    {f.terminal.map((line, j) => (
                      <div key={j}>&gt; {line}</div>
                    ))}
                  </div>
                )}
                {f.autoSize && (
                  <div className="mt-auto flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm" style={{ color: '#79ff5b' }}>check_box</span>
                    <span className="text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>AUTO-SIZE ON</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-outline-variant" style={{ background: '#0c0e12' }}>
        <div className="flex flex-col md:flex-row justify-between items-center px-6 lg:px-8 py-8 w-full gap-4">
          <span className="text-[11px] tracking-[0.08em] font-bold text-primary uppercase" style={{ fontFamily: 'Geist, monospace' }}>CivilCore</span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link to="/docs" className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant hover:text-primary uppercase transition-colors" style={{ fontFamily: 'Geist, monospace' }}>API</Link>
            <Link to="/docs" className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant hover:text-primary uppercase transition-colors" style={{ fontFamily: 'Geist, monospace' }}>SDK</Link>
          </div>
          <span className="text-[13px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>© 2026 CIVILCORE ENGINEERING. ALL RIGHTS RESERVED.</span>
        </div>
      </footer>
    </div>
  );
}
