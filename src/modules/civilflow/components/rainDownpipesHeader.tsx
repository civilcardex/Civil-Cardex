// Encabezado de 2 filas y colgroup de ChequeoBajantesLluvias (17 columnas, tooltips
// Wyly-Eaton). JSX 100% estático — fuera del render del componente para que no se
// re-cree con cada cambio de estado de las filas.
import { thC, thCg } from './rainDownpipesStyles.ts';

/**
 * thead + colgroup de la tabla de chequeo de capacidad de bajantes de aguas lluvias:
 * grupos ÁREA / CAUDAL DE DISEÑO / CAPACIDAD DEL TUBO (Wyly-Eaton, fórmula de capacidad
 * de tubo parcialmente lleno) arriba, subcolumnas abajo.
 */
export function RainDownpipesHeader() {
  return (
    <>
      <colgroup>
        <col style={{ width: 70 }} />
        <col style={{ width: 78 }} />
        <col style={{ width: 78 }} />
        <col style={{ width: 46 }} />
        <col style={{ width: 46 }} />
        <col style={{ width: 46 }} />
        <col style={{ width: 72 }} />
        <col style={{ width: 100 }} />
        <col style={{ width: 72 }} />
        <col style={{ width: 54 }} />
        <col style={{ width: 46 }} />
        <col style={{ width: 46 }} />
        <col style={{ width: 46 }} />
        <col style={{ width: 48 }} />
        <col style={{ width: 50 }} />
        <col style={{ width: 40 }} />
        <col style={{ width: 58 }} />
      </colgroup>
      <thead>
        <tr>
          <th
            title="Bajante de aguas lluvias (BALL) según el dibujo."
            scope="col"
            className="col-h ll"
            rowSpan={2}
            style={thC}
          >
            Bajante
          </th>
          <th
            title="Bajantes de pisos superiores que descargan en este bajante."
            scope="col"
            className="col-h ll"
            rowSpan={2}
            style={thC}
          >
            Bajantes asociados
          </th>
          <th
            title="Canal recolector que recibe este bajante (según el dibujo)."
            scope="col"
            className="col-h ll"
            rowSpan={2}
            style={thC}
          >
            Canales
            <br />
            asociados
          </th>
          <th
            title="Ramales de la red de lluvias que drenan a este bajante."
            scope="col"
            className="col-h ll"
            rowSpan={2}
            style={thC}
          >
            Ramales asociados
          </th>
          <th
            title="Área de cubierta que drena (m²)."
            scope="col"
            className="col-h ll"
            colSpan={3}
            style={thCg}
          >
            ÁREA (m²)
          </th>
          <th
            title="Método racional: lluvia que cae sobre el área del grupo."
            scope="col"
            className="col-h ll"
            colSpan={4}
            style={thCg}
          >
            CAUDAL DE DISEÑO
          </th>
          <th
            title="Verificación de capacidad y uso del tubo propuesto."
            scope="col"
            className="col-h ll"
            colSpan={6}
            style={thCg}
          >
            CAPACIDAD DEL TUBO (Wyly-Eaton)
          </th>
          <th
            title="Estado del chequeo de diámetros. Unidad: Dcalc ≤ Dprop."
            scope="col"
            className="col-h ll"
            rowSpan={2}
            style={{ ...thC, width: 84, minWidth: 84, maxWidth: 100 }}
          >
            Chequeo
          </th>
        </tr>
        <tr>
          <th
            title="Área que drena al bajante según el dibujo (m²)."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Parcial
          </th>
          <th
            title="Área adicional no dibujada, editable (m²)."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Otras
          </th>
          <th
            title="Área total = Parcial + Otras (m²)."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Total
          </th>
          <th
            title="Material de la cubierta: define el coeficiente de escorrentía C. Visite el catálogo maestro para más información."
            scope="col"
            className="col-h ll"
            style={{ ...thC, minWidth: 96 }}
          >
            Material
            <br />
            cubierta
          </th>
          <th
            title="Coeficiente de escorrentía del material; sin material elegido el cálculo no se realiza (Q = 0)."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Coeficiente
            <br />
            escorrentía
          </th>
          <th
            title="Intensidad de lluvia de diseño (mm/h). Unidad: mm/h."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Intensidad
          </th>
          <th
            title="Caudal de diseño del bajante (L/s) por método racional. Unidad: L/s."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Caudal
          </th>
          <th
            title="Fracción de la sección del tubo ocupada por el agua (flujo anular)."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Llenado
          </th>
          <th
            title="Rugosidad de referencia del material de la bajante."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Manning
          </th>
          <th
            title="Diámetro que exige el caudal de diseño (pulg). Unidad: pulg."
            scope="col"
            className="col-h ok"
            style={thC}
          >
            Diámetro
            <br />
            calculado
          </th>
          <th
            title="Diámetro comercial propuesto (pulg) — no menor al mayor ramal conectado. Unidad: pulg."
            scope="col"
            className="col-h ok"
            style={thC}
          >
            Diámetro
            <br />
            propuesto
          </th>
          <th
            title="Capacidad del diámetro propuesto (L/s). Unidad: L/s."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Q
            <br />
            capacidad
          </th>
          <th
            title="Qué tan lleno trabaja el tubo: relación entre el caudal de diseño y la capacidad del diámetro propuesto; debe quedar por debajo del 100%."
            scope="col"
            className="col-h ll"
            style={thC}
          >
            Uso
          </th>
        </tr>
      </thead>
    </>
  );
}
