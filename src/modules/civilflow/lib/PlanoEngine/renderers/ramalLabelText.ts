import { normalizeDnLabel } from '../../../utils/formatUtils.ts';
import { pisoCortoLoose as getPisoCorto, matDrawingLabel } from '../../../constants';

/** Texto de las etiquetas de ramal: función pura (testeada) que arma nombre + info por red; el dibujo vive en ramalBody. */

/** Partes de texto de la etiqueta de un ramal (formato por red, Ítem 1). */
export interface RamalLabelParts {
  /** Nombre del ramal con sufijo de piso ("RAC1-P2") — vacío si showName off o canal. */
  lbl: string;
  /** String compacto por red ("S4" CPVC 1/2" P 0.5% 3.20m") — null = usar partes genéricas. */
  infoStr: string | null;
  /** Material para el esquema genérico (matDrawingLabel o PVC-V en vent). */
  matPart: string;
  /** "D=<diámetro>" del esquema genérico (fuera de san). */
  dPart: string;
  /** "S=x%" del esquema genérico (fuera de san). */
  pendPart: string;
  /** "L=<longitud>m" del esquema genérico (fuera de san). */
  lblPart: string;
}

const inchPartOf = (d: string): string => {
  const q = d.indexOf('"');
  return q > 0 ? d.slice(0, q + 1) : d;
};
const rdePartOf = (d: string): string => {
  const q = d.indexOf('"');
  return q >= 0 && q + 1 < d.length ? d.slice(q + 1).trim() : '';
};
const diamPulg = (d?: string): string => {
  if (!d) return '';
  const norm = normalizeDnLabel(d)
    .replace(/\s*—.*$/, '')
    .trim();
  return inchPartOf(norm);
};

/** Texto de la etiqueta de un ramal por red (san/ll compacto "S4" CPVC 1/2" P 0.5% 3.20m"; resto genérico). Solo el contenido — el dibujo (caja, declutter) queda en ramalBody. @param r - ramal con label/diametro/pendiente/totalL y flags show*. @param nivelN - npt (nivel de piso topografico) del nivel actual (para el sufijo "-P2"). */
export function buildRamalLabelParts(
  r: {
    label?: string;
    totalL?: number;
    material?: string;
    diametro?: string;
    pendiente?: number | string;
    net: string;
    showName?: boolean;
    showLength?: boolean;
    showMatDiamPend?: boolean;
    esCanalId?: string | null;
  },
  nivelN: number | string | null | undefined,
): RamalLabelParts {
  const pCorto = getPisoCorto(nivelN);
  const lvlSuffix = pCorto ? `-${pCorto}` : '';
  const showName = r.showName !== false;
  const showLength = r.showLength !== false;
  const showMatDiamPend = r.showMatDiamPend !== false;
  // Ramal de canal (orig. usuario): SIN nombre — solo Longitud/Pendiente/Diámetro.
  const esCanal = !!r.esCanalId;
  const lbl = showName && r.label && !esCanal ? `${r.label}${lvlSuffix}` : '';
  // Ítem 1: formatos por red. Para san/ll/ac/af/gas se produce un único string compacto;
  // vent y el resto mantienen el esquema de segmentos genérico de abajo.
  let infoStr: string | null = null;
  let matPart = '';
  if (r.net === 'san') {
    const diamPart = showMatDiamPend ? diamPulg(r.diametro) : '';
    const pendVal = showMatDiamPend && r.pendiente != null ? Number(r.pendiente).toFixed(1) : '';
    const longPartSan = showLength && r.totalL ? `${r.totalL.toFixed(2)}m` : '';
    const segs = showMatDiamPend
      ? [`${diamPart ? `S${diamPart}` : 'S'}`, pendVal ? `P${pendVal}%` : 'P%', longPartSan]
      : [longPartSan];
    infoStr = segs.filter(Boolean).join(' ') || null;
    if (infoStr === 'S P% m' || infoStr === 'S') infoStr = null;
  } else if (r.net === 'll') {
    if (esCanal) {
      // Ramal de canal: etiqueta L/S/D con los valores EDITABLES del ramal
      // (pendiente y diámetro default 2 — orig. usuario).
      const dPartC = diamPulg(r.diametro);
      infoStr =
        [
          showLength && r.totalL ? `L=${r.totalL.toFixed(2)}m` : '',
          r.pendiente ? `S=${Number(r.pendiente)}%` : '',
          dPartC ? `D=${dPartC}` : '',
        ]
          .filter(Boolean)
          .join(' ') || null;
    } else {
      const diamPart = showMatDiamPend ? diamPulg(r.diametro) : '';
      const pendVal = showMatDiamPend && r.pendiente != null ? Number(r.pendiente).toFixed(1) : '';
      const longPart = showLength && r.totalL ? `${r.totalL.toFixed(2)}m` : '';
      const segs = showMatDiamPend
        ? [`ALL${diamPart ? ` ${diamPart}` : ''}`, pendVal ? `P ${pendVal}%` : '', longPart]
        : [longPart];
      infoStr = segs.filter(Boolean).join(' ') || null;
    }
  } else if (r.net === 'ac') {
    const norm = r.diametro
      ? normalizeDnLabel(r.diametro)
          .replace(/\s*—.*$/, '')
          .trim()
      : '';
    const diamPart = showMatDiamPend ? inchPartOf(norm) : '';
    const rde = showMatDiamPend ? rdePartOf(norm) : '';
    const longPart = showLength && r.totalL ? `${r.totalL.toFixed(2)}m` : '';
    const segs = showMatDiamPend
      ? [`CPVC${diamPart ? ` ${diamPart}` : ''}`, rde, longPart]
      : [longPart];
    infoStr = segs.filter(Boolean).join(' ') || null;
  } else if (r.net === 'af') {
    const norm = r.diametro
      ? normalizeDnLabel(r.diametro)
          .replace(/\s*—.*$/, '')
          .trim()
      : '';
    const diamPart = showMatDiamPend ? inchPartOf(norm) : '';
    const rde = showMatDiamPend ? rdePartOf(norm) : '';
    const longPart = showLength && r.totalL ? `${r.totalL.toFixed(2)}m` : '';
    const segs = showMatDiamPend
      ? [`PVC${diamPart ? ` ${diamPart}` : ''}`, rde, longPart]
      : [longPart];
    infoStr = segs.filter(Boolean).join(' ') || null;
  } else if (r.net === 'gas') {
    const diamPart = showMatDiamPend ? diamPulg(r.diametro) : '';
    const mat = showMatDiamPend ? matDrawingLabel(r.material) : '';
    const longPart = showLength && r.totalL ? `${r.totalL.toFixed(2)}m` : '';
    const segs = showMatDiamPend
      ? [mat ? `${mat}${diamPart ? ` ${diamPart}` : ''}` : diamPart, longPart]
      : [longPart];
    infoStr = segs.filter(Boolean).join(' ') || null;
  }
  const matPartFallback = showMatDiamPend
    ? matDrawingLabel(r.material) || (r.net === 'vent' ? 'PVC-V' : '')
    : '';
  matPart = infoStr ? '' : r.net === 'san' ? '' : matPartFallback;
  const dPart =
    !infoStr && showMatDiamPend && r.net !== 'san' && r.diametro
      ? `D=${normalizeDnLabel(r.diametro)}`
      : '';
  const pPart =
    !infoStr && showMatDiamPend && r.net !== 'san' && r.pendiente ? `S=${r.pendiente}%` : '';
  const showPend = r.net === 'san' || r.net === 'll';
  const pendPart = !infoStr && r.net !== 'san' && showPend && pPart ? pPart : '';
  const lblPart =
    !infoStr && r.net !== 'san' && showLength && r.totalL ? `L=${r.totalL.toFixed(2)}m` : '';
  return { lbl, infoStr, matPart, dPart, pendPart, lblPart };
}
