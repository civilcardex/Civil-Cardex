import { Tabla, donde, fx } from './ui';

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
          {fx(
            <>
              K = 1 / &radic;(N − 1) &nbsp;&nbsp; (N &gt; 1)
              <br />K = 1 &nbsp;&nbsp; (N = 1)
            </>,
          )}
          {fx(
            <>
              Q = K · Q<sub>UD</sub>
              <br />
              <br />Q<sub>UD</sub> = 0.1163 · UD<sup>0.6875</sup> &nbsp;&nbsp; (UD &lt; 240)
              <br />Q<sub>UD</sub> = 0.074 · UD<sup>0.7504</sup> &nbsp;&nbsp; (UD &ge; 240)
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['K', 'factor de simultaneidad'],
            ['N', 'número de aparatos conectados'],
            ['Q', 'caudal de diseño (L/min)'],
            [
              <>
                Q<sub>UD</sub>
              </>,
              'caudal por unidad de descarga (L/min)',
            ],
            ['UD', 'unidades de descarga totales'],
          ])}
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
          {fx(
            <>
              D = ((Q · n) / (0.312 · &radic;S))<sup>3/8</sup> &times; 1000 / 25.4
              &nbsp;&nbsp;[pulg]
            </>,
          )}
          {fx(
            <>
              Q = 0.312 · (D/1000)<sup>8/3</sup> · &radic;S / n
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['D', 'diámetro (pulgadas)'],
            ['Q', 'caudal (m³/s)'],
            ['n', 'coeficiente de Manning'],
            ['S', 'pendiente (m/m)'],
          ])}
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
          {fx(
            <>
              Q<sub>aire</sub> = 1000 · V<sub>t</sub> · (&pi;/4) · D² · (17/24)
            </>,
          )}
          {fx(
            <>
              D<sub>vent</sub> = ((Q<sub>aire</sub> · n) / (1.754 · S<sup>5/3</sup>))<sup>3/8</sup>
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            [
              <>
                Q<sub>aire</sub>
              </>,
              'caudal de aire requerido (m³/s)',
            ],
            [
              <>
                V<sub>t</sub>
              </>,
              'velocidad del aire en la tubería (m/s)',
            ],
            ['D', 'diámetro de la bajante (m)'],
            [
              <>
                D<sub>vent</sub>
              </>,
              'diámetro de ventilación (m)',
            ],
            ['n', 'coeficiente de Manning'],
            ['S', 'pendiente (m/m)'],
          ])}
        </div>
      ),
    },
  ],
};

export default sanitarias;
