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
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Tramo
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Inicio
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Final
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Piso
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          colSpan={3}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Unidades Consumo
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          No. de descargas
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          K
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Caudal
          <br />
          (lps)
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Diámetro
          <br /> estimado
        </th>
        <th
          scope="col"
          className="col-h ok"
          colSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Diámetro
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Coeficiente
          <br />C
        </th>
        <th
          scope="col"
          className="col-h"
          rowSpan={2}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Vel. <br />
          (mm/s)
        </th>
        <th
          scope="col"
          className="col-h"
          colSpan={4}
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
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
            fontSize: 10,
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
          style={{ textAlign: 'center', padding: '2px 1px', fontSize: 10 }}
        >
          Presión
        </th>
      </tr>
      <tr>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Propia
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Otros Ramales
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Total
        </th>
        <th
          scope="col"
          className="col-h ok"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Diseño
        </th>
        <th
          scope="col"
          className="col-h ok"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Interno
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Horizontal
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Vertical
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Eq. Accesorios
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Total
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          %
        </th>
        <th
          scope="col"
          className="col-h"
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          m
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Inicial
        </th>
        <th
          scope="col"
          className={`col-h ${cssClass}`}
          style={{ textAlign: 'center', padding: '0 1px', fontSize: 10 }}
        >
          Final
        </th>
      </tr>
    </thead>
  );
}
