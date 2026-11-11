import { Link } from 'react-router-dom';
import ArticlePage from './ArticlePage.tsx';

/** Artículo "Método Hunter en la NTC 1500": contenido editorial de /aprende/hunter-ntc-1500.
 *  Los valores numéricos (UC por aparato, coeficientes de la curva, límites de presión) son los
 *  mismos que calcula el módulo CivilFlow — el artículo no contradice a la app. */
function HunterNtc1500Page() {
  return (
    <ArticlePage
      data={{
        path: '/aprende/hunter-ntc-1500',
        titulo: 'Método Hunter en la NTC 1500: por qué a partir de 240 UC cambia la fórmula',
        bajada:
          'Dimensionar una red de agua fría no es sumar los caudales de todos los aparatos. La NTC 1500 toma prestada la curva de Hunter, que convierte unidades de consumo en un caudal probable — y esa curva tiene dos tramos, con frontera en 240 UC.',
        fecha: '11 de noviembre de 2026',
        autor: 'Equipo CivilCardex',
        secciones: [
          {
            titulo: 'El problema: nadie abre todas las llaves a la vez',
            cuerpo: (
              <>
                <p>
                  Si dimensionaras la tubería de agua de un edificio sumando el caudal nominal de
                  cada aparato, obtendrías un tubo gigante que casi nunca trabajaría: el lavamanos
                  del baño 7 no abre al mismo tiempo que la ducha del baño 12. La{' '}
                  <strong>red es presurizada y a demanda</strong>, así que lo que hay que estimar no
                  es la suma total, sino el <strong>caudal probable</strong>: cuánta agua fluye de
                  verdad si los aparatos se usan con la simultaneidad típica de una vivienda o un
                  edificio.
                </p>
                <p>
                  Esa estimación la resolvió Roy Hunter en los años cuarenta con un modelo de
                  <strong> probabilidad de uso simultáneo</strong>: en lugar de caudales por
                  aparato, asigna a cada uno una cantidad adimensional — las{' '}
                  <strong>UC (Unidades de Consumo)</strong> — y usa una curva que convierte la suma
                  de UC en caudal de diseño. La NTC 1500 (la norma colombiana de fontanería) adopta
                  este método para las redes de agua fría y agua caliente.
                </p>
              </>
            ),
          },
          {
            titulo: 'UC: cuánto "pide" cada aparato',
            cuerpo: (
              <>
                <p>
                  Cada aparato sanitario aporta un valor de UC fijo según la tabla de la NTC 1500.
                  Los valores que maneja la app (editables por proyecto en los parámetros de diseño)
                  para la red de agua fría son:
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Aparato</th>
                      <th scope="col">UC (agua fría)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Inodoro con tanque</td>
                      <td>2.2</td>
                    </tr>
                    <tr>
                      <td>Lavamanos</td>
                      <td>0.5</td>
                    </tr>
                    <tr>
                      <td>Ducha</td>
                      <td>1.0</td>
                    </tr>
                    <tr>
                      <td>Lavaplatos</td>
                      <td>1.0</td>
                    </tr>
                    <tr>
                      <td>Tina</td>
                      <td>1.0</td>
                    </tr>
                    <tr>
                      <td>Lavadora</td>
                      <td>1.0</td>
                    </tr>
                    <tr>
                      <td>Lavadero</td>
                      <td>0.75</td>
                    </tr>
                  </tbody>
                </table>
                <div className="nota">
                  No confundas UC con UD (Unidades de Desagüe): las UC dimensionan el{' '}
                  <strong>suministro</strong> (agua fría y caliente) y las UD dimensionan el{' '}
                  <strong>desagüe</strong> (redes sanitarias). Son tablas distintas — el inodoro
                  vale 2.2 UC de suministro y 4 UD de desagüe — aunque ambas alimenten curvas de
                  Hunter.
                </div>
                <p>
                  El tramo más aguas arriba de la red acumula las UC de todos los aparatos que
                  sirve: UC propia + UC de otros ramales. Ese total es el que entra a la curva.
                </p>
              </>
            ),
          },
          {
            titulo: 'K: el factor de simultaneidad',
            cuerpo: (
              <>
                <p>
                  Antes de entrar a la curva, el total de UC se modula por un factor{' '}
                  <strong>K</strong> que penaliza — o mejor, favorece — la probabilidad de que
                  varios aparatos descarguen a la vez:
                </p>
                <div className="formula">
                  K = 1 &nbsp;(N = 1 descarga)
                  <br />K = 1 / &radic;(N − 1) &nbsp;(N &gt; 1)
                </div>
                <p>donde N es el número de descargas (aparatos) del tramo. Algunos valores:</p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Descargas (N)</th>
                      <th scope="col">K</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>1.00</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>0.71</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>0.45</td>
                    </tr>
                    <tr>
                      <td>60</td>
                      <td>0.13</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  Con un solo aparato el caudal probable es el caudal real (K = 1); con 60, la
                  probabilidad de coincidencia se dispara y K cae a 0.13. La simultaneidad es la
                  razón por la que un edificio de 20 apartamentos no necesita 20 veces el tubo de
                  uno.
                </p>
              </>
            ),
          },
          {
            titulo: 'La curva de Hunter y el quiebre de 240 UC',
            cuerpo: (
              <>
                <p>
                  El caudal probable de la curva se calcula con dos expresiones distintas según el
                  tamaño del tramo (resultados en L/s):
                </p>
                <div className="formula">
                  q<sub>UC</sub> = 0.1163 · UC<sup>0.6875</sup> &nbsp;&nbsp;(UC &lt; 240)
                  <br />q<sub>UC</sub> = 0.074 · UC<sup>0.7504</sup> &nbsp;&nbsp;(UC &ge; 240)
                  <br />
                  <br />Q<sub>diseño</sub> = K · q<sub>UC</sub>
                </div>
                <p>
                  Las dos expresiones son ajustes a la misma curva experimental de Hunter, cada uno
                  válido en su rango. El exponente mayor del segundo tramo (0.7504 frente a 0.6875)
                  lo compensa su coeficiente menor (0.074 frente a 0.1163):{' '}
                  <strong>a partir de 240 UC la curva crece más despacio</strong>, porque en tramos
                  grandes la coincidencia simultánea de todos los aparatos es cada vez más
                  improbable. Es el corazón probabilístico del método.
                </p>
                <p>¿Qué significa en números? Comparando justo al borde del quiebre, con K = 1:</p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Tramo</th>
                      <th scope="col">Fórmula aplicada</th>
                      <th scope="col">Q (L/s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>239 UC</td>
                      <td>
                        0.1163 · 239<sup>0.6875</sup>
                      </td>
                      <td>≈ 5.02</td>
                    </tr>
                    <tr>
                      <td>241 UC</td>
                      <td>
                        0.074 · 241<sup>0.7504</sup>
                      </td>
                      <td>≈ 4.54</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  El caudal calculado "baja" al cruzar la frontera. No es un error de redondeo: son
                  dos ajustes distintos de la misma tendencia, y el segundo describe mejor el
                  comportamiento de redes grandes. Lo importante para el diseñador es aplicar el
                  tramo que corresponda al total de UC del tramo — la tabla de diseño de la app hace
                  ese cambio de fórmula de forma automática.
                </p>
              </>
            ),
          },
          {
            titulo: 'Ejemplo numérico completo: el baño de una vivienda',
            cuerpo: (
              <>
                <p>Un baño típico con lavamanos, inodoro con tanque y ducha. Paso a paso:</p>
                <ol>
                  <li>
                    <strong>UC del tramo:</strong> lavamanos 0.5 + inodoro tanque 2.2 + ducha 1.0 ={' '}
                    <strong>3.7 UC</strong>.
                  </li>
                  <li>
                    <strong>Factor K:</strong> N = 3 descargas → K = 1/&radic;(3−1) ={' '}
                    <strong>0.71</strong>.
                  </li>
                  <li>
                    <strong>Curva (UC &lt; 240):</strong> q<sub>UC</sub> = 0.1163 · 3.7
                    <sup>0.6875</sup> ≈ 0.29 L/s.
                  </li>
                  <li>
                    <strong>Caudal de diseño:</strong> Q = 0.71 × 0.29 ≈ <strong>0.20 L/s</strong>{' '}
                    (unos 12 L/min).
                  </li>
                </ol>
                <p>
                  Ese Q ≈ 0.20 L/s es el caudal que entra al dimensionamiento: con él se escoge el
                  diámetro, se calculan las pérdidas por Hazen-Williams y se verifica que al aparato
                  más desfavorable le llegue su presión mínima de la NTC 1500 (ducha ≥ 1.02 m.c.a.,
                  inodoro con tanque ≥ 0.71 m.c.a., lavamanos ≥ 0.51 m.c.a., según la Tabla 3 de la
                  norma).
                </p>
                <p>
                  ¿Y cuando la red crece? Sumando 20 baños iguales a un mismo ramal: 20 × 3.7 = 74
                  UC, con N = 60 descargas → K = 0.13. Sin simultaneidad, el caudal sería 0.1163 ·
                  74<sup>0.6875</sup> ≈ 2.24 L/s; con el factor K, Q ≈ 0.13 × 2.24 ≈{' '}
                  <strong>0.29 L/s</strong>. Casi ocho veces menos: la probabilidad de que veinte
                  baños descarguen al mismo tiempo es minúscula, y el tubo lo agradece.
                </p>
              </>
            ),
          },
          {
            titulo: 'Errores comunes (y cómo evitarlos)',
            cuerpo: (
              <>
                <ul>
                  <li>
                    <strong>Sumar caudales nominales en vez de usar la curva.</strong> Es el error
                    clásico que produce tuberías sobredimensionadas: agua estancada más tiempo en la
                    red y sobrecosto sin beneficio.
                  </li>
                  <li>
                    <strong>Confundir UC con UD.</strong> La tabla de suministro y la de desagüe no
                    son intercambiables: el inodoro vale 2.2 UC pero 4 UD. Usar la tabla equivocada
                    cambia el resultado de forma sistemática.
                  </li>
                  <li>
                    <strong>Olvidar K… o aplicarlo dos veces.</strong> El factor entra una única
                    vez, multiplicando la curva: Q = K · q<sub>UC</sub>.
                  </li>
                  <li>
                    <strong>Usar el tramo alto de la curva en tramos pequeños.</strong> La expresión
                    con coeficiente 0.074 solo aplica a partir de 240 UC; en un tramo de 40 UC da un
                    caudal menor al real y subdimensiona.
                  </li>
                  <li>
                    <strong>Verificar solo el caudal.</strong> Aunque el Q alcance, el diámetro
                    elegido puede dejar la presión del aparato crítico por debajo del mínimo de la
                    NTC 1500. La cadena completa es UC → Q → diámetro → pérdidas → presión en el
                    aparato.
                  </li>
                </ul>
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
              CivilFlow arma la tabla de diseño tramo por tramo: acumula las UC (propias + otros
              ramales), aplica K y el tramo correcto de la curva de Hunter, escoge diámetro, calcula
              pérdidas por Hazen-Williams y verifica la presión de cada aparato contra la NTC 1500 —
              sobre tu plano PDF, sin fórmulas a mano.
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

export default HunterNtc1500Page;
