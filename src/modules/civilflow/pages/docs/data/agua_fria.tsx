const agua_fria = {
    name: 'Agua fría',
    icon: 'ac_unit',
    color: '#1B6EF3',
    sections: [
      {
        title: 'Unidades de consumo (UC)',
        body: (
          <div className="space-y-3">
            <p>Unidades de Consumo para suministro de agua según NTC 1500:</p>
            <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
              <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Aparato</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">UC AF</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">UC AC</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">UD</th></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Inodoro tanque</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2.2</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">—</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">4</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavamanos</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Ducha</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.0</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.0</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavaplatos</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.0</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.0</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Tina</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.0</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.0</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavadora</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.0</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">—</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">4</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavadero</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.75</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.75</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
            </tbody></table></div>
          </div>
        ),
      },
      {
        title: 'Hazen-Williams (pérdidas)',
        body: (
          <div className="space-y-3">
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              h<sub>f</sub> = (10.67 · L · Q<sup>1.852</sup>) / (C<sup>1.852</sup> · D<sup>4.87</sup>)
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">h<sub>f</sub></span><span>pérdida por fricción (m)</span>
              <span className="font-semibold text-primary">L</span><span>longitud (m)</span>
              <span className="font-semibold text-primary">Q</span><span>caudal (m³/s)</span>
              <span className="font-semibold text-primary">C</span><span>coeficiente Hazen-Williams</span>
              <span className="font-semibold text-primary">D</span><span>diámetro interno (m)</span>
            </div>
            <div className="text-[13px] mt-2">
              <span className="font-semibold">Valores de C:</span>
              <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 ml-4 mt-1">
                <span className="font-mono text-primary">PVC</span><span>C = 150</span>
                <span className="font-mono text-primary">PE</span><span>C = 140</span>
                <span className="font-mono text-primary">Cobre</span><span>C = 130–140</span>
                <span className="font-mono text-primary">Acero galv.</span><span>C = 120</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: 'Verificación de presión y velocidad',
        body: (
          <div className="space-y-3">
            <p className="font-semibold text-[13px]">Presiones mínimas por aparato (NTC 1500):</p>
            <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
              <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Aparato</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Min (m.c.a.)</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Max (m.c.a.)</th></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Inodoro tanque</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.71</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">14.10</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavamanos</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.51</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">5.63</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Ducha</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1.02</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">5.63</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavaplatos</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.51</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">5.63</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Tina</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.51</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">14.10</td></tr>
            </tbody></table></div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Velocidad recomendada: 0.60 m/s – 3.00 m/s · Máxima absoluta: 5.00 m/s
            </div>
          </div>
        ),
      },
    ],
};

export default agua_fria;
