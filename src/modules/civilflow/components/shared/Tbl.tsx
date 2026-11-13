import React from 'react';

interface TblProps {
  cols: string[];
  /** Notas descriptivas por columna (tooltip en el th, mismo orden que cols). */
  tips?: string[];
  rows: React.ReactNode[][];
  /** Clase extra para la tabla (p. ej. `tbl-calc-fixed` para table-layout: fixed). */
  tableClassName?: string;
  /** Clase extra para todos los th. */
  thClassName?: string;
  /** Clase extra para los td de valor (los que no son primera columna ni valueCol). */
  tdClassName?: string;
  /** Clase extra SOLO para la primera columna (antes tdlStyle). */
  tdlClassName?: string;
  /** Clase extra por índice de columna (se aplica también a los th: data-w para ancho). */
  colClasses?: (string | undefined)[];
  center?: boolean;
  valueCol?: number;
  caption?: string;
}

/** Tabla genérica de memoria de cálculo: encabezados con tooltip (tips), primera columna en
 *  negrita y columna Valor estrecha (valueCol). Ej: reporte EP con 4 columnas -> Tbl({cols,
 *  rows}) sin repetir markup de thead/tbody en cada página. */
const Tbl = React.memo(function Tbl({
  cols,
  tips,
  rows,
  center,
  valueCol,
  caption,
  tableClassName,
  thClassName,
  tdClassName,
  tdlClassName,
  colClasses,
}: TblProps) {
  const vc = valueCol ?? 2;

  return (
    <table
      className={`tbl tbl-calc${center ? ' tbl-calc-center' : ''}${
        tableClassName ? ` ${tableClassName}` : ''
      }`}
    >
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th
              scope="col"
              key={i}
              title={tips?.[i]}
              className={[thClassName, colClasses?.[i]].filter(Boolean).join(' ') || undefined}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => {
              const cls =
                [
                  j === 0 ? 'tbl-l' : j === vc ? 'tbl-v' : undefined,
                  j === 0 ? tdlClassName : tdClassName,
                  colClasses?.[j],
                ]
                  .filter(Boolean)
                  .join(' ') || undefined;
              return (
                <td key={j} className={cls}>
                  {c}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

export default Tbl;
