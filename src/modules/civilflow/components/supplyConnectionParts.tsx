import React from 'react';
import { LazyDecimalInput } from './shared/LazyDecimalInput';
/** Caption visualmente oculto de la tabla de acometida. */
export const SupplyConnection_S1: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  lineHeight: 1.4,
  color: 'var(--txt2)',
  background: 'var(--bg3)',
  padding: '8px',
  borderRadius: '4px',
  border: '1px solid var(--line)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
/** Estilo del selector de diámetro de la acometida. */
export const SupplyConnection_S2: React.CSSProperties = {
  width: '100%',
  padding: '3px 4px',
  border: '1px solid #3a494a',
  borderRadius: 3,
  background: '#1e2024',
  color: '#e2e2e8',
  fontSize: 11,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  textAlign: 'center',
  textAlignLast: 'center',
};

/** Resultado físico de una fila de acometida: diámetro interno, velocidad, longitudes, pérdidas y presión final. */
export interface FilaResult {
  dInt: number;
  V: number;
  Lt: number;
  hfPct: number;
  hfM: number;
  Pfin: number;
}

/** Longitudes de un tramo de acometida: horizontal, vertical y equivalente de accesorios. */
export interface LData {
  h: number;
  v: number;
  le: number;
}

/** Selección de contador del catálogo para la acometida. */
export interface ContadorSel {
  dn?: string;
  q?: number;
}

/** Opción de diámetro: pulgadas, nombre nominal, etiqueta y diámetro interno. */
export interface DiamOpt {
  pulg: number;
  label: string;
  dInt: number;
  nominal?: string;
}

/** Props del panel Acometida: valores y setters del formulario, filas resueltas y validaciones de presión. */
export interface AcometidaProps {
  Qaco: number;
  contadorSel: ContadorSel;
  acoContIx: number;
  setAcoContIx: (ix: number) => void;
  acoMonName: string;
  setAcoMonName: (name: string) => void;
  acoRedContDiam: string;
  acoContMonDiam: string;
  acoL1: LData;
  setAcoL1: (fn: (s: LData) => LData) => void;
  acoL2: LData;
  setAcoL2: (fn: (s: LData) => LData) => void;
  acoPini: number;
  setAcoPini: (p: number) => void;
  acoHfMax: number;
  setAcoHfMax: (v: number) => void;
  acoLeMed: number;
  setAcoLeMed: (le: number) => void;
  cHW1: number;
  cHW2: number;
  f1: FilaResult;
  f2: FilaResult;
  hfContador: number;
  pResidual: number;
  okPresion: boolean;
  AF_DIAM_OPTS: DiamOpt[];
  isTr1Drawn?: boolean;
  isTr2Drawn?: boolean;
  onContDiamChange?: (val: string) => void;
}

/** Contenedor de una sección de la tabla de acometida. */
export const SECTION_COL: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  overflow: 'hidden',
  background: 'var(--bg)',
};
/** Encabezado de sección de la tabla de acometida. */
export const SECTION_HDR: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--line)',
  background: 'var(--bg2)',
};
/** Título de sección de la tabla de acometida. */
export const SECTION_H4: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--txt)',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
/** Celda de encabezado centrada de la tabla de acometida. */
export const TH_CENTER: React.CSSProperties = { textAlign: 'center', padding: '2px 6px' };
/** Celda de nombre de parámetro de la tabla de acometida. */
export const TD_PARAM_LABEL: React.CSSProperties = {
  padding: '2px 8px',
  textAlign: 'left',
  fontWeight: 600,
};
/** Celda de valor de parámetro de la tabla de acometida. */
export const TD_PARAM_VALUE: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--txt2)',
  fontWeight: 600,
  padding: '1px 2px',
};
/** Celda de unidad de parámetro de la tabla de acometida. */
export const TD_PARAM_UNIT: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--txt3)',
  padding: '1px 2px',
};
/** Contenedor desplazable interior de la sección. */
export const SCROLL_INNER: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  alignItems: 'stretch',
  paddingBottom: '16px',
};

/** Input numérico perezoso: solo avisa el cambio al salir del campo (blur/Enter), para no pelear con el valor formateado mientras se escribe. */
export function LazyNum({
  value,
  onChange,
  ariaLabel,
  style,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <LazyDecimalInput
      value={value?.toString() ?? ''}
      onCommit={(raw) => {
        const p = parseFloat(raw);
        onChange(Number.isFinite(p) ? p : 0);
      }}
      ariaLabel={ariaLabel}
      style={style}
      className={className}
    />
  );
}
