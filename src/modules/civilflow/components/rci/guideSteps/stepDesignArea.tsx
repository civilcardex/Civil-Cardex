/** Pasos 4 y 5 de la Guía de diseño RCI, el área que calcula: «Ubique el área de diseño» (el
 *  rectángulo hidráulicamente más desfavorable) y «Numera la ruta crítica» (rociadores y
 *  nudos desde lo más remoto hacia la derivación).
 *  Ej: <PasoAreaDiseno ctx={ctx} /> pinta el plano con "Área de diseño en el extremo más remoto". */
import { PlanSvg } from '../RCISvgFloorplan.tsx';
import { fmt } from '../../../utils/rci/RCIRowsModel2.ts';
import { n2 } from '../RCISvgSchemas.tsx';
import { BLOQUE, BLOQUE_COMPACTO, TXT, UL, type PropsPasoGuia } from './shared.ts';

/* 4 · Ubique el área de diseño */
export function PasoAreaDiseno({ ctx }: PropsPasoGuia) {
  const { R } = ctx;
  const ro = R.roc;
  return (
    <>
      <div style={BLOQUE}>
        <PlanSvg
          roc={ro}
          opts={{ area: true, nodes: true, label: 'Área de diseño en el extremo más remoto' }}
        />
      </div>
      <p style={TXT}>
        El área de diseño es el grupo de rociadores que se supone abiertos al mismo tiempo. Es un
        rectángulo de <b>{n2(ro.Adis * 0.092903)} m²</b> con su lado largo de{' '}
        <b>{n2(ro.Llargo)} m</b> (1,2·√A) paralelo a los ramales, ubicado en la zona{' '}
        <b>hidráulicamente más desfavorable</b>: lejos del alimentador y de la VCP.
      </p>
      <ul style={UL}>
        <li>
          Rociadores por ramal dentro del área: {n2(ro.Llargo)} / {n2(ro.S)} → <b>{ro.Nramal}</b>{' '}
          (siempre hacia arriba).
        </li>
        <li>
          Rociadores en total: {fmt(ro.Adis, 0)} / {fmt(ro.Areal, 1)} ft² → <b>{ro.Nreq}</b>,
          repartidos en <b>{ro.Nramales}</b> ramales
          {ro.Nultimo < ro.Nramal
            ? `; el último lleva ${ro.Nultimo}, en el extremo remoto del ramal (igual que los demás)`
            : ''}
          .
        </li>
        <li>Los rociadores fuera del área (grises) no fluyen en el cálculo.</li>
      </ul>
    </>
  );
}

/* 5 · Numera la ruta crítica */
export function PasoRutaCritica({ ctx }: PropsPasoGuia) {
  const { R } = ctx;
  const ro = R.roc;
  return (
    <>
      <div style={BLOQUE_COMPACTO}>
        <PlanSvg
          roc={ro}
          opts={{
            area: true,
            number: true,
            nodes: true,
            brazo: true,
            label: 'Numeración de rociadores y nudos',
          }}
        />
      </div>
      <p style={TXT}>
        Numera los rociadores que fluyen desde el <b>más remoto</b> (1) hacia la derivación, ramal
        por ramal: 1, 2, 3 en el primer ramal; 4, 5, 6 en el siguiente, y así hasta {ro.Nreq}. El
        último número debe ser igual a los rociadores que exige el área.
      </p>
      <ul style={UL}>
        <li>
          El rociador más remoto es el que exige más presión, no siempre el más lejano en planta.
          Para identificarlo compara, ramal por ramal, la longitud hasta la derivación, el diámetro,
          los accesorios y el desnivel: gana el recorrido con más pérdidas. Ponlo de primero en la
          tabla de Ramales (flechas ↑↓): los rociadores que fluyen se reparten desde el primer
          ramal. Si duda entre dos ubicaciones, prueba ambos órdenes y quédate con el que exija más
          presión en la derivación.
        </li>
        <li>
          Los nudos de conexión se nombran con letras desde la A (lo más remoto) hasta la derivación
          del montante, que lleva la última letra. La punta de cada ramal conserva la identificación
          del dibujo (la columna Inicio da su Roc N de cálculo); el revisor compara ramal por ramal
          los rociadores dibujados.
        </li>
        <li>
          El tramo entre el último rociador que fluye y su conexión es uno solo (el <b>brazo</b>
          ): sus tees son de paso y no se cuentan; sí cuentan los codos y la tee donde entrega.
        </li>
      </ul>
    </>
  );
}
