import React from 'react';

import { SR_ONLY_STYLE } from '../../../../components/shared/sharedStyles.ts';
const TH_DEFAULT: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--txt3)',
  fontFamily: 'var(--mono)',
  textAlign: 'center',
  padding: '2px 6px',
  borderBottom: '1px solid var(--line)',
  borderRight: '1px solid var(--line)',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  background: 'var(--bg3)',
};

const TD_DEFAULT: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'var(--mono)',
  padding: '1px 6px',
  borderBottom: '1px solid var(--line)',
  borderRight: '1px solid var(--line)',
  color: 'var(--txt2)',
  textAlign: 'center',
  verticalAlign: 'middle',
};

const TDL_DEFAULT: React.CSSProperties = {
  ...TD_DEFAULT,
  textAlign: 'left',
  fontFamily: 'var(--body)',
  color: 'var(--txt)',
  minWidth: 150,
  fontSize: 14,
  fontWeight: 600,
};

interface TblProps {
  cols: string[];
  /** Notas descriptivas por columna (tooltip en el th, mismo orden que cols). */
  tips?: string[];
  rows: React.ReactNode[][];
  thStyle?: React.CSSProperties;
  tdStyle?: React.CSSProperties;
  tdlStyle?: React.CSSProperties;
  fontSize?: number;
  center?: boolean;
  valueCol?: number;
  tableStyle?: React.CSSProperties;
  caption?: string;
  /** Estilos extra por índice de columna (se funden sobre th/td) — p. ej. ensanchar Valor
   *  y estrechar Fuente/norma. */
  colStyles?: (React.CSSProperties | undefined)[];
}

/** Tabla genérica de memoria de cálculo: encabezados con tooltip (tips), primera columna en
 *  negrita y columna Valor estrecha (valueCol). Ej: reporte EP con 4 columnas -> Tbl({cols,
 *  rows}) sin repetir markup de thead/tbody en cada página. */
const Tbl = React.memo(function Tbl({
  cols,
  tips,
  rows,
  thStyle,
  tdStyle,
  tdlStyle,
  fontSize,
  center,
  valueCol,
  tableStyle,
  caption,
  colStyles,
}: TblProps) {
  const th = { ...TH_DEFAULT, ...thStyle };
  const td = { ...TD_DEFAULT, ...tdStyle };
  const tdl = { ...TDL_DEFAULT, ...tdlStyle };
  const vc = valueCol ?? 2;

  return (
    <table
      className="tbl"
      style={{
        fontSize: fontSize || 11,
        width: center ? '90%' : '100%',
        maxWidth: center ? 900 : undefined,
        borderCollapse: 'collapse',
        margin: center ? '0 auto' : 0,
        ...tableStyle,
      }}
    >
      {caption && <caption style={SR_ONLY_STYLE}>{caption}</caption>}
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th scope="col" key={i} title={tips?.[i]} style={{ ...th, ...colStyles?.[i] }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => {
              let s: React.CSSProperties;
              if (j === 0) {
                s = tdl;
              } else if (j === vc) {
                s = { ...td, width: '1%', whiteSpace: 'nowrap' };
              } else {
                s = td;
              }
              return (
                <td key={j} style={{ ...s, ...colStyles?.[j] }}>
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
