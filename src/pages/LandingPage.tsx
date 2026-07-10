import {  useState, useCallback, useEffect, useRef  } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePageMeta } from '../hooks/usePageMeta';
import Reveal from '../components/Reveal';
import BlueprintParticles from '../components/landing/BlueprintParticles';
import CursorSpotlight from '../components/landing/CursorSpotlight';
import StickyCtaBanner from '../components/landing/StickyCtaBanner';
import Tilt3DCard from '../components/landing/Tilt3DCard';
import TypewriterText from '../components/landing/TypewriterText';
import ScrollIndicator from '../components/landing/ScrollIndicator';
import HeroAurora from '../components/landing/HeroAurora';
import TopographyBackground from '../components/landing/TopographyBackground';
import RotatingWireframe from '../components/landing/RotatingWireframe';


const MODULOS_HERO = [
  { id: 'flow', logo: '/logos/civilFlowlogo.svg', name: 'CivilFlow', color: '#00aaff', path: '/civilflow',
    desc: 'Diseño y análisis de redes hidráulicas, sanitarias y de gas. Modelado de flujos, presiones y caudales.',
    cats: ['Modelado de redes', 'Análisis de presiones', 'Cálculo de caudales', 'Normativas integradas'] },
  { id: 'manage', logo: '/logos/civilManagelogo.svg', name: 'Manager', color: '#e67e22', path: '/civilmanage',
    desc: 'Gestión de proyectos, presupuestos, cronogramas y seguimiento de avance de obra.',
    cats: ['Control de costos', 'Gestión de cronogramas', 'Avance de obra', 'Integración ERP'] },
  { id: 'structure', logo: '/logos/civilStructurelogo.svg', name: 'CivilStructure', color: '#7f8c8d', path: '/civilstructure',
    desc: 'Diseño estructural y análisis de elementos como puentes, losas y marcos. Cálculo de cargas y resistencia.',
    cats: ['Análisis FEM', 'Diseño de elementos', 'Cálculo de cargas', 'Normativas NTC'] },
  { id: 'terrain', logo: '/logos/civilTerrainlogo.svg', name: 'CivilTerrain', color: '#27ae60', path: '/civilterrain',
    desc: 'Topografía digital, perfiles de terreno y cálculo de movimiento de tierras. Modelos 3D del suelo.',
    cats: ['Modelos 3D', 'Curvas de nivel', 'Volúmenes corte/relleno', 'Integración LiDAR'] },
  { id: 'bim', logo: '/logos/civilBIMlogo.svg', name: 'CivilBIM', color: '#8e44ad', path: '/civilbim',
    desc: 'Integración BIM para coordinación multidisciplinar. Visualización y gestión de modelos 3D inteligentes.',
    cats: ['Importación IFC', 'Detección de colisiones', 'Coordinación BIM', 'Vinculación Revit'] },
  { id: 'mep', logo: '/logos/civilMEPlogo.svg', name: 'CivilMEP', color: '#16a085', path: '/civilmep',
    desc: 'Diseño de instalaciones mecánicas, eléctricas y de plomería integradas al modelo civil.',
    cats: ['Ruteo inteligente', 'Análisis de cargas', 'Dimensionamiento', 'Coordination MEP'] },
  { id: 'roads', logo: '/logos/civilRoadslogo.svg', name: 'CivilRoads', color: '#f1c40f', path: '/civilroads',
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
  const [heroReady, setHeroReady] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  usePageMeta('Inicio', 'Plataforma de ingeniería civil para diseño hidráulico, sanitario y estructural');

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setHeroReady(true), 250);
    
    const handleScroll = () => {
      if (prefersReducedMotion || !heroRef.current) return;
      heroRef.current.style.setProperty('--scroll-y', `${window.scrollY}`);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleEnter = useCallback((i: number) => setHoveredIdx(i), []);
  const handleLeave = useCallback(() => setHoveredIdx(null), []);
  const handleClick = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div className="min-h-screen" style={{ background: '#0a0e14', color: '#e2e2e8' }}>
      <script type="application/ld+json">{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "CivilFlow",
  "url": "https://civilcore.app",
  "description": "Software de ingeniería hidrosanitaria para diseño de redes de agua, gas, sanitarias, pluviales y equipos de presión.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://civilcore.app/docs?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
})}</script>
      <script type="application/ld+json">{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "CivilFlow",
  "url": "https://civilcore.app",
  "logo": "https://civilcore.app/logo.svg",
  "description": "Software de ingeniería civil e hidrosanitaria. Cumplimiento NTC 1500, RAS 2000, NSR-10.",
  "foundingDate": "2024"
})}</script>
      <style>{`
        .hero-mod-card {
          transition: border-color 0.35s, box-shadow 0.35s;
          cursor: pointer;
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
        
        /* Tooltip */
        @keyframes tooltipBounce {
          0% { opacity: 0; transform: translate(-50%, 10px) scale(0.9); }
          60% { opacity: 1; transform: translate(-50%, -4px) scale(1.02); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .mod-tooltip {
          display: none;
          position: absolute;
          bottom: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          width: 320px;
          background: rgba(10, 14, 20, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid var(--mod-color);
          border-radius: 8px;
          padding: 16px;
          z-index: 50;
          text-align: left;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.5);
          pointer-events: none;
        }
        .hero-mod-card:hover .mod-tooltip, .hero-mod-card:focus-within .mod-tooltip {
          display: block;
          animation: tooltipBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .mod-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 6px;
          border-style: solid;
          border-color: var(--mod-color) transparent transparent transparent;
        }

        .hero-logo-glow { animation: logoPulse 4s ease-in-out infinite; }
        @keyframes logoPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        .hero-bg-grid {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background-size: 60px 60px;
          background-image: 
            linear-gradient(to right, rgba(0,220,229,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,220,229,0.03) 1px, transparent 1px);
          transform: perspective(1000px) rotateX(60deg) rotateZ(-45deg);
          transform-origin: center;
        }
        .section-divider { background: linear-gradient(90deg, transparent, rgba(0,170,255,0.15), transparent); height: 1px; border: none; margin: 0; }

        html {
          scroll-snap-type: y proximity;
        }
        section {
          scroll-snap-align: start;
        }
        .will-change-transform {
          will-change: transform;
        }

        /* Shimmer */
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .core-shimmer {
          background: linear-gradient(90deg, #00dce5 0%, #00aaff 25%, #00f5ff 50%, #00aaff 75%, #00dce5 100%);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shimmer 6s linear infinite;
        }

        /* Skeleton */
        @keyframes skeletonPulse {
          0% { opacity: 0.5; }
          50% { opacity: 0.8; }
          100% { opacity: 0.5; }
        }
        .skeleton-block {
          background: linear-gradient(90deg, #111317, #1a1c20, #111317);
          background-size: 200% 100%;
          animation: skeletonPulse 1.5s ease-in-out infinite;
          border-radius: 8px;
        }

        /* Icon morphing */
        .pilar-card .material-symbols-outlined, 
        .why-card .material-symbols-outlined {
          transition: font-variation-settings 0.4s ease;
        }
        .pilar-card:hover .material-symbols-outlined, 
        .why-card:hover .material-symbols-outlined {
          font-variation-settings: 'FILL' 1 !important;
        }

        /* Entrance and hover animations */
        @keyframes heroEntrance {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .hero-enter-logo {
          opacity: 0;
          animation: heroEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hero-enter-title {
          opacity: 0;
          animation: heroEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
        }
        .hero-enter-subtitle {
          opacity: 0;
          animation: heroEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
        }
        @keyframes cardEntrance {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .hero-card-entrance {
          opacity: 0;
          animation: cardEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pilar-card, .why-card {
          transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.3s, box-shadow 0.3s;
        }
        .pilar-card:hover, .why-card:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 220, 229, 0.3) !important;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(0, 220, 229, 0.05);
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-snap-type: none !important; }
          .core-shimmer { animation: none !important; }
          .skeleton-block { animation: none !important; }
          .pilar-card .material-symbols-outlined, 
          .why-card .material-symbols-outlined { transition: none !important; }
          
          .hero-enter-logo,
          .hero-enter-title,
          .hero-enter-subtitle,
          .hero-card-entrance {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .hero-mod-card:hover,
          .pilar-card:hover,
          .why-card:hover {
            transform: none !important;
          }
        }
      `}</style>

      <Navbar />

      {/* ===== HERO ===== */}
      <section id="hero-section" ref={heroRef} className="relative min-h-screen flex flex-col justify-center overflow-hidden" 
        style={{ background: '#05070a' }}>
        
        {/* Background Orchestration */}
        <HeroAurora />
        <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
          <div className="hero-bg-grid" />
        </div>
        <TopographyBackground />
        <RotatingWireframe />
        <div className="absolute inset-0 z-[4] pointer-events-auto">
          <BlueprintParticles />
        </div>

        
        <CursorSpotlight containerRef={heroRef as React.RefObject<HTMLElement>} />

        {/* Logo + Branding — upper area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4" style={{ paddingTop: '10vh', paddingBottom: '2vh' }}>
          {!heroReady ? (
            <div className="flex flex-col items-center text-center gap-6">
              <div className="skeleton-block w-36 h-36 md:w-48 md:h-48 rounded-2xl" />
              <div className="skeleton-block w-80 h-16 md:w-[600px] md:h-24 mt-2" />
              <div className="skeleton-block w-64 h-4 md:w-96" />
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="hero-enter-logo relative mb-4 md:mb-6 p-4 md:p-5 rounded-2xl"
                style={{ background: 'radial-gradient(circle at center, rgba(0,170,255,0.08) 0%, transparent 70%)', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,170,255,0.1)' }}>
                <img src="/logos/civilCorelogo.svg" alt="CivilCore"
                  className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain"
                  style={{ filter: 'drop-shadow(0 0 80px rgba(0,170,255,0.5))' }}  width={112} height={112} loading="lazy" />
              </div>
              <h1 className="hero-enter-title text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight uppercase mb-3 md:mb-4"
                style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
                <span style={{ color: '#e8f4fd' }}>CIVIL</span>
                <span className="core-shimmer">CORE</span>
              </h1>
              <TypewriterText 
                text="DISEÑA. ANALIZA. OPTIMIZA. CONSTRUYE." 
                delay={800}
                className="hero-enter-subtitle text-xs sm:text-sm md:text-base tracking-[0.35em] uppercase font-semibold"
                style={{ color: '#8AB4D6', fontFamily: 'Geist, monospace' }}
              />
            </div>
          )}
        </div>

        <ScrollIndicator />

        {/* 7 Module Cards — bottom area */}
        <div className="relative z-10 px-4 pb-6 sm:pb-8 md:pb-10">
          <ul className="max-w-7xl mx-auto flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-5" style={{ listStyle: 'none', margin: '0 auto', padding: 0 }}>
            {MODULOS_HERO.map((m, i) => (
              <li key={m.id} className="relative w-[140px] sm:w-[150px] md:w-[160px]" style={{ zIndex: hoveredIdx === i ? 30 : 1 }}>
                <Tilt3DCard
                  className="hero-mod-card hero-card-entrance flex flex-col items-center justify-center text-center p-3 border rounded-lg h-full w-full relative"
                  style={{ '--mod-color': m.color,
                    background: 'rgba(10,14,20,0.6)',
                    backdropFilter: 'blur(8px)',
                    borderColor: hoveredIdx === i ? m.color + '55' : 'transparent',
                    boxShadow: hoveredIdx === i ? `0 0 20px ${m.color}22, 0 0 40px ${m.color}0a` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    animationDelay: `${450 + i * 80}ms` } as any}>
                  
                  <div className="mod-tooltip">
                    <h3 className="text-base font-bold mb-2" style={{ color: m.color, fontFamily: 'Hanken Grotesk, sans-serif' }}>{m.name}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: '#8a9bb0' }}>{m.desc}</p>
                  </div>

                  <div className="mod-glow absolute inset-0 rounded-lg pointer-events-none"
                    style={{ background: `radial-gradient(circle at center, ${m.color}0c 0%, transparent 70%)` }} />
                  <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 relative z-10 rounded-xl"
                    style={{
                      background: 'radial-gradient(circle at center, rgba(0,170,255,0.04) 0%, transparent 70%)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px'
                    }}>
                    <img src={m.logo} alt={m.name} className="mod-logo" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                  </div>
                  <span className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider relative z-10"
                    style={{ color: m.color, fontFamily: 'Hanken Grotesk, sans-serif' }}>
                    {m.name.replace('Civil', '')}
                  </span>
                  <span className="text-[8px] sm:text-[9px] md:text-[10px] text-center mt-1 md:mt-1.5 relative z-10 uppercase tracking-wider leading-tight"
                    style={{ color: '#8AB4D6', fontFamily: 'Geist, monospace', fontWeight: 600 }}>
                    {(MOD_SUB as Record<string, string>)[m.id]}
                  </span>
                  
                  <button type="button" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    aria-label={`${m.name}: ${m.desc}`}
                    onClick={() => handleClick(m.path)}
                    onFocus={() => handleEnter(i)}
                    onBlur={handleLeave}
                    onMouseEnter={() => handleEnter(i)}
                    onMouseLeave={handleLeave}
                  />
                </Tilt3DCard>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== 4 PILLARS — always visible, independent section ===== */}
      <section className="py-16 px-6 lg:px-8" style={{ background: '#0a0e14' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="h-px bg-outline-variant flex-grow" />
              <h2 className="text-xl font-semibold uppercase tracking-widest px-4" style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>Pilares</h2>
              <div className="h-px bg-outline-variant flex-grow" />
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PILLARS.map((p, index) => (
              <Reveal key={p.icon} delay={index * 100} className="h-full">
                <div className="pilar-card border border-outline-variant p-6 flex items-center gap-4 hover:border-primary/30 transition-all h-full"
                  style={{ background: '#111317' }}>
                  <span className="material-symbols-outlined text-2xl flex-shrink-0" style={{ color: '#00dce5', fontVariationSettings: "'FILL' 0" }}>{p.icon}</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest leading-tight" style={{ color: '#e8f4fd', fontFamily: 'Geist, monospace' }}>{p.title}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ===== POR QUÉ CIVILCORE ===== */}
      <section className="py-20 px-6 lg:px-8" style={{ background: '#0a0e14' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="h-px bg-outline-variant flex-grow" />
              <h2 className="text-xl font-semibold uppercase tracking-widest px-4" style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>¿Por qué CivilCore?</h2>
              <div className="h-px bg-outline-variant flex-grow" />
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: 'speed', title: 'VELOCIDAD', desc: 'De los datos del proyecto a la memoria de cálculo en minutos, no en horas. Cálculos en tiempo real con retroalimentación instantánea.' },
              { icon: 'verified', title: 'PRECISIÓN NORMATIVA', desc: 'Verificación automática contra NTC, RAS, NFPA y normativas locales. Reducción de errores humanos al 0%.' },
              { icon: 'hub', title: 'INTEGRACIÓN TOTAL', desc: 'Todos los módulos comparten un mismo modelo de datos. Cambios en topografía se reflejan en estructura, redes y presupuesto.' },
            ].map((f, index) => (
              <Reveal key={f.icon} delay={index * 100} className="h-full">
                <div className="why-card border border-outline-variant p-8 hover:border-primary/30 transition-all group h-full"
                  style={{ background: '#111317' }}>
                  <span className="material-symbols-outlined text-3xl mb-4 block group-hover:text-primary transition-colors" style={{ color: '#00dce5' }}>{f.icon}</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#8AB4D6' }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ===== CTA ===== */}
      <section id="cta-section" className="py-24 px-6 lg:px-8" style={{ background: '#0a0e14' }}>
        <Reveal className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold uppercase" style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>
            ¿Listo para elaborar sus<br />
            <span style={{ color: '#00dce5' }}>memorias de cálculo?</span>
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: '#8AB4D6' }}>
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
              style={{ fontFamily: 'Geist, monospace', color: '#8AB4D6' }}>
              DOCUMENTACIÓN TÉCNICA
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-outline-variant" style={{ background: '#0a0e14' }}>
        <div className="flex flex-col md:flex-row justify-between items-center py-8 px-6 lg:px-8 gap-4 max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logos/civilCorelogo.svg" alt="CivilCore" className="h-11 w-11 object-contain"  width={44} height={44} loading="lazy" />
              <span className="text-2xl font-bold uppercase" style={{ color: '#6a8e8e', fontFamily: 'Hanken Grotesk, sans-serif' }}>CivilCore</span>
            </Link>
            <nav className="flex gap-6">
              <Link to="/docs" className="uppercase tracking-widest transition-colors hover:text-on-surface" style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Geist, monospace', color: '#6a8e8e' }}>Documentación</Link>
              <Link to="/pricing" className="uppercase tracking-widest transition-colors hover:text-on-surface" style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Geist, monospace', color: '#6a8e8e' }}>Precios</Link>
              <button type="button" className="uppercase tracking-widest cursor-pointer transition-colors hover:text-on-surface" style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Geist, monospace', color: '#6a8e8e', background: 'none', border: 'none', padding: 0 }}>Contacto Técnico</button>
            </nav>
          </div>
          <div style={{ color: '#6a8e8e', fontSize: 12 }}>
            © 2026 CivilCore. Ingeniería de Precisión.
          </div>
        </div>
      </footer>
      
      <StickyCtaBanner heroId="hero-section" ctaId="cta-section" />
    </div>
  );
}

export default LandingPage;
