type DiamOpt = { pulg: number; nominal: string; label?: string; dInt: number };

// Física de un tramo de la acometida (red → contador → montante): velocidad, longitud total,
// pérdida por fricción y presión final. `diamTable` y `Qaco` llegan como parámetros para que
// la función sea pura y testeable.
/** Física de un tramo de la acometida (red→contador o contador→montante): velocidad, longitud total, pérdida por fricción y presión final.
 * `diamTable` y `Qaco` llegan como parámetros para que la función sea pura y testeable. */
export function calcFila(
  nominal: string,
  h: number,
  v: number,
  le: number,
  pIn: number,
  cHW: number,
  diamTable: DiamOpt[],
  Qaco: number,
) {
  const opt = nominal ? diamTable.find((d) => d.nominal === nominal) : null;
  const dInt = opt ? opt.dInt : 0;
  const V =
    Qaco > 0 && dInt > 0
      ? Math.round(((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt)) * 10) / 10
      : 0;
  const Lt = (h || 0) + (v || 0) + (le || 0);
  // Misma física que rowPhysics (tabla de diseño): hfPct está en m/km → metros = ·Lt/1000.
  // Con guard V/dInt>0: 0^1.852/0^1.167 = NaN sin él (diámetro sin resolver).
  const hfPct =
    V > 0 && dInt > 0
      ? Math.round(
          ((60.1 * Math.pow(V, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(dInt, 1.167))) * 100,
        ) / 100
      : 0;
  const hfM = Lt > 0 && hfPct > 0 ? Math.round((hfPct / 1000) * Lt * 100) / 100 : 0;
  const Pfin = +(pIn - (v || 0) - hfM).toFixed(2);
  return { dInt, V, Lt, hfPct, hfM, Pfin };
}
