const hidraulica = {
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
};

export default hidraulica;
