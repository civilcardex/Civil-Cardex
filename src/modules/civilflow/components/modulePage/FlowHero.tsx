import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { ModuleConfig } from '../../../../pages/moduleData';

interface Props {
  cfg: ModuleConfig;
  onCtaClick?: () => void;
}

interface NetCard {
  name: string;
  color: string;
  icon: string;
  features: string[];
}

const NETWORKS: NetCard[] = [
  {
    name: 'Agua fría',
    color: '#4D8FF7',
    icon: 'water_drop',
    features: [
      'Unidades de consumo (Hunter / fixture units)',
      'Cálculo Hazen-Williams por tramo',
      'Caudal de diseño por aparato y nivel',
      'Listado de aparatos exportable',
    ],
  },
  {
    name: 'Agua caliente',
    color: '#F04545',
    icon: 'local_fire_department',
    features: [
      'Selección de calentador ',
      'Pérdidas térmicas en tubería',
      'Caudal de diseño por aparato',
      'Verificación IPC/UPC',
    ],
  },
  {
    name: 'Sanitaria',
    color: '#F5A623',
    icon: 'plumbing',
    features: [
      'Unidades de descarga Hunter (PD)',
      'Caudal por simultaneidad (factor K)',
      'Cálculo Manning (RAS / ASCE)',
      'Memoria de cálculo exportable',
    ],
  },
  {
    name: 'Aguas lluvias',
    color: '#8B5CF6',
    icon: 'rainy',
    features: [
      'Método racional (C · I · A) ASCE',
      'Curva de intensidad por municipio',
      'Diseño de bajante y canal',
      'Listado de áreas de drenaje',
    ],
  },
  {
    name: 'Gas',
    color: '#A855F7',
    icon: 'local_gas_station',
    features: [
      'Cálculo Renouard (NFPA 54 / ANSI Z223.1)',
      'Factor de simultaneidad',
      'Selección de diámetro y material',
      'Indicador verde/rojo de ΔP',
    ],
  },
  {
    name: 'Contra incendio',
    color: '#F87171',
    icon: 'fire_extinguisher',
    features: [
      'Referencia NFPA 13 (rociadores)',
      'NFPA 14 (standpipes y mangueras)',
      'Listado de verificación normativa',
      'Memoria de cálculo exportable',
    ],
  },
];

const ROTATE_MS = 3400;

function FlowHeroBackground({ accent }: { accent: string }) {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          transform: 'perspective(900px) rotateX(58deg) translateZ(-140px) scale(2.2)',
          transformOrigin: 'center top',
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1440 560"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="ramalAF" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4D8FF7" stopOpacity="0" />
            <stop offset="50%" stopColor="#4D8FF7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4D8FF7" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ramalAC" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F04545" stopOpacity="0" />
            <stop offset="50%" stopColor="#F04545" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F04545" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ramalSAN" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0" />
            <stop offset="50%" stopColor="#F5A623" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bajanteSAN" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0" />
            <stop offset="50%" stopColor="#F5A623" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bajanteLL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="montanteGAS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0" />
            <stop offset="50%" stopColor="#A855F7" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineaGuia" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f0f4f8" stopOpacity="0" />
            <stop offset="50%" stopColor="#f0f4f8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f0f4f8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hotspot1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="60%" stopColor={accent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="280" cy="180" r="240" fill="url(#hotspot1)" />

        <polyline
          points="60,300 220,300 260,340 360,340 400,300 560,300"
          fill="none"
          stroke="url(#ramalAF)"
          strokeWidth="2"
        />
        <circle
          cx="220"
          cy="300"
          r="8"
          fill="none"
          stroke="#4D8FF7"
          strokeOpacity="0.7"
          strokeWidth="2"
        />
        <circle cx="220" cy="300" r="2.5" fill="#4D8FF7" fillOpacity="0.85" />
        <circle
          cx="400"
          cy="300"
          r="6"
          fill="none"
          stroke="#4D8FF7"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />

        <polyline
          points="780,260 920,260 960,300 1080,300 1120,260 1320,260"
          fill="none"
          stroke="url(#ramalAC)"
          strokeWidth="2"
        />
        <circle
          cx="920"
          cy="260"
          r="7"
          fill="none"
          stroke="#F04545"
          strokeOpacity="0.7"
          strokeWidth="1.5"
        />
        <rect
          x="1076"
          y="296"
          width="8"
          height="8"
          fill="none"
          stroke="#F04545"
          strokeOpacity="0.65"
          strokeWidth="1.5"
        />

        <polyline
          points="100,460 240,460 280,500 380,500 420,460 600,460"
          fill="none"
          stroke="url(#ramalSAN)"
          strokeWidth="2"
        />
        <rect
          x="236"
          y="456"
          width="8"
          height="8"
          fill="none"
          stroke="#F5A623"
          strokeOpacity="0.7"
          strokeWidth="2"
        />

        <polyline
          points="640,420 700,420 740,460 820,460 860,420 940,420"
          fill="none"
          stroke="url(#ramalSAN)"
          strokeWidth="2"
        />
        <rect
          x="696"
          y="416"
          width="8"
          height="8"
          fill="none"
          stroke="#F5A623"
          strokeOpacity="0.65"
          strokeWidth="1.5"
        />

        <line x1="500" y1="60" x2="500" y2="500" stroke="url(#bajanteSAN)" strokeWidth="3" />
        <circle
          cx="500"
          cy="60"
          r="6"
          fill="none"
          stroke="#F5A623"
          strokeOpacity="0.7"
          strokeWidth="2"
        />
        <circle
          cx="500"
          cy="500"
          r="6"
          fill="none"
          stroke="#F5A623"
          strokeOpacity="0.7"
          strokeWidth="2"
        />

        <line x1="1100" y1="80" x2="1100" y2="480" stroke="url(#bajanteLL)" strokeWidth="3" />
        <circle
          cx="1100"
          cy="80"
          r="6"
          fill="none"
          stroke="#8B5CF6"
          strokeOpacity="0.7"
          strokeWidth="2"
        />
        <circle
          cx="1100"
          cy="480"
          r="6"
          fill="none"
          stroke="#8B5CF6"
          strokeOpacity="0.7"
          strokeWidth="2"
        />

        <line x1="700" y1="60" x2="700" y2="420" stroke="url(#bajanteSAN)" strokeWidth="3" />
        <circle
          cx="700"
          cy="420"
          r="6"
          fill="none"
          stroke="#F5A623"
          strokeOpacity="0.7"
          strokeWidth="2"
        />

        <line x1="1240" y1="120" x2="1240" y2="460" stroke="url(#montanteGAS)" strokeWidth="3" />
        <circle
          cx="1240"
          cy="120"
          r="9"
          fill="none"
          stroke="#A855F7"
          strokeOpacity="0.8"
          strokeWidth="2"
        />
        <circle cx="1240" cy="120" r="3" fill="#A855F7" fillOpacity="0.9" />
        <circle
          cx="1240"
          cy="290"
          r="6"
          fill="none"
          stroke="#A855F7"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />

        <line x1="1300" y1="180" x2="1380" y2="180" stroke="url(#montanteGAS)" strokeWidth="3" />
        <circle
          cx="1300"
          cy="180"
          r="6"
          fill="none"
          stroke="#A855F7"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />

        <line x1="500" y1="460" x2="380" y2="460" stroke="url(#ramalSAN)" strokeWidth="2" />
        <line x1="700" y1="420" x2="740" y2="420" stroke="url(#ramalSAN)" strokeWidth="2" />
        <line
          x1="1100"
          y1="300"
          x2="1240"
          y2="300"
          stroke="url(#montanteGAS)"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        <line
          x1="60"
          y1="180"
          x2="1380"
          y2="180"
          stroke="url(#lineaGuia)"
          strokeWidth="1"
          strokeDasharray="6 8"
        />
        <line
          x1="60"
          y1="400"
          x2="1380"
          y2="400"
          stroke="url(#lineaGuia)"
          strokeWidth="1"
          strokeDasharray="6 8"
        />
        <line
          x1="60"
          y1="540"
          x2="1380"
          y2="540"
          stroke="url(#lineaGuia)"
          strokeWidth="1"
          strokeDasharray="6 8"
        />

        <g transform="translate(360,170)" opacity="0.55">
          <line x1="0" y1="0" x2="0" y2="14" stroke="#f0f4f8" strokeOpacity="0.35" />
          <text
            x="6"
            y="11"
            fill="#f0f4f8"
            fontFamily="Geist, monospace"
            fontSize="9"
            fontWeight="700"
          >
            +1.20
          </text>
        </g>
        <g transform="translate(1180,390)" opacity="0.55">
          <line x1="0" y1="0" x2="0" y2="14" stroke="#f0f4f8" strokeOpacity="0.35" />
          <text
            x="6"
            y="11"
            fill="#f0f4f8"
            fontFamily="Geist, monospace"
            fontSize="9"
            fontWeight="700"
          >
            NPT +0.00
          </text>
        </g>
        <g transform="translate(740,400)" opacity="0.5">
          <line x1="0" y1="0" x2="0" y2="14" stroke="#f0f4f8" strokeOpacity="0.35" />
          <text
            x="6"
            y="11"
            fill="#f0f4f8"
            fontFamily="Geist, monospace"
            fontSize="9"
            fontWeight="700"
          >
            -0.60
          </text>
        </g>

        <rect
          x="120"
          y="430"
          width="100"
          height="60"
          fill="#F5A623"
          fillOpacity="0.06"
          stroke="#F5A623"
          strokeOpacity="0.25"
          strokeWidth="1"
        />
        <rect
          x="900"
          y="240"
          width="100"
          height="60"
          fill="#F04545"
          fillOpacity="0.06"
          stroke="#F04545"
          strokeOpacity="0.25"
          strokeWidth="1"
        />
        <rect
          x="660"
          y="380"
          width="80"
          height="50"
          fill="#4D8FF7"
          fillOpacity="0.06"
          stroke="#4D8FF7"
          strokeOpacity="0.22"
          strokeWidth="1"
        />
      </svg>
    </>
  );
}

export default function FlowHero({ cfg, onCtaClick }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const accent = cfg.accent;

  return (
    <section
      ref={heroRef}
      className="relative w-full overflow-hidden border-b border-outline-variant flex flex-col items-center justify-center text-center"
      style={{
        minHeight: 560,
        background: '#1a1c20',
      }}
    >
      <FlowHeroBackground accent={accent} />

      <div className="relative z-10 px-6 lg:px-8 py-20 max-w-5xl mx-auto flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-5">
          <img
            src={cfg.logo}
            alt={cfg.title}
            className="h-20 md:h-24 lg:h-28 w-auto object-contain"
            style={{ filter: `drop-shadow(0 0 24px ${accent}66)` }}
            loading="lazy"
          />
          <h1
            className="text-3xl md:text-5xl lg:text-6xl leading-tight font-bold tracking-tight"
            style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
          >
            <span className="ccx-silver">Civil</span> <span style={{ color: accent }}>Flow</span>
          </h1>
        </div>

        <p className="text-base md:text-lg max-w-2xl leading-relaxed" style={{ color: '#dce3ea' }}>
          {cfg.description}
        </p>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full mt-2 p-6 rounded-2xl"
          style={{
            background:
              'linear-gradient(135deg, rgba(40,42,46,0.5) 0%, rgba(17,19,23,0.7) 50%, rgba(28,30,34,0.5) 100%)',
            border: '1px solid rgba(245,214,104,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          {NETWORKS.map((n, i) => (
            <NetworkCard key={n.name} net={n} start={visible} delayMs={i * 1700} />
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <button
            type="button"
            onClick={onCtaClick}
            className="inline-flex items-center gap-2 px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold transition-all"
            style={{
              fontFamily: 'Geist, monospace',
              background: accent,
              boxShadow: `0 0 18px ${accent}4d`,
              cursor: 'pointer',
              border: 'none',
              color: '#0b1014',
            }}
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            {cfg.ctaText}
          </button>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 border border-outline-variant text-on-surface px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold hover:border-primary transition-colors"
            style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.5)' }}
          >
            <span className="material-symbols-outlined text-sm">menu_book</span>
            Documentación
          </Link>
        </div>
      </div>
    </section>
  );
}

function NetworkCard({ net, start, delayMs }: { net: NetCard; start: boolean; delayMs: number }) {
  const [idx, setIdx] = useState(0);
  const total = net.features.length;

  useEffect(() => {
    if (!start) return;
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => setIdx((i) => (i + 1) % total), ROTATE_MS);
    }, delayMs);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [start, total, delayMs]);

  return (
    <div
      className="relative border px-10 py-4 flex flex-col items-start gap-2 text-left overflow-hidden h-full"
      style={{
        background: 'rgba(17,19,23,0.6)',
        borderColor: '#3a494a',
        minHeight: 130,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 0% 0%, ${net.color}26 0%, transparent 65%)`,
        }}
      />
      <div className="flex flex-col gap-1.5 relative z-10 w-full">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: `${net.color}22`, color: net.color }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1", fontSize: 20 }}
            >
              {net.icon}
            </span>
          </div>
          <div className="flex flex-col">
            <span
              className="text-[10px] tracking-[0.12em] uppercase font-bold leading-none"
              style={{ fontFamily: 'Geist, monospace', color: net.color }}
            >
              RED
            </span>
            <span
              className="text-base font-bold leading-tight"
              style={{ fontFamily: 'Hanken Grotesk, sans-serif', color: '#f0f4f8' }}
            >
              {net.name}
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full min-h-[48px]">
        {net.features.map((f, i) => (
          <div
            key={f}
            className="absolute inset-0 transition-all duration-500"
            style={{
              opacity: i === idx ? 1 : 0,
              transform: i === idx ? 'translateY(0)' : 'translateY(8px)',
              pointerEvents: i === idx ? 'auto' : 'none',
            }}
          >
            <span
              className="text-[13px] leading-snug"
              style={{ fontFamily: 'Geist, monospace', color: '#dce3ea' }}
            >
              {f}
            </span>
          </div>
        ))}
      </div>

      <div className="relative z-10 flex gap-1.5 mt-auto w-full">
        {net.features.map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 transition-all duration-500"
            style={{
              background: i === idx ? net.color : '#3a494a',
              opacity: i === idx ? 1 : 0.4,
            }}
          />
        ))}
      </div>
    </div>
  );
}
