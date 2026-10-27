import React from 'react';
import { SI } from '../../styles/sharedTableStyles.ts';
import { LazyDecimalInput } from '../shared/LazyDecimalInput.tsx';

/** Datos del formulario del módulo ep (Equipo de Presión): caudales, alturas y pérdidas,
 *  presiones (mín/máx), geometría de cisterna y parámetros de bomba. Todo texto (campos de
 *  entrada); lo comparten las 3 páginas del módulo (entrada, tanque, verificación). */
export interface EPData {
  qac: string;
  qasc: string;
  hfac: string;
  hfacs: string;
  hfotros: string;
  pred: string;
  pmin: string;
  pmax: string;
  zbomba: string;
  ztop: string;
  zcis: string;
  hfcis: string;
  nt: string;
  nr: string;
  etab: string;
  etam: string;
  fs: string;
  ciclos: string;
  alfa: string;
  vsuc: string;
  vimp: string;
  dnsuc: string;
  dnimp: string;
  modo: 'red' | 'cisterna';
  pcomercial: string;
  /** Cisterna — volumetría (Excel hoja CISTERNA sección 2). */
  dotL: string;
  nUsuarios: string;
  diasAut: string;
  bciL: string;
  /** Cisterna — NPSH (Excel hoja CISTERNA sección 3). */
  patm: string;
  pv: string;
  npshr: string;
}

/** Semilla del formulario ep (Equipo de Presión): trae los valores típicos de norma ya puestos
 *  (presión mínima 5 m.c.a., eficiencia de bomba 0.65, factor de seguridad 1.15) y el resto
 *  vacío para que el usuario llene lo de SU proyecto. */
export const EP_DEFAULTS: EPData = {
  qac: '',
  qasc: '',
  hfac: '',
  hfacs: '',
  hfotros: '',
  pred: '',
  pmin: '5',
  pmax: '51',
  zbomba: '',
  ztop: '',
  zcis: '',
  hfcis: '',
  nt: '1',
  nr: '1',
  etab: '0.65',
  etam: '0.85',
  fs: '1.15',
  ciclos: '6',
  alfa: '0.30',
  vsuc: '1.5',
  vimp: '2.0',
  dnsuc: '',
  dnimp: '',
  modo: 'red',
  pcomercial: '',
  dotL: '200',
  nUsuarios: '',
  diasAut: '1',
  bciL: '0',
  patm: '',
  pv: '0.24',
  npshr: '',
};

/** Entrada decimal ligada a un campo de EPData: solo commitea al perder el foco, así el
 *  recálculo del módulo ep (Equipo de Presión) no corre con cada tecla. Ej: el campo Presión
 *  mínima es <LazyInp field="pmin" … />. */
export function LazyInp({
  field,
  style,
  ariaLabel,
  disabled,
  ep,
  updEP,
}: {
  field: keyof EPData;
  style?: React.CSSProperties;
  ariaLabel?: string;
  disabled?: boolean;
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
}) {
  return (
    <LazyDecimalInput
      value={String(ep[field] ?? '')}
      onCommit={(v) => updEP(field, v)}
      ariaLabel={ariaLabel}
      disabled={disabled}
      style={{
        ...(style || SI),
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? 'default' : 'text',
      }}
    />
  );
}

/** Etiqueta de un parámetro del formulario ep (Equipo de Presión): nombre en negrita y, si hay,
 *  subtítulo aclaratorio pequeño debajo (ej: unidad o fórmula). */
export const Param = ({ name, sub }: { name: string; sub?: React.ReactNode }) => (
  <div>
    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>{name}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>{sub}</div>}
  </div>
);

/** Nota gris pequeña del formulario ep (Equipo de Presión): aclaraciones que no son campos,
 *  ej: "Se consideran pérdidas por el método de Hazen-Williams". */
export const Comment = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      fontSize: 12,
      color: 'var(--txt3)',
      lineHeight: 1.2,
      wordBreak: 'break-word',
      whiteSpace: 'normal',
    }}
  >
    {children}
  </span>
);
