const lluvias = {
    name: 'Aguas lluvias',
    icon: 'water',
    color: '#22D3EE',
    sections: [
      {
        title: 'Método racional',
        body: (
          <div className="space-y-3">
            <p>El caudal de Aguas lluvias se calcula según RAS 2000:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Q = (C · I · A) / 360
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Q</span><span>caudal de diseño (m³/s)</span>
              <span className="font-semibold text-primary">C</span><span>coeficiente de escorrentía</span>
              <span className="font-semibold text-primary">I</span><span>intensidad de lluvia (mm/h)</span>
              <span className="font-semibold text-primary">A</span><span>área de drenaje (m²)</span>
            </div>
          </div>
        ),
      },
      {
        title: 'Coeficiente de escorrentía C',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Tipo de superficie</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">C</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cubierta impermeable</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.95–1.00</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cubierta metálica</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.95–1.00</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Teja / Placa concreto</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.85–0.95</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Jardines / Áreas verdes</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.10–0.25</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Zonas pavimentadas</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.70–0.95</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Césped / Suelo arenoso</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.05–0.10</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Césped / Suelo arcilloso</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.15–0.25</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Bajante y canal de cubierta',
        body: (
          <div className="space-y-3">
            <p>Diámetro de bajante de Aguas lluvias:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              D = ((Q · n) / (1.754 · S<sup>5/3</sup>))<sup>3/8</sup> &times; 1000 &nbsp;&nbsp;[mm]
            </div>
            <p className="text-[13px]">Canal rectangular — caudal máximo:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Q<sub>max</sub> = (1/n) · A · R<sub>h</sub><sup>2/3</sup> · √S
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">D</span><span>diámetro de bajante (mm)</span>
              <span className="font-semibold text-primary">Q</span><span>caudal de diseño (m³/s)</span>
              <span className="font-semibold text-primary">Q<sub>max</sub></span><span>caudal máximo del canal (m³/s)</span>
              <span className="font-semibold text-primary">n</span><span>coeficiente de Manning</span>
              <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
              <span className="font-semibold text-primary">A</span><span>área hidráulica del canal (m²)</span>
              <span className="font-semibold text-primary">R<sub>h</sub></span><span>radio hidráulico (m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant">Verificación: Q<sub>real</sub> &le; Q<sub>max</sub> → OK</div>
          </div>
        ),
      },
    ],
};

export default lluvias;
