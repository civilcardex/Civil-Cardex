import { Tabla, donde, fx } from './ui';

const gas = {
  name: 'Red de gas',
  desc: 'Método de Renouard (NTC 3728), factor de simultaneidad y materiales.',
  icon: 'gas_meter',
  color: '#A855F7',
  sections: [
    {
      title: 'Método de Renouard',
      body: (
        <div className="space-y-3">
          <p>
            Pérdida de presión por tramo (NTC 3728, baja presión) — la misma que aplica la tabla de
            diseño de gas:
          </p>
          {fx(
            <>
              &Delta;P = 23200 · L · q<sup>1.82</sup> · DR<sup>0.82</sup> / D<sub>i</sub>
              <sup>4.82</sup>
              <br />V = (354 · q · 101.325) / (D<sub>i</sub>² · P)
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            [<>&Delta;P</>, 'pérdida de presión del tramo (mbar)'],
            ['L', 'longitud equivalente del tramo (m)'],
            ['q', 'caudal de diseño del tramo (m³/h)'],
            ['DR', 'densidad relativa del gas (natural ≈ 0.6, GLP ≈ 1.5)'],
            [
              <>
                D<sub>i</sub>
              </>,
              'diámetro interno (mm)',
            ],
            ['V', 'velocidad del flujo (m/s), con P en kPa absoluta'],
          ])}
          <div className="text-[13px] mt-2">
            <span className="font-semibold">Presión tramo a tramo:</span> la presión disponible se
            consume aguas abajo — P<sub>fin</sub> de un tramo es la P<sub>ini</sub> del siguiente.
            La tabla verifica O.K. cuando V ≤ 10 m/s y ΔP &gt; 0.
          </div>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Velocidad máx: 10 m/s · La presión residual en el aparato más lejano debe permitir su
            operación.
          </div>
        </div>
      ),
    },
    {
      title: 'Caudal de diseño por aparato',
      body: (
        <div className="space-y-3">
          <p>
            Cada aparato aporta su consumo nominal (m³/h, catálogo de gasodomésticos de la pestaña
            Parámetros de diseño) y el caudal del tramo combina los tipos presentes con el criterio
            de los 2 aparatos mayores:
          </p>
          {fx(
            <>
              q = (q<sub>1</sub>·n<sub>1</sub> + q<sub>2</sub>·n<sub>2</sub>) / 2 + Σ q<sub>i</sub>
              ·n
              <sub>i</sub> (resto)
              <br />
              <br />q<sub>diseño</sub> = máx( q · f<sub>alt</sub> · f<sub>temp</sub> · f
              <sub>dens</sub>, 2.7 )
            </>,
          )}
          {donde([
            [
              <>
                q<sub>1</sub>, q<sub>2</sub>
              </>,
              'consumos de los 2 tipos de mayor demanda presentes, con sus cantidades n',
            ],
            [
              <>
                f<sub>alt</sub> = 101.325/P<sub>atm</sub>
              </>,
              'corrección por altitud de la ciudad del proyecto',
            ],
            [
              <>
                f<sub>temp</sub> = √(288/T)
              </>,
              'corrección por temperatura del gas',
            ],
            [
              <>
                f<sub>dens</sub> = √(0.67/DR)
              </>,
              'corrección por densidad relativa',
            ],
            ['2.7 m³/h', 'caudal mínimo de diseño impuesto por la tabla'],
          ])}
        </div>
      ),
    },
    {
      title: 'Factor de simultaneidad',
      body: (
        <Tabla
          head={['N° aparatos', 'Factor fs']}
          rows={[
            ['1–2', '1.00'],
            ['3–5', '0.80'],
            ['6–10', '0.70'],
            ['11–20', '0.60'],
            ['> 20', '0.50'],
          ]}
        />
      ),
    },
    {
      title: 'Materiales para gas',
      body: (
        <Tabla
          head={['Material', 'Diámetro típico', 'K']}
          rows={[
            ['PE al PE ¾"', '20 mm', '49'],
            ['PE al PE 1"', '25 mm', '49'],
            ['Acero Galv ½"', '12.7 mm', '57.5'],
            ['Acero Galv ¾"', '19 mm', '57.5'],
            ['Cobre Rigido ½"', '10.9 mm', '54.2'],
            ['Cobre Rigido ¾"', '17.4 mm', '54.2'],
          ]}
        />
      ),
    },
    {
      title: 'Rangos por país',
      body: (
        <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
          El chequeo (V m&aacute;x y &Delta;P acumulada) usa los rangos del pa&iacute;s seleccionado
          en IDENTIFICACI&Oacute;N DEL PROYECTO. Tabla completa de pa&iacute;ses en la
          secci&oacute;n <b>Normativa por pa&iacute;s</b> de esta documentaci&oacute;n.
        </p>
      ),
    },
  ],
};

export default gas;
