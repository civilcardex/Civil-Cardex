import { dec } from '../utils/parseDecimal';
import { matHazenC } from '../constants/engineeringDataMaterials';

/** Inputs editables por bomba. */
export interface BombaInputs {
  sal: string;
  hz: string;
  lImp: string;
  dImp: string;
  pDesc: string;
  etaB: string;
  fSrv: string;
  tCic: string;
  hMin: string;
  hMax: string;
  bCam: string;
  lCam: string;
  npsh: string;
  tipoTuberia: string;
}

/** Semilla de la UI (exportada: el test de regresión necesita la forma completa). */
export const INPUTS_DEFAULT: BombaInputs = {
  sal: '',
  hz: '',
  lImp: '',
  dImp: '',
  pDesc: '',
  etaB: '',
  fSrv: '1.25',
  tCic: '',
  hMin: '',
  hMax: '',
  bCam: '',
  lCam: '',
  npsh: '',
  tipoTuberia: 'PVC-PR',
};

const MAT_POR_TIPO: Record<string, string> = {
  'PVC-PR': 'PVC-PR',
  'Acero galvanizado': 'Acero HG',
  'Acero al carbón': 'A.C.',
};

/** C de Hazen-Williams: Catálogo Maestro según tipo de tubería — solo lectura. */
export function cHazenDe(tipoTuberia: string): number {
  return matHazenC(MAT_POR_TIPO[tipoTuberia] ?? 'PVC-PR') ?? 150;
}

export function calcsDe(inp: BombaInputs, uds: number) {
  const sal = dec(inp.sal);
  const hz = dec(inp.hz);
  const li = dec(inp.lImp);
  const di = dec(inp.dImp);
  const eta = dec(inp.etaB);
  const ch = cHazenDe(inp.tipoTuberia);
  const fs = dec(inp.fSrv) || 1.25;
  const pd = dec(inp.pDesc);
  const tc = dec(inp.tCic);
  const hmn = dec(inp.hMin);
  const hmx = dec(inp.hMax);
  const bc = dec(inp.bCam);
  const lc = dec(inp.lCam);
  const Dm = di * 0.0254;
  const ud = uds;

  const K = sal <= 1 ? 1 : +(1 / Math.sqrt(sal - 1)).toFixed(2);
  const Qd = +(
    K * (ud < 240 ? 0.1163 * Math.pow(ud, 0.6875) : 0.074 * Math.pow(ud, 0.7504))
  ).toFixed(2);
  const Qb = +(Qd * 1.25).toFixed(2);
  // V con Qd (caudal de diseño — metodología del Excel maestro, D27).
  const Vi = Qd > 0 && Dm > 0 ? +((Qd * 0.001) / (3.14159 * Math.pow(Dm / 2, 2))).toFixed(3) : 0;
  // Cadena H a PRECISIÓN COMPLETA (el Excel encadena sin redondear y solo muestra 3 dec):
  // redondear cada eslabón divergía ±0.001-0.002 del maestro justo en el umbral del 3er decimal.
  const HfRaw =
    Qb > 0 && li > 0 && Dm > 0
      ? (10.67 * li * Math.pow(Qb / 1000, 1.852)) / (Math.pow(ch, 1.852) * Math.pow(Dm, 4.87))
      : 0;
  const Hf = +HfRaw.toFixed(3);
  const HacRaw = HfRaw * 0.25;
  const Hac = +HacRaw.toFixed(3);
  const Hfri = +(HfRaw + HacRaw).toFixed(3);
  // Altura estática = Hz geométrica + presión mínima en descarga; Hm = fricción + estática.
  const HestRaw = hz + pd;
  const Hest = +HestRaw.toFixed(3);
  const HmRaw = HfRaw + HacRaw + HestRaw;
  const Hm = +HmRaw.toFixed(3);
  const Vch = Vi >= 0.6 && Vi <= 3.5 ? 'O.K.' : 'REVISAR DIÁMETRO';
  const Ph = Qb > 0 ? +((Qb * 1000 * 9.81 * HmRaw) / 1000).toFixed(2) : 0;
  // η bomba: se LEE del campo "Eficiencia bomba η" (Datos de entrada) — sin default. P eje =
  // P hid / η. Tolerante a fracción (0.65) o porcentaje (65); ≤1 es fracción. Campo vacío ⇒
  // P eje/P com/HP/selección sin valor (—), nunca inventar η.
  const etaFrac = eta > 0 ? (eta <= 1 ? eta : eta / 100) : 0;
  const Peje: number | '' = etaFrac > 0 ? +(Ph / etaFrac).toFixed(2) : '';
  const Pcom: number | '' = Peje !== '' ? +(Peje * fs).toFixed(2) : '';
  // 745.7 W/HP — la MISMA constante de las equivalencias Eq(...) de abajo.
  const php: number | '' = Pcom !== '' ? +(Pcom / 745.7).toFixed(2) : '';
  const Sel: string =
    php === ''
      ? ''
      : php <= 0.5
        ? '0.5 HP'
        : php <= 1
          ? '1 HP'
          : php <= 2
            ? '2 HP'
            : php <= 3
              ? '3 HP'
              : '≥ 5 HP';
  const Vcam = Qb > 0 && tc > 0 ? +(Qb * tc * 60).toFixed(2) : 0;
  const Vgeo = bc > 0 && lc > 0 && hmx - hmn > 0 ? +(bc * lc * (hmx - hmn)).toFixed(2) : 0;
  const Vchk = Vgeo > 0 && Vcam > 0 ? (Vgeo >= Vcam / 1000 ? 'O.K.' : 'AMPLIAR CÁMARA') : '';
  return {
    K,
    Qd,
    Qb,
    Vi,
    Hf,
    Hac,
    Hfri,
    Hest,
    Hm,
    Vch,
    Ph,
    Peje,
    Pcom,
    php,
    Sel,
    Vcam,
    Vgeo,
    Vchk,
  };
}
