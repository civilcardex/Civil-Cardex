export default function BlueprintMarks() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[10] overflow-hidden opacity-30 select-none">
      {/* Top Left Corner */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t border-l border-[#00dce5] opacity-50" />
      <div className="absolute top-5 left-5 w-2 h-2 border border-[#00dce5] rounded-full" />

      {/* Top Right Corner */}
      <div className="absolute top-4 right-4 w-8 h-8 border-t border-r border-[#00dce5] opacity-50" />

      {/* Bottom Left Corner */}
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b border-l border-[#00dce5] opacity-50" />

      {/* Bottom Right Corner */}
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b border-r border-[#00dce5] opacity-50" />

      {/* Crosshairs - Left/Right Center */}
      <div className="absolute top-1/2 left-2 -translate-y-1/2 w-4 h-4 flex items-center justify-center opacity-50 hidden sm:flex">
        <div className="w-full h-[1px] bg-[#00dce5]" />
        <div className="absolute h-full w-[1px] bg-[#00dce5]" />
        <div className="absolute w-2 h-2 border border-[#00dce5] rounded-full" />
      </div>
      <div className="absolute top-1/2 right-2 -translate-y-1/2 w-4 h-4 flex items-center justify-center opacity-50 hidden sm:flex">
        <div className="w-full h-[1px] bg-[#00dce5]" />
        <div className="absolute h-full w-[1px] bg-[#00dce5]" />
        <div className="absolute w-2 h-2 border border-[#00dce5] rounded-full" />
      </div>
    </div>
  );
}
