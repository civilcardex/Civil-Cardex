const equipos = {
    name: 'Bombas, tanques y equipos',
    icon: 'settings',
    color: '#0ECC7A',
    sections: [
      {
        title: 'Potencia de bomba',
        body: (
          <div className="space-y-3">
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              HP = (Q · H<sub>m</sub>) / (76 · &eta;)
            </div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">HP</span><span>potencia (HP) — 1 HP = 0.746 kW</span>
              <span className="font-semibold text-primary">Q</span><span>caudal (L/min)</span>
              <span className="font-semibold text-primary">H<sub>m</sub></span><span>altura manométrica total (m)</span>
              <span className="font-semibold text-primary">&eta;</span><span>eficiencia de la bomba (decimal)</span>
            </div>
            <p className="text-[13px] mt-2 font-semibold">Altura manométrica total:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              H<sub>m</sub> = H<sub>s</sub> + H<sub>i</sub> + h<sub>f,s</sub> + h<sub>f,i</sub>
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">H<sub>s</sub></span><span>altura de succión (m)</span>
              <span className="font-semibold text-primary">H<sub>i</sub></span><span>altura de impulsión (m)</span>
              <span className="font-semibold text-primary">h<sub>f,s</sub></span><span>pérdida por fricción en succión (m)</span>
              <span className="font-semibold text-primary">h<sub>f,i</sub></span><span>pérdida por fricción en impulsión (m)</span>
            </div>
          </div>
        ),
      },
      {
        title: 'NPSH',
        body: (
          <div className="space-y-3">
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              NPSH<sub>disp</sub> = (P<sub>atm</sub> − P<sub>v</sub>) / (&rho; · g) − h<sub>f,s</sub>
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">NPSH<sub>disp</sub></span><span>carga neta de succión disponible (m)</span>
              <span className="font-semibold text-primary">P<sub>atm</sub></span><span>presión atmosférica (Pa)</span>
              <span className="font-semibold text-primary">P<sub>v</sub></span><span>presión de vapor del agua (Pa)</span>
              <span className="font-semibold text-primary">&rho;</span><span>densidad del agua (kg/m³)</span>
              <span className="font-semibold text-primary">g</span><span>gravedad = 9.81 m/s²</span>
              <span className="font-semibold text-primary">h<sub>f,s</sub></span><span>pérdida por fricción en succión (m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Verificación: NPSH<sub>req</sub> &lt; NPSH<sub>disp</sub> (curva de bomba)
            </div>
          </div>
        ),
      },
      {
        title: 'Tanque de reserva',
        body: (
          <div className="space-y-3">
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              V = Población · Dotación · F<sub>reserva</sub>
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">V</span><span>volumen del tanque (L)</span>
              <span className="font-semibold text-primary">Población</span><span>número de habitantes</span>
              <span className="font-semibold text-primary">Dotación</span><span>consumo diario por persona (L/hab/dia)</span>
              <span className="font-semibold text-primary">F<sub>reserva</sub></span><span>factor de reserva (usualmente 1.5–2.0)</span>
            </div>
            <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
              <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Tipo de uso</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Dotación (L/hab/dia)</th></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Residencial</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">150–200</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Hotel</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">250–400</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Comercial</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">80–120</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Industrial</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">100–200</td></tr>
            </tbody></table></div>
            <div className="text-[12px] text-on-surface-variant">
              Relación L/A: 2:1 a 4:1 · Altura: 1.5–3.0 m
            </div>
          </div>
        ),
      },
      {
        title: 'Sistemas hidroneumáticos',
        body: (
          <div className="space-y-3">
            <p className="text-[13px] font-semibold">Premisas de diseño:</p>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="bg-surface-container-low p-2 rounded">Dotación: 250 L/persona</div>
              <div className="bg-surface-container-low p-2 rounded">Q<sub>b</sub> = 3 &times; Q<sub>m</sub></div>
              <div className="bg-surface-container-low p-2 rounded">P max: 50 psi (350 kPa)</div>
              <div className="bg-surface-container-low p-2 rounded">P min: 30 psi (207 kPa)</div>
              <div className="bg-surface-container-low p-2 rounded">Arranques max: 6/hora</div>
              <div className="bg-surface-container-low p-2 rounded">Eficiencia: 60%</div>
            </div>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Q<sub>m</sub> = (q · N) / 1440 &nbsp;&nbsp;[L/min]
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Q<sub>m</sub></span><span>caudal medio (L/min)</span>
              <span className="font-semibold text-primary">q</span><span>consumo unitario por persona (L/persona/dia)</span>
              <span className="font-semibold text-primary">N</span><span>número de personas</span>
            </div>
          </div>
        ),
      },
    ],
};

export default equipos;
