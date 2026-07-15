const gas = {
    name: 'Red de gas',
    icon: 'gas_meter',
    color: '#A855F7',
    sections: [
      {
        title: 'Método de Renouard',
        body: (
          <div className="space-y-3">
            <p>Fórmula de Renouard para redes de baja presión (NTC 3728):</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              &Delta;P = 48620 · K · L · Q<sup>1.82</sup> / (P<sub>atm</sub> · D<sup>4.82</sup>)
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">&Delta;P</span><span>pérdida de presión (Pa)</span>
              <span className="font-semibold text-primary">K</span><span>coeficiente de fricción</span>
              <span className="font-semibold text-primary">L</span><span>longitud total (m)</span>
              <span className="font-semibold text-primary">Q</span><span>caudal de gas (m³/h)</span>
              <span className="font-semibold text-primary">P<sub>atm</sub></span><span>presión atmosférica (kPa)</span>
              <span className="font-semibold text-primary">D</span><span>diámetro interno (mm)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Límite: &Delta;P &le; 9.81 mbar (1 m.c.a.) · Velocidad máx: 10 m/s
            </div>
          </div>
        ),
      },
      {
        title: 'Factor de simultaneidad',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">N° aparatos</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Factor fs</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1–2</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.00</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">3–5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.80</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">6–10</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.70</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">11–20</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.60</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&gt; 20</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.50</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Materiales para gas',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Material</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Diámetro típico</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">K</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PE al PE ¾"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">20 mm</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">49</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PE al PE 1"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">25 mm</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">49</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Acero Galv ½"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">12.7 mm</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">57.5</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Acero Galv ¾"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">19 mm</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">57.5</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cobre Rigido ½"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">10.9 mm</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">54.2</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cobre Rigido ¾"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">17.4 mm</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">54.2</td></tr>
          </tbody></table></div>
        ),
      },
    ],
};

export default gas;
