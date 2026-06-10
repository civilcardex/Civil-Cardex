import { memo } from 'react';
import { useApparatus } from "../context/ApparatusContext";
import { calcUDparcial, calcUDacumulado } from "../utils/componentHelpers";
import { DIAM_OPTIONS } from "../constants";
import { parseDescription } from "../utils/parseDescription";
import { relacionesHidraulicas, caudalTuboLleno } from "../utils/calcSanitary";

interface HydraulicCalcTableProps {
  tramos: any[];
  mode: 'sanitary' | 'rainwater';
  titleIcon: string;
  titleText: string;
  colorVar: string;
}

const HydraulicCalcTable = memo(function HydraulicCalcTable({
  tramos,
  mode,
  titleIcon,
  titleText,
  colorVar
}: HydraulicCalcTableProps) {
  const { udBase } = useApparatus();
  const acumMap = mode === 'sanitary' ? calcUDacumulado(tramos, udBase) : null;

  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t">{titleIcon} {titleText}</span>
      </div>
      <div className="card-b" style={{overflowX:'auto'}}>
        <table className="tbl" style={{fontSize:13}}>
          <thead>
            <tr>
              <th className="col-h" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Tramo</th>
              <th className="col-h" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Q/Q0</th>
              <th className="col-h" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>V/Vo</th>
              <th className="col-h" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Y/D</th>
              <th className="col-h" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>α</th>
              <th className="col-h" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Rh/D</th>
              <th className="col-h" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Rh<br/>mm</th>
            </tr>
          </thead>
          <tbody>
            {tramos.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
            ) : tramos.map(t => {
              const n = t.nmaning || 0.009;
              const sVal = t.sPercent || 2;
              const S = sVal / 100;
              const dSel = DIAM_OPTIONS.find(d => d.pulg === (t.diamDisPulg || 0)) || null;
              const DintMm = dSel ? dSel.mm : 0;

              let Q: number;
              let key: string;

              if (mode === 'sanitary') {
                const nSalidas = t.nSalidas || 2;
                const K = Math.round(nSalidas <= 1 ? 1 : 1 / Math.sqrt(nSalidas - 1) * 100) / 100;
                const udPropias = calcUDparcial(t, udBase);
                const descIds = parseDescription(t.descripcion);
                const udOtros = descIds.reduce((s: number, id: string) => s + ((acumMap as Record<string, number>)[id] || 0), 0);
                const udAcum = udPropias + udOtros;
                Q = udAcum > 0 ? Math.round(K * (udAcum < 240 ? 0.1163 * Math.pow(udAcum, 0.6875) : 0.074 * Math.pow(udAcum, 0.7504)) * 1000) / 1000 : 0;
                key = t.id;
              } else {
                Q = t.qLps || 0;
                key = t._key;
              }

              let Qo = 0, qqo = 0, v = 0, y_D = 0, alpha = 0, Rh_D = 0, Rh = 0;

              if (Q > 0 && S > 0 && n > 0 && DintMm > 0) {
                Qo = Math.round(caudalTuboLleno(DintMm / 1000, n, S) * 1000 * 100) / 100;
                const q = Q / Qo;
                qqo = Math.round(q * 100) / 100;
                const rel = relacionesHidraulicas(q);
                v = rel.v_V0;
                y_D = rel.h_D;
                alpha = rel.alpha;
                Rh_D = rel.Rh_D;
                Rh = Rh_D * DintMm;
              }

              const displayId = mode === 'sanitary' ? t.id : (t.id || t._key);

              return (
                <tr key={key}>
                  <td className="c"><span className="sigla" style={{fontSize:10}}>{displayId}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,color:colorVar}}>{qqo>0?qqo.toFixed(4):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{v>0?v.toFixed(6):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{y_D>0?y_D.toFixed(6):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{alpha>0?alpha.toFixed(6):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{Rh_D>0?Rh_D.toFixed(6):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,color:colorVar}}>{Rh>0?Rh.toFixed(4):'—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default HydraulicCalcTable;
