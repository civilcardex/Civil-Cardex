import React from "react";
import { useEP, type EPData } from "../../context/EPContext";

import { SI } from "../../styles/sharedTableStyles";
import { LazyDecimalInput } from "../shared/LazyDecimalInput";

export function LazyInp({ field, style, ariaLabel, disabled }: { field: keyof EPData; style?: React.CSSProperties; ariaLabel?: string; disabled?: boolean }) {
  const { ep, updEP } = useEP();
  return (
    <LazyDecimalInput
      value={String(ep[field] ?? "")}
      onCommit={(v) => updEP(field, v)}
      ariaLabel={ariaLabel}
      disabled={disabled}
      style={{ ...(style || SI), opacity: disabled ? 0.7 : 1, cursor: disabled ? 'default' : 'text' }}
    />
  );
}

export const Param = ({ name, sub }: { name: string; sub?: React.ReactNode }) => (
  <div>
    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--txt)" }}>{name}</div>
    {sub && <div style={{ fontSize: 12, color: "var(--txt3)", marginTop: 1 }}>{sub}</div>}
  </div>
);

export const Comment = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 12, color: "var(--txt3)", lineHeight: 1.2, wordBreak: "break-word", whiteSpace: "normal" }}>{children}</span>
);

