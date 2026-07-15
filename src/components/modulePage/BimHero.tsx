import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData';

export default function BimHero({ cfg }: { cfg: ModuleConfig }) {
  return (
    <section className="relative w-full flex items-center border-b border-outline-variant overflow-hidden" style={{ minHeight: 600 }}>
      <div className="absolute inset-0 z-0" style={{ opacity: 0.1, backgroundImage: 'radial-gradient(circle at 2px 2px, #849495 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      <div className="w-full max-w-7xl px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 z-10 items-center py-20">
        <div className="flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 border border-outline-variant px-3 py-1 w-fit" style={{ background: '#1a1c20' }}>
            <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
            <span className="text-[13px] text-on-surface-variant uppercase tracking-widest" style={{ fontFamily: 'Geist, monospace' }}>{cfg.badgeLabel}</span>
          </div>
          <h2 className="text-2xl md:text-4xl lg:text-[48px] leading-[56px] font-bold text-on-surface tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
            {cfg.headline}
          </h2>
          <p className="text-base text-on-surface-variant max-w-xl">
            {cfg.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Link to="/civilflowareatrabajo" className="inline-flex border border-outline-variant text-on-surface px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 hover:border-[#d946ef] transition-colors" style={{ fontFamily: 'Geist, monospace', background: '#333539' }}>
              <span className="material-symbols-outlined text-lg">terminal</span> {cfg.ctaText}
            </Link>
            <Link to="/docs" className="border border-outline-variant text-on-surface-variant px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2 hover:text-on-surface transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
              <span className="material-symbols-outlined text-lg">description</span> Documentación API
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-4 mt-8 border-t border-outline-variant pt-6">
            <div className="flex flex-col">
              <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>99.9%</span>
              <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Precisión Geométrica</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>&lt;10ms</span>
              <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Latencia Sincronización</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>IFC4</span>
              <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Soporte Nativo</span>
            </div>
          </div>
        </div>
        <div className="relative h-[300px] lg:h-[500px] w-full flex items-center justify-center">
          <div className="absolute inset-0 border border-outline-variant flex items-center justify-center overflow-hidden" style={{ background: '#1a1c20', boxShadow: `0 0 20px -5px ${cfg.accent}` }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined opacity-10" style={{ fontSize: 120, color: cfg.accent, fontVariationSettings: "'FILL' 0, 'wght' 200" }}>architecture</span>
            </div>
            <div className="absolute top-4 left-4 text-[10px] text-on-surface-variant flex flex-col gap-1" style={{ fontFamily: 'Geist, monospace' }}>
              <span>COORD: 34.0522° N, 118.2437° W</span>
              <span>ELEV: +142.5m ASL</span>
              <span style={{ color: cfg.accent }}>STATUS: SYNCED</span>
            </div>
            <div className="absolute bottom-4 right-4 flex gap-2">
              <div className="w-2 h-2 animate-pulse" style={{ background: '#2ff801' }} />
              <span className="text-[10px]" style={{ fontFamily: 'Geist, monospace', color: '#2ff801' }}>LIVE DATA</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
