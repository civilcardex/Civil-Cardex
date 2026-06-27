
export const docData = {
  hidraulica: {
    name: 'Principios de hidráulica',
    icon: 'water_drop',
    color: '#4D8FF7',
    sections: [
      {
        title: 'Número de Froude',
        body: (
          <div className="space-y-3">
            <p>El número de Froude (Fr) es adimensional y relaciona las fuerzas de inercia con las de gravedad en un fluido.</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Fr = v / √(g · DH)
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">v</span><span>velocidad del agua (m/s)</span>
              <span className="font-semibold text-primary">g</span><span>gravedad = 9.81 m/s²</span>
              <span className="font-semibold text-primary">DH</span><span>profundidad hidráulica = A/T</span>
            </div>
            <div className="mt-3">
              <span className="text-on-surface-variant text-[13px] font-semibold block mb-1">Interpretación del régimen:</span>
              <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
                <span className="font-mono text-cyan-400 font-bold">Fr &gt; 1</span><span>Supercrítico — flujo rápido, energía cinética predominante</span>
                <span className="font-mono text-yellow-400 font-bold">Fr = 1</span><span>Crítico — flujo limítrofe</span>
                <span className="font-mono text-green-400 font-bold">Fr &lt; 1</span><span>Subcrítico — flujo lento, energía potencial predominante</span>
              </div>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3 mt-2">
              Recomendación: Para flujo estable se busca Fr &lt; 0.9 (subcrítico) o Fr &gt; 1.1 (supercrítico).
            </div>
          </div>
        ),
      },
      {
        title: 'Ecuación de Manning',
        body: (
          <div className="space-y-3">
            <p>Flujo a superficie libre según Manning:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              V = (1/n) · R<sub>h</sub><sup>2/3</sup> · √S
            </div>
            <p className="text-[13px]">Caudal:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Q = (1/n) · A · R<sub>h</sub><sup>2/3</sup> · √S
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">V</span><span>velocidad (m/s)</span>
              <span className="font-semibold text-primary">n</span><span>coeficiente de rugosidad de Manning</span>
              <span className="font-semibold text-primary">R<sub>h</sub></span><span>radio hidráulico (m)</span>
              <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
              <span className="font-semibold text-primary">A</span><span>área de la sección (m²)</span>
              <span className="font-semibold text-primary">Q</span><span>caudal (m³/s)</span>
            </div>
          </div>
        ),
      },
      {
        title: 'Fuerza tractiva',
        body: (
          <div className="space-y-3">
            <p>Fuerza que el fluido ejerce sobre el fondo del canal, responsable del arrastre de partículas sedimentadas.</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              T<sub>0</sub> = &gamma; · R · S
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">T<sub>0</sub></span><span>tensión tractiva (kg/m²)</span>
              <span className="font-semibold text-primary">&gamma;</span><span>peso específico del agua = 1000 kg/m³</span>
              <span className="font-semibold text-primary">R</span><span>radio hidráulico (m)</span>
              <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Requisito NTC 1500: T<sub>0</sub> &ge; 0.10 kg/m² (mínimo). Recomendado: 0.15 kg/m².
            </div>
          </div>
        ),
      },
      {
        title: 'Relaciones geométricas (sección circular)',
        body: (
          <div className="space-y-3">
            <p>Para tuberías parcialmente llenas, las relaciones de velocidad y caudal dependen de Y/D:</p>
            <div className="text-[13px]">
              <span className="font-semibold text-primary">Relación v/V (velocidad real / tubo lleno):</span>
              <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
                0.00 &lt; q/Q &le; 0.06  →  v/V = 10<sup>(0.0298 + 0.2910 · log(q/Q))</sup><br/>
                0.06 &lt; q/Q &le; 0.26  →  v/V = 10<sup>(0.0138 + 0.2860 · log(q/Q))</sup><br/>
                0.26 &lt; q/Q &le; 0.91  →  v/V = 10<sup>(0.0218 + 0.2900 · log(q/Q))</sup>
              </div>
            </div>
            <div className="text-[13px]">
              <span className="font-semibold text-primary">Relación h/D (calado / diámetro):</span>
              <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
                0.00 &le; q/Q &lt; 0.11  →  h/D = 0.3827 + 0.0645 · ln(q/Q)<br/>
                0.11 &le; q/Q &lt; 0.21  →  h/D = 0.6003 + 0.1547 · ln(q/Q)<br/>
                0.21 &le; q/Q &lt; 0.91  →  h/D = 0.225 + 0.667 · (q/Q)
              </div>
            </div>
            <div className="text-[13px]">
              <span className="font-semibold text-primary">Ángulo &alpha; (radianes):</span>
              <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">&alpha; = 2 · arccos(1 − 2 · h/D)</div>
            </div>
            <div className="text-[13px]">
              <span className="font-semibold text-primary">Relación R<sub>h</sub>/D:</span>
              <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">R<sub>h</sub>/D = ¼ · (1 − sen(&alpha;) / &alpha;)</div>
            </div>
          </div>
        ),
      },
      {
        title: 'Pendiente crítica',
        body: (
          <div className="space-y-3">
            <p>Para canales de sección circular:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              S<sub>c</sub> = (4.579 &times; 10<sup>−4</sup>) / d<sup>3</sup>
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">S<sub>c</sub></span><span>pendiente crítica</span>
              <span className="font-semibold text-primary">d</span><span>diámetro de tubería (m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Si S &lt; S<sub>c</sub>: pendiente subcrítica para cualquier caudal.<br/>
              Si S &gt; S<sub>c</sub>: puede presentar comportamiento supercrítico.
            </div>
          </div>
        ),
      },
      {
        title: 'Elementos hidráulicos por sección',
        body: (
          <div className="space-y-4">
            <div>
              <span className="text-[13px] font-semibold text-cyan-400">Rectangular</span>
              <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
                A = b · y<br/>
                P = b + 2 · y<br/>
                R<sub>h</sub> = (b · y) / (b + 2 · y)<br/>
                T = b
              </div>
            </div>
            <div>
              <span className="text-[13px] font-semibold text-yellow-400">Trapezoidal</span>
              <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
                A = (b + z · y) · y<br/>
                P = b + 2 · y · &radic;(1 + z²)<br/>
                R<sub>h</sub> = ((b + z · y) · y) / (b + 2 · y · &radic;(1 + z²))<br/>
                T = b + 2 · z · y
              </div>
            </div>
            <div>
              <span className="text-[13px] font-semibold text-green-400">Circular (parcialmente lleno)</span>
              <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
                A = (D²/4) · (&theta; − sen(&theta;)) / 2<br/>
                P = D · &theta; / 2<br/>
                R<sub>h</sub> = D/4 · (1 − sen(&theta;) / &theta;)<br/>
                T = D · sen(&theta;/2)
              </div>
              <div className="text-[11px] text-on-surface-variant ml-4">con &theta; en radianes</div>
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">b</span><span>ancho de base (m)</span>
              <span className="font-semibold text-primary">y</span><span>calado o profundidad del flujo (m)</span>
              <span className="font-semibold text-primary">z</span><span>talud horizontal (relación H:V)</span>
              <span className="font-semibold text-primary">D</span><span>diámetro de tubería (m)</span>
              <span className="font-semibold text-primary">&theta;</span><span>ángulo del espejo de agua (rad)</span>
              <span className="font-semibold text-primary">A</span><span>área hidráulica (m²)</span>
              <span className="font-semibold text-primary">P</span><span>perímetro mojado (m)</span>
              <span className="font-semibold text-primary">R<sub>h</sub></span><span>radio hidráulico (m)</span>
              <span className="font-semibold text-primary">T</span><span>espejo de agua (m)</span>
            </div>
          </div>
        ),
      },
    ],
  },
  sanitarias: {
    name: 'Redes sanitarias',
    icon: 'plumbing',
    color: '#F5A623',
    sections: [
      {
        title: 'Unidades de descarga (UD)',
        body: (
          <div className="space-y-3">
            <p>Método empírico para estimar el flujo máximo probable en sistemas de drenaje sanitario según NTC 1500.</p>
            <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
              <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Aparato</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Control</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">UD</th></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavamanos</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Llave</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Inodoro</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Tanque</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">4</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Ducha</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Válvula mezcla</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavaplatos</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Grifería</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Tina</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Válvula mezcla</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavadora</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">—</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">4</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Lavadero</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">—</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Orinal / Urinal</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Tanque</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">5</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Sanitario fluxómetro</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Fluxómetro</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">6</td></tr>
            </tbody></table></div>
          </div>
        ),
      },
      {
        title: 'Caudal por simultaneidad',
        body: (
          <div className="space-y-3">
            <p>Factor de simultaneidad y caudal de diseño por el método de Hunter:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              K = 1 / &radic;(N − 1) &nbsp;&nbsp; (N &gt; 1)<br/>
              K = 1 &nbsp;&nbsp; (N = 1)
            </div>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Q = K · Q<sub>UD</sub><br/><br/>
              Q<sub>UD</sub> = 0.1163 · UD<sup>0.6875</sup> &nbsp;&nbsp; (UD &lt; 240)<br/>
              Q<sub>UD</sub> = 0.074 · UD<sup>0.7504</sup> &nbsp;&nbsp; (UD &ge; 240)
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">K</span><span>factor de simultaneidad</span>
              <span className="font-semibold text-primary">N</span><span>número de aparatos conectados</span>
              <span className="font-semibold text-primary">Q</span><span>caudal de diseño (L/min)</span>
              <span className="font-semibold text-primary">Q<sub>UD</sub></span><span>caudal por unidad de descarga (L/min)</span>
              <span className="font-semibold text-primary">UD</span><span>unidades de descarga totales</span>
            </div>
            <div className="text-[12px] text-on-surface-variant">Fórmula basada en Hunter - ASHRAE</div>
          </div>
        ),
      },
      {
        title: 'Bajantes sanitarios',
        body: (
          <div className="space-y-3">
            <p>Diámetro de bajante por Manning:</p>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              D = ((Q · n) / (0.312 · &radic;S))<sup>3/8</sup> &times; 1000 / 25.4 &nbsp;&nbsp;[pulg]
            </div>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Q = 0.312 · (D/1000)<sup>8/3</sup> · &radic;S / n
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">D</span><span>diámetro (pulgadas)</span>
              <span className="font-semibold text-primary">Q</span><span>caudal (m³/s)</span>
              <span className="font-semibold text-primary">n</span><span>coeficiente de Manning</span>
              <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Velocidad mínima: 0.60 m/s (autolimpieza) · Velocidad máxima: 5.00 m/s<br/>
              Fuerza tractiva: T<sub>0</sub> &ge; 0.10 kg/m² (NTC 1500)
            </div>
          </div>
        ),
      },
      {
        title: 'Tubería de ventilación',
        body: (
          <div className="space-y-3">
            <p>Funciones: entrada de aire, evacuación de gases, mantener sellos hidráulicos, autolimpieza.</p>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3 mb-2">
              Diámetro mínimo NTC 1500: 1&frac12;" (38 mm)
            </div>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              Q<sub>aire</sub> = 1000 · V<sub>t</sub> · (&pi;/4) · D² · (17/24)
            </div>
            <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
              D<sub>vent</sub> = ((Q<sub>aire</sub> · n) / (1.754 · S<sup>5/3</sup>))<sup>3/8</sup>
            </div>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Q<sub>aire</sub></span><span>caudal de aire requerido (m³/s)</span>
              <span className="font-semibold text-primary">V<sub>t</sub></span><span>velocidad del aire en la tubería (m/s)</span>
              <span className="font-semibold text-primary">D</span><span>diámetro de la bajante (m)</span>
              <span className="font-semibold text-primary">D<sub>vent</sub></span><span>diámetro de ventilación (m)</span>
              <span className="font-semibold text-primary">n</span><span>coeficiente de Manning</span>
              <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
            </div>
          </div>
        ),
      },
    ],
  },
  lluvias: {
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
  },
  agua_fria: {
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
  },
  agua_caliente: {
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
  },
  gas: {
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
  },
  equipos: {
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
  },
  tablas: {
    name: 'Tablas y verificaciones',
    icon: 'table_chart',
    color: '#C9A227',
    sections: [
      {
        title: 'Manning — coeficientes n',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Material</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">n</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PVC sanitario</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.009</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PVC presión</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.009</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Hierro fundido</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.013</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Concreto</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.013</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Acero galvanizado</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.015</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cobre</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.013</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Gres cerámico</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.010</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PE</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.009</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Verificaciones sanitarias',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Parámetro</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Condición</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Ref.</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Pendiente min (2–6")</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 2% (20 mm/m)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500 8.4.1</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Pendiente min (8"+ )</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 0.5% (5 mm/m)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500 8.4.1</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad mínima</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 0.60 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad máxima</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 5.00 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Fuerza tractiva min</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 0.10 kg/m²</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Relleno sobre tubería</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 0.30 m</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Verificaciones redes de agua',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Parámetro</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Condición</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Ref.</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad máxima (rec.)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 3.00 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">RAS 2000</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad máxima abs.</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 5.00 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">RAS 2000</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Presión estática máx</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 50 m.c.a.</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Presión dinámica mín</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 3.00 m.c.a.</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Verificaciones red de gas',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Parámetro</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Condición</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Ref.</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&Delta;P máximo</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 9.81 mbar</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad máxima</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 10 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">P. min en acometida</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 17 mbar</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">P. max interior</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 25 mbar</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Diámetros comerciales PVC RDE 11',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Nominal</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">DI (mm)</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">DE (mm)</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">½"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">16.6</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">21.3</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">¾"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">21.8</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">26.7</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">28.5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">33.4</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1¼"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">37.1</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">42.2</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1½"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">43.6</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">48.3</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">56.1</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">60.3</td></tr>
          </tbody></table></div>
        ),
      },
    ],
  },
  formulas: {
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
  },
  manual: {
    name: 'Manual de usuario',
    icon: 'menu_book',
    color: '#4D8FF7',
    sections: [
      {
        title: 'Introducción',
        body: (
          <div className="space-y-3">
            <p>CIVILFLOW KML 2026 es un aplicativo web de diseño hidrosanitario desarrollado por el Ing. Camilo Cárdenas Chacón. Permite elaborar memorias de cálculo completas para redes de Agua fría, Agua caliente, Sanitaria, Aguas lluvias, Gas combustible y Red contra incendio.</p>
            <p className="text-[13px] font-semibold">Normas aplicadas:</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NTC 1500:2020</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">RAS 2000</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NTC 3728</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NSR-10 Título J</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NFPA 13</span>
            </div>
          </div>
        ),
      },
      {
        title: 'Interfaz del aplicativo',
        body: (
          <div className="space-y-4">
            <p>La interfaz de CIVILFLOW KML 2026 se divide en cinco zonas principales, cada una con funciones específicas para facilitar el diseño hidrosanitario:</p>

            <div className="border border-outline-variant rounded overflow-hidden">
              <div className="grid grid-cols-[140px,1fr] gap-0 text-[13px]">
                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Topbar</div>
                <div className="px-3 py-2 border-b border-outline-variant">Barra superior con el logo de la firma KML, el nombre del sistema Civil Flow, los datos del ingeniero responsable (nombre, título, número de matrícula profesional) y las normas técnicas aplicables (NTC 1500, RAS 2000, NTC 3728, NSR-10). Se muestra también el nombre del proyecto activo.</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Nav / Pestañas</div>
                <div className="px-3 py-2 border-b border-outline-variant">Barra de navegación con pestañas para acceder a cada módulo del aplicativo: Planos (carga de PDF o imagen), Materiales (gestión de catálogos por red), Aparatos (tabla de unidades de consumo y descarga), Cubierta (cálculo de Aguas lluvias por método racional), Gas (diseño de redes por Renouard), Calentadores (selección de equipos a gas), Validación (resumen y verificación final).</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Sidebar</div>
                <div className="px-3 py-2 border-b border-outline-variant">Panel lateral izquierdo con tres secciones: Datos del proyecto (nombre, dirección, municipio, uso, empresa prestadora, presión de red, dotación), Materiales por red (selector de tipo de tubería para cada sistema: AF, AC, sanitaria, lluvias, gas, RCI), Redes a calcular (toggles para activar o desactivar cada red del proyecto) y Generador de niveles (configuración de sótanos, pisos, alturas y NPT).</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Content</div>
                <div className="px-3 py-2 border-b border-outline-variant">Área central donde se muestran las tablas, formularios y resultados del módulo seleccionado. Aquí se ingresan los datos de cada red, se visualizan los cálculos y se revisan las verificaciones de norma.</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2">Act Bar</div>
                <div className="px-3 py-2">Barra de acción inferior que muestra en tiempo real los totales del proyecto: unidades de consumo (UC) de agua fría y caliente, unidades de descarga (UD) sanitarias, pérdida de presión acumulada de gas (ΔP) con indicador color verde/rojo según cumpla el límite NTC 3728.</div>
              </div>
            </div>

            <p className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              El orden de trabajo recomendado es: datos del proyecto, generación de niveles, selección de materiales, activación de redes, ajuste de aparatos, cálculo de cubierta, diseño de red de gas, selección de calentador y finalmente validación y exportación.
            </p>
          </div>
        ),
      },
      {
        title: 'Datos del proyecto',
        body: (
          <div className="space-y-3">
            <p>Complete los datos generales en el Sidebar. Estos datos aparecen en todas las memorias de cálculo.</p>
            <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
              <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Campo</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Ejemplo</th></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Nombre del proyecto</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Casa No. 26 CR Monte Real</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Dirección</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">CR 10 No. 25-40</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Municipio</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Floridablanca</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Uso</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Vivienda unifamiliar</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Empresa prestadora</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">EMAB - Floridablanca</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">P. red (m.c.a.)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">20</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Dotación (L/hab/dia)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">280</td></tr>
            </tbody></table></div>
            <div className="text-[12px] text-on-surface-variant">Dotación según RAS 2000 Tabla B.2.1 — Vivienda unifamiliar: 200–280 L/hab/dia.</div>
          </div>
        ),
      },
      {
        title: 'Generador de niveles',
        body: (
          <div className="space-y-3">
            <p>El generador automático de niveles se encuentra en la parte inferior del Sidebar.</p>
            <ol className="list-decimal list-inside text-[13px] space-y-1">
              <li>Definir N° de sótanos (0 si no aplica)</li>
              <li>Definir N° de pisos sobre rasante (min. 1)</li>
              <li>Altura de entrepiso (2.80–3.30 m) y sótano (2.80–3.00 m)</li>
              <li>NPT Piso 1 (nivel de referencia)</li>
              <li>Activar "Incluir cubierta" si aplica</li>
              <li>Hacer clic en "Generar niveles"</li>
            </ol>
          </div>
        ),
      },
      {
        title: 'Redes a calcular',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">#</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Red</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Cuando activar</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Sanitaria</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Siempre — obligatoria</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Aguas lluvias</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cuando hay cubierta</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">4</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Agua fría</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Siempre — suministro</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Agua caliente</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cuando hay calentador</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">6</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Red de Gas</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cuando hay aparatos a gas</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">7</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Equipo presión</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Presión de red insuficiente</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">8</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Bomba AR</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Aguas residuales en sótano</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">9</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Recirculación AC</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">L de AC &gt; 15 m</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">10</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Contra incendio</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Según NSR-10 Título J</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Flujo de trabajo completo',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">#</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Tarea</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Datos del proyecto (Sidebar)</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Generar niveles</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">3</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Seleccionar materiales</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">4</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Activar redes</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Ajustar aparatos (UC, UD, Q gas)</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">6</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Ingresar cubierta (áreas, I)</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">7</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Calcular red de gas (Renouard)</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">8</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Seleccionar calentador</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">9</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Verificar validación</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">10</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Verificar validación final</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Normatividad aplicada',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Norma</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Aplicación</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500:2020</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">UC, UD, presiones, velocidades, diámetros mínimos</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">RAS 2000</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Dotaciones, Manning, método racional</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Renouard, caudales gas, factor fs</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NSR-10 Título J</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Protección contra incendio</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NFPA 13:2022</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Rociadores, densidad, área operación</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 382</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PVC a presión, RDE</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1087</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PVC sanitario y lluvias</td></tr>
          </tbody></table></div>
        ),
      },
    ],
  },
}
