import { Tabla, donde, fx } from './ui';

const equipos = {
  name: 'Bombas, tanques y equipos',
  desc: 'Potencia de bombas, NPSH, tanque de reserva e hidroneumáticos.',
  icon: 'settings',
  color: '#0ECC7A',
  sections: [
    {
      title: 'Potencia de bomba',
      body: (
        <div className="space-y-3">
          <p>
            Cadena de potencia que calculan las tablas de bomba aguas residuales y equipo de
            presión:
          </p>
          {fx(
            <>
              Q<sub>bombeo</sub> = 1.25 · Q<sub>diseño</sub> &nbsp;&nbsp;(reserva 25%)
              <br />P<sub>hid</sub> = &rho; · g · Q · H<sub>m</sub> &nbsp;&nbsp;[W]
              <br />P<sub>eje</sub> = P<sub>hid</sub> / &eta;<sub>bomba</sub>
              <br />
              HP = P<sub>eje</sub> / 746 &nbsp;&nbsp;&nbsp;(forma compacta: HP = Q·H<sub>m</sub> /
              (76·&eta;) con Q en L/min)
            </>,
          )}
          {donde([
            [
              <>
                P<sub>hid</sub>
              </>,
              'potencia hidráulica: la que el fluido recibe',
            ],
            [
              <>
                P<sub>eje</sub>
              </>,
              'potencia en el eje: lo que exige el motor con el rendimiento de la curva',
            ],
            [
              <>
                P<sub>com</sub>
              </>,
              'potencia comercial: el motor comercial inmediatamente superior se selecciona ≥ este valor',
            ],
            ['1 HP', '= 0.746 kW = 746 W'],
          ])}
          <p className="text-[13px] mt-2 font-semibold">Altura manométrica total:</p>
          {fx(
            <>
              H<sub>m</sub> = H<sub>s</sub> + H<sub>i</sub> + h<sub>f,s</sub> + h<sub>f,i</sub>
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            [
              <>
                H<sub>s</sub>
              </>,
              'altura de succión (m)',
            ],
            [
              <>
                H<sub>i</sub>
              </>,
              'altura de impulsión (m)',
            ],
            [
              <>
                h<sub>f,s</sub> / h<sub>f,i</sub>
              </>,
              'pérdidas por fricción en succión/impulsión (Hazen-Williams sobre la longitud equivalente)',
            ],
          ])}
          <p className="text-[13px]">
            Para el catálogo el caudal se convierte a GPM: Q<sub>bombeo</sub> × 15.8503. La
            selección final (bomba sumergible trituradora, impeler monocanal) se verifica contra la
            curva del fabricante.
          </p>
        </div>
      ),
    },
    {
      title: 'NPSH',
      body: (
        <div className="space-y-3">
          <p>
            Carga neta positiva de succión: si no se cumple, la bomba cavita (ruido, pérdida de
            capacidad, erosión del impeler):
          </p>
          {fx(
            <>
              NPSH<sub>disp</sub> = (P<sub>atm</sub> − P<sub>v</sub>) / (&rho; · g) ± h<sub>z</sub>{' '}
              − h<sub>f,s</sub>
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            [
              <>
                NPSH<sub>disp</sub>
              </>,
              'carga neta de succión disponible (m)',
            ],
            [
              <>
                P<sub>atm</sub>
              </>,
              'presión atmosférica — CAE con la altitud (Bogotá ≈ 75% del nivel del mar)',
            ],
            [
              <>
                P<sub>v</sub>
              </>,
              'presión de vapor del agua a su temperatura (Pa)',
            ],
            [
              <>
                h<sub>z</sub>
              </>,
              'carga de la lámina de agua sobre la boca de succión (+ si la bomba está debajo, − si está encima)',
            ],
            [
              <>
                h<sub>f,s</sub>
              </>,
              'pérdida por fricción en succión (m)',
            ],
          ])}
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Verificación: NPSH<sub>req</sub> &lt; NPSH<sub>disp</sub> (curva del fabricante). Si no
            cumple: sumerge más la succión, sube el nivel de la cisterna o reduce codos/longitud de
            succión.
          </div>
        </div>
      ),
    },
    {
      title: 'Tanque de reserva',
      body: (
        <div className="space-y-3">
          {fx(
            <>
              V = Población · Dotación · F<sub>reserva</sub>
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['V', 'volumen del tanque (L)'],
            ['Población', 'número de habitantes'],
            ['Dotación', 'consumo diario por persona (L/hab/dia)'],
            [
              <>
                F<sub>reserva</sub>
              </>,
              'factor de reserva (usualmente 1.5–2.0)',
            ],
          ])}
          <Tabla
            head={['Tipo de uso', 'Dotación (L/hab/dia)']}
            rows={[
              ['Residencial', '150–200'],
              ['Hotel', '250–400'],
              ['Comercial', '80–120'],
              ['Industrial', '100–200'],
            ]}
          />
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
            <div className="bg-surface-container-low p-2 rounded">
              Q<sub>b</sub> = 3 &times; Q<sub>m</sub>
            </div>
            <div className="bg-surface-container-low p-2 rounded">P max: 50 psi (350 kPa)</div>
            <div className="bg-surface-container-low p-2 rounded">P min: 30 psi (207 kPa)</div>
            <div className="bg-surface-container-low p-2 rounded">Arranques max: 6/hora</div>
            <div className="bg-surface-container-low p-2 rounded">Eficiencia: 60%</div>
          </div>
          {fx(
            <>
              Q<sub>m</sub> = (q · N) / 1440 &nbsp;&nbsp;[L/min]
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            [
              <>
                Q<sub>m</sub>
              </>,
              'caudal medio (L/min)',
            ],
            ['q', 'consumo unitario por persona (L/persona/dia)'],
            ['N', 'número de personas'],
          ])}
        </div>
      ),
    },
  ],
};

export default equipos;
