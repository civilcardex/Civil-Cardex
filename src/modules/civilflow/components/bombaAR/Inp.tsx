import React from "react";
import { SI } from "../../styles/sharedTableStyles";

const nv = (s: string) => s === '' ? '' : /^[\d]*\.?[\d]*$/.test(s) ? s : false;
const oc = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { const v = nv(e.target.value); if (v !== false) set(v) };

export default function Inp({ v, set, style, disabled, ariaLabel }: { v: string; set: (v: string) => void; style?: React.CSSProperties; disabled?: boolean; ariaLabel?: string }) {
  return <input type="text" inputMode="decimal" aria-label={ariaLabel} value={v} onChange={oc(set)} disabled={disabled} style={{ ...(style || SI), opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'text' }} />;
}
