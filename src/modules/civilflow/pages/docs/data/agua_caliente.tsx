const agua_caliente = {
    name: 'Agua caliente',
    icon: 'local_fire_department',
    color: '#F04545',
    sections: [
      {
        title: 'Consideraciones de diseño',
        body: (
          <div className="space-y-3">
            <ul className="list-disc list-inside text-[13px] space-y-1">
              <li>Expansión térmica: los tubos se dilatan con la temperatura</li>
              <li>Aislamiento térmico para reducir pérdidas de calor</li>
              <li>Temperatura de servicio: 55–60 °C</li>
              <li>Recirculación opcional si L &gt; 15 m</li>
            </ul>
            <p className="text-[13px] font-semibold mt-2">Materiales comunes:</p>
            <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
              <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Material</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">T max</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Norma</th></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">CPVC</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">82 °C</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">RDE 11</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cobre</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">100 °C</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Soldable</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PP-R</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">70–90 °C</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Tipo 3</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PEX</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">60–80 °C</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Tipo A/B/C</td></tr>
            </tbody></table></div>
          </div>
        ),
      },
      {
        title: 'Pérdidas de calor y recirculación',
        body: (
          <div className="space-y-3">
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Q<sub>perd</sub> = U · A · (T<sub>m</sub> − T<sub>a</sub>)
            </div>
            <div className="text-[13px]">
              <span className="font-semibold">Caudal de recirculación:</span>
              <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
                Q<sub>rec</sub> = Q<sub>perd</sub> / (c<sub>p</sub> · &Delta;T)
              </div>
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Q<sub>perd</sub></span><span>pérdida de calor (kcal/h)</span>
              <span className="font-semibold text-primary">U</span><span>coeficiente global de transferencia (kcal/(h·m²·°C))</span>
              <span className="font-semibold text-primary">A</span><span>área superficial del tubo (m²)</span>
              <span className="font-semibold text-primary">T<sub>m</sub></span><span>temperatura media del agua (°C)</span>
              <span className="font-semibold text-primary">T<sub>a</sub></span><span>temperatura ambiente (°C)</span>
              <span className="font-semibold text-primary">Q<sub>rec</sub></span><span>caudal de recirculación (kg/h)</span>
              <span className="font-semibold text-primary">c<sub>p</sub></span><span>calor específico = 1 kcal/(kg·°C)</span>
              <span className="font-semibold text-primary">&Delta;T</span><span>diferencia de temperatura (5–10 °C)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              c<sub>p</sub> = 1 kcal/(kg·°C) · &Delta;T típico: 5–10 °C
            </div>
          </div>
        ),
      },
    ],
};

export default agua_caliente;
