import { TH_C } from './downpipesHeaderStyles';
/** Cabecera de 3 filas de la tabla de bajantes (23 columnas agrupadas en
 *  INFORMACIÓN COMÚN / BAJANTES AGUAS NEGRAS / TUBERÍA DE VENTILACIÓN). Markup puro. */
export function DownpipesHeader() {
  return (
    <thead>
      <tr>
        <th
          title="Identificación, unidades de descarga y parámetros comunes."
          scope="col"
          className="col-h san"
          colSpan={9}
          style={TH_C}
        >
          INFORMACIÓN
          <br />
          COMÚN
        </th>
        <th
          title="Chequeo de capacidad del bajante de aguas negras."
          scope="col"
          className="col-h ok"
          colSpan={7}
          style={TH_C}
        >
          BAJANTES
          <br />
          AGUAS NEGRAS
        </th>
        <th
          title="Dimensionamiento de la tubería de ventilación del edificio."
          scope="col"
          className="col-h ven"
          colSpan={7}
          style={TH_C}
        >
          TUBERÍA DE
          <br />
          VENTILACIÓN
        </th>
      </tr>
      <tr>
        <th
          title="Bajante de aguas negras (BAN) según el dibujo."
          scope="col"
          className="col-h san"
          rowSpan={2}
          style={TH_C}
        >
          No.
        </th>
        <th
          title="Piso de origen y de destino de la descarga."
          scope="col"
          className="col-h san"
          colSpan={2}
          style={TH_C}
        >
          Nivel
        </th>
        <th
          title="Ramales sanitarios que drenan a este bajante."
          scope="col"
          className="col-h san"
          rowSpan={2}
          style={TH_C}
        >
          Ramales
          <br />
          Asociados
        </th>
        <th
          title="Unidades de descarga (Hunter): propias del bajante y acumuladas."
          scope="col"
          className="col-h san"
          colSpan={2}
          style={TH_C}
        >
          Unidades
          <br />
          Descarga
        </th>
        <th
          title="Fracción de la sección del tubo ocupada por el agua (flujo anular)."
          scope="col"
          className="col-h san"
          rowSpan={2}
          style={TH_C}
        >
          Llenado
          <br />
        </th>
        <th
          title="Caudal de diseño por unidades de descarga (L/s). Unidad: L/s."
          scope="col"
          className="col-h san"
          rowSpan={2}
          style={TH_C}
        >
          Caudal
        </th>
        <th
          title="Rugosidad del material de la bajante."
          scope="col"
          className="col-h san"
          rowSpan={2}
          style={TH_C}
        >
          Manning
          <br />
        </th>
        <th
          title="Diámetro del bajante: calculado vs propuesto."
          scope="col"
          className="col-h ok"
          colSpan={2}
          style={TH_C}
        >
          Diámetro
        </th>
        <th
          title="Estado del chequeo de diámetros."
          scope="col"
          className="col-h ok"
          rowSpan={2}
          style={TH_C}
        >
          Chequeo
        </th>
        <th
          title="Capacidad máxima del diámetro propuesto (L/s). Unidad: L/s."
          scope="col"
          className="col-h ok"
          rowSpan={2}
          style={TH_C}
        >
          Caudal <br /> máximo
        </th>
        <th
          title="Velocidad terminal del flujo en el tubo (m/s). Unidad: m/s."
          scope="col"
          className="col-h ok"
          rowSpan={2}
          style={TH_C}
        >
          Velocidad <br /> terminal
        </th>
        <th
          title="Longitud terminal: calculada y la mínima recomendada (m)."
          scope="col"
          className="col-h ok"
          colSpan={2}
          style={TH_C}
        >
          Longitud
          <br />
          terminal
        </th>
        <th
          title="Velocidad del aire en el núcleo de la ventilación (m/s). Unidad: m/s."
          scope="col"
          className="col-h ven"
          rowSpan={2}
          style={TH_C}
        >
          Velocidad
          <br />
          aire
        </th>
        <th
          title="Fricción usada para el cálculo de la ventilación."
          scope="col"
          className="col-h ven"
          rowSpan={2}
          style={TH_C}
        >
          Fricción
          <br />
          (ƒ)
        </th>
        <th
          title="Caudal de aire que transporta la ventilación (L/s). Unidad: L/s."
          scope="col"
          className="col-h ven"
          rowSpan={2}
          style={TH_C}
        >
          Caudal <br /> Aire
        </th>
        <th
          title="Longitud desarrollada de la ventilación (m) — editable. Unidad: m."
          scope="col"
          className="col-h ven"
          rowSpan={2}
          style={TH_C}
        >
          Longitud <br /> Bajante
        </th>
        <th
          title="Diámetro de ventilación: calculado, propuesto y su chequeo."
          scope="col"
          className="col-h ven"
          colSpan={3}
          style={TH_C}
        >
          Diámetro
          <br />
          Ventilación
        </th>
      </tr>
      <tr>
        <th title="Piso donde nace el bajante." scope="col" className="col-h san" style={TH_C}>
          Origen
        </th>
        <th title="Bajante o ramal donde descarga." scope="col" className="col-h san" style={TH_C}>
          Destino
        </th>
        <th
          title="Unidades de descarga generadas en el propio bajante."
          scope="col"
          className="col-h san"
          style={TH_C}
        >
          Parcial
        </th>
        <th
          title="Unidades de descarga totales acumuladas."
          scope="col"
          className="col-h san"
          style={TH_C}
        >
          Acumulada
        </th>
        <th
          title="Diámetro que exige el caudal de diseño (pulg). Unidad: ″."
          scope="col"
          className="col-h ok"
          style={TH_C}
        >
          Calculado
        </th>
        <th
          title="Diámetro comercial propuesto (pulg). Unidad: ″."
          scope="col"
          className="col-h ok"
          style={TH_C}
        >
          Propuesto
        </th>
        <th
          title="Longitud terminal calculada con la velocidad (m). Unidad: m."
          scope="col"
          className="col-h ok"
          style={TH_C}
        >
          Calculada
        </th>
        <th
          title="Longitud terminal mínima recomendada (m). Unidad: m."
          scope="col"
          className="col-h ok"
          style={TH_C}
        >
          Mínima
        </th>
        <th
          title="Diámetro de ventilación que exige el caudal de aire (pulg). Unidad: ″."
          scope="col"
          className="col-h ven"
          style={TH_C}
        >
          Calculado
        </th>
        <th
          title="Diámetro comercial de ventilación propuesto (pulg). Unidad: ″."
          scope="col"
          className="col-h ven"
          style={TH_C}
        >
          Propuesto
        </th>
        <th
          title="Estado del chequeo de la ventilación."
          scope="col"
          className="col-h ven"
          style={TH_C}
        >
          Chequeo
        </th>
      </tr>
    </thead>
  );
}
