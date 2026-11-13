import { Link } from 'react-router-dom';
import type { ModuleConfig } from '../../pages/moduleData.ts';

interface Props {
  cfg: ModuleConfig;
  onCtaClick?: () => void;
}

// Large, faint background glyphs echoing the module's own domain (budgeting, catalogs,
// crews, suppliers) instead of a flat gradient — purely decorative, aria-hidden.
// La posición de cada glifo vive en modulePage.css (.manage-bg-icon-N).
const BG_ICONS = ['account_balance_wallet', 'inventory_2', 'groups', 'local_shipping'];

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

/** Hero de la página del módulo CM (Civil Manager): H1, CTAs y funcionalidades clave sobre íconos de dominio de fondo (decorativos, aria-hidden). */
export default function ManageHero({ cfg, onCtaClick }: Props) {
  return (
    <section className="manage-hero relative pt-24 pb-16 px-6 lg:px-8 overflow-hidden flex flex-col items-center justify-center text-center">
      <div className="manage-hero-overlay absolute inset-0 pointer-events-none" />
      {BG_ICONS.map((icon, i) => (
        <span
          key={icon}
          aria-hidden="true"
          className={`manage-bg-icon manage-bg-icon-${i + 1} material-symbols-outlined absolute pointer-events-none select-none hidden sm:block`}
        >
          {icon}
        </span>
      ))}

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-5">
          <img
            src={cfg.logo}
            alt={cfg.title}
            className="manage-hero-logo h-20 md:h-24 lg:h-28 w-auto object-contain"
            loading="lazy"
          />
          <h1 className="font-hanken text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            <span className="ccx-silver">Civil</span> <span className="ccx-gold">Manager</span>
          </h1>
        </div>

        <p className="text-base md:text-lg text-on-surface-variant max-w-2xl leading-relaxed">
          {cfg.description}
        </p>

        {/* Funcionalidades del módulo — entrada escalonada, tarjetas con hover dinámico */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 w-full max-w-4xl mt-4">
          {FUNCTIONALITIES.map((f) => (
            <div
              key={f.title}
              className="mh-card border p-7 flex flex-col items-center gap-3 text-center transition-all duration-300 hover:border-current"
            >
              <span className="module-fill-icon mh-card-icon material-symbols-outlined text-4xl! transition-transform duration-300">
                {f.icon}
              </span>
              <span className="font-hanken text-base font-bold text-on-surface">{f.title}</span>
              <span className="mh-desc text-[12px] leading-snug">{f.desc}</span>
            </div>
          ))}
        </div>

        <div className="mh-cta-row mh-card flex flex-col sm:flex-row gap-4 mt-10">
          {onCtaClick ? (
            <button
              type="button"
              onClick={onCtaClick}
              className="mh-cta mh-cta-button inline-flex px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 transition-all hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined">rocket_launch</span> {cfg.ctaText}
            </button>
          ) : (
            <Link
              to="/civilmanagerareatrabajo"
              className="mh-cta inline-flex px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 transition-all hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined">rocket_launch</span> {cfg.ctaText}
            </Link>
          )}
          <Link
            to="/docs"
            className="font-geist-mono inline-flex items-center gap-2 border border-outline-variant text-on-surface px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold hover:border-primary hover:-translate-y-0.5 transition-all"
          >
            <span className="material-symbols-outlined">terminal</span> Documentación
          </Link>
        </div>
      </div>
    </section>
  );
}
