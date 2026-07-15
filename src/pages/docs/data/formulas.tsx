const formulas = {
    name: 'Fórmulas del sistema',
    icon: 'calculate',
    color: '#F5A623',
    sections: [
      {
        title: 'Número de Reynolds',
        body: (
          <div className="space-y-3">
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Re = (V · D) / &nu;
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Re</span><span>número de Reynolds (adimensional)</span>
              <span className="font-semibold text-primary">V</span><span>velocidad del fluido (m/s)</span>
              <span className="font-semibold text-primary">D</span><span>diámetro interno de la tubería (m)</span>
              <span className="font-semibold text-primary">&nu;</span><span>viscosidad cinemática del agua (m²/s)</span>
            </div>
            <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
              <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Tipo de flujo</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Rango Re</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Característica</th></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Laminar</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Re &lt; 2300</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Líneas paralelas</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Transición</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2300 &lt; Re &lt; 4000</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Inestable</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Turbulento</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Re &gt; 4000</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Mezcla intensa</td></tr>
            </tbody></table></div>
          </div>
        ),
      },
    ],
};

export default formulas;
