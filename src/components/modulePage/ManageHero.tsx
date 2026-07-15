import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData';

export default function ManageHero({ cfg }: { cfg: ModuleConfig }) {
  return (
    <section className="relative pt-24 pb-16 px-6 lg:px-8 overflow-hidden flex flex-col items-center justify-center text-center" style={{ minHeight: 600, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${cfg.accent}0D, #111317)` }} />
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-6">
        <div className="flex items-center justify-center w-16 h-16 border mb-4" style={{ background: '#282a2e', borderColor: '#3a494a', boxShadow: `0 0 15px ${cfg.accent}33` }}>
          <img src={cfg.logo} alt={cfg.title} className="h-10 w-10 object-contain" width={40} height={40} loading="lazy" />
        </div>
        <h2 className="text-4xl md:text-6xl text-primary font-bold tracking-tight leading-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
          CivilManage: <br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${cfg.accent}, #fef08a)` }}>Control Total</span> sobre el Ciclo de Vida del Proyecto
        </h2>
        <p className="text-base text-on-surface-variant max-w-2xl">
          {cfg.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link to="/civilflowareatrabajo" className="inline-flex px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2" style={{ fontFamily: 'Geist, monospace', background: cfg.accent, color: '#111317' }}>
            <span className="material-symbols-outlined text-sm">rocket_launch</span> {cfg.ctaText}
          </Link>
          <Link to="/docs" className="border border-outline-variant text-on-surface px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2 hover:border-primary transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
            <span className="material-symbols-outlined text-sm">terminal</span> VER DOCUMENTACIÓN API
          </Link>
        </div>
      </div>
    </section>
  );
}
