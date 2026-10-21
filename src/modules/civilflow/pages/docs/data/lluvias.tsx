import { Tabla, donde, fx } from './ui';

const lluvias = {
  name: 'Aguas lluvias',
  desc: 'Método racional, coeficiente C, capacidad de bajantes (Wyly-Eaton) y canales de cubierta.',
  icon: 'water',
  color: '#22D3EE',
  sections: [
    {
      title: 'Método racional',
      body: (
        <div className="space-y-3">
          <p>El caudal de Aguas lluvias se calcula según RAS 2000:</p>
          {fx('Q = (C · I · A) / 360')}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['Q', 'caudal de diseño (m³/s)'],
            ['C', 'coeficiente de escorrentía'],
            ['I', 'intensidad de lluvia (mm/h)'],
            ['A', 'área de drenaje (m²)'],
          ])}
        </div>
      ),
    },
    {
      title: 'Coeficiente de escorrentía C',
      body: (
        <Tabla
          head={['Tipo de superficie', 'C']}
          rows={[
            ['Cubierta impermeable', '0.95–1.00'],
            ['Cubierta metálica', '0.95–1.00'],
            ['Teja / Placa concreto', '0.85–0.95'],
            ['Jardines / Áreas verdes', '0.10–0.25'],
            ['Zonas pavimentadas', '0.70–0.95'],
            ['Césped / Suelo arenoso', '0.05–0.10'],
            ['Césped / Suelo arcilloso', '0.15–0.25'],
          ]}
        />
      ),
    },
    {
      title: 'Bajante y canal de cubierta',
      body: (
        <div className="space-y-3">
          <p>Diámetro de bajante de Aguas lluvias:</p>
          {fx(
            <>
              D = ((Q · n) / (1.754 · S<sup>5/3</sup>))<sup>3/8</sup> &times; 1000 &nbsp;&nbsp;[mm]
            </>,
          )}
          <p className="text-[13px]">Canal rectangular — caudal máximo:</p>
          {fx(
            <>
              Q<sub>max</sub> = (1/n) · A · R<sub>h</sub>
              <sup>2/3</sup> · √S
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['D', 'diámetro de bajante (mm)'],
            ['Q', 'caudal de diseño (m³/s)'],
            [
              <>
                Q<sub>max</sub>
              </>,
              'caudal máximo del canal (m³/s)',
            ],
            ['n', 'coeficiente de Manning'],
            ['S', 'pendiente (m/m)'],
            ['A', 'área hidráulica del canal (m²)'],
            [
              <>
                R<sub>h</sub>
              </>,
              'radio hidráulico (m)',
            ],
          ])}
          <div className="text-[12px] text-on-surface-variant">
            Verificación: Q<sub>real</sub> &le; Q<sub>max</sub> → OK
          </div>
        </div>
      ),
    },
    {
      title: 'Capacidad de bajantes (Wyly-Eaton)',
      body: (
        <div className="space-y-3">
          <p>
            Capacidad hidráulica de un bajante vertical parcialmente lleno (flujo anular), método de
            Wyly-Eaton — la que usan las tablas de chequeo de bajantes de cubierta. Corrige el
            coeficiente K por la rugosidad del material como en Manning:
          </p>
          {fx(
            <>
              Q<sub>cap</sub> = 27.8 · (0.009 / n) · r<sup>5/3</sup> · D<sup>8/3</sup>{' '}
              &nbsp;&nbsp;[gpm]
              <br />Q<sub>cap</sub> = Q<sub>cap,gpm</sub> × 0.0631 &nbsp;&nbsp;[L/s]
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['D', 'diámetro del bajante (pulg)'],
            ['r', 'razón de llenado del tubo (1/4 o 7/24)'],
            ['n', 'Manning del material (ref. 0.009 = tubería lisa)'],
            ['27.8', 'coeficiente K de Wyly-Eaton (gpm, pulg)'],
          ])}
          <p className="text-[13px]">
            Ejemplo: D = 4", n = 0.011, r = 7/24 → Q<sub>cap</sub> ≈ 7.4 L/s. El chequeo exige Q
            <sub>diseño</sub> / Q<sub>cap</sub> ≤ 100% (la tabla de chequeo lo muestra como %).
          </p>
        </div>
      ),
    },
  ],
};

export default lluvias;
