/**
 * Estilos en línea del configurador de plano (modal de calibración: marcar el
 * origen físico y medir la escala). Toast superior, barra de herramientas,
 * banners de estado y botones de cada paso del panel de calibración. Los S1..S11
 * van en orden de aparición; los de nombre largo son bloques semánticos.
 */
import type { CSSProperties } from 'react';

/** Fondo del toast por severidad: err rojo, warn ámbar, ok verde. */
export const TOAST_BG: Record<string, string> = {
  err: 'rgba(211,47,47,0.9)',
  warn: 'rgba(245,158,11,0.9)',
  ok: 'rgba(14,204,122,0.9)',
};
/** Toast fijo en la parte alta del modal (verde ok por defecto) con el resultado de la última acción. */
export const PlanoConfigurator_S1: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'center',
  background: TOAST_BG.ok,
  color: '#fff',
};
/** Barra de herramientas superior del modal (título + acciones). */
export const PlanoConfigurator_S2: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '6px 14px',
  borderBottom: '1px solid var(--line)',
  flexShrink: 0,
  background: 'var(--bg)',
  minHeight: 36,
  flexWrap: 'wrap',
};
/** Select de nivel del plano (Paso 1, media fila). */
export const PlanoConfigurator_S3: CSSProperties = {
  width: '50%',
  padding: '5px 6px',
  fontSize: 12,
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  color: 'var(--txt2)',
  cursor: 'pointer',
};
/** Select de escala predefinida 1:N (fila completa, incluye la calibrada si no es estándar). */
export const PlanoConfigurator_S4: CSSProperties = {
  width: '100%',
  padding: '5px 6px',
  fontSize: 12,
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  color: 'var(--txt2)',
  cursor: 'pointer',
};
/** Botón ✕ compacto para quitar el origen marcado. */
export const PlanoConfigurator_S5: CSSProperties = {
  padding: '3px 6px',
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 2,
  color: 'var(--txt3)',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
};
/** Input de la longitud de referencia del eje X en metros (Paso 3). */
export const PlanoConfigurator_S6: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '5px 4px',
  fontSize: 12,
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  color: 'var(--txt)',
  fontFamily: 'monospace',
};
/** Línea "✓ factor X" con el botón para quitarlo (Paso 3 resuelto). */
export const PlanoConfigurator_S7: CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: 'var(--ok)',
  fontFamily: 'monospace',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};
/** Botón ✕ compacto para quitar el factor X. */
export const PlanoConfigurator_S8: CSSProperties = {
  padding: '3px 6px',
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 2,
  color: 'var(--txt3)',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
};
/** Input de la longitud de referencia del eje Y en metros (Paso 4). */
export const PlanoConfigurator_S9: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '5px 4px',
  fontSize: 12,
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  color: 'var(--txt)',
  fontFamily: 'monospace',
};
/** Línea "✓ factor Y" con el botón para quitarlo (Paso 4 resuelto). */
export const PlanoConfigurator_S10: CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: 'var(--ok)',
  fontFamily: 'monospace',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};
/** Botón ✕ compacto para quitar el factor Y. */
export const PlanoConfigurator_S11: CSSProperties = {
  padding: '3px 6px',
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 2,
  color: 'var(--txt3)',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
};
/** Base de los banners de estado del flujo (pendiente/calibrado); el color lo agrega el consumidor. */
export const PlanoConfigurator_bannerBase: CSSProperties = {
  margin: '8px 10px',
  padding: '6px 8px',
  borderRadius: 'var(--r)',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  transition: 'all 0.2s ease',
};
/** Cabecera numerada de cada paso (1. Nivel, 2. Origen…): el color lo agrega el consumidor según estado. */
export const PlanoConfigurator_stepHeader: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
/** Botón del paso "marcar origen" (el punto físico de referencia del piso). */
export const PlanoConfigurator_origenBtn: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 10.5,
  fontWeight: 600,
  borderRadius: 'var(--r)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  transition: 'all .15s',
};
/** Botón compacto del paso de trazo (dibujar una longitud conocida para medir la escala). */
export const PlanoConfigurator_trazarBtn: CSSProperties = {
  padding: '5px 4px',
  fontSize: 10.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  borderRadius: 'var(--r)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  transition: 'all .15s',
};
