import React from "react";
import { TH, TD } from "../../styles/sharedTableStyles";

const Tbl_S1: React.CSSProperties = { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 };
const TDBom: React.CSSProperties = { ...TD, background: '#1a1c20' };
const TDL: React.CSSProperties = { ...TDBom, textAlign: 'left', fontFamily: 'var(--body)' };

export default function Tbl({ cols, rows, th, td, tdl, fontSize, center, valueCol, caption }: { cols: string[]; rows: React.ReactNode[][]; th?: React.CSSProperties; td?: React.CSSProperties; tdl?: React.CSSProperties; fontSize?: number; center?: boolean; valueCol?: number; caption?: string }) {
  const h = th || TH, d = td || TDBom, dl = tdl || TDL;
  const vc = valueCol ?? 2;
  return <table className="tbl" style={{ fontSize: fontSize || 11, width: center ? '90%' : '100%', maxWidth: 900, borderCollapse: 'collapse', margin: center ? '0 auto' : 0 }}>
    {caption && <caption style={Tbl_S1}>{caption}</caption>}
    <thead><tr>{cols.map((c, i) => <th scope="col" key={i} style={h}>{c}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => {
      const s = j === 0 ? dl : j === vc ? { ...d, width: '1%', whiteSpace: 'nowrap' } : d;
      return <td key={j} style={s}>{c}</td>;
    })}</tr>)}</tbody>
  </table>;
}
