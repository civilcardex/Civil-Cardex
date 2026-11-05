/** Strip resumen del HTML de referencia (#hidSummary): los 5 indicadores del cálculo del piso
 *  en una banda con divisores — rociador más remoto, lo que exige el área, la derivación del
 *  piso, cuántos entraron al cálculo y el pedido de gabinetes. Ej: «Rociador más remoto
 *  25.97 gpm @ 20.20 psi · El área exige 7 rociadores (3 + 3 + 1) …». */
import type { RciResult, RciState, TipCalc } from '../../lib/rci/types.ts';
import { numMontantesDibujados } from '../../lib/rci/building.ts';
import { fmt } from '../../utils/rci/RCIRowsModel2.ts';

const S: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 0',
  padding: '8px 14px',
  border: '1px solid var(--line)',
  borderLeft: '4px solid var(--steel)',
  borderRadius: '0 8px 8px 0',
  background: 'var(--bg2)',
  marginBottom: 10,
};
const ITEM: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  fontSize: 12.5,
  color: 'var(--txt2)',
  padding: '0 16px',
};
const ITEM_PRIMERO: React.CSSProperties = { ...ITEM, paddingLeft: 0 };
const DIV: React.CSSProperties = { borderLeft: '2px solid var(--steel)' };
const B: React.CSSProperties = { fontSize: 15.5, color: 'var(--txt)', fontWeight: 600 };

/** Un indicador del strip: etiqueta chica + valor grande. `div` pinta el divisor izquierdo. */
function Kpi({
  lbl,
  children,
  primero,
  title,
}: {
  lbl: string;
  children: React.ReactNode;
  primero?: boolean;
  title?: string;
}) {
  return (
    <div style={{ ...(primero ? ITEM_PRIMERO : ITEM), ...(primero ? null : DIV) }} title={title}>
      <span>{lbl}</span>
      <b style={B}>{children}</b>
    </div>
  );
}

/** Strip #hidSummary del HTML. Ej: <HidSummary R={R} tip={tip} estado={estado} />. */
export function HidSummary({
  R,
  tip,
  estado,
}: {
  R: RciResult;
  /** Tipología del piso activo (sus criterios y su red). */
  tip: TipCalc | null;
  estado: RciState;
}) {
  const o = tip ? tip.roc : R.roc;
  const rd = tip?.rd ?? null;
  /* Reparto del área: N por ramal con el último parcial, «3 + 3 + 1». */
  const partes: number[] = [];
  for (let j = 0; j < o.Nramales; j++) partes.push(j === o.Nramales - 1 ? o.Nultimo : o.Nramal);
  const okN = rd ? rd.flTot >= o.Nreq : false;
  /* Pedido de gabinetes: UNA sola fuente — compute ya lo resolvió en R.sp.Qreq/Preq
   * (Clase II 100/65; Clase I/III 500+250·(n−1) con tope 1000/1250). No recalcular aquí:
   * el gemelo divergió del motor una vez con el predicate de 'Sí'. */
  const exigeSP = estado.local.exigeSP === 'Sí';
  const clase = estado.sp.clase;
  /* Montantes efectivos: del dibujo (códigos extraídos), solo para el title del KPI. */
  const nMont = numMontantesDibujados(estado);
  const qGab = R.sp.Qreq;
  const pGab = R.sp.Preq;
  return (
    <div style={S}>
      <Kpi
        lbl="Rociador más remoto"
        primero
        title="Q = densidad × S × L; P = máx(P mínima, (Q/K)²)"
      >
        {fmt(o.Q1)} gpm @ {fmt(o.Prem)} psi
      </Kpi>
      <Kpi lbl="El área exige" title="Reparto por ramal del área de diseño">
        {o.Nreq} rociadores{o.Nramales > 0 ? ` (${partes.join(' + ')})` : ''}
      </Kpi>
      <Kpi
        lbl={`Derivación del piso${tip ? ` (${tip.g.id})` : ''}`}
        title="Presión y caudal en la derivación del montante (nudo raíz de la red)"
      >
        {rd && rd.rt && rd.rt.solved
          ? `${fmt(rd.rt.Q, 1)} gpm @ ${fmt(rd.rt.P, 1)} psi`
          : 'Incompleta'}
      </Kpi>
      <Kpi lbl="En el cálculo" title="Rociadores que entraron al balance de la red">
        <span style={{ color: okN ? 'var(--succ, #5DBB83)' : 'var(--err, #F04545)' }}>
          {rd ? rd.Nop : 0} rociadores {okN ? '✓' : rd ? `– faltan ${o.Nreq - rd.flTot}` : ''}
        </span>
      </Kpi>
      <Kpi
        lbl={`Brida de descarga${R.edif.gov ? ` (gobierna ${R.edif.gov.f.nombre})` : ''}`}
        title="Demanda que gobierna en la brida de descarga de la bomba (edificio completo)"
      >
        {fmt(R.alim.Qend, 1)} gpm @ {fmt(R.alim.Pend, 1)} psi
      </Kpi>
      {exigeSP ? (
        <Kpi
          lbl={`Gabinetes · ${clase}`}
          title={`NFPA 14: ${clase} pide ${qGab} gpm a ${pGab} psi en la salida más remota${nMont > 1 ? ` (${nMont} montantes)` : ''}`}
        >
          {qGab} gpm @ {pGab} psi
        </Kpi>
      ) : null}
    </div>
  );
}

export default HidSummary;
