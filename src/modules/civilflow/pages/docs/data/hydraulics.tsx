import { donde, fx } from './ui';

const hidraulica = {
  name: 'Principios de hidráulica',
  desc: 'Fundamentos: Froude, Manning, fuerza tractiva y elementos hidráulicos de la sección circular.',
  icon: 'water_drop',
  color: '#4D8FF7',
  sections: [
    {
      title: 'Número de Froude',
      body: (
        <div className="space-y-3">
          <p>
            El número de Froude (Fr) es adimensional y relaciona las fuerzas de inercia con las de
            gravedad en un fluido.
          </p>
          {fx('Fr = v / √(g · DH)')}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['v', 'velocidad del agua (m/s)'],
            ['g', 'gravedad = 9.81 m/s²'],
            ['DH', 'profundidad hidráulica = A/T'],
          ])}
          <div className="mt-3">
            <span className="text-on-surface-variant text-[13px] font-semibold block mb-1">
              Interpretación del régimen:
            </span>
            {donde([
              [
                <span className="font-mono text-cyan-400 font-bold">Fr &gt; 1</span>,
                'Supercrítico — flujo rápido, energía cinética predominante',
              ],
              [
                <span className="font-mono text-yellow-400 font-bold">Fr = 1</span>,
                'Crítico — flujo limítrofe',
              ],
              [
                <span className="font-mono text-green-400 font-bold">Fr &lt; 1</span>,
                'Subcrítico — flujo lento, energía potencial predominante',
              ],
            ])}
          </div>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3 mt-2">
            Recomendación: Para flujo estable se busca Fr &lt; 0.9 (subcrítico) o Fr &gt; 1.1
            (supercrítico).
          </div>
        </div>
      ),
    },
    {
      title: 'Ecuación de Manning',
      body: (
        <div className="space-y-3">
          <p>Flujo a superficie libre según Manning:</p>
          {fx(
            <>
              V = (1/n) · R<sub>h</sub>
              <sup>2/3</sup> · √S
            </>,
          )}
          <p className="text-[13px]">Caudal:</p>
          {fx(
            <>
              Q = (1/n) · A · R<sub>h</sub>
              <sup>2/3</sup> · √S
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['V', 'velocidad (m/s)'],
            ['n', 'coeficiente de rugosidad de Manning'],
            [
              <>
                R<sub>h</sub>
              </>,
              'radio hidráulico (m)',
            ],
            ['S', 'pendiente (m/m)'],
            ['A', 'área de la sección (m²)'],
            ['Q', 'caudal (m³/s)'],
          ])}
        </div>
      ),
    },
    {
      title: 'Fuerza tractiva',
      body: (
        <div className="space-y-3">
          <p>
            Fuerza que el fluido ejerce sobre el fondo del canal, responsable del arrastre de
            partículas sedimentadas.
          </p>
          {fx(
            <>
              T<sub>0</sub> = &gamma; · R · S
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            [
              <>
                T<sub>0</sub>
              </>,
              'tensión tractiva (kg/m²)',
            ],
            [<>&gamma;</>, 'peso específico del agua = 1000 kg/m³'],
            ['R', 'radio hidráulico (m)'],
            ['S', 'pendiente (m/m)'],
          ])}
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
          <p>
            Para tuberías parcialmente llenas, las relaciones de velocidad y caudal dependen de Y/D:
          </p>
          <div className="text-[13px]">
            <span className="font-semibold text-primary">
              Relación v/V (velocidad real / tubo lleno):
            </span>
            {fx(
              <>
                0.00 &lt; q/Q &le; 0.06 → v/V = 10<sup>(0.0298 + 0.2910 · log(q/Q))</sup>
                <br />
                0.06 &lt; q/Q &le; 0.26 → v/V = 10<sup>(0.0138 + 0.2860 · log(q/Q))</sup>
                <br />
                0.26 &lt; q/Q &le; 0.91 → v/V = 10<sup>(0.0218 + 0.2900 · log(q/Q))</sup>
              </>,
            )}
          </div>
          <div className="text-[13px]">
            <span className="font-semibold text-primary">Relación h/D (calado / diámetro):</span>
            {fx(
              <>
                0.00 &le; q/Q &lt; 0.11 → h/D = 0.3827 + 0.0645 · ln(q/Q)
                <br />
                0.11 &le; q/Q &lt; 0.21 → h/D = 0.6003 + 0.1547 · ln(q/Q)
                <br />
                0.21 &le; q/Q &lt; 0.91 → h/D = 0.225 + 0.667 · (q/Q)
              </>,
            )}
          </div>
          <div className="text-[13px]">
            <span className="font-semibold text-primary">Ángulo &alpha; (radianes):</span>
            {fx('α = 2 · arccos(1 − 2 · h/D)', true)}
          </div>
          <div className="text-[13px]">
            <span className="font-semibold text-primary">
              Relación R<sub>h</sub>/D:
            </span>
            {fx(
              <>
                R<sub>h</sub>/D = ¼ · (1 − sen(&alpha;) / &alpha;)
              </>,
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Pendiente crítica',
      body: (
        <div className="space-y-3">
          <p>Para canales de sección circular:</p>
          {fx(
            <>
              S<sub>c</sub> = (4.579 &times; 10<sup>−4</sup>) / d<sup>3</sup>
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            [
              <>
                S<sub>c</sub>
              </>,
              'pendiente crítica',
            ],
            ['d', 'diámetro de tubería (m)'],
          ])}
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Si S &lt; S<sub>c</sub>: pendiente subcrítica para cualquier caudal.
            <br />
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
            {fx(
              <>
                A = b · y
                <br />
                P = b + 2 · y
                <br />R<sub>h</sub> = (b · y) / (b + 2 · y)
                <br />T = b
              </>,
            )}
          </div>
          <div>
            <span className="text-[13px] font-semibold text-yellow-400">Trapezoidal</span>
            {fx(
              <>
                A = (b + z · y) · y
                <br />
                P = b + 2 · y · &radic;(1 + z²)
                <br />R<sub>h</sub> = ((b + z · y) · y) / (b + 2 · y · &radic;(1 + z²))
                <br />T = b + 2 · z · y
              </>,
            )}
          </div>
          <div>
            <span className="text-[13px] font-semibold text-green-400">
              Circular (parcialmente lleno)
            </span>
            {fx(
              <>
                A = (D²/4) · (&theta; − sen(&theta;)) / 2
                <br />
                P = D · &theta; / 2
                <br />R<sub>h</sub> = D/4 · (1 − sen(&theta;) / &theta;)
                <br />T = D · sen(&theta;/2)
              </>,
            )}
            <div className="text-[11px] text-on-surface-variant ml-4">con &theta; en radianes</div>
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['b', 'ancho de base (m)'],
            ['y', 'calado o profundidad del flujo (m)'],
            ['z', 'talud horizontal (relación H:V)'],
            ['D', 'diámetro de tubería (m)'],
            [<>&theta;</>, 'ángulo del espejo de agua (rad)'],
            ['A', 'área hidráulica (m²)'],
            ['P', 'perímetro mojado (m)'],
            [
              <>
                R<sub>h</sub>
              </>,
              'radio hidráulico (m)',
            ],
            ['T', 'espejo de agua (m)'],
          ])}
        </div>
      ),
    },
  ],
};

export default hidraulica;
