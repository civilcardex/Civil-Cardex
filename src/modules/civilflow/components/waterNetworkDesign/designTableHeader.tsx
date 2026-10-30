import type { CSSProperties, ReactNode } from 'react';
import { rangoAfTxt } from '../../constants/countryStandards';

// ponytail: los 28 <th> comparten 2 estilos base (fila 1 con padding 2px, fila 2 con padding 0)
// más extras puntuales (borde inferior, anchos) — antes el literal iba repetido a mano en cada th.
const TH_FILA1: CSSProperties = { textAlign: 'center', padding: '2px 1px', fontSize: 10.5 };
const TH_FILA2: CSSProperties = { textAlign: 'center', padding: '0 1px', fontSize: 10.5 };
const BORDE_INF = { borderBottom: '2px solid var(--line)' };

/** Columna del encabezado: tooltip, rótulo (con <br/> donde lo había) y clase extra sobre col-h. */
interface ColEnc {
  title: string;
  label: ReactNode;
  /** undefined = solo col-h · 'css' = col-h + clase de color de la red · 'ok' = col-h ok (editable) */
  cls?: 'css' | 'ok';
  rowSpan?: 2;
  colSpan?: number;
  /** extras de estilo sobre el base de la fila. Ej: {minWidth: 44} del «Número de descargas». */
  th?: CSSProperties;
}

function celdaTh(col: ColEnc, base: CSSProperties, cssClass: string) {
  const cls = col.cls === 'css' ? `col-h ${cssClass}` : col.cls === 'ok' ? 'col-h ok' : 'col-h';
  return (
    <th
      key={col.title}
      title={col.title}
      scope="col"
      className={cls}
      rowSpan={col.rowSpan}
      colSpan={col.colSpan}
      style={col.th ? { ...base, ...col.th } : base}
    >
      {col.label}
    </th>
  );
}

// ponytail: fila 1 va en función porque el tooltip de «Vel.» interpola rangoAfTxt(pais).
function fila1(pais?: string): ColEnc[] {
  return [
    {
      title: 'Tramo de la red de agua (alimentador) según el dibujo.',
      label: 'Tramo',
      rowSpan: 2,
    },
    { title: 'Punto de inicio del tramo.', label: 'Inicio', cls: 'css', rowSpan: 2 },
    { title: 'Punto donde termina el tramo.', label: 'Final', cls: 'css', rowSpan: 2 },
    {
      title: 'Unidades de consumo (fixture units) que abastece el tramo.',
      label: 'Unidades Consumo',
      cls: 'css',
      colSpan: 3,
      th: BORDE_INF,
    },
    {
      title: 'Número de descargas conectadas al tramo.',
      label: (
        <>
          Número
          <br />
          de descargas
        </>
      ),
      rowSpan: 2,
      th: { minWidth: 44 },
    },
    { title: 'Coeficiente de simultaneidad K aplicado al cálculo.', label: 'K', rowSpan: 2 },
    { title: 'Caudal de diseño del tramo (L/s).', label: 'Caudal', cls: 'css', rowSpan: 2 },
    {
      title: 'Diámetro que sugiere el cálculo para el caudal. Unidad: pulgadas (").',
      label: (
        <>
          Diámetro
          <br /> estimado
        </>
      ),
      rowSpan: 2,
    },
    {
      title: 'Diámetro propuesto y su interior. Unidad: pulgadas ("); interior en mm.',
      label: 'Diámetro',
      cls: 'ok',
      colSpan: 2,
      th: BORDE_INF,
    },
    {
      title: 'Coeficiente de Hazen-Williams del material.',
      label: (
        <>
          Coeficiente
          <br />C
        </>
      ),
      rowSpan: 2,
      th: { minWidth: 40, maxWidth: 56 },
    },
    {
      title: `Velocidad del agua en el tramo (mm/s). Cumple entre ${rangoAfTxt(pais)}.`,
      label: 'Vel.',
      rowSpan: 2,
    },
    {
      title: 'Longitudes del tramo y equivalencias de accesorios (m).',
      label: 'Longitud (m)',
      colSpan: 4,
      th: BORDE_INF,
    },
    {
      title: 'Pérdida de carga por fricción en el tramo.',
      label: (
        <>
          Pérdidas
          <br />
          por
          <br />
          fricción
        </>
      ),
      colSpan: 2,
      th: { whiteSpace: 'nowrap', minWidth: 64, ...BORDE_INF },
    },
    {
      title: 'Presión disponible al inicio y al final del tramo.',
      label: 'Presión',
      cls: 'css',
      colSpan: 2,
      th: BORDE_INF,
    },
    {
      title:
        'Chequeo de presión en el aparato conectado al tramo: la presión disponible debe caer entre la mínima y la máxima del aparato (NTC 1500).',
      label: (
        <>
          Chequeo
          <br />
          presión
        </>
      ),
      cls: 'css',
      rowSpan: 2,
      th: { padding: '0 1px' },
    },
  ];
}

const FILA2: ColEnc[] = [
  { title: 'Unidades de consumo generadas en el propio tramo.', label: 'Propia', cls: 'css' },
  {
    title: 'Unidades de consumo que llegan de ramales conectados.',
    label: 'Otros Ramales',
    cls: 'css',
  },
  { title: 'Unidades de consumo acumuladas del tramo.', label: 'Total', cls: 'css' },
  {
    title: 'Diámetro comercial propuesto — editable. Unidad: pulgadas (").',
    label: 'Diseño',
    cls: 'ok',
  },
  { title: 'Diámetro interior del tubo propuesto (mm).', label: 'Interno', cls: 'ok' },
  { title: 'Longitud del tramo en horizontal (m).', label: 'Horizontal' },
  { title: 'Longitud del tramo en vertical (m).', label: 'Vertical' },
  { title: 'Longitud equivalente de los accesorios instalados (m).', label: 'Eq. Accesorios' },
  { title: 'Longitud total desarrollada del tramo (m).', label: 'Total' },
  {
    title: 'Pérdida de carga del tramo en ‰ (m por kilómetro de tubería).',
    label: '‰',
    th: { fontSize: 12.5 },
  },
  { title: 'Pérdida de carga en metros de columna de agua.', label: 'm' },
  { title: 'Presión disponible al inicio del tramo.', label: 'Inicial', cls: 'css' },
  { title: 'Presión disponible al final del tramo.', label: 'Final', cls: 'css' },
];

/** Encabezado estático de la tabla de diseño de red: dos filas y 24 columnas con celdas
 *  combinadas. No tiene lógica; solo la clase de color de la red activa. */
export function DesignTableHeader({ cssClass, pais }: { cssClass: string; pais?: string }) {
  return (
    <thead>
      <tr>{fila1(pais).map((col) => celdaTh(col, TH_FILA1, cssClass))}</tr>
      <tr>{FILA2.map((col) => celdaTh(col, TH_FILA2, cssClass))}</tr>
    </thead>
  );
}
