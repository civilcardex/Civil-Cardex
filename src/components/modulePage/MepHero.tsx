import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData';

export default function MepHero({ cfg }: { cfg: ModuleConfig }) {
  return (
    <section className="relative w-full flex flex-col lg:flex-row items-center px-6 lg:px-8 py-16 gap-12 overflow-hidden border-b border-outline-variant" style={{ background: '#1a1c20', minHeight: 600 }}>
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative z-10 w-full lg:w-1/2 flex flex-col gap-6">
        <div className="inline-flex items-center gap-2 border border-outline-variant px-3 py-1 w-max" style={{ background: '#111317' }}>
          <span className="w-2 h-2 bg-primary-fixed-dim animate-pulse" style={{ background: '#00dce5' }} />
          <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
          <span className="text-[13px] uppercase" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>{cfg.badgeLabel}</span>
        </div>
        <h2 className="text-2xl md:text-4xl lg:text-[48px] leading-[1.1] font-bold text-on-background tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
          Diseño Inteligente de <br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, #00dce5, #79ff5b)' }}>Instalaciones Especiales</span>
        </h2>
        <p className="text-base text-on-surface-variant max-w-xl">
          {cfg.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-4">
          <Link to="/civilflowareatrabajo" className="inline-flex text-on-primary px-8 py-3 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2" style={{ fontFamily: 'Geist, monospace', background: '#00dce5' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>precision_manufacturing</span> {cfg.ctaText}
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
  );
}
