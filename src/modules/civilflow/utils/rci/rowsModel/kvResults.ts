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
 *  referencia). qrTxt/sistemaTxt llegan de st.clas (no viven en Criterios).
 *  Ej: con el ejemplo, «Área adoptada» = 1.066,2 ft² (QR −29 %). */
export function kvRociadorDiseno(ro: Criterios, qrTxt: string, sistemaTxt: string): KvRci[] {
  return [
    {
      l: 'Tipo: ¿respuesta rápida?',
      v: qrTxt,
      nota: 'reduce el área en húmedo, riesgo leve u ordinario y techo ≤ 6,1 m',
    },
    { l: 'Factor K', v: f1(ro.K, 1), u: 'gpm/psi½' },
    { l: 'Presión mínima', v: f1(ro.Pmin, 1), u: 'psi', nota: 'mín. 7 psi o la del listado' },
    {
      l: 'Sistema',
      v: sistemaTxt,
      nota: sistemaTxt === 'Seco' ? 'área +30 %, C acero 100' : undefined,
    },
    {
      l: 'Densidad',
      v: `${ro.hz.d.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`,
      u: 'gpm/ft²',
      nota: ro.hz.d === ro.hz.a ? undefined : `área base ${f1(ro.hz.a, 0)} ft²`,
    },
    { l: 'Área base', v: f1(ro.hz.a, 0), u: 'ft²', nota: 'punto único de la Tabla 19.2.3.1.1' },
    {
      l: 'Reducción QR',
      v: ro.RedQR > 0 ? `${f1(ro.RedQR * 100, 0)} %` : '—',
      nota: 'solo sistema húmedo; área mínima 768 ft²',
    },
    {
      l: 'Factor sistema seco',
      v: ro.FSeco > 1 ? `${f1(ro.FSeco, 2)}` : '—',
      nota: ro.FSeco > 1 ? 'área +30 %' : 'sistema húmedo o pendiente ≤ 2:12',
    },
    { l: 'Área adoptada', v: f1(ro.Adis, 1), u: 'ft²', nota: `${f1(ro.Adis * 0.092903, 1)} m²` },
  ];
}

/** Criterios de rociadores — tabla 2 «Cobertura y caudales» (9 filas, orden del HTML).
 *  Ej: con el ejemplo, «Rociadores exigidos» = 7 (3 ramales × 3; 7 con flujo). */
export function kvRociadorCobertura(ro: Criterios, Nop: number | null): KvRci[] {
  return [
    {
      l: 'Cobertura máxima por rociador',
      v: f1(ro.Acmax, 0),
      u: 'ft²',
      nota: 'según el techo (225/168/130 en leve)',
    },
    { l: 'S, L máximos', v: `${f1(ro.hz.s, 1)} / ${f1(ro.hz.l, 1)}`, u: 'm' },
    {
      l: 'S × L real',
      v: `${f1(ro.S)} × ${f1(ro.L)}`,
      u: 'm',
      nota: `área real ${f1(ro.Areal, 1)} ft²`,
    },
    {
      l: 'Rociadores exigidos en el área',
      v: `${ro.Nreq}`,
      nota:
        Nop !== null
          ? `${Nop} con flujo en la red`
          : `${ro.Nramales} ramales × ${ro.Nramal} (último: ${ro.Nultimo})`,
    },
    { l: 'Rociador más remoto', v: f1(ro.Q1), u: 'gpm', nota: `a ${f1(ro.Prem)} psi` },
    {
      l: 'Presión del más remoto',
      v: f1(ro.Prem, 1),
      u: 'psi',
      nota: `K ${f1(ro.K, 1)} @ Pmin ${f1(ro.Pmin, 1)}`,
    },
    { l: 'Caudal teórico', v: f1(ro.Qteo, 1), u: 'gpm' },
    {
      l: 'Mangueras (adicionales)',
      v: f1(ro.Qmang, 0),
      u: 'gpm',
      nota: `tabla: ${ro.hz.hose} gpm`,
    },
    {
      l: 'Duración (mín–máx)',
      v: ro.dmin === ro.dmax ? `${ro.dmin}` : `${ro.dmin}–${ro.dmax}`,
      u: 'min',
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
