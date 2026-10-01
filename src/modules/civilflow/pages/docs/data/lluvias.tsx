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
          {donde({
            Q: 'caudal de diseño (m³/s)',
            C: 'coeficiente de escorrentía',
            I: 'intensidad de lluvia (mm/h)',
            A: 'área de drenaje (m²)',
          })}
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
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            D = ((Q · n) / (1.754 · S<sup>5/3</sup>))<sup>3/8</sup> &times; 1000 &nbsp;&nbsp;[mm]
          </div>
          <p className="text-[13px]">Canal rectangular — caudal máximo:</p>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            Q<sub>max</sub> = (1/n) · A · R<sub>h</sub>
            <sup>2/3</sup> · √S
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">D</span>
            <span>diámetro de bajante (mm)</span>
            <span className="font-semibold text-primary">Q</span>
            <span>caudal de diseño (m³/s)</span>
            <span className="font-semibold text-primary">
              Q<sub>max</sub>
            </span>
            <span>caudal máximo del canal (m³/s)</span>
            <span className="font-semibold text-primary">n</span>
            <span>coeficiente de Manning</span>
            <span className="font-semibold text-primary">S</span>
            <span>pendiente (m/m)</span>
            <span className="font-semibold text-primary">A</span>
            <span>área hidráulica del canal (m²)</span>
            <span className="font-semibold text-primary">
              R<sub>h</sub>
            </span>
            <span>radio hidráulico (m)</span>
          </div>
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
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            Q<sub>cap</sub> = 27.8 · (0.009 / n) · r<sup>5/3</sup> · D<sup>8/3</sup>{' '}
            &nbsp;&nbsp;[gpm]
            <br />Q<sub>cap</sub> = Q<sub>cap,gpm</sub> × 0.0631 &nbsp;&nbsp;[L/s]
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde({
            D: 'diámetro del bajante (pulg)',
            r: 'razón de llenado del tubo (1/4 o 7/24)',
            n: 'Manning del material (ref. 0.009 = tubería lisa)',
            '27.8': 'coeficiente K de Wyly-Eaton (gpm, pulg)',
          })}
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
