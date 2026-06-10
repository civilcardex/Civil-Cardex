import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const MODULOS_HERO = [
  { id: 'flow', logo: '/logos/civilFlowlogo.webp', name: 'CivilFlow', color: '#00aaff', path: '/civilflow',
    desc: 'Diseño y análisis de redes hidráulicas, sanitarias y de gas. Modelado de flujos, presiones y caudales.',
    cats: ['Modelado de redes', 'Análisis de presiones', 'Cálculo de caudales', 'Normativas integradas'] },
  { id: 'structure', logo: '/logos/civilStructurelogo.webp', name: 'CivilStructure', color: '#7f8c8d', path: '/civilstructure',
    desc: 'Diseño estructural y análisis de elementos como puentes, losas y marcos. Cálculo de cargas y resistencia.',
    cats: ['Análisis FEM', 'Diseño de elementos', 'Cálculo de cargas', 'Normativas NTC'] },
  { id: 'terrain', logo: '/logos/civilTerrainlogo.webp', name: 'CivilTerrain', color: '#27ae60', path: '/civilterrain',
    desc: 'Topografía digital, perfiles de terreno y cálculo de movimiento de tierras. Modelos 3D del suelo.',
    cats: ['Modelos 3D', 'Curvas de nivel', 'Volúmenes corte/relleno', 'Integración LiDAR'] },
  { id: 'bim', logo: '/logos/civilBIMlogo.webp', name: 'CivilBIM', color: '#8e44ad', path: '/civilbim',
    desc: 'Integración BIM para coordinación multidisciplinar. Visualización y gestión de modelos 3D inteligentes.',
    cats: ['Importación IFC', 'Detección de colisiones', 'Coordinación BIM', 'Vinculación Revit'] },
  { id: 'manage', logo: '/logos/civilManagelogo.webp', name: 'CivilManage', color: '#e67e22', path: '/civilmanage',
    desc: 'Gestión de proyectos, presupuestos, cronogramas y seguimiento de avance de obra.',
    cats: ['Control de costos', 'Gestión de cronogramas', 'Avance de obra', 'Integración ERP'] },
  { id: 'mep', logo: '/logos/civilMEPlogo.webp', name: 'CivilMEP', color: '#16a085', path: '/civilmep',
    desc: 'Diseño de instalaciones mecánicas, eléctricas y de plomería integradas al modelo civil.',
    cats: ['Ruteo inteligente', 'Análisis de cargas', 'Dimensionamiento', 'Coordination MEP'] },
  { id: 'roads', logo: '/logos/civilRoadslogo.webp', name: 'CivilRoads', color: '#f1c40f', path: '/civilroads',
    desc: 'Diseño geométrico de vías, urbanismo, peraltes y alineamientos horizontales y verticales.',
    cats: ['Alineamientos', 'Diseño geométrico', 'Señalización', 'Análisis de tráfico'] },
];

const MOD_SUB = {
  flow: 'REDES HIDRÁULICAS, SANITARIAS Y GAS',
  structure: 'DISEÑO ESTRUCTURAL Y ANÁLISIS',
  terrain: 'TOPOGRAFÍA Y MOVIMIENTO DE TIERRAS',
  bim: 'INTEGRACIÓN BIM',
  manage: 'PRESUPUESTOS Y GESTIÓN',
  mep: 'INSTALACIONES MEP',
  roads: 'VÍAS Y URBANISMO',
};

const PILLARS = [
  { icon: 'link', title: 'INTEGRACIÓN\nTOTAL' },
  { icon: 'cloud_sync', title: 'FLUJO DE TRABAJO\nCONECTADO' },
  { icon: 'schema', title: 'DATOS ÚNICOS\nINTELIGENTES' },
  { icon: 'group_work', title: 'COLABORACIÓN\nEN TIEMPO REAL' },
];

function LandingPage() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const navigate = useNavigate();
  const hovered = hoveredIdx !== null ? MODULOS_HERO[hoveredIdx] : null;
  const handleEnter = useCallback((i: number) => setHoveredIdx(i), []);
  const handleLeave = useCallback(() => setHoveredIdx(null), []);
  const handleClick = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div className="min-h-screen" style={{ background: '#0a0e14', color: '#e2e2e8' }}>
      <style>{`
        .hero-mod-card {
          transition: transform 0.35s cubic-bezier(.4,0,.2,1), border-color 0.35s, box-shadow 0.35s;
          cursor: pointer;
        }
        .hero-mod-card:hover {
          transform: translateY(-8px) scale(1.04);
        }
        .hero-mod-card .mod-glow {
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .hero-mod-card:hover .mod-glow {
          opacity: 1;
        }
        .hero-mod-card .mod-logo {
          transition: filter 0.4s ease, transform 0.4s ease;
          filter: brightness(1);
        }
        .hero-mod-card:hover .mod-logo {
          filter: brightness(1.15) drop-shadow(0 0 12px var(--mod-color));
          transform: scale(1.08);
        }
        .desc-panel {
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition: max-height 0.4s cubic-bezier(.4,0,.2,1), opacity 0.35s ease, border-color 0.35s;
        }
        .desc-panel.active {
          max-height: 280px;
          opacity: 1;
        }
        .hero-logo-glow { animation: logoPulse 4s ease-in-out infinite; }
        @keyframes logoPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        .hero-bg-grid {
          background-image: linear-gradient(rgba(0,170,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,170,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .section-divider { background: linear-gradient(90deg, transparent, rgba(0,170,255,0.15), transparent); height: 1px; }
      `}</style>

      <Navbar />

      {/* ===== HERO ===== */}
      <section className="relative w-full h-screen flex flex-col overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center top, #0d1a2e 0%, #0a0e14 60%)' }} />
        <div className="absolute inset-0 hero-bg-grid" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] hero-logo-glow pointer-events-none"
          style={{ background: 'rgba(0,170,255,0.12)' }} />

        {/* Logo + Branding — upper area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4" style={{ paddingTop: '10vh', paddingBottom: '2vh' }}>
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 md:mb-6 p-4 md:p-5 rounded-2xl"
              style={{ background: 'radial-gradient(circle at center, rgba(0,170,255,0.08) 0%, transparent 70%)', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,170,255,0.1)' }}>
              <img src="/logos/civilCorelogo.webp" alt="CivilCore"
                className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain"
                style={{ filter: 'drop-shadow(0 0 80px rgba(0,170,255,0.5))' }} />
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight uppercase mb-3 md:mb-4"
              style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              <span style={{ color: '#e8f4fd' }}>CIVIL</span>
              <span style={{ color: '#00dce5' }}>CORE</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base tracking-[0.35em] uppercase font-semibold"
              style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>
              DISEÑA. ANALIZA. OPTIMIZA. CONSTRUYE.
            </p>
          </div>
        </div>

        {/* 7 Module Cards — bottom area */}
        <div className="relative z-10 px-4 pb-6 sm:pb-8 md:pb-10">
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 md:gap-4">
            {MODULOS_HERO.map((m, i) => (
              <div key={m.id}
                className="hero-mod-card flex flex-col items-center text-center p-2 sm:p-3 md:p-4 border rounded-lg relative"
                style={{ '--mod-color': m.color,
                  background: 'rgba(10,14,20,0.6)',
                  backdropFilter: 'blur(8px)',
                  borderColor: hoveredIdx === i ? m.color + '55' : 'transparent',
                  boxShadow: hoveredIdx === i ? `0 0 20px ${m.color}22, 0 0 40px ${m.color}0a` : 'none' } as any}
                onMouseEnter={() => handleEnter(i)}
                onMouseLeave={handleLeave}
                onClick={() => handleClick(m.path)}>
                <div className="mod-glow absolute inset-0 rounded-lg pointer-events-none"
                  style={{ background: `radial-gradient(circle at center, ${m.color}0c 0%, transparent 70%)` }} />
                <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 flex items-center justify-center mb-2 md:mb-3 relative z-10 rounded-xl"
                  style={{ background: 'radial-gradient(circle at center, rgba(0,170,255,0.04) 0%, transparent 70%)' }}>
                  <img src={m.logo} alt={m.name} className="mod-logo w-full h-full object-contain p-1 sm:p-2" />
                </div>
                <span className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider relative z-10"
                  style={{ color: m.color, fontFamily: 'Hanken Grotesk, sans-serif' }}>
                  {m.name.replace('Civil', '')}
                </span>
                <span className="text-[8px] sm:text-[9px] md:text-[10px] text-center mt-1 md:mt-1.5 relative z-10 uppercase tracking-wider leading-tight"
                  style={{ color: '#6b8cae', fontFamily: 'Geist, monospace', fontWeight: 600 }}>
                  {(MOD_SUB as Record<string, string>)[m.id]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DESCRIPTION PANEL — below hero, slides down ===== */}
      <div className={`desc-panel border-t-2 border-b-2 ${hovered ? 'active' : ''}`}
        style={{ background: 'rgba(10,14,20,0.95)', backdropFilter: 'blur(16px)',
          borderColor: hovered ? hovered.color : 'transparent' }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-5 flex flex-col md:flex-row gap-5 items-start">
          {hovered ? (
            <>
              <div className="flex items-center gap-4 flex-shrink-0 min-w-fit">
                <div className="w-14 h-14 border rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: hovered.color + '44', background: hovered.color + '0a' }}>
                  <img src={hovered.logo} alt={hovered.name} className="w-10 h-10 object-contain"
                    style={{ filter: `drop-shadow(0 0 6px ${hovered.color}55)` }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold whitespace-nowrap" style={{ color: hovered.color, fontFamily: 'Hanken Grotesk, sans-serif' }}>{hovered.name}</h3>
                  <p className="text-xs uppercase tracking-widest whitespace-nowrap" style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>
                    {((MOD_SUB as Record<string, string>)[hovered.id] || '').charAt(0) + ((MOD_SUB as Record<string, string>)[hovered.id] || '').slice(1).toLowerCase()}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                <p className="text-sm leading-relaxed" style={{ color: '#8a9bb0' }}>{hovered.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {hovered.cats.map(c => (
                    <span key={c} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 border rounded"
                      style={{ borderColor: hovered.color + '33', color: hovered.color, fontFamily: 'Geist, monospace', fontWeight: 600 }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: hovered.color }} />
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : <div style={{ minHeight: 1 }} />}
        </div>
      </div>

      {/* ===== 4 PILLARS — always visible, independent section ===== */}
      <section className="py-16 px-6 lg:px-8" style={{ background: '#0a0e14' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-px bg-outline-variant flex-grow" />
            <h2 className="text-xl font-semibold uppercase tracking-widest px-4" style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>Pilares</h2>
            <div className="h-px bg-outline-variant flex-grow" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PILLARS.map(p => (
              <div key={p.icon} className="border border-outline-variant p-6 flex items-center gap-4 hover:border-primary/30 transition-all"
                style={{ background: '#111317' }}>
                <span className="material-symbols-outlined text-2xl flex-shrink-0" style={{ color: '#00dce5', fontVariationSettings: "'FILL' 0" }}>{p.icon}</span>
                <span className="text-[11px] font-bold uppercase tracking-widest leading-tight" style={{ color: '#e8f4fd', fontFamily: 'Geist, monospace' }}>{p.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ===== POR QUÉ CIVILCORE ===== */}
      <section className="py-20 px-6 lg:px-8" style={{ background: '#0a0e14' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px bg-outline-variant flex-grow" />
            <h2 className="text-xl font-semibold uppercase tracking-widest px-4" style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>¿Por qué CivilCore?</h2>
            <div className="h-px bg-outline-variant flex-grow" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: 'speed', title: 'VELOCIDAD', desc: 'De los datos del proyecto a la memoria de cálculo en minutos, no en horas. Cálculos en tiempo real con retroalimentación instantánea.' },
              { icon: 'verified', title: 'PRECISIÓN NORMATIVA', desc: 'Verificación automática contra NTC, RAS, NFPA y normativas locales. Reducción de errores humanos al 0%.' },
              { icon: 'hub', title: 'INTEGRACIÓN TOTAL', desc: 'Todos los módulos comparten un mismo modelo de datos. Cambios en topografía se reflejan en estructura, redes y presupuesto.' },
            ].map(f => (
              <div key={f.icon} className="border border-outline-variant p-8 hover:border-primary/30 transition-all group"
                style={{ background: '#111317' }}>
                <span className="material-symbols-outlined text-3xl mb-4 block group-hover:text-primary transition-colors" style={{ color: '#00dce5' }}>{f.icon}</span>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6b8cae' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ===== CTA ===== */}
      <section className="py-24 px-6 lg:px-8" style={{ background: '#0a0e14' }}>
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold uppercase" style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>
            ¿Listo para elaborar sus<br />
            <span style={{ color: '#00dce5' }}>memorias de cálculo?</span>
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: '#6b8cae' }}>
            CivilCore — de los datos del proyecto a la memoria de cálculo exportable, con verificación normativa automática.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link to="/civilflowareatrabajo" className="hidden md:inline-block bg-primary text-on-primary px-10 py-4 uppercase text-[11px] tracking-[0.1em] font-bold hover:bg-primary-container transition-all"
              style={{ fontFamily: 'Geist, monospace', boxShadow: '0 0 20px rgba(0,245,255,0.3)' }}>
              EMPEZAR AHORA
            </Link>
            <span className="md:hidden text-sm px-6 py-3 text-center" style={{ color: '#f5a623', fontFamily: 'Geist, monospace', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 4 }}>
              Disponible solo en escritorio
            </span>
            <Link to="/docs" className="border border-outline-variant px-10 py-4 uppercase text-[11px] tracking-[0.1em] font-bold hover:border-primary hover:text-primary transition-all"
              style={{ fontFamily: 'Geist, monospace', color: '#6b8cae' }}>
              DOCUMENTACIÓN TÉCNICA
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-outline-variant" style={{ background: '#0a0e14' }}>
        <div className="flex flex-col md:flex-row justify-between items-center py-8 px-6 lg:px-8 gap-4 max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logos/civilCorelogo.webp" alt="CivilCore" className="h-11 w-11 object-contain" />
              <span className="text-2xl font-bold uppercase" style={{ color: '#3a494a', fontFamily: 'Hanken Grotesk, sans-serif' }}>CivilCore</span>
            </Link>
            <nav className="flex gap-6">
              <Link to="/docs" className="uppercase tracking-widest transition-colors hover:text-on-surface" style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Geist, monospace', color: '#3a494a' }}>Documentación</Link>
              <Link to="/pricing" className="uppercase tracking-widest transition-colors hover:text-on-surface" style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Geist, monospace', color: '#3a494a' }}>Precios</Link>
              <span className="uppercase tracking-widest cursor-pointer transition-colors hover:text-on-surface" style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Geist, monospace', color: '#3a494a' }}>Contacto Técnico</span>
            </nav>
          </div>
          <div style={{ color: '#3a494a', fontSize: 12 }}>
            © 2026 CivilCore. Ingeniería de Precisión.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
