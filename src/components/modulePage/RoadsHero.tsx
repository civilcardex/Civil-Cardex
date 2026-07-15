import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData';

export default function RoadsHero({ cfg }: { cfg: ModuleConfig }) {
  return (
    <section className="relative w-full flex items-center overflow-hidden border-b border-outline-variant" style={{ minHeight: 700 }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #0F1115, rgba(15,17,21,0.8), transparent)' }} />
      <div className="relative z-10 w-full px-6 lg:px-8 grid grid-cols-12 gap-3 mt-16 md:mt-0">
        <div className="col-span-12 md:col-span-6 lg:col-span-5 flex flex-col justify-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 w-fit border" style={{ background: '#1A1D23', borderColor: cfg.accent }}>
            <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
            <span className="text-[13px] uppercase" style={{ fontFamily: 'Geist, monospace', color: cfg.accent }}>{cfg.badgeLabel}</span>
          </div>
          <h2 className="text-2xl md:text-4xl lg:text-[48px] leading-[1.1] font-bold text-on-background tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
            Infraestructura Vial de <span style={{ color: cfg.accent }}>Alta Precisión</span>.
          </h2>
          <p className="text-base text-on-surface-variant max-w-md">
            {cfg.description}
          </p>
          <div className="pt-8 flex flex-col sm:flex-row gap-4">
            <Link to="/civilflowareatrabajo" className="inline-flex bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 hover:bg-primary/90 transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
              {cfg.ctaText} <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
            <Link to="/docs" className="border border-outline text-on-background px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container-highest transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
              Ver Documentación
            </Link>
          </div>
          <div className="mt-12 flex gap-8 border-t border-outline-variant pt-4">
            <div>
              <p className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase mb-1" style={{ fontFamily: 'Geist, monospace' }}>Precisión</p>
              <p className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>Sub-milimétrica</p>
            </div>
            <div>
              <p className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase mb-1" style={{ fontFamily: 'Geist, monospace' }}>Simulación</p>
              <p className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>Tiempo Real</p>
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-6 lg:col-start-7 hidden md:flex items-center justify-center">
          <div className="p-8 w-full max-w-lg relative border" style={{ background: 'linear-gradient(135deg, rgba(26,29,35,0.8), rgba(26,29,35,0.4))', backdropFilter: 'blur(12px)', borderColor: 'rgba(51,56,66,0.5)' }}>
            <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ background: `linear-gradient(to right, transparent, ${cfg.accent}, transparent)` }} />
            <div className="flex justify-between items-start mb-6">
              <div className="text-xl font-bold text-on-background" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Live Metrics View</div>
              <span className="material-symbols-outlined text-outline">data_usage</span>
            </div>
            <div className="space-y-4">
              {cfg.metrics?.map((m, i) => (
                <div key={i} className="flex justify-between items-center border-b border-outline-variant pb-2">
                  <span className="text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>{m.label}</span>
                  <span className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: m.isAccent ? cfg.accent : '#00dce5' }}>{m.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 h-32 w-full border border-outline-variant relative overflow-hidden" style={{ background: '#0c0e12' }}>
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#3a494a 1px, transparent 1px)', backgroundSize: '8px 8px', opacity: 0.3 }} />
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0,80 Q25,20 50,50 T100,20" fill="none" stroke={cfg.accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <circle cx="50" cy="50" fill="#00dce5" r="3" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
