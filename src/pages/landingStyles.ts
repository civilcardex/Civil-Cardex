export const LANDING_STYLES = `
        .hero-mod-card {
          transition: border-color 0.35s, box-shadow 0.35s;
          cursor: pointer;
        }
        .hero-mod-card .mod-glow {
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .hero-mod-card:hover .mod-glow {
          opacity: 1;
        }
        .hero-mod-card .mod-logo {
          transition: filter 0.4s ease, transform 0.4s ease;
          filter: brightness(1);
        }
        .hero-mod-card:hover .mod-logo {
          filter: brightness(1.15) drop-shadow(0 0 12px var(--mod-color));
          transform: scale(1.08);
        }
        
        /* Tooltip */
        @keyframes tooltipBounce {
          0% { opacity: 0; transform: translate(-50%, 10px) scale(0.9); }
          60% { opacity: 1; transform: translate(-50%, -4px) scale(1.02); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .mod-tooltip {
          display: none;
          position: absolute;
          bottom: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          width: 320px;
          background: rgba(10, 14, 20, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid var(--mod-color);
          border-radius: 8px;
          padding: 16px;
          z-index: 50;
          text-align: left;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.5);
          pointer-events: none;
        }
        .hero-mod-card:hover .mod-tooltip, .hero-mod-card:focus-within .mod-tooltip {
          display: block;
          animation: tooltipBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .mod-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 6px;
          border-style: solid;
          border-color: var(--mod-color) transparent transparent transparent;
        }

        .hero-logo-glow { animation: logoPulse 4s ease-in-out infinite; }
        @keyframes logoPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        .hero-bg-grid {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background-size: 60px 60px;
          background-image: 
            linear-gradient(to right, rgba(0,220,229,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,220,229,0.03) 1px, transparent 1px);
          transform: perspective(1000px) rotateX(60deg) rotateZ(-45deg);
          transform-origin: center;
        }
        .section-divider { background: linear-gradient(90deg, transparent, rgba(0,170,255,0.15), transparent); height: 1px; border: none; margin: 0; }

        html {
          scroll-snap-type: y proximity;
        }
        section {
          scroll-snap-align: start;
        }
        .will-change-transform {
          will-change: transform;
        }

        /* Shimmer */
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .core-shimmer {
          background: linear-gradient(90deg, #00dce5 0%, #00aaff 25%, #00f5ff 50%, #00aaff 75%, #00dce5 100%);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shimmer 6s linear infinite;
        }

        /* Skeleton */
        @keyframes skeletonPulse {
          0% { opacity: 0.5; }
          50% { opacity: 0.8; }
          100% { opacity: 0.5; }
        }
        .skeleton-block {
          background: linear-gradient(90deg, #111317, #1a1c20, #111317);
          background-size: 200% 100%;
          animation: skeletonPulse 1.5s ease-in-out infinite;
          border-radius: 8px;
        }

        /* Icon morphing */
        .pilar-card .material-symbols-outlined, 
        .why-card .material-symbols-outlined {
          transition: font-variation-settings 0.4s ease;
        }
        .pilar-card:hover .material-symbols-outlined, 
        .why-card:hover .material-symbols-outlined {
          font-variation-settings: 'FILL' 1 !important;
        }

        /* Entrance and hover animations */
        @keyframes heroEntrance {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .hero-enter-logo {
          opacity: 0;
          animation: heroEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hero-enter-title {
          opacity: 0;
          animation: heroEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
        }
        .hero-enter-subtitle {
          opacity: 0;
          animation: heroEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
        }
        @keyframes cardEntrance {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .hero-card-entrance {
          opacity: 0;
          animation: cardEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pilar-card, .why-card {
          transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.3s, box-shadow 0.3s;
        }
        .pilar-card:hover, .why-card:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 220, 229, 0.3) !important;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(0, 220, 229, 0.05);
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-snap-type: none !important; }
          .core-shimmer { animation: none !important; }
          .skeleton-block { animation: none !important; }
          .pilar-card .material-symbols-outlined, 
          .why-card .material-symbols-outlined { transition: none !important; }
          
          .hero-enter-logo,
          .hero-enter-title,
          .hero-enter-subtitle,
          .hero-card-entrance {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .hero-mod-card:hover,
          .pilar-card:hover,
          .why-card:hover {
            transform: none !important;
          }
        }
      `