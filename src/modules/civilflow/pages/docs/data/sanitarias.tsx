import { Tabla, donde } from './ui';

const sanitarias = {
  name: 'Redes sanitarias',
  desc: 'Unidades de descarga, caudal por simultaneidad, bajantes y ventilación (NTC 1500).',
  icon: 'plumbing',
  color: '#F5A623',
  sections: [
    {
      title: 'Unidades de descarga (UD)',
      body: (
        <div className="space-y-3">
          <p>
            Método empírico para estimar el flujo máximo probable en sistemas de drenaje sanitario
            según NTC 1500.
          </p>
          <Tabla
            head={['Aparato', 'Control', 'UD']}
            rows={[
              ['Lavamanos', 'Llave', '2'],
              ['Inodoro', 'Tanque', '4'],
              ['Ducha', 'Válvula mezcla', '2'],
              ['Lavaplatos', 'Grifería', '2'],
              ['Tina', 'Válvula mezcla', '2'],
              ['Lavadora', '—', '4'],
              ['Lavadero', '—', '2'],
              ['Orinal / Urinal', 'Tanque', '5'],
              ['Sanitario fluxómetro', 'Fluxómetro', '6'],
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Caudal por simultaneidad',
      body: (
        <div className="space-y-3">
          <p>Factor de simultaneidad y caudal de diseño por el método de Hunter:</p>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            K = 1 / &radic;(N − 1) &nbsp;&nbsp; (N &gt; 1)
            <br />K = 1 &nbsp;&nbsp; (N = 1)
          </div>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            Q = K · Q<sub>UD</sub>
            <br />
            <br />Q<sub>UD</sub> = 0.1163 · UD<sup>0.6875</sup> &nbsp;&nbsp; (UD &lt; 240)
            <br />Q<sub>UD</sub> = 0.074 · UD<sup>0.7504</sup> &nbsp;&nbsp; (UD &ge; 240)
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">K</span>
            <span>factor de simultaneidad</span>
            <span className="font-semibold text-primary">N</span>
            <span>número de aparatos conectados</span>
            <span className="font-semibold text-primary">Q</span>
            <span>caudal de diseño (L/min)</span>
            <span className="font-semibold text-primary">
              Q<sub>UD</sub>
            </span>
            <span>caudal por unidad de descarga (L/min)</span>
            <span className="font-semibold text-primary">UD</span>
            <span>unidades de descarga totales</span>
          </div>
          <div className="text-[12px] text-on-surface-variant">
            Fórmula basada en Hunter - ASHRAE
          </div>
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
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde({
            D: 'diámetro (pulgadas)',
            Q: 'caudal (m³/s)',
            n: 'coeficiente de Manning',
            S: 'pendiente (m/m)',
          })}
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Velocidad mínima: 0.60 m/s (autolimpieza) · Velocidad máxima: 5.00 m/s
            <br />
            Fuerza tractiva: T<sub>0</sub> &ge; 0.10 kg/m² (NTC 1500)
          </div>
          <p className="text-[13px]">
            Además del diámetro, la tabla de diseño sanitario verifica por tramo: tirante normal Y
            <sub>n</sub>/D ≤ 0.75 (reserva de aire), régimen supercrítico por Froude (Fr &gt; 1),
            velocidad dentro de límites y fuerza tractiva. El caudal del tramo acumula las UD de
            todos los aparatos aguas arriba (UD propia + UD de otros ramales) con la curva de
            simultaneidad mostrada arriba.
          </p>
        </div>
      ),
    },
    {
      title: 'Tubería de ventilación',
      body: (
        <div className="space-y-3">
          <p>
            Funciones: entrada de aire, evacuación de gases, mantener sellos hidráulicos,
            autolimpieza.
          </p>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3 mb-2">
            Diámetro mínimo NTC 1500: 1&frac12;" (38 mm)
          </div>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            Q<sub>aire</sub> = 1000 · V<sub>t</sub> · (&pi;/4) · D² · (17/24)
          </div>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            D<sub>vent</sub> = ((Q<sub>aire</sub> · n) / (1.754 · S<sup>5/3</sup>))<sup>3/8</sup>
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">
              Q<sub>aire</sub>
            </span>
            <span>caudal de aire requerido (m³/s)</span>
            <span className="font-semibold text-primary">
              V<sub>t</sub>
            </span>
            <span>velocidad del aire en la tubería (m/s)</span>
            <span className="font-semibold text-primary">D</span>
            <span>diámetro de la bajante (m)</span>
            <span className="font-semibold text-primary">
              D<sub>vent</sub>
            </span>
            <span>diámetro de ventilación (m)</span>
            <span className="font-semibold text-primary">n</span>
            <span>coeficiente de Manning</span>
            <span className="font-semibold text-primary">S</span>
            <span>pendiente (m/m)</span>
          </div>
        </div>
      ),
    },
  ],
};

export default sanitarias;
