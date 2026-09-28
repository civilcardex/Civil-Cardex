import { dec } from '../../utils/parseDecimal';

// Cálculos de la página Cisterna (Excel hoja CISTERNA) — ÚNICA fuente para página, página de
// verificación y tests. Antes: HMT/NPSH triplicados (EPCisternaPage / EPVerificationPage /
// test) con deriva silenciosa garantizada. Celdas citadas: C8/C9/C10 (desniveles), C27 (HMT
// cisterna — SIN descuento de Pred, a diferencia del modo RED), NPSHd (patm − pv − |z_cis| −
// hf_cis) vs NPSHr + 0.5 m de margen normativo (RAS 2000).

/** Forma mínima de EPData que los cálculos cisterna leen (todo string, convención EP). */
export interface EpCisternaIn {
  modo: 'red' | 'cisterna';
  ztop: string;
  zcis: string;
  hfac: string;
  hfacs: string;
  hfotros: string;
  hfcis: string;
  pmin: string;
  patm: string;
  pv: string;
  npshr: string;
  dotL: string;
  nUsuarios: string;
  diasAut: string;
  bciL: string;
}

export interface EpCisternaCalc {
  /** Modo RED: los números de cisterna no aplican (la página solo muestra aviso). */
  aplica: boolean;
  HgTotal: number;
  HfTotal: number;
  HMT: number;
  npshd: number;
  npshOk: boolean;
  volConsumo: number;
  volTotal: number;
  /** Los 3 inputs de NPSH (patm/pv/npshr) están poblados — sin ellos el veredicto es
   *  "—" y NO la falsa alarma de cavitación que daban los defaults vacíos. */
  npshEvaluable: boolean;
}

/** Encadenado cisterna completo desde EPData (strings con coma decimal). */
export function calcularCisterna(ep: EpCisternaIn): EpCisternaCalc {
  const zcis = dec(ep.zcis);
  const hfsuc = dec(ep.hfcis);
  const hAcrit = Math.max(dec(ep.hfac), dec(ep.hfacs));
  const HgTotal = dec(ep.ztop) - zcis;
  const HfTotal = hAcrit + dec(ep.hfotros) + hfsuc;
  const HMT = HgTotal + HfTotal + dec(ep.pmin);
  const patm = dec(ep.patm);
  const pv = dec(ep.pv);
  const npshr = dec(ep.npshr);
  const npshEvaluable = ep.patm.trim() !== '' && ep.pv.trim() !== '' && ep.npshr.trim() !== '';
  const npshd = patm - pv - Math.abs(zcis) - hfsuc;
  const npshOk = npshEvaluable && npshd >= npshr + 0.5;
  const volConsumo = dec(ep.dotL) * dec(ep.nUsuarios) * dec(ep.diasAut);
  return {
    aplica: ep.modo !== 'red',
    HgTotal,
    HfTotal,
    HMT,
    npshd,
    npshOk,
    volConsumo,
    volTotal: volConsumo + dec(ep.bciL),
    npshEvaluable,
  };
}
