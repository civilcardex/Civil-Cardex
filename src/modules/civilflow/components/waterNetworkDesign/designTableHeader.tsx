// Encabezado estático de la tabla de diseño (2 filas × 23 columnas, con celdas combinadas).
// No tiene lógica: solo depende de la clase de color de la red activa (af/ac).
/** Encabezado estático de la tabla de diseño de red: dos filas y 23 columnas con celdas
 *  combinadas. No tiene lógica; solo la clase de color de la red activa. */
export function DesignTableHeader({ cssClass }: { cssClass: string }) {
  return (
    <thead>
      <tr>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Tramo
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Inicio
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Final
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Piso
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          colSpan={3}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Unidades Consumo
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          No. de descargas
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          K
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Caudal
          <br />
          (lps)
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Diámetro
          <br /> estimado
        </th>
        <th
          scope="col"
          className="col-h ok"
          colSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Diámetro
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Coeficiente
          <br />C
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Vel. <br />
          (mm/s)
        </th>
        <th
          scope="col"
          className="col-h"
          colSpan={4}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Longitud (m)
        </th>
        <th
          scope="col"
          className="col-h"
          colSpan={2}
          style={{
            textAlign: 'center',
            padding: '2px 1px',
            fontSize: 9,
            whiteSpace: 'nowrap',
            minWidth: 56,
          }}
        >
          Pérdidas
          <br />
          por
          <br />
          fricción
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          colSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
        >
          Presión
        </th>
      </tr>
      <tr>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Propia
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Otros Ramales
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Total
        </th>
        <th
          scope="col"
          className="col-h ok"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Diseño
        </th>
        <th
          scope="col"
          className="col-h ok"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Interno
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Horizontal
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Vertical
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Eq. Accesorios
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Total
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          %
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          m
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Inicial
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
        >
          Final
        </th>
      </tr>
    </thead>
  );
}
