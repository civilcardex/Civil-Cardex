import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData';

interface Props {
  cfg: ModuleConfig;
  onCtaClick?: () => void;
}

// Large, faint background glyphs echoing the module's own domain (budgeting, catalogs,
// crews, suppliers) instead of a flat gradient — purely decorative, aria-hidden.
const BG_ICONS = [
  { icon: 'account_balance_wallet', top: '8%', left: '6%', size: 130, rotate: -12 },
  { icon: 'inventory_2', top: '58%', left: '4%', size: 100, rotate: 8 },
  { icon: 'groups', top: '14%', left: '86%', size: 110, rotate: 10 },
  { icon: 'local_shipping', top: '62%', left: '88%', size: 120, rotate: -8 },
];

const FUNCTIONALITIES = [
  {
    icon: 'account_balance_wallet',
    title: 'Análisis de precios unitarios completo',
    desc: 'Mano de obra, insumos, equipo y transporte',
  },
  {
    icon: 'inventory_2',
    title: 'Catálogos integrados',
    desc: 'Insumos, equipos, cuadrillas y proveedores',
  },
  {
    icon: 'file_upload',
    title: 'Importación Excel',
    desc: 'Sincroniza catálogos completos en minutos',
  },
  {
    icon: 'tune',
    title: 'Perfil país',
    desc: 'Factor prestacional y parámetros base',
  },
];

export default function ManageHero({ cfg, onCtaClick }: Props) {
  const accent = cfg.accent;

  return (
    <section
      className="relative pt-24 pb-16 px-6 lg:px-8 overflow-hidden flex flex-col items-center justify-center text-center"
      style={{
        minHeight: '92vh',
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 55% at 18% 15%, ${accent}22 0%, transparent 60%), radial-gradient(ellipse 70% 55% at 85% 20%, #79ff5b14 0%, transparent 60%), linear-gradient(to bottom, ${accent}0D, #111317)`,
        }}
      />
      {BG_ICONS.map((b) => (
        <span
          key={b.icon}
          aria-hidden="true"
          className="material-symbols-outlined absolute pointer-events-none select-none hidden sm:block"
          style={{
            top: b.top,
            left: b.left,
            fontSize: b.size,
            color: accent,
            opacity: 0.07,
            transform: `rotate(${b.rotate}deg)`,
          }}
        >
          {b.icon}
        </span>
      ))}

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-5">
          <img
            src={cfg.logo}
            alt={cfg.title}
            className="h-20 md:h-24 lg:h-28 w-auto object-contain"
            style={{ filter: `drop-shadow(0 0 24px ${accent}66)` }}
            loading="lazy"
          />
          <h2
            className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
            style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
          >
            <span className="ccx-silver">Civil</span> <span className="ccx-gold">Manager</span>
          </h2>
        </div>

        <p className="text-base md:text-lg text-on-surface-variant max-w-2xl leading-relaxed">
          {cfg.description}
        </p>

        {/* Funcionalidades del módulo — entrada escalonada, tarjetas con hover dinámico */}
        <style>{`
          @keyframes mhCardIn {
            from { opacity: 0; transform: translateY(16px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .mh-card {
            animation: mhCardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .mh-card:hover {
            transform: translateY(-4px);
          }
          .mh-card:hover .mh-card-icon {
            transform: scale(1.12) rotate(-4deg);
          }
        `}</style>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 w-full max-w-4xl mt-4">
          {FUNCTIONALITIES.map((f, i) => (
            <div
              key={f.title}
              className="mh-card border p-7 flex flex-col items-center gap-3 text-center transition-all duration-300 hover:border-current"
              style={{
                background: `linear-gradient(155deg, rgba(30,33,40,0.8) 0%, rgba(17,19,23,0.75) 55%, ${accent}1c 100%)`,
                borderColor: '#3a494a',
                color: accent,
                animationDelay: `${i * 140}ms`,
              }}
            >
              <span
                className="mh-card-icon material-symbols-outlined text-4xl transition-transform duration-300"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {f.icon}
              </span>
              <span
                className="text-base font-bold text-on-surface"
                style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                {f.title}
              </span>
              <span
                className="text-[12px] leading-snug"
                style={{ fontFamily: 'Geist, monospace', color: '#8a9bb0' }}
              >
                {f.desc}
              </span>
            </div>
          ))}
        </div>

        <div
          className="mh-card flex flex-col sm:flex-row gap-4 mt-10"
          style={{ animationDelay: `${FUNCTIONALITIES.length * 140}ms` }}
        >
          {onCtaClick ? (
            <button
              type="button"
              onClick={onCtaClick}
              className="inline-flex px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{
                fontFamily: 'Geist, monospace',
                background: accent,
                color: '#111317',
                boxShadow: `0 0 22px ${accent}55`,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <span className="material-symbols-outlined">rocket_launch</span> {cfg.ctaText}
            </button>
          ) : (
            <Link
              to="/civilmanagerareatrabajo"
              className="inline-flex px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{
                fontFamily: 'Geist, monospace',
                background: accent,
                color: '#111317',
                boxShadow: `0 0 22px ${accent}55`,
              }}
            >
              <span className="material-symbols-outlined">rocket_launch</span> {cfg.ctaText}
            </Link>
          )}
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 border border-outline-variant text-on-surface px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold hover:border-primary hover:-translate-y-0.5 transition-all"
            style={{ fontFamily: 'Geist, monospace' }}
          >
            <span className="material-symbols-outlined">terminal</span> Documentación
          </Link>
        </div>
      </div>
    </section>
  );
}
