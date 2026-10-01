import { Tabla } from './ui';

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
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            &Delta;P = 23200 · L · q<sup>1.82</sup> · DR<sup>0.82</sup> / D<sub>i</sub>
            <sup>4.82</sup>
            <br />V = (354 · q · 101.325) / (D<sub>i</sub>² · P)
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">&Delta;P</span>
            <span>pérdida de presión del tramo (Pa)</span>
            <span className="font-semibold text-primary">L</span>
            <span>longitud equivalente del tramo (m)</span>
            <span className="font-semibold text-primary">q</span>
            <span>caudal de diseño del tramo (m³/h)</span>
            <span className="font-semibold text-primary">DR</span>
            <span>densidad relativa del gas (natural ≈ 0.6, GLP ≈ 1.5)</span>
            <span className="font-semibold text-primary">
              D<sub>i</sub>
            </span>
            <span>diámetro interno (mm)</span>
            <span className="font-semibold text-primary">V</span>
            <span>velocidad del flujo (m/s), con P en kPa absoluta</span>
          </div>
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
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            q = (q<sub>1</sub>·n<sub>1</sub> + q<sub>2</sub>·n<sub>2</sub>) / 2 + Σ q<sub>i</sub>·n
            <sub>i</sub> (resto)
            <br />
            <br />q<sub>diseño</sub> = máx( q · f<sub>alt</sub> · f<sub>temp</sub> · f
            <sub>dens</sub>, 2.7 )
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">
              q<sub>1</sub>, q<sub>2</sub>
            </span>
            <span>consumos de los 2 tipos de mayor demanda presentes, con sus cantidades n</span>
            <span className="font-semibold text-primary">
              f<sub>alt</sub> = 101.325/P<sub>atm</sub>
            </span>
            <span>corrección por altitud de la ciudad del proyecto</span>
            <span className="font-semibold text-primary">
              f<sub>temp</sub> = √(288/T)
            </span>
            <span>corrección por temperatura del gas</span>
            <span className="font-semibold text-primary">
              f<sub>dens</sub> = √(0.67/DR)
            </span>
            <span>corrección por densidad relativa</span>
            <span className="font-semibold text-primary">2.7 m³/h</span>
            <span>caudal mínimo de diseño impuesto por la tabla</span>
          </div>
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
  ],
};

export default gas;
