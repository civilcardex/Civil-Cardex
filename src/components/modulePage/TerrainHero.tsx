import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData';

export default function TerrainHero({ cfg }: { cfg: ModuleConfig }) {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <section className="relative z-10 flex flex-col md:flex-row items-center gap-12 mb-24 max-w-7xl mx-auto">
        <div className="md:w-1/2 flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-outline-variant w-fit" style={{ background: '#282a2e' }}>
            <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
            <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace', color: cfg.accent }}>{cfg.badgeLabel}</span>
          </div>
          <h2 className="text-xl md:text-3xl lg:text-[36px] font-bold text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
            {cfg.headline}
          </h2>
          <p className="text-base text-on-surface-variant max-w-xl">
            {cfg.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Link to="/civilflowareatrabajo" className="inline-block bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-colors border border-primary" style={{ fontFamily: 'Geist, monospace' }}>
              {cfg.ctaText}
            </Link>
            <Link to="/docs" className="bg-transparent text-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container-highest transition-colors border border-primary" style={{ fontFamily: 'Geist, monospace', borderColor: 'var(--acc)', color: 'var(--acc)' }}>
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
            <span className="text-[13px] text-secondary px-2 py-1 backdrop-blur-sm border border-outline-variant" style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.8)', color: 'var(--ok)' }}>SLOPE: 12.4%</span>
          </div>
          <div className="absolute bottom-4 right-4">
            <span className="text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>RENDER ENGINE v2.4.1</span>
          </div>
        </div>
      </section>
    </>
  );
}
