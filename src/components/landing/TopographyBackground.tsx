/** Curvas de nivel SVG "respirando" detrás del hero (opacidad 8%, decorativas, reduced-motion apaga la animación). */
export default function TopographyBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[2] opacity-[0.08] flex items-center justify-center overflow-hidden">
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1000 600"
        fill="none"
        stroke="#e8c84a"
        strokeWidth="0.5"
      >
        {/* Top left curves */}
        <path
          d="M-100,300 Q150,200 400,350 T900,250 T1200,300"
          className="topo-line animate-topo"
        />
        <path
          d="M-100,280 Q160,170 420,330 T920,220 T1200,280"
          className="topo-line animate-topo"
        />
        <path
          d="M-100,260 Q170,140 440,310 T940,190 T1200,260"
          className="topo-line animate-topo"
        />
        <path
          d="M-100,240 Q180,110 460,290 T960,160 T1200,240"
          className="topo-line animate-topo"
        />

        {/* Bottom right curves */}
        <path
          d="M-100,450 Q200,550 500,400 T1000,500 T1200,450"
          className="topo-line animate-topo"
        />
        <path
          d="M-100,470 Q210,580 520,420 T1020,530 T1200,470"
          className="topo-line animate-topo"
        />
        <path
          d="M-100,490 Q220,610 540,440 T1040,560 T1200,490"
          className="topo-line animate-topo"
        />
        <path
          d="M-100,510 Q230,640 560,460 T1060,590 T1200,510"
          className="topo-line animate-topo"
        />
      </svg>
    </div>
  );
}
