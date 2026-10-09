import { rangoAfTxt } from '../../constants/normasPais';
// Encabezado estático de la tabla de diseño (2 filas × 24 columnas, con celdas combinadas).
// No tiene lógica: solo depende de la clase de color de la red activa (af/ac).
/** Encabezado estático de la tabla de diseño de red: dos filas y 24 columnas con celdas
 *  combinadas. No tiene lógica; solo la clase de color de la red activa. */
export function DesignTableHeader({ cssClass, pais }: { cssClass: string; pais?: string }) {
  return (
    <thead>
      <tr>
        <th
          title="Tramo de la red de agua (alimentador) según el dibujo."
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          Tramo
        </th>
        <th
          title="Punto de inicio del tramo."
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          Inicio
        </th>
        <th
          title="Punto donde termina el tramo."
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          Final
        </th>
        <th
          title="Unidades de consumo (fixture units) que abastece el tramo."
          scope="col"
          className={`col-h ${cssClass}`}
          colSpan={3}
          style={{
            textAlign: 'center',
            padding: '2px 1px',
            fontSize: 10.5,
            borderBottom: '2px solid var(--line)',
          }}
        >
          Unidades Consumo
        </th>
        <th
          title="Número de descargas conectadas al tramo."
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          No. de descargas
        </th>
        <th
          title="Coeficiente de simultaneidad K aplicado al cálculo."
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          K
        </th>
        <th
          title="Caudal de diseño del tramo (L/s)."
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          Caudal
          <br />
          (lps)
        </th>
        <th
          title='Diámetro que sugiere el cálculo para el caudal. Unidad: pulgadas (").'
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          Diámetro
          <br /> estimado
        </th>
        <th
          title='Diámetro propuesto y su interior. Unidad: pulgadas ("); interior en mm.'
          scope="col"
          className="col-h ok"
          colSpan={2}
          style={{
            textAlign: 'center',
            padding: '2px 1px',
            fontSize: 10.5,
            borderBottom: '2px solid var(--line)',
          }}
        >
          Diámetro
        </th>
        <th
          title="Coeficiente de Hazen-Williams del material."
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          Coeficiente
          <br />C
        </th>
        <th
          title={`Velocidad del agua en el tramo (mm/s). Cumple entre ${pais ? rangoAfTxt(pais) : '0,50–2,50 m/s (NTC 1500 / RAS 2000)'}.`}
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10.5 }}
        >
          Vel. <br />
          (mm/s)
        </th>
        <th
          title="Longitudes del tramo y equivalencias de accesorios (m)."
          scope="col"
          className="col-h"
          colSpan={4}
          style={{
            textAlign: 'center',
            padding: '2px 1px',
            fontSize: 10.5,
            borderBottom: '2px solid var(--line)',
          }}
        >
          Longitud (m)
        </th>
        <th
          title="Pérdida de carga por fricción en el tramo."
          scope="col"
          className="col-h"
          colSpan={2}
          style={{
            textAlign: 'center',
            padding: '2px 1px',
            fontSize: 10.5,
            whiteSpace: 'nowrap',
            minWidth: 56,
            borderBottom: '2px solid var(--line)',
          }}
        >
          Pérdidas
          <br />
          por
          <br />
          fricción
        </th>
        <th
          title="Presión disponible al inicio y al final del tramo."
          scope="col"
          className={`col-h ${cssClass}`}
          colSpan={2}
          style={{
            textAlign: 'center',
            padding: '2px 1px',
            fontSize: 10.5,
            borderBottom: '2px solid var(--line)',
          }}
        >
          Presión
        </th>
        <th
          title="Chequeo de presión en el aparato conectado al tramo: la presión disponible debe caer entre la mínima y la máxima del aparato (NTC 1500)."
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Chequeo
          <br />
          presión
        </th>
      </tr>
      <tr>
        <th
          title="Unidades de consumo generadas en el propio tramo."
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Propia
        </th>
        <th
          title="Unidades de consumo que llegan de ramales conectados."
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Otros Ramales
        </th>
        <th
          title="Unidades de consumo acumuladas del tramo."
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Total
        </th>
        <th
          title='Diámetro comercial propuesto — editable. Unidad: pulgadas (").'
          scope="col"
          className="col-h ok"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Diseño
        </th>
        <th
          title="Diámetro interior del tubo propuesto (mm)."
          scope="col"
          className="col-h ok"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Interno
        </th>
        <th
          title="Longitud del tramo en horizontal (m)."
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Horizontal
        </th>
        <th
          title="Longitud del tramo en vertical (m)."
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Vertical
        </th>
        <th
          title="Longitud equivalente de los accesorios instalados (m)."
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Eq. Accesorios
        </th>
        <th
          title="Longitud total desarrollada del tramo (m)."
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Total
        </th>
        <th
          title="Pérdida de carga del tramo en ‰ (m por kilómetro de tubería)."
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          ‰
        </th>
        <th
          title="Pérdida de carga en metros de columna de agua."
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          m
        </th>
        <th
          title="Presión disponible al inicio del tramo."
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Inicial
        </th>
        <th
          title="Presión disponible al final del tramo."
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10.5 }}
        >
          Final
        </th>
      </tr>
    </thead>
  );
}
