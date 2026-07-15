import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData';

export default function FlowHero({ cfg }: { cfg: ModuleConfig }) {
  return (
    <section className="relative w-full overflow-hidden border-b border-outline-variant" style={{ minHeight: 500, background: '#1a1c20' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, #111317 0%, rgba(17,19,23,0) 100%)' }} />
      <div className="relative z-10 px-6 lg:px-8 py-20 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <img src={cfg.logo} alt={cfg.title} className="h-8 w-8 object-contain" width={32} height={32} loading="lazy" />
          <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace', color: cfg.accent }}>{cfg.badgeLabel}</span>
        </div>
        <h1 className="text-2xl md:text-4xl lg:text-[44px] leading-tight font-bold text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
          {cfg.headline}
        </h1>
        <p className="text-base text-on-surface-variant max-w-xl leading-relaxed">
          {cfg.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Link to="/civilflowareatrabajo" className="inline-block px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold text-on-primary transition-all" style={{ fontFamily: 'Geist, monospace', background: cfg.accent, boxShadow: `0 0 15px ${cfg.accent}4d` }}>
            {cfg.ctaText}
          </Link>
          <Link to="/docs" className="border border-outline-variant text-on-surface px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:border-primary transition-all" style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.5)' }}>
            Ver Documentación
          </Link>
        </div>
      </div>
    </section>
  );
}
