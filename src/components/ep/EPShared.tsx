import React, { useState, useRef, useEffect } from "react";
import { useEP, type EPData } from "../../context/EPContext";
import { parseDecimalInput } from "../../utils/parseDecimal";

export const dec = (s: string) => parseDecimalInput(s) || 0;

export const SI: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 3, background: "var(--bg4)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--txt)", width: "100%", boxSizing: "border-box", textAlign: "center", outline: "none", padding: "3px 5px" };

export function LazyInp({ field, style, ariaLabel }: { field: keyof EPData; style?: React.CSSProperties; ariaLabel?: string }) {
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

  return <input type="text" inputMode="decimal" aria-label={ariaLabel} value={val} onChange={handleChange} onBlur={handleBlur} style={style || SI} />;
}

export const Fmt = (v: any, u = "") => {
  if (v === "" || v === null || v === undefined) return <span style={{ color: "var(--txt3)", fontSize: 11 }}>—</span>;
  const val = typeof v === "number" ? v.toFixed(2) : v;
  return <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{val}{u ? ` ${u}` : ""}</span>;
};

export const Param = ({ name, sub }: { name: string; sub?: string }) => (
  <div>
    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--txt)" }}>{name}</div>
    {sub && <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 1 }}>{sub}</div>}
  </div>
);

export const Comment = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 9, color: "var(--txt4)", lineHeight: 1.2, wordBreak: "break-word" }}>{children}</span>
);

export const FLEX_COL: React.CSSProperties = { display: "flex", flexDirection: "column" };
