import React from 'react';
import { SI } from '../../styles/sharedTableStyles';
import { LazyDecimalInput } from '../shared/LazyDecimalInput';

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
}

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
};

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

export const Param = ({ name, sub }: { name: string; sub?: React.ReactNode }) => (
  <div>
    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>{name}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>{sub}</div>}
  </div>
);

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
