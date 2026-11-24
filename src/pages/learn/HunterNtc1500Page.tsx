import { Link } from 'react-router';
import ArticlePage from './ArticlePage.tsx';

/** Artículo "El método de Hunter": contenido editorial de /aprende/hunter-ntc-1500.
 *  TEORÍA GENERAL (ped. usuario 2026-11-16): sin normas de país — la curva y sus valores son
 *  los de Roy Hunter, que muchos códigos de fontanería adoptan. Los números que cita son los
 *  mismos que calcula el módulo CivilFlow — el artículo no contradice a la app. */
function HunterNtc1500Page() {
  return (
    <ArticlePage
      data={{
        path: '/aprende/hunter-ntc-1500',
        titulo: 'El método de Hunter: por qué a partir de 240 UC cambia la fórmula',
        bajada:
          'Dimensionar una red de agua fría no es sumar los caudales de todos los aparatos. El método de Hunter convierte unidades de consumo en un caudal probable mediante una curva probabilística — y esa curva tiene dos tramos, con frontera en 240 UC.',
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
                  de UC en caudal de diseño. Es el método de referencia de la fontanería de
                  edificaciones y lo adoptan la mayoría de los códigos modernos para las redes de
                  agua fría y agua caliente.
                </p>
              </>
            ),
          },
          {
            titulo: 'UC: cuánto "pide" cada aparato',
            cuerpo: (
              <>
                <p>
                  Cada aparato sanitario aporta un valor de UC fijo según la tabla clásica de
                  Hunter. Los valores que maneja la app (editables por proyecto en los parámetros de
                  diseño) para la red de agua fría son:
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
            titulo: 'Sin factor de simultaneidad: la curva simplificada',
            cuerpo: (
              <>
                <p>
                  Algunas prácticas añaden al caudal de la curva un{' '}
                  <strong>factor de simultaneidad</strong> adicional que reduce el resultado según
                  el número de descargas del tramo (formas tipo K = 1/√(N−1)). CivilFlow aplica la{' '}
                  <strong>curva simplificada</strong>: el caudal probable sale directamente de la
                  curva de Hunter — la propia curva ya es probabilística y premia la simultaneidad
                  en tramos grandes (su exponente hace que el caudal crezca más despacio que las
                  UC).
                </p>
                <p>
                  La ventaja es trazabilidad: un solo paso entre las UC del tramo y el caudal de
                  diseño, sin parámetros intermedios que dependan de criterios de cada oficina.
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
                  Q<sub>diseño</sub> = 0.1163 · UC<sup>0.6875</sup> &nbsp;&nbsp;(UC &lt; 240)
                  <br />Q<sub>diseño</sub> = 0.074 · UC<sup>0.7504</sup> &nbsp;&nbsp;(UC &ge; 240)
                </div>
                <p>
                  Las dos expresiones son ajustes a la misma curva experimental de Hunter, cada uno
                  válido en su rango. El exponente mayor del segundo tramo (0.7504 frente a 0.6875)
                  lo compensa su coeficiente menor (0.074 frente a 0.1163):{' '}
                  <strong>a partir de 240 UC la curva crece más despacio</strong>, porque en tramos
                  grandes la coincidencia simultánea de todos los aparatos es cada vez más
                  improbable. Es el corazón probabilístico del método.
                </p>
                <p>¿Qué significa en números? Comparando justo al borde del quiebre:</p>
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
                    <strong>Curva (UC &lt; 240):</strong> Q = 0.1163 · 3.7<sup>0.6875</sup> ≈{' '}
                    <strong>0.29 L/s</strong> (unos 17 L/min).
                  </li>
                </ol>
                <p>
                  Ese Q ≈ 0.29 L/s es el caudal que entra al dimensionamiento: con él se escoge el
                  diámetro, se calculan las pérdidas por Hazen-Williams y se verifica que al aparato
                  más desfavorable le llegue su presión mínima (la que fije el criterio aplicable al
                  proyecto — cada aparato tiene un piso de presión con el que funciona bien).
                </p>
                <p>
                  ¿Y cuando la red crece? Sumando 20 baños iguales a un mismo ramal: 20 × 3.7 = 74
                  UC. La curva da 0.1163 · 74<sup>0.6875</sup> ≈ 2.24 L/s — mucho menos que los 20
                  caudales sumados a la vez, porque su forma probabilística ya premia la
                  simultaneidad: cuanto más grande el tramo, más improbable que todo descargue a la
                  vez.
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
                    <strong>Usar el tramo alto de la curva en tramos pequeños.</strong> La expresión
                    con coeficiente 0.074 solo aplica a partir de 240 UC; en un tramo de 40 UC da un
                    caudal menor al real y subdimensiona.
                  </li>
                  <li>
                    <strong>Verificar solo el caudal.</strong> Aunque el Q alcance, el diámetro
                    elegido puede dejar la presión del aparato crítico por debajo del mínimo
                    exigido. La cadena completa es UC → Q → diámetro → pérdidas → presión en el
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
              ramales), aplica el tramo correcto de la curva de Hunter, escoge diámetro, calcula
              pérdidas por Hazen-Williams y verifica la presión de cada aparato — sobre tu plano
              PDF, sin fórmulas a mano.
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
