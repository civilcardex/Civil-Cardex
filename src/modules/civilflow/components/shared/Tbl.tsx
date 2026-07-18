import React from 'react';

const TH_DEFAULT: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--txt3)', fontFamily: 'var(--mono)',
  textAlign: 'center', padding: '2px 6px',
  borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line)',
  whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.4px',
  background: 'var(--bg3)',
};

const TD_DEFAULT: React.CSSProperties = {
  fontSize: 12, fontFamily: 'var(--mono)', padding: '1px 6px',
  borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line)',
  color: 'var(--txt2)', textAlign: 'center', verticalAlign: 'middle',
};

const TDL_DEFAULT: React.CSSProperties = {
  ...TD_DEFAULT,
  textAlign: 'left', fontFamily: 'var(--body)', color: 'var(--txt)',
  minWidth: 150, fontSize: 14, fontWeight: 600,
};

interface TblProps {
  cols: string[];
  rows: React.ReactNode[][];
  thStyle?: React.CSSProperties;
  tdStyle?: React.CSSProperties;
  tdlStyle?: React.CSSProperties;
  fontSize?: number;
  center?: boolean;
  valueCol?: number;
  tableStyle?: React.CSSProperties;
  caption?: string;
}

const VH: React.CSSProperties = {position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0};

const Tbl = React.memo(function Tbl({
  cols, rows, thStyle, tdStyle, tdlStyle,
  fontSize, center, valueCol, tableStyle, caption,
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
      {caption && <caption style={VH}>{caption}</caption>}
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th scope="col" key={i} style={th}>{c}</th>
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
              return <td key={j} style={s}>{c}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

export default Tbl;
