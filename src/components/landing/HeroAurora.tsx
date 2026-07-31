export default function HeroAurora() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div
        className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.25] mix-blend-screen filter blur-[120px] animate-aurora-1"
        style={{ background: '#e8c84a' }}
      />
      <div
        className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.15] mix-blend-screen filter blur-[100px] animate-aurora-2"
        style={{ background: '#c04000' }}
      />
      <div
        className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full opacity-[0.20] mix-blend-screen filter blur-[100px] animate-aurora-3"
        style={{ background: '#c8a84e' }}
      />
      <style>{`
        @keyframes aurora1 { 
          0%, 100% { transform: translate(0, 0) scale(1); } 
          33% { transform: translate(10%, 15%) scale(1.1); } 
          66% { transform: translate(-5%, 5%) scale(0.9); } 
        }
        @keyframes aurora2 { 
          0%, 100% { transform: translate(0, 0) scale(1); } 
          33% { transform: translate(-10%, -10%) scale(1.05); } 
          66% { transform: translate(15%, 5%) scale(1.1); } 
        }
        @keyframes aurora3 { 
          0%, 100% { transform: translate(0, 0) scale(1); } 
          33% { transform: translate(5%, -15%) scale(0.95); } 
          66% { transform: translate(-15%, 10%) scale(1.05); } 
        }
        .animate-aurora-1 { animation: aurora1 20s ease-in-out infinite alternate; }
        .animate-aurora-2 { animation: aurora2 25s ease-in-out infinite alternate-reverse; }
        .animate-aurora-3 { animation: aurora3 22s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) {
          .animate-aurora-1, .animate-aurora-2, .animate-aurora-3 { animation: none; }
        }
      `}</style>
    </div>
  );
}
