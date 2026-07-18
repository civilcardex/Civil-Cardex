import type { ReactNode, CSSProperties } from "react";

export const subHeadingStyle = {
  fontFamily: "var(--mono)",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--txt)",
  margin: "16px 0 10px 0",
  letterSpacing: "0.3px",
};

const tabBtnBaseStyle: CSSProperties = {
  flex: 1, padding: "14px 18px", borderRadius: "var(--r)",
  border: "1px solid", cursor: "pointer", fontSize: 15,
  fontFamily: "var(--body)", transition: "all .15s",
};

export function TabBtn({ active, onClick, children, id }: { active: boolean; onClick: () => void; children?: ReactNode; id?: string }) {
  return (
    <button type="button" id={id} onClick={onClick} role="tab" aria-selected={active}
      style={{
        ...tabBtnBaseStyle,
        fontWeight: active ? 700 : 400,
        borderColor: active ? "var(--acc2)" : "var(--line)",
        background: active ? "var(--bg3)" : "transparent",
      }}
    >{children}</button>
  );
}

export function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        flex: 1, padding: "12px 16px", borderRadius: "var(--r)",
        border: "1px solid", cursor: "pointer", fontSize: 14,
        fontWeight: active ? 600 : 400,
        borderColor: active ? "var(--acc2)" : "var(--line)",
        background: active ? "rgba(27,110,243,.08)" : "transparent",
        transition: "background-color .15s, border-color .15s",
      }}
    >{children}</button>
  );
}
