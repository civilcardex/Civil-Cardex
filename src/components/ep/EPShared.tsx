import React, { useState, useRef, useEffect } from "react";
import { useEP, type EPData } from "../../context/EPContext";

import { SI } from "../../styles/sharedTableStyles";

export function LazyInp({ field, style, ariaLabel, disabled }: { field: keyof EPData; style?: React.CSSProperties; ariaLabel?: string; disabled?: boolean }) {
  const { ep, updEP } = useEP();
  const [val, setVal] = useState(() => String(ep[field] ?? ""));
  const isDirty = useRef(false);

  useEffect(() => {
    if (!isDirty.current) setVal(String(ep[field] ?? ""));
  }, [ep, field]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirty.current = true;
    const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setVal(v);
  };

  const handleBlur = () => {
    isDirty.current = false;
    updEP(field, val);
  };

  return <input type="text" disabled={disabled} inputMode="decimal" aria-label={ariaLabel} value={val} onChange={handleChange} onBlur={handleBlur} style={{...style || SI, opacity: disabled ? 0.7 : 1, cursor: disabled ? 'default' : 'text'}} />;
}

export const Param = ({ name, sub }: { name: string; sub?: string }) => (
  <div>
    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--txt)" }}>{name}</div>
    {sub && <div style={{ fontSize: 12, color: "var(--txt3)", marginTop: 1 }}>{sub}</div>}
  </div>
);

export const Comment = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 12, color: "var(--txt4)", lineHeight: 1.2, wordBreak: "break-word" }}>{children}</span>
);

