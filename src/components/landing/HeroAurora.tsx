/** Manchas de luz difuminadas (aurora ámbar) del hero de la landing; tres blobs con keyframes lentos, apagados con prefers-reduced-motion. */
export default function HeroAurora() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="aurora-a absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.25] mix-blend-screen filter blur-[120px] animate-aurora-1" />
      <div className="aurora-b absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.15] mix-blend-screen filter blur-[100px] animate-aurora-2" />
      <div className="aurora-c absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full opacity-[0.20] mix-blend-screen filter blur-[100px] animate-aurora-3" />
    </div>
  );
}
