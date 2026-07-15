import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData';

export default function StructureHero({ cfg }: { cfg: ModuleConfig }) {
  return (
    <section className="relative flex items-center border-b border-outline-variant overflow-hidden" style={{ minHeight: 600, background: '#0c0e12' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="absolute top-1/4 left-8 text-[13px] text-outline opacity-50 hidden lg:block" style={{ fontFamily: 'Geist, monospace' }}>
        SYS.INIT: OK<br />LOAD_FACTOR: 1.4<br />MESH_DENSITY: HIGH<br />SOLVER_ITER: 2540
      </div>
      <div className="container mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-3 relative z-10">
        <div className="flex flex-col justify-center gap-6 max-w-2xl py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary text-primary w-fit" style={{ background: 'rgba(0,245,255,0.1)', borderColor: cfg.accent, color: cfg.accent }}>
            <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
            <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace' }}>{cfg.badgeLabel}</span>
          </div>
          <h2 className="text-xl md:text-3xl lg:text-[36px] text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 700 }}>
            {cfg.headline}
          </h2>
          <p className="text-base text-on-surface-variant">
            {cfg.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link to="/civilflowareatrabajo" className="inline-block bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-all" style={{ fontFamily: 'Geist, monospace', background: cfg.accent }}>
              {cfg.ctaText}
            </Link>
            <button type="button" className="border text-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container transition-all flex items-center gap-2" style={{ fontFamily: 'Geist, monospace', borderColor: cfg.accent, color: cfg.accent }}>
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
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" style={{ background: 'var(--ok)' }} /> NODE_STRESS_MAX
            </div>
            <div className="absolute bottom-4 left-4 border border-outline-variant p-2 text-[13px]" style={{ background: '#282a2e', fontFamily: 'Geist, monospace' }}>
              <span style={{ color: cfg.accent }}>Fz:</span> 450kN
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
