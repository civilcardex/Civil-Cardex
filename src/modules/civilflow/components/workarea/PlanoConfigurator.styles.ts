import type { CSSProperties } from "react";

export const TOAST_BG: Record<string, string> = { err: 'rgba(211,47,47,0.9)', warn: 'rgba(245,158,11,0.9)', ok: 'rgba(14,204,122,0.9)' };
export const PlanoConfigurator_S1: CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: '6px 14px', fontSize: 12, fontWeight: 600, textAlign: 'center', background: TOAST_BG.ok, color: '#fff', };
export const PlanoConfigurator_S2: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg)', minHeight: 36, flexWrap: 'wrap' };
export const PlanoConfigurator_S3: CSSProperties = { width: '50%', padding: '5px 6px', fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer' };
export const PlanoConfigurator_S4: CSSProperties = { width: '100%', padding: '5px 6px', fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer' };
export const PlanoConfigurator_S5: CSSProperties = { padding: '3px 6px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 12, lineHeight: 1 };
export const PlanoConfigurator_S6: CSSProperties = { flex: 1, minWidth: 0, padding: '5px 4px', fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt)', fontFamily: 'monospace' };
export const PlanoConfigurator_S7: CSSProperties = { marginTop: 3, fontSize: 12, color: 'var(--ok)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' };
export const PlanoConfigurator_S8: CSSProperties = { padding: '3px 6px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 12, lineHeight: 1 };
export const PlanoConfigurator_S9: CSSProperties = { flex: 1, minWidth: 0, padding: '5px 4px', fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt)', fontFamily: 'monospace' };
export const PlanoConfigurator_S10: CSSProperties = { marginTop: 3, fontSize: 12, color: 'var(--ok)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' };
export const PlanoConfigurator_S11: CSSProperties = { padding: '3px 6px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 12, lineHeight: 1 };
export const PlanoConfigurator_bannerBase: CSSProperties = {
  margin: '8px 10px', padding: '6px 8px', borderRadius: 'var(--r)', textAlign: 'center',
  fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, transition: 'all 0.2s ease',
};
export const PlanoConfigurator_stepHeader: CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
export const PlanoConfigurator_origenBtn: CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 10.5, fontWeight: 600, borderRadius: 'var(--r)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all .15s',
};
export const PlanoConfigurator_trazarBtn: CSSProperties = {
  padding: '5px 4px', fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 'var(--r)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .15s',
};
export const PlanoConfigurator_S12: CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: 'var(--bg3)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, color: 'var(--txt2)' };
export const PlanoConfigurator_S13: CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: 'var(--bg3)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, color: 'var(--txt2)' };
