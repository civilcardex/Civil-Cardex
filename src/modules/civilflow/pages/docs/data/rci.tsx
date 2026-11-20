/** Contenido de la sección "Red contra incendios (RCI)" de la página /docs: criterios NFPA 13
 *  (densidad/área), DMR por riesgo, brazo del ramal con la geometría real del dibujo, Pe por
 *  elevación y demanda de bomba. Ej: la sección de DMR explica por qué el chequeo compara
 *  contra S máx./2 del riesgo. */
import { NormaLink } from '../../../components/shared/standardsLinks.tsx';
import { HZ } from '../../../lib/rci/tables.ts';
import { Tabla, donde, fx } from './ui';

/** Filas de la tabla de riesgos con los números del motor (d = densidad gpm/ft², a = área de
 *  diseño ft², s = S máx. m, hose = gabinetes gpm). */
const RIESGOS = Object.entries(HZ).map(([nombre, h]) => ({
  nombre,
  d: h.d,
  a: h.a,
  smax: h.s,
  dmr: h.s / 2,
  hose: h.hose,
}));

const rci = {
  name: 'Contra incendios',
  desc: 'Criterios NFPA 13 por riesgo, DMR de los ramales, brazo con la geometría del dibujo y demanda de bomba.',
  icon: 'fire_extinguisher',
  color: '#EF4444',
  sections: [
    {
      title: 'Criterios de diseño: densidad y área',
      body: (
        <div className="space-y-3">
          <p>
            El diseño de los rociadores sigue el método de <strong>densidad/área</strong> de{' '}
            <NormaLink nombre="NFPA 13" />: según el riesgo del piso, cada rociador debe entregar
            una densidad de agua sobre el área que lo cubre:
          </p>
          {fx(<>q = densidad × S × L &nbsp;&nbsp;→ caudal del rociador (L/min)</>)}
          {donde([
            ['densidad', 'densidad de diseño del riesgo (L/min·m²)'],
            [
              'S × L',
              'área que cubre cada rociador: separación entre ramales × distancia entre rociadores (m²)',
            ],
          ])}
          <p className="text-[13px]">
            La verificación exige que los rociadores que <strong>fluyen</strong> (los que caen
            dentro del área de diseño, contados desde el más remoto) cubran esa área. En el ejemplo
            de verificación: riesgo leve con área de diseño de 1,066.24 ft² y 7 rociadores fluyendo;
            el más remoto entrega 16.34 L/min a 8.51 psi.
          </p>
          <Tabla
            head={[
              'Riesgo',
              'Densidad (L/min·m²)',
              'Área de diseño (ft²)',
              'S máx. (m)',
              'Gabinetes (gpm)',
            ]}
            rows={RIESGOS.map((r) => [
              r.nombre,
              String(r.d).replace('.', ','),
              r.a.toLocaleString('es-CO'),
              String(r.smax).replace('.', ','),
              String(r.hose),
            ])}
            envolver
          />
        </div>
      ),
    },
    {
      title: 'DMR: distancia máxima de los ramales a los muros',
      body: (
        <div className="space-y-3">
          <p>
            Ningún ramal puede quedar más lejos del muro que la{' '}
            <strong>mitad de la separación máxima (S máx.)</strong> que exige el riesgo — si quedara
            más lejos, la esquina del cuarto entre el último rociador y la pared no recibiría agua
            suficiente:
          </p>
          {fx(<>DMR = S máx. ÷ 2</>)}
          <p className="text-[13px]">
            Con el riesgo leve (S máx. 4.60 m) el DMR queda en <strong>2.30 m</strong>; con riesgo
            extra G1 (S máx. 3.70 m) baja a <strong>1.85 m</strong>. El chequeo marca CUMPLE cuando
            el ramal dibujado queda dentro de su DMR — el riesgo lo fija la fila del piso del ramal
            representativo de cada tipología, y si la fila no lo trae, el riesgo global del
            proyecto.
          </p>
          <Tabla
            head={['Riesgo', 'S máx. (m)', 'DMR (m)']}
            rows={RIESGOS.map((r) => [
              r.nombre,
              String(r.smax).replace('.', ','),
              String(r.dmr).replace('.', ','),
            ])}
          />
        </div>
      ),
    },
    {
      title: 'El brazo del ramal: distancias reales del dibujo',
      body: (
        <div className="space-y-3">
          <p>
            El <strong>brazo</strong> es el tramo del ramal desde el último rociador que fluye hasta
            el punto donde el ramal se conecta a la red. Si el ramal trae rociadores dibujados, la
            tabla <strong>mide las distancias reales sobre el dibujo</strong>: cada tramo intermedio
            mide lo que hay entre rociador y rociador, y el brazo mide desde el último rociador
            hasta la conexión — incluyendo la bajada al pie de la derivación cuando el ramal llega
            directo a ella.
          </p>
          {fx(
            <>
              L de cada tramo = distancia dibujada entre rociadores
              <br />
              brazo = distancia dibujada del último rociador a la conexión
            </>,
          )}
          <p className="text-[13px]">
            Ejemplo de verificación: el ramal R1 tiene 5 rociadores en 22.20 m de dibujo, con 4
            separaciones de 4.30 m; el brazo dibujado queda en <strong>5.00 m</strong> y su chequeo
            cierra en 50.75 L/min a 20.29 psi en el nudo de conexión.
          </p>
          <p className="text-[13px]">
            Si el ramal <strong>no tiene geometría dibujada</strong> (proyecto viejo o ramal cargado
            a mano), el cálculo cae al método clásico: separaciones S parejas y brazo = L ramal −
            (fluyentes − 1) × S. El dibujo siempre manda: editar la S de un ramal con geometría no
            cambia el cálculo (el campo queda informativo).
          </p>
        </div>
      ),
    },
    {
      title: 'Pe: presión que gana o pierde por elevación',
      body: (
        <div className="space-y-3">
          <p>
            Cada tramo gana o pierde presión según la diferencia de cota entre su inicio y su final:{' '}
            <strong>bajar gana presión, subir pierde</strong>. El motor la calcula en m.c.a. (metros
            de columna de agua) y la muestra convertida a psi:
          </p>
          {fx(
            <>
              Pe (m.c.a.) = cota inicial − cota final &nbsp;&nbsp;→ Pe (psi) = Pe (m.c.a.) × 1.42
            </>,
          )}
          <p className="text-[13px]">
            Ejemplo del ramal de llegada: la bajada del techo al pie de la derivación es de 2.80 m →
            el tramo <strong>gana</strong> 2.80 m.c.a. ≈ 3.98 psi. Un tramo que sube la misma altura
            la pierde.
          </p>
        </div>
      ),
    },
    {
      title: 'Demanda de la bomba: rociadores + gabinetes',
      body: (
        <div className="space-y-3">
          <p>
            La bomba contra incendio debe cubrir los rociadores que fluyen <strong>más</strong> el
            caudal de los gabinetes de manguera que exige el riesgo (100 gpm en riesgo leve, 250 en
            ordinario, 500 en extra):
          </p>
          {fx(<>Q bomba = Q rociadores + Q gabinetes</>)}
          <p className="text-[13px]">
            Ejemplo de verificación: los ramales entregan 311.17 gpm en el nudo de la derivación y
            los gabinetes del riesgo leve aportan 100 gpm → la bomba se selecciona contra
            <strong>411.17 gpm</strong> con la presión neta que pide el balance de nudos.
          </p>
        </div>
      ),
    },
    {
      title: 'Normativa aplicada',
      body: (
        <div className="space-y-3">
          <p>Los chequeos citan la fuente con enlace a la publicación oficial:</p>
          <Tabla
            head={['Chequeo', 'Norma']}
            rows={[
              ['Densidad/área, brazo y DMR', <NormaLink nombre="NFPA 13" />],
              ['Gabinetes y siamesa', <NormaLink nombre="NFPA 14" />],
              ['Riesgos y separaciones', <NormaLink nombre="NTC 1500" />],
              ['Sistemas contra incendio en vivienda', <NormaLink nombre="Guía ERAS" />],
            ]}
            envolver
          />
        </div>
      ),
    },
  ],
};

export default rci;
