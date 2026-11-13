import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.tsx';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { metaDeRuta } from '../seo/routeMeta.ts';
import BlueprintParticles from '../components/landing/BlueprintParticles.tsx';
import Tilt3DCard from '../components/landing/Tilt3DCard.tsx';
import TypewriterText from '../components/landing/TypewriterText.tsx';
import ScrollIndicator from '../components/landing/ScrollIndicator.tsx';
import HeroAurora from '../components/landing/HeroAurora.tsx';
import TopographyBackground from '../components/landing/TopographyBackground.tsx';
import RotatingWireframe from '../components/landing/RotatingWireframe.tsx';
import SiteFooter from '../components/landing/SiteFooter.tsx';

const MODULOS_HERO = [
  {
    id: 'flow',
    logo: '/logos/civilFlowlogo.webp',
    name: 'CivilFlow',
    color: '#00aaff',
    path: '/civilflow',
    desc: 'Diseño y análisis de redes hidráulicas, sanitarias y de gas. Modelado de flujos, presiones y caudales.',
  },
  {
    id: 'manage',
    logo: '/logos/civilManagelogo.webp',
    name: 'Civil Manager',
    color: '#e67e22',
    path: '/civilmanager',
    desc: 'Presupuestos de obra civil, análisis de precios unitarios (APU) con mano de obra, insumos, equipo y transporte, catálogos integrados y configuración de perfil país y factor prestacional.',
  },
  {
    id: 'structure',
    logo: '/logos/civilStructurelogo.webp',
    name: 'CivilStructure',
    color: '#7f8c8d',
    path: '/civilstructure',
    desc: 'Diseño estructural y análisis de elementos como puentes, losas y marcos. Cálculo de cargas y resistencia.',
  },
  {
    id: 'terrain',
    logo: '/logos/civilTerrainlogo.webp',
    name: 'CivilTerrain',
    color: '#27ae60',
    path: '/civilterrain',
    desc: 'Topografía digital, perfiles de terreno y cálculo de movimiento de tierras. Modelos 3D del suelo.',
  },
  {
    id: 'roads',
    logo: '/logos/civilRoadslogo.webp',
    name: 'CivilRoads',
    color: '#f1c40f',
    path: '/civilroads',
    desc: 'Diseño geométrico de vías, urbanismo, peraltes y alineamientos horizontales y verticales.',
  },
];

const MOD_SUB = {
  flow: 'REDES HIDRÁULICAS, SANITARIAS Y GAS',
  structure: 'DISEÑO ESTRUCTURAL Y ANÁLISIS',
  terrain: 'TOPOGRAFÍA Y MOVIMIENTO DE TIERRAS',
  manage: 'PRESUPUESTOS Y APU',
  roads: 'VÍAS Y URBANISMO',
};

const PILLARS = [
  {
    icon: 'water_drop',
    title: 'Redes e\ninstalaciones',
    sub: 'Agua potable · Saneamiento · Gas · Contra incendio · Más disciplinas en camino',
  },
  {
    icon: 'request_quote',
    title: 'PRESUPUESTOS\nY APU',
    sub: 'Mano de obra · Insumos · Equipo · Precios por país',
  },
  {
    icon: 'verified',
    title: 'VERIFICACIÓN\nNORMATIVA',
    sub: 'Normativa del país del proyecto + estándares internacionales',
  },
  {
    icon: 'description',
    title: 'MEMORIAS DE\nCÁLCULO',
    sub: 'Exportables, trazables a la norma y al dato del proyecto',
  },
];

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // En prerender nace visible: el HTML estático debe mostrar el contenido (sin JS no
  // habría IntersectionObserver que lo revele).
  const [visible, setVisible] = useState(
    () => !!(globalThis as { __CIVILCARDEX_PRERENDER__?: boolean }).__CIVILCARDEX_PRERENDER__,
  );
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`fade-in${visible ? ' fade-in-visible' : ''}${className ? ` ${className}` : ''}`}
      data-delay={delay || undefined}
    >
      {children}
    </div>
  );
}

/** Landing pública (hero con typewriter, módulos, docs, precios resumidos): contenido estático prerenderizado y animaciones de cliente encima. */
function LandingPage() {
  // SEO: en prerender nace listo (el HTML trae el hero, no el skeleton). En cliente,
  // skeleton 250 ms → hero como siempre (el flag __CIVILCARDEX_PRERENDER__ solo existe en node).
  const [heroReady, setHeroReady] = useState(
    () => !!(globalThis as { __CIVILCARDEX_PRERENDER__?: boolean }).__CIVILCARDEX_PRERENDER__,
  );
  const heroRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  usePageMeta(metaDeRuta('/')?.title, metaDeRuta('/')?.description);

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

  const handleClick = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div className="landing-root min-h-screen">
      <Navbar />

      <main>
        {/* ===== HERO ===== */}
        <section
          id="hero-section"
          ref={heroRef}
          className="hero-section relative min-h-screen flex flex-col justify-center overflow-hidden"
        >
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

          {/* Logo + Branding — upper area */}
          <div className="hero-branding relative z-10 flex-1 flex items-center justify-center px-4">
            {!heroReady ? (
              <div className="flex flex-col items-center text-center gap-6">
                <div className="skeleton-block w-36 h-36 md:w-48 md:h-48 rounded-2xl" />
                <div className="skeleton-block w-80 h-16 md:w-[600px] md:h-24 mt-2" />
                <div className="skeleton-block w-64 h-4 md:w-96" />
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="hero-logo-plate hero-enter-logo relative mb-3 md:mb-4 p-4 md:p-5 rounded-2xl">
                  <img
                    src="/logos/civilCardexlogo-v2.webp"
                    alt="CivilCardex"
                    className="hero-logo-img w-32 h-32 sm:w-40 sm:h-40 md:w-52 md:h-52 object-contain"
                    width={128}
                    height={128}
                    fetchPriority="high"
                  />
                </div>
                <h1 className="hero-title hero-enter-title text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight uppercase mb-1 md:mb-2">
                  <span className="civsilver">CIVIL</span>
                  <span className="core-shimmer">&nbsp;CARDEX</span>
                </h1>
                <TypewriterText
                  text="PLATAFORMA DE INTELIGENCIA EN INGENIERÍA CIVIL"
                  delay={1800}
                  className="hero-tagline-a hero-enter-subtitle text-xs sm:text-sm md:text-base tracking-[0.3em] uppercase font-semibold mb-2"
                />
                <TypewriterText
                  text="DISEÑA - ANALIZA - OPTIMIZA - CONSTRUYE"
                  delay={3000}
                  className="hero-tagline-b hero-enter-subtitle text-xs sm:text-sm md:text-base tracking-[0.35em] uppercase font-semibold"
                />
              </div>
            )}
          </div>

          <ScrollIndicator />

          {/* 5 Module Cards — bottom area */}
          <div className="relative z-10 px-4 pb-6 sm:pb-8 md:pb-10">
            <ul className="hero-modules landing-list max-w-7xl mx-auto flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-5">
              {MODULOS_HERO.map((m) => {
                const nameRest = m.name.replace(/^Civil\s?/, '');
                return (
                  <li
                    key={m.id}
                    data-mod={m.id}
                    className="hero-mod-slot relative w-[140px] sm:w-[150px] md:w-[160px]"
                  >
                    <Tilt3DCard className="hero-mod-card hero-card-entrance flex flex-col items-center justify-center text-center p-3 border rounded-lg h-full w-full relative">
                      <div className="mod-tooltip">
                        <p className="mod-tooltip-title text-base font-bold mb-2">
                          <span className="mod-civil">Civil </span>
                          {nameRest}
                        </p>
                        <p className="mod-desc text-xs leading-relaxed">{m.desc}</p>
                      </div>

                      <div className="mod-glow absolute inset-0 rounded-lg pointer-events-none" />
                      <div className="mod-logo-wrap w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 relative z-10 rounded-xl">
                        <img src={m.logo} alt={m.name} className="mod-logo-img mod-logo" />
                      </div>
                      <span className="mod-name text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider relative z-10">
                        <span className="mod-civil">Civil </span>
                        {nameRest}
                      </span>
                      <span className="mod-sub text-[8px] sm:text-[9px] md:text-[10px] text-center mt-1 md:mt-1.5 relative z-10 uppercase tracking-wider leading-tight">
                        {(MOD_SUB as Record<string, string>)[m.id]}
                      </span>

                      <button
                        type="button"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        aria-label={`${m.name}: ${m.desc}`}
                        onClick={() => handleClick(m.path)}
                      />
                    </Tilt3DCard>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ===== 4 PILLARS — always visible, independent section ===== */}
        <section className="landing-section py-16 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <FadeIn>
              <div className="flex items-center gap-4 mb-10">
                <div className="h-px bg-outline-variant flex-grow" />
                <h2 className="landing-heading text-xl font-semibold uppercase tracking-widest px-4">
                  Pilares
                </h2>
                <div className="h-px bg-outline-variant flex-grow" />
              </div>
            </FadeIn>
            <ul className="landing-list grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PILLARS.map((p, index) => (
                <li key={p.icon} className="h-full">
                  <FadeIn delay={index * 100} className="h-full">
                    <div className="pilar-card border border-outline-variant p-6 flex flex-col gap-3 hover:border-primary/30 transition-all h-full">
                      <div className="flex items-center gap-4">
                        <span className="pillar-icon material-symbols-outlined text-2xl! flex-shrink-0">
                          {p.icon}
                        </span>
                        <h3 className="pillar-title text-[11px] font-bold uppercase tracking-widest leading-tight">
                          {p.title}
                        </h3>
                      </div>
                      <span className="pillar-sub text-[10px] tracking-[0.08em] uppercase leading-relaxed">
                        {p.sub}
                      </span>
                    </div>
                  </FadeIn>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <hr className="section-divider" />

        {/* ===== POR QUÉ CIVILCORE ===== */}
        <section className="landing-section py-20 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <FadeIn>
              <div className="flex items-center gap-4 mb-12">
                <div className="h-px bg-outline-variant flex-grow" />
                <h2 className="landing-heading text-xl font-semibold uppercase tracking-widest px-4">
                  ¿Por qué Civil Cardex?
                </h2>
                <div className="h-px bg-outline-variant flex-grow" />
              </div>
            </FadeIn>
            <ul className="landing-list grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: 'design_services',
                  title: 'DISEÑO SOBRE PLANOS',
                  desc: 'Cargue planos en PDF y trace los elementos de diseño por nivel. Autosave y visualización isométrica mientras diseña.',
                },
                {
                  icon: 'speed',
                  title: 'CÁLCULO EN TIEMPO REAL',
                  desc: 'Caudales, pérdidas de carga y chequeos con retroalimentación instantánea, contra la normativa vigente del país del proyecto.',
                },
                {
                  icon: 'request_quote',
                  title: 'PRESUPUESTOS Y APU',
                  desc: 'Análisis de precios unitarios con mano de obra, insumos, equipo y transporte, catálogos integrados y precios de referencia por país.',
                },
                {
                  icon: 'verified',
                  title: 'VERIFICACIÓN NORMATIVA',
                  desc: 'Cumplimiento automático contra la normativa del país del proyecto y estándares internacionales para cada red y disciplina. Reducción de errores humanos al mínimo.',
                },
                {
                  icon: 'description',
                  title: 'MEMORIAS EXPORTABLES',
                  desc: 'Generación de la memoria de cálculo completa con datos del proyecto, materiales y validación normativa citada en un clic.',
                },
                {
                  icon: 'hub',
                  title: 'COBERTURA INTEGRAL',
                  desc: 'Redes, estructuras, terreno, vías y presupuestos bajo una misma plataforma, con datos compartidos entre módulos y disciplinas de la ingeniería civil.',
                },
              ].map((f, index) => (
                <li key={f.icon} className="h-full">
                  <FadeIn delay={index * 100} className="h-full">
                    <div className="why-card border border-outline-variant p-8 hover:border-primary/30 transition-all group h-full">
                      <span className="why-icon material-symbols-outlined text-3xl! mb-4 block group-hover:text-primary transition-colors">
                        {f.icon}
                      </span>
                      <h3 className="why-title text-sm font-bold uppercase tracking-widest mb-3">
                        {f.title}
                      </h3>
                      <p className="why-desc text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  </FadeIn>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <hr className="section-divider" />

        {/* ===== CTA ===== */}
        <section id="cta-section" className="landing-section py-24 px-6 lg:px-8">
          <FadeIn className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="landing-heading text-3xl md:text-4xl font-bold uppercase">
              ¿Listo para elaborar sus
              <br />
              <span className="cta-accent">memorias de cálculo?</span>
            </h2>
            <p className="why-desc text-sm max-w-xl mx-auto">
              CivilCardex — de los datos del proyecto a la memoria de cálculo exportable, con
              verificación normativa automática.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Link
                to="/pricing"
                className="landing-cta hidden md:inline-block bg-primary text-on-primary px-10 py-4 uppercase text-[11px] tracking-[0.1em] font-bold hover:bg-primary-container transition-all"
              >
                EMPEZAR AHORA
              </Link>
              <span className="landing-mobile-note md:hidden text-sm px-6 py-3 text-center">
                Disponible solo en escritorio
              </span>
              <Link
                to="/docs"
                className="landing-cta-ghost border border-outline-variant px-10 py-4 uppercase text-[11px] tracking-[0.1em] font-bold hover:border-primary hover:text-primary transition-all"
              >
                DOCUMENTACIÓN TÉCNICA
              </Link>
            </div>
          </FadeIn>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default LandingPage;
