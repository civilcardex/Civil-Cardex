import { Link } from 'react-router-dom';
import ArticlePage from './ArticlePage.tsx';

/** Artículo "Fuerza tractiva en redes sanitarias": contenido editorial de /aprende/fuerza-tractiva-sanitaria.
 *  Los criterios citados (0.10/0.15 kg/m², V 0.45–4.0 m/s, y/D ≤ 0.75, pendiente mínima 2% para
 *  D ≥ 2") son los mismos que verifica la app para Colombia — sin inventar numerales adicionales. */
function SanTractiveForcePage() {
  return (
    <ArticlePage
      data={{
        path: '/aprende/fuerza-tractiva-sanitaria',
        titulo: 'Fuerza tractiva mínima en redes sanitarias: autolimpieza y RAS 2000',
        bajada:
          'Un tubo sanitario bien dimensionado en caudal puede seguir fallando en la práctica: si el agua no "jala" lo suficiente, los sólidos se sedimentan y la red se tapa. Ese jalón se mide y se llama fuerza tractiva.',
        fecha: '11 de noviembre de 2026',
        autor: 'Equipo CivilCardex',
        secciones: [
          {
            titulo: '¿Qué es la fuerza tractiva?',
            cuerpo: (
              <>
                <p>
                  La <strong>fuerza tractiva</strong> (o tensión tractiva, τ) es el esfuerzo
                  cortante que el flujo ejerce sobre el fondo y las paredes de la tubería: la
                  "fuerza de arrastre" que tiene el agua para empujar sólidos, arenas y papel aguas
                  abajo. Se calcula como:
                </p>
                <div className="formula">
                  &tau; = &rho; · g · R<sub>h</sub> · S
                </div>
                <p>
                  donde &rho; es la densidad del agua, g la gravedad, R<sub>h</sub> el radio
                  hidráulico (área mojada dividida por perímetro mojado; a tubo lleno R<sub>h</sub>{' '}
                  = D/4) y S la pendiente de la tubería en m/m. Su magnitud es pequeña — se habla de
                  pocos pascals — y por eso la práctica colombiana la expresa en kg/m² (1 kg/m² ≈
                  9.81 Pa). La app la calcula con la forma equivalente:
                </p>
                <div className="formula">
                  &tau; ≈ 1000 · R<sub>h</sub> · S &nbsp;&nbsp;[kg/m²]
                </div>
                <p>
                  Fíjate en la proporcionalidad:{' '}
                  <strong>τ crece con el radio hidráulico y con la pendiente</strong>, y con nada
                  más. Eso define todo lo que viene después.
                </p>
              </>
            ),
          },
          {
            titulo: 'Por qué importa: la autolimpieza',
            cuerpo: (
              <>
                <p>
                  Una red sanitaria de gravedad casi nunca va a tubo lleno: el caudal de diseño
                  (calculado con las UD y la curva de Hunter) llena una fracción del tubo y el resto
                  es aire. Si en ese flujo parcial la τ es baja, las partículas pesadas decantan y
                  forman una capa de sedimento. La capa crece, el tirante se desordena, empiezan los{' '}
                  <strong>olores</strong> y, tarde o temprano, la <strong>obstrucción</strong> — la
                  falla número uno de las redes sanitarias en operación.
                </p>
                <p>
                  El criterio de <strong>autolimpieza</strong> es entonces un piso mínimo de
                  arrastre: los valores de referencia usados en Colombia son{' '}
                  <strong>τ ≥ 0.10 kg/m²</strong> (mínimo, NTC 1500) y{' '}
                  <strong>τ ≥ 0.15 kg/m²</strong> (recomendado; el criterio que verifica la app, con
                  referencia al RAS 2000) — equivalentes a aproximadamente 1.0 y 1.5 Pa.
                </p>
                <div className="nota">
                  Los numerales y valores exactos de las normas cambian con las revisiones:{' '}
                  <strong>verifica el numeral vigente</strong> de la NTC 1500 y del RAS 2000 antes
                  de sustentar un diseño. Los aquí citados son los criterios de verificación con los
                  que la app trabaja para Colombia.
                </div>
              </>
            ),
          },
          {
            titulo: 'El papel del diámetro y la pendiente',
            cuerpo: (
              <>
                <p>
                  De τ = 1000 · R<sub>h</sub> · S salen dos palancas de diseño:
                </p>
                <ul>
                  <li>
                    <strong>La pendiente (S)</strong> es la palanca directa: τ es proporcional a
                    ella. Bajar la pendiente a la mitad baja la τ a la mitad. Es la razón de que las
                    normas fijen pendientes mínimas por diámetro (la NTC 1500, por ejemplo, exige ≥
                    2.0% para tuberías sanitarias de 2" o más).
                  </li>
                  <li>
                    <strong>El diámetro (D)</strong> es la palanca traicionera. A tubo lleno, un
                    tubo mayor tiene mayor R<sub>h</sub> = D/4 y mayor τ. Pero el tubo sanitario{' '}
                    <em>no va lleno</em>: con el mismo caudal, un tubo más grande fluye con un
                    tirante más superficial (menor y/D), su radio hidráulico real baja y la τ{' '}
                    <strong>no sube — baja un poco</strong>.
                  </li>
                </ul>
                <p>
                  Ese es el error clásico: "subo el diámetro por si acaso". La capacidad de
                  transporte (Q<sub>o</sub>) sí sube, pero la autolimpieza empeora: el agua corre en
                  una lámina delgada, sin fuerza para arrastrar los sólidos. El tubo grande "por si
                  acaso" es, en redes sanitarias de caudal bajo, una garantía de sedimentos.
                </p>
              </>
            ),
          },
          {
            titulo: 'Ejemplo numérico completo',
            cuerpo: (
              <>
                <p>
                  Veamos los dos efectos con números. El procedimiento es el mismo que usa la tabla
                  sanitaria de la app: caudal a tubo lleno por Manning (PVC, n = 0.009), la razón
                  q/Q<sub>o</sub> da el tirante y la velocidad de flujo parcial, y la τ sale con τ =
                  1000 · R<sub>h</sub> · S.
                </p>
                <p>
                  <strong>Caso 1 — la pendiente.</strong> PVC sanitario de 4" (diámetro interior ≈
                  100 mm) con Q = 2 L/s:
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Pendiente</th>
                      <th scope="col">y/D</th>
                      <th scope="col">V real (m/s)</th>
                      <th scope="col">τ (kg/m²)</th>
                      <th scope="col">Chequeo (≥ 0.15)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>S = 1%</td>
                      <td>0.40</td>
                      <td>0.68</td>
                      <td>0.22</td>
                      <td>O.K.</td>
                    </tr>
                    <tr>
                      <td>S = 0.4%</td>
                      <td>0.51</td>
                      <td>0.49</td>
                      <td>0.10</td>
                      <td>NO CUMPLE</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  Con la pendiente aplanada, el tirante sube (el tubo va más lleno) pero la τ cae a
                  menos de la mitad: S pesa más que R<sub>h</sub>. El mismo tubo que cumplía deja de
                  autolimpiarse solo por acostarlo.
                </p>
                <p>
                  <strong>Caso 2 — el diámetro.</strong> Ahora Q = 1 L/s y S = 0.5%, comparando el
                  mismo PVC de 4" contra uno de 6" (≈ 150 mm):
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Tubería</th>
                      <th scope="col">y/D</th>
                      <th scope="col">V real (m/s)</th>
                      <th scope="col">τ (kg/m²)</th>
                      <th scope="col">Chequeo (≥ 0.15)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>4" (100 mm)</td>
                      <td>0.34</td>
                      <td>0.43</td>
                      <td>0.10</td>
                      <td>NO CUMPLE</td>
                    </tr>
                    <tr>
                      <td>6" (150 mm)</td>
                      <td>0.21</td>
                      <td>0.41</td>
                      <td>0.09</td>
                      <td>NO CUMPLE</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  Subir de 4" a 6" <strong>no arregla nada</strong>: la τ incluso baja (0.10 → 0.09
                  kg/m²) y el tirante queda tan superficial que los sólidos van a sedimentar. La
                  solución correcta cuando la τ no cumple es la otra palanca: subir la pendiente del
                  tramo.
                </p>
              </>
            ),
          },
          {
            titulo: 'Los criterios aplicados en Colombia',
            cuerpo: (
              <>
                <p>
                  Los límites de verificación con los que la app valida cada tramo sanitario para
                  Colombia:
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Criterio</th>
                      <th scope="col">Valor</th>
                      <th scope="col">Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Velocidad mínima (autolimpieza)</td>
                      <td>≥ 0.45 m/s</td>
                      <td>RAS 2000 §D.4.3</td>
                    </tr>
                    <tr>
                      <td>Velocidad máxima</td>
                      <td>≤ 4.00 m/s</td>
                      <td>RAS 2000 §D.4.3</td>
                    </tr>
                    <tr>
                      <td>Llenado máximo y/D</td>
                      <td>≤ 0.75</td>
                      <td>RAS 2000 §D.4.3</td>
                    </tr>
                    <tr>
                      <td>Fuerza tractiva mínima</td>
                      <td>≥ 0.10 kg/m² (mín.) · 0.15 kg/m² (recom.)</td>
                      <td>NTC 1500 · criterio de la app (ref. RAS 2000)</td>
                    </tr>
                    <tr>
                      <td>Pendiente mínima sanitaria (D ≥ 2")</td>
                      <td>≥ 2.0%</td>
                      <td>NTC 1500 §8.3</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  El RAS 2000 (el Reglamento Técnico del Sector de Agua Potable y Saneamiento
                  Básico) fija el marco para alcantarillado — velocidades, llenados y pendientes — y
                  la NTC 1500 cubre las redes internas del edificio. Antes de sustentar un diseño,
                  consulta el numeral vigente de cada norma: los valores citados aquí son los
                  criterios con los que la app verifica, no una copia literal de la norma.
                </p>
              </>
            ),
          },
          {
            titulo: 'Cómo se verifica en la práctica',
            cuerpo: (
              <>
                <p>
                  El chequeo de fuerza tractiva no se hace "a ojo": por cada tramo de la red
                  sanitaria se calculan el caudal y la velocidad a tubo lleno (Manning), la razón
                  q/Q<sub>o</sub>, el tirante y la velocidad reales de flujo parcial, el número de
                  Froude (para saber si el régimen es subcrítico o supercrítico) y la τ real, con
                  una bandera O.K. / NO CUMPLE por criterio. Es exactamente la fila que la tabla
                  sanitaria de CivilFlow construye sobre tu plano.
                </p>
              </>
            ),
          },
        ],
        cierre: (
          <>
            <h2 className="text-[18px] font-bold text-on-surface leading-snug mb-1">
              Calcula esto automáticamente
            </h2>
            <p>
              CivilFlow calcula la fuerza tractiva real de cada tramo sanitario junto con velocidad,
              llenado y/D y Froude, y marca los que no cumplen los criterios de RAS 2000 y NTC 1500
              — así el tubo "por si acaso" no pasa inadvertido hasta la obra.
            </p>
            <p>
              <Link
                to="/civilflow"
                className="inline-block text-primary font-semibold border border-outline-variant rounded-md px-4 py-2 mt-1 hover:bg-surface-container-low transition-colors"
              >
                Conoce Civil Flow →
              </Link>
            </p>
          </>
        ),
      }}
    />
  );
}

export default SanTractiveForcePage;
