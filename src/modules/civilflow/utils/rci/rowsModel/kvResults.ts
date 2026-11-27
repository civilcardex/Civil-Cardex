/** Resultados del cálculo RCI (Red Contra Incendio) en pares etiqueta/valor: las líneas
 *  "etiqueta: valor unidad (nota)" de las tarjetas de solo lectura — criterios de rociadores,
 *  siamesa, bomba y tanque. Puro: sin React ni storage.
 *  Ej: kvRociadorDiseno(ro, qrTxt, sistemaTxt)[1] = { l: 'Factor K', v: '5,6', u: 'gpm/psi½' }. */

import { fmtEs as f1 } from '../../../lib/rci/fmtEs.ts';
import type { BombaResult, Criterios, SiaResult, TanqueResult } from '../../../lib/rci/types.ts';

/* ============================ Resultados en pares etiqueta/valor ============================ */

/** Una línea de resultados "etiqueta: valor unidad (nota)". */
export interface KvRci {
  l: string;
  v: string;
  u?: string;
  nota?: string;
}

/** Criterios de rociadores — tabla 1 «Rociador y área de diseño» (9 filas, orden del HTML de
 *  referencia). qrTxt/sistemaTxt llegan del PISO BASE de la tipología (no de Entradas).
 *  Ej: con el ejemplo, «Área adoptada» = 1.066,2 ft² (QR −29 %). */
export function kvRociadorDiseno(ro: Criterios, qrTxt: string, sistemaTxt: string): KvRci[] {
  const qr = String(qrTxt || '').trim() === 'Sí';
  const seco = String(sistemaTxt || '').trim() === 'Seco' || ro.FSeco > 1;
  return [
    {
      l: 'Tipo de rociador',
      v: qr ? 'Respuesta rápida (QR)' : 'Respuesta estándar',
      nota: qr
        ? 'Reacciona antes al calor: puede reducir el área de diseño (cap. 19)'
        : 'Sin reducción de área por respuesta rápida',
    },
    {
      l: 'Factor K',
      v: f1(ro.K, 1),
      u: 'gpm/psi½',
      nota: `${f1(ro.K * 14.4, 0)} L/min/bar½ · dato del fabricante`,
    },
    {
      l: 'Presión mínima de operación',
      v: f1(ro.Pmin, 1),
      u: 'psi',
      nota: 'Mínimo 7 psi o la del listado del rociador',
    },
    {
      l: 'Sistema',
      v: seco ? 'Seco' : 'Húmedo',
      nota: seco ? 'Área de diseño +30 %' : 'Tubería llena de agua',
    },
    {
      l: 'Densidad de diseño',
      v: f1(ro.hz.d, 2),
      u: 'gpm/ft²',
      nota: `${f1(ro.hz.d * 40.746, 2)} mm/min · Tabla 19.2.3.1.1`,
    },
    {
      l: 'Área de diseño base',
      v: f1(ro.hz.a, 0),
      u: 'ft²',
      nota: `${f1(ro.hz.a * 0.092903, 1)} m²`,
    },
    {
      l: 'Reducción por rociadores QR',
      v: f1(ro.RedQR * 100, 1),
      u: '%',
      nota: ro.RedQR
        ? `Techo ${f1(ro.HtFt, 1)} ft; y = 55 − 1,5x (10 < x ≤ 20 ft)`
        : 'Solo sistema húmedo, riesgo leve u ordinario y techo ≤ 20 ft',
    },
    {
      l: 'Factor por sistema seco',
      v: f1(ro.FSeco, 2),
      nota: seco ? '+30 % en sistema seco' : 'Sistema húmedo',
    },
    {
      l: 'Área de diseño adoptada',
      v: f1(ro.Adis, 1),
      u: 'ft²',
      nota: `${f1(ro.Adis * 0.092903, 1)} m²`,
    },
  ];
}

/** Criterios de rociadores — tabla 2 «Cobertura y caudales» (10 filas, orden del HTML).
 *  S y L faltantes se muestran «—» con la indicación del dato (nunca un cero calculado).
 *  Ej: con el ejemplo, «Rociadores requeridos» = 7 (3 ramales × 3; 7 con flujo). */
export function kvRociadorCobertura(ro: Criterios, Nop: number | null): KvRci[] {
  const faltaSL = !(ro.S > 0) || !(ro.L > 0);
  const faltaS = !(ro.S > 0);
  const faltaL = !(ro.L > 0);
  const faltante = [faltaS ? 'S' : '', faltaL ? 'L' : ''].filter(Boolean).join(' y ');
  const notaSL = faltaSL ? `Falta ${faltante} del piso base (Pisos del edificio)` : undefined;
  return [
    {
      l: 'Cobertura máxima por rociador',
      v: f1(ro.Acmax, 0),
      u: 'ft²',
      nota: `${f1(ro.Acmax * 0.092903, 1)} m² · cap. 10`,
    },
    {
      l: 'Separación máxima S / L',
      v: `${f1(ro.hz.s, 1)} / ${f1(ro.hz.l, 1)}`,
      u: 'm',
      nota: 'cap. 10',
    },
    {
      l: 'Área real por rociador S × L',
      v: faltaSL ? '—' : f1(ro.Areal, 1),
      u: 'ft²',
      nota: faltaSL
        ? notaSL
        : `${f1(ro.S * ro.L, 1)} m² · S = ${f1(ro.S, 2)} m, L = ${f1(ro.L, 2)} m`,
    },
    {
      l: 'Rociadores requeridos en el área',
      v: faltaSL ? '—' : `${ro.Nreq}`,
      u: 'un',
      nota: faltaSL
        ? notaSL
        : `Redondeo hacia arriba · ${ro.Nramales} ramales × ${ro.Nramal} (último: ${ro.Nultimo})${
            Nop !== null
              ? `. Red seleccionada: ${Nop} con flujo (dato de la red, no el mínimo exigido)`
              : ''
          }`,
    },
    {
      l: 'Caudal mínimo del rociador más remoto',
      v: f1(ro.Q1),
      u: 'gpm',
      nota: `${f1(ro.Q1 * 3.785411784, 1)} L/min = densidad × S × L`,
    },
    {
      l: 'Presión del rociador más remoto',
      v: f1(ro.Prem, 1),
      u: 'psi',
      nota: `${f1(ro.Prem / 1.4223, 1)} m.c.a. = máx(Pmin, (Q/K)²)`,
    },
    {
      l: 'Caudal teórico de rociadores',
      v: f1(ro.Qteo, 1),
      u: 'gpm',
      nota: `${f1((ro.Qteo * 3.785411784) / 60, 2)} L/s`,
    },
    {
      l: 'Caudal de mangueras (int. + ext.)',
      v: f1(ro.Qmang, 0),
      u: 'gpm',
      nota: 'Tabla 19.2.3.1.1',
    },
    {
      l: 'Duración del rango',
      v: ro.dmin === ro.dmax ? `${ro.dmin}` : `${ro.dmin}–${ro.dmax}`,
      u: 'min',
      nota: 'Tabla 19.2.3.1.1',
    },
    {
      l: 'Distancia máxima a muro',
      v: ro.Dmuro > 0 ? f1(ro.Dmuro, 2) : '—',
      u: 'm',
      nota:
        ro.Dmuro > 0
          ? `Entre 0,10 y ${f1(ro.hz.s / 2, 2)} m (S máx./2)`
          : 'Falta la DMR del piso base (Pisos del edificio)',
    },
  ];
}

/** Resultados de la siamesa (conexión de bomberos). Ej: el ejemplo pide 125.1 psi con 500 gpm. */
export function kvSiamesa(sia: SiaResult | null): KvRci[] {
  if (!sia)
    return [
      {
        l: 'Siamesa',
        v: '—',
        nota: 'se activa cuando el código exige montantes (Normativa local)',
      },
    ];
  return [
    {
      l: 'Presión requerida en las entradas',
      v: sia.P !== null ? f1(sia.P, 1) : '—',
      u: 'psi',
      nota:
        sia.P !== undefined && sia.Q !== null
          ? `con ${f1(sia.Q, 1)} gpm del carro de bomberos`
          : 'complete material, Ø y L de la siamesa',
    },
    { l: 'Altura de la conexión', v: f1(sia.z), u: 'm', nota: 'sobre el andén (0,46–1,22 m)' },
  ];
}

/** Resultados de bomba (NFPA 20) y tanque (NFPA 22). Ej: el ejemplo selecciona 500 gpm @ 141 psi
 *  con motor de 75 HP y tanque de 56.78 m³ gobernado por los montantes. */
export function kvBombaTanque(b: BombaResult, t: TanqueResult, gobernante: string | null): KvRci[] {
  const filas: KvRci[] = [
    {
      l: 'Demanda de rociadores (D1)',
      v: `${f1(b.D1.Q, 1)}`,
      u: 'gpm',
      nota: `${f1(b.D1.P, 1)} psi netos en la bomba`,
    },
    {
      l: 'Demanda de montantes (D2)',
      v: b.D2 ? `${f1(b.D2.Q, 1)}` : 'No aplica',
      u: b.D2 ? 'gpm' : undefined,
      nota: b.D2 ? `${f1(b.D2.P, 1)} psi netos — gobierna` : undefined,
    },
    {
      l: 'Bomba seleccionada',
      v: `${f1(b.Qnom, 0)}`,
      u: 'gpm',
      nota: `a ${f1(b.Pnom, 0)} psi (demanda ${f1(b.Qdem, 1)} gpm; margen aplicado)`,
    },
    {
      l: 'Presión a caudal cero (churn)',
      v: `${f1(b.Pchurn, 1)}`,
      u: 'psi',
      nota: `${Math.round((b.Pchurn / Math.max(1, b.Pnom)) * 100)} % de la nominal (NFPA 20: ≤ 140 %)`,
    },
    { l: 'Presión al 150 %', v: `${f1(b.P150, 1)}`, u: 'psi', nota: '≥ 65 % de la nominal' },
    {
      l: 'Motor comercial',
      v: `${f1(b.HPmot, 0)}`,
      u: 'HP',
      nota: `requeridos ${f1(Math.max(b.HPr, b.HP150), 1)} HP`,
    },
    {
      l: 'Presión máx. del sistema',
      v: `${f1(b.Pmaxsis, 1)}`,
      u: 'psi',
      nota: 'churn + nivel máximo del tanque',
    },
    {
      l: 'Jockey: arranque / parada',
      v: `${f1(b.JkStart, 0)} / ${f1(b.JkStop, 0)}`,
      u: 'psi',
      nota: `${f1(b.Qjockey, 1)} gpm; la principal arranca a ${f1(b.PpStart, 0)} psi`,
    },
    { l: 'NPSH disponible', v: f1(b.NPSHd), u: 'm', nota: `succión ${f1(b.Vsuc)} m/s al 150 %` },
    {
      l: 'Tanque contra incendio',
      v: f1(t.V, 1),
      u: 'm³',
      nota: `${t.dur} min${t.tip ? ` · gobierna ${t.tip}` : ''}${gobernante ? ` · piso gobernante ${gobernante}` : ''}`,
    },
  ];
  return filas;
}
