import { NormaLink } from '../../../components/shared/standardsLinks';
import { Tabla, donde, fx } from './ui';

const formulas = {
  name: 'Fórmulas del sistema',
  desc: 'Catálogo completo de las fórmulas que CivilCardex aplica en cada cálculo, con sus variables, límites y norma de origen.',
  icon: 'calculate',
  color: '#F5A623',
  sections: [
    {
      title: 'Reynolds y régimen de flujo (presurizado)',
      body: (
        <div className="space-y-3">
          <p>
            Clasifica el flujo presurizado de agua fría y caliente: Hazen-Williams solo es aplicable
            en régimen turbulento:
          </p>
          {fx(
            <>
              Re = (V · D<sub>h</sub>) / &nu;
            </>,
          )}
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            ['V', 'velocidad media (m/s)'],
            [
              <>
                D<sub>h</sub>
              </>,
              'diámetro hidráulico (m): el D interior en tubería circular; 4·A/P en un canal rectangular',
            ],
            [
              <>&nu;</>,
              'viscosidad cinemática (m²/s) — agua 20 °C ≈ 1.0×10⁻⁶; a 60 °C ≈ 0.47×10⁻⁶',
            ],
          ])}
          <Tabla
            head={['Re', 'Régimen', 'Característica']}
            rows={[
              ['Re < 2.300', 'Laminar', 'Líneas paralelas'],
              ['2.300 – 4.000', 'Transición', 'Inestable'],
              ['Re > 4.000', 'Turbulento', 'Hazen-Williams aplica'],
            ]}
          />
          <p className="text-[13px]">
            Ejemplo: V = 1.8 m/s en un tubo de 20 mm con agua a 20 °C → Re = 1.8·0.02/1e-6 = 36.000
            → turbulento.
          </p>
        </div>
      ),
    },
    {
      title: 'Froude y régimen (flujo en parcialmente lleno)',
      body: (
        <div className="space-y-3">
          <p>
            El que usan las tablas sanitarias y de lluvias para clasificar el flujo de cada tramo
            según su tirante:
          </p>
          {fx(
            <>
              Fr = V / &radic;(g · y<sub>h</sub>)
            </>,
          )}
          {donde([
            ['V', 'velocidad del flujo (m/s)'],
            [
              <>
                y<sub>h</sub>
              </>,
              'tirante hidráulico (m)',
            ],
            ['g', 'gravedad = 9.81 m/s²'],
          ])}
          <Tabla
            head={['Fr', 'Régimen', 'Interpretación']}
            rows={[
              ['Fr < 1', 'Subcrítico', 'Gravedad domina: flujo lento y profundo'],
              ['Fr ≈ 1', 'Crítico', 'Estado límite (no estable para diseño)'],
              ['Fr > 1', 'Supercrítico', 'Flujo rápido y somero — el deseable en sanitarias'],
            ]}
          />
          <p className="text-[13px]">
            El tirante normal (Y<sub>n</sub>) y crítico (Y<sub>c</sub>) de cada tramo se resuelven
            para la sección circular parcialmente llena; la app exige además Y<sub>n</sub>/D ≤ 0.75
            (reserva de aire, <NormaLink nombre="NTC 1500">NTC 1500</NormaLink>).
          </p>
        </div>
      ),
    },
    {
      title: 'Fuerza tractiva (autolimpieza)',
      body: (
        <div className="space-y-3">
          <p>
            Esfuerzo cortante sobre el fondo que arrastra los sólidos — verificación obligatoria de
            las tablas sanitarias:
          </p>
          {fx(
            <>
              &tau; = &rho; · g · R<sub>h</sub> · S ≈ 1000 · R<sub>h</sub> · S &nbsp;&nbsp;[kg/m²]
            </>,
          )}
          {donde([
            [
              <>
                R<sub>h</sub>
              </>,
              'radio hidráulico de la sección parcialmente llena (m)',
            ],
            ['S', 'pendiente (m/m)'],
          ])}
          {fx('Criterio: τ ≥ 0.15 kg/m² → O.K.', true)}
          <p className="text-[13px]">
            Si no cumple: aumenta la pendiente del tramo. Es la razón de las pendientes mínimas por
            diámetro de <NormaLink nombre="NTC 1500">NTC 1500</NormaLink>.
          </p>
        </div>
      ),
    },
    {
      title: 'Curva de Hunter — caudal probable (agua fría y caliente)',
      body: (
        <div className="space-y-3">
          <p>
            Convierte las unidades de consumo (UC) acumuladas de un tramo en el caudal de diseño,
            admitiendo que no todos los aparatos descargan a la vez:
          </p>
          {fx(
            <>
              K = 1 &nbsp;&nbsp;(N = 1 descarga)
              <br />
              K = 1 / &radic;(N − 1) &nbsp;&nbsp;(N &gt; 1)
              <br />
              <br />q<sub>UC</sub> = 0.1163 · UC<sup>0.6875</sup> &nbsp;&nbsp;(UC &lt; 240) [L/s]
              <br />q<sub>UC</sub> = 0.074 · UC<sup>0.7504</sup> &nbsp;&nbsp;(UC ≥ 240) [L/s]
              <br />
              <br />Q<sub>diseño</sub> = K · q<sub>UC</sub>
            </>,
          )}
          {donde([
            ['N', 'número de descargas simultáneas del tramo (columna "No. de descargas")'],
            ['UC', 'unidades de consumo acumuladas (propias + otros ramales)'],
          ])}
          <p className="text-[13px]">
            Ejemplo: tramo con 240 UC y 6 descargas → K = 1/&radic;5 = 0.447; q = 0.1163·240
            <sup>0.6875</sup> ≈ 7.2 L/s → Q ≈ 3.2 L/s. Cambiar el diámetro NO cambia Q: la curva
            solo depende de UC.
          </p>
        </div>
      ),
    },
    {
      title: 'Hazen-Williams — pérdidas de carga (presurizado)',
      body: (
        <div className="space-y-3">
          <p>
            Pérdidas de fricción de agua fría, caliente, acometida y bombeo (agua, flujo turbulento,
            materiales de pared lisa):
          </p>
          {fx(
            <>
              h<sub>f</sub> = 10.67 · L · Q<sup>1.852</sup> / (C<sup>1.852</sup> · D<sup>4.87</sup>)
              &nbsp;&nbsp;[m]
            </>,
          )}
          {donde([
            ['Q', 'caudal (m³/s)'],
            ['D', 'diámetro INTERIOR (m) — por eso importa la serie RDE/schedule del material'],
            [
              'L',
              'longitud del tramo: horizontal + vertical + longitud equivalente de accesorios (m)',
            ],
            ['C', 'coeficiente del material (PVC ≈ 140–150, cobre ≈ 130, acero ≈ 100)'],
          ])}
          <p className="text-[13px]">
            La tabla de diseño muestra el resultado como pérdida en metros y en % de la presión
            disponible. Presión final del tramo: P<sub>fin</sub> = P<sub>ini</sub> − h<sub>f</sub> ±
            ΔZ (cambio de cota).
          </p>
        </div>
      ),
    },
    {
      title: 'Velocidad — límites por red',
      body: (
        <div className="space-y-3">
          {fx(
            <>
              V = Q / A = Q / ((π/4) · D<sub>i</sub>²)
            </>,
          )}
          <Tabla
            head={['Red', 'Límite (m/s)', 'Por qué']}
            rows={[
              [
                'Agua fría / caliente',
                '0.45 – 4.0',
                'Mín evita sedimentación; máx ruido y golpe de ariete',
              ],
              ['Sanitaria / lluvias', '≥ 0.45', 'Autolimpieza — complementa la fuerza tractiva'],
              ['Gas', '≤ 10', 'Límite aplicado por la tabla de gas'],
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Renouard — red de gas',
      body: (
        <div className="space-y-3">
          <p>
            Pérdida de presión por tramo y velocidad del flujo, como las aplica la tabla de diseño
            de gas:
          </p>
          {fx(
            <>
              ΔP = 23200 · L · q<sup>1.82</sup> · DR<sup>0.82</sup> / D<sub>i</sub>
              <sup>4.82</sup>
              <br />V = (354 · q · 101.325) / (D<sub>i</sub>² · P)
            </>,
          )}
          {donde([
            ['q', 'caudal de gas del tramo (m³/h) — por simultaneidad de aparatos'],
            ['L', 'longitud equivalente del tramo (m)'],
            [
              <>
                D<sub>i</sub>
              </>,
              'diámetro interior (mm)',
            ],
            ['DR', 'densidad relativa del gas (natural ≈ 0.6, GLP ≈ 1.5)'],
            ['P', 'presión del punto (kPa absoluta)'],
          ])}
          <p className="text-[13px]">
            El caudal de cada tramo suma los consumos (
            <NormaLink nombre="NTC 3728">NTC 3728</NormaLink>) con el factor de simultaneidad por
            tipos de aparato (mínimo 2.7 m³/h). La presión se consume aguas abajo: P<sub>fin</sub>{' '}
            de un tramo = P<sub>ini</sub> del siguiente. Verificación: V ≤ 10 m/s.
          </p>
        </div>
      ),
    },
    {
      title: 'Potencia y NPSH de bombas',
      body: (
        <div className="space-y-3">
          <p>
            Cadena de potencia del cálculo de bombas (bomba aguas residuales y equipo de presión):
          </p>
          {fx(
            <>
              Q<sub>bombeo</sub> = 1.25 · Q<sub>diseño</sub> &nbsp;&nbsp;(reserva 25%)
              <br />H<sub>m</sub> = H<sub>geom</sub> + h<sub>f,succión</sub> + h
              <sub>f,descarga</sub>
              <br />P<sub>hid</sub> = &rho; · g · Q · H<sub>m</sub> &nbsp;&nbsp;[W]
              <br />P<sub>eje</sub> = P<sub>hid</sub> / &eta;<sub>bomba</sub>
              <br />
              HP = W / 746
            </>,
          )}
          {donde([
            [
              <>
                H<sub>m</sub>
              </>,
              'altura manométrica total (m.c.a.)',
            ],
            [
              <>
                &eta;<sub>bomba</sub>
              </>,
              'rendimiento según la curva del fabricante',
            ],
            [
              <>
                P<sub>com</sub>
              </>,
              'potencia comercial: se selecciona el motor comercial inmediatamente superior',
            ],
          ])}
          {fx(
            <>
              NPSH<sub>disp</sub> = P<sub>atm</sub>/&rho;g + h<sub>cisterna</sub> − h<sub>vap</sub>
              /&rho;g − h<sub>f,suc</sub> &gt; NPSH<sub>req</sub>
            </>,
          )}
          <p className="text-[13px]">
            Si el NPSH disponible no cubre el requerido, la bomba cavita: bájala respecto al nivel
            de agua o reduce las pérdidas de succión. Caudal nominal para catálogo: Q
            <sub>bombeo</sub> × 15.8503 = GPM.
          </p>
        </div>
      ),
    },
    {
      title: 'Manning y sección circular parcialmente llena',
      body: (
        <div className="space-y-3">
          <p>Base del diseño sanitario, de lluvias y de canales (flujo por gravedad):</p>
          {fx(
            <>
              Q = (1/n) · A · R<sub>h</sub>
              <sup>2/3</sup> · &radic;S
              <br />R<sub>h</sub> = A / P<sub>mojado</sub>
              <br />
              <br />D = ((Q · n) / (1.754 · &radic;S))<sup>3/8</sup> × 1000 &nbsp;&nbsp;[mm]
              &nbsp;&nbsp;(círculo lleno, despejado)
            </>,
          )}
          <p className="text-[13px]">
            Para la sección parcialmente llena la app resuelve la geometría no lineal del círculo
            (ángulo α del arco mojado, A y P<sub>mojado</sub> en función del tirante): dado el
            diámetro y la pendiente, obtiene la razón de llenado r = Q/Q<sub>lleno</sub> y de ella
            el tirante h/D, el R<sub>h</sub> y la velocidad V del tramo. El diámetro propuesto
            "cumple" cuando h/D ≤ 0.75 y la velocidad cae en el rango permitido.
          </p>
        </div>
      ),
    },
    {
      title: 'Vertedero y orificio — embocadura del canal',
      body: (
        <div className="space-y-3">
          <p>
            Altura de agua necesaria en el canal para que el caudal entre al bajante (chequeo de
            canales de cubierta):
          </p>
          {fx(
            <>
              H<sub>vert</sub> = ( Q / (C<sub>w</sub> · π · D) )<sup>2/3</sup> &nbsp;&nbsp;C
              <sub>w</sub> = 1.7
              <br />H<sub>orif</sub> = ( Q / (C<sub>d</sub> · π · D²/4) )² / (2g) &nbsp;&nbsp;C
              <sub>d</sub> = 0.6
              <br />H<sub>req</sub> = máx(H<sub>vert</sub>, H<sub>orif</sub>) ≤ h<sub>útil</sub>
            </>,
          )}
          {donde([
            ['D', 'diámetro de la embocadura/bajante (m)'],
            [
              <>
                h<sub>útil</sub>
              </>,
              'altura útil del canal antes del rebalse',
            ],
          ])}
          <p className="text-[13px]">
            El vertedero describe la entrada perimetral con lámina libre; el orificio, la embocadura
            ahogada de arista viva. Gobierna el peor de los dos.
          </p>
        </div>
      ),
    },
    {
      title: 'Método racional y Wyly-Eaton (lluvias)',
      body: (
        <div className="space-y-3">
          {fx(
            <>
              Q = C · I · A / 3600 &nbsp;&nbsp;[L/s]
              <br />Q<sub>cap</sub> = 27.8 · (0.009/n) · r<sup>5/3</sup> · D<sup>8/3</sup> · 0.0631
              &nbsp;&nbsp;[L/s]
            </>,
          )}
          {donde([
            ['C', 'coeficiente de escorrentía (por material de cubierta, catálogo maestro)'],
            ['I', 'intensidad de lluvia de diseño (mm/h)'],
            [
              'A',
              'área aportante acumulada (m²) — incluye 50% de los muros verticales que descargan a la cubierta',
            ],
            ['r', 'razón de llenado del bajante (1/4 o 7/24)'],
            ['D, n', 'diámetro (pulg) y Manning del material'],
          ])}
          <p className="text-[13px]">
            Detalle de Wyly-Eaton en la categoría <strong>Aguas lluvias</strong>. Verificación: Q/Q
            <sub>cap</sub> ≤ 100%.
          </p>
        </div>
      ),
    },
    {
      title: 'Conversión de unidades usadas por el sistema',
      body: (
        <Tabla
          head={['Conversión', 'Factor']}
          rows={[
            ['L/s → gpm', '× 0.0630902'],
            ['m³/s → gpm (bombas)', '× 15850.3'],
            ['Watt → HP', '÷ 746'],
            ['pulg → mm', '× 25.4'],
            ['mm/h → m/s (lluvia)', '÷ 3.6×10⁶'],
          ]}
        />
      ),
    },
  ],
};

export default formulas;
