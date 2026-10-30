/**
 * Estilos del panel de aparatos (FixturesPanel) como constantes de módulo: se crean UNA vez
 * al cargar, no en cada render. Los que dependen del color de la red (accent) o del pulso de
 * selección son funciones puras que devuelven el MISMO objeto que antes se escribía inline.
 * Ej: containerStyle(true, '#2563EB') pinta el fondo azul del pulso al seleccionar un ramal.
 */
import type { CSSProperties } from 'react';

/** Botón-cabecera plegable del panel (misma fila para título, total y flecha). */
export const FixturesPanel_S1: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px 8px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  overflow: 'hidden',
};
/** Título " Aparatos" en mayúsculas con corte por elipsis. */
export const FixturesPanel_S2: CSSProperties = {
  fontFamily: "'Geist',monospace",
  fontSize: 12,
  color: 'var(--txt3)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
/** Línea "Asignado a X" bajo la cabecera. */
export const FixturesPanel_S3: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  color: 'var(--txt2)',
  fontFamily: "'Geist',monospace",
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
  padding: '0 2px',
};
/** Mitad izquierda de la cabecera: punto de color + título. */
export const FIXTURES_HEADER_IZQ: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  overflow: 'hidden',
};
/** Mitad derecha de la cabecera: total + flecha de plegado. */
export const FIXTURES_HEADER_DER: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 1,
  minWidth: 0,
};
/** Flecha ▾/▸ del plegado. */
export const FIXTURES_CHEVRON: CSSProperties = {
  fontSize: 12,
  color: 'var(--txt2)',
  fontFamily: "'Geist',monospace",
  flexShrink: 0,
};
/** Relleno del cuerpo abierto del panel. */
export const FIXTURES_CUERPO: CSSProperties = { padding: '0 10px 10px' };
/** Mensaje "Selecciona un ramal/bajante en el dibujo" (sin selección). */
export const FIXTURES_SIN_SEL: CSSProperties = {
  fontSize: 12,
  color: 'var(--txt2)',
  fontFamily: "'Geist',monospace",
  textAlign: 'center',
  marginBottom: 6,
  padding: '2px 0',
};
/** Nota centrada (contador no aplica / red sin aparatos). */
export const FIXTURES_NOTA: CSSProperties = {
  fontSize: 12,
  color: 'var(--txt3)',
  padding: '24px 0',
  textAlign: 'center',
};
/** Bloque plano cuando la red activa no cuantifica aparatos: contenedor exterior. */
export const FIXTURES_NOCUANTIFICA: CSSProperties = {
  padding: '10px 12px 8px',
  borderBottom: '1px solid #3a494a',
};
/** Título del bloque no-cuantifica. */
export const FIXTURES_NOCUANTIFICA_TIT: CSSProperties = {
  fontFamily: "'Geist',monospace",
  fontSize: 12,
  color: 'var(--txt3)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 1,
};
/** Texto del bloque no-cuantifica. */
export const FIXTURES_NOCUANTIFICA_TXT: CSSProperties = {
  fontSize: 12,
  color: 'var(--txt2)',
  fontFamily: "'Geist',monospace",
  padding: '4px 0',
  lineHeight: 1.5,
};

/**
 * Contenedor del panel: borde inferior + pulso azul al cambiar de selección.
 * Ej: containerStyle(true, '#e8c84a') enciende el resplandor del borde en dorado.
 */
export const containerStyle = (pulse: boolean, accent: string): CSSProperties => ({
  borderBottom: '1px solid #3a494a',
  background: pulse ? 'rgba(37,99,235,.10)' : 'transparent',
  transition: 'background .8s ease',
  boxShadow: pulse ? `inset 0 0 0 1px ${accent}` : 'none',
});

/**
 * Punto de color de la cabecera: encendido (disco del color de la red) o apagado (anillo gris).
 * Ej: dotStyle(false, '#2563EB') dibuja el anillo vacío cuando no hay selección.
 */
export const dotStyle = (isActive: boolean, accent: string): CSSProperties => ({
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: isActive ? accent : 'transparent',
  border: isActive ? 'none' : '1px solid #3a494a',
  flexShrink: 0,
  boxShadow: isActive ? `0 0 8px ${accent}` : 'none',
});

/**
 * Insignia del total de unidades (UC o UD) junto al título, teñida con el color de la red.
 * Ej: badgeStyle('#2563EB') -> píldora azul con borde translúcido.
 */
export const badgeStyle = (accent: string): CSSProperties => ({
  fontSize: 12,
  fontWeight: 700,
  color: accent,
  fontFamily: "'Geist',monospace",
  background: 'rgba(37,99,235,.1)',
  border: `1px solid ${accent}55`,
  borderRadius: 3,
  padding: '1px 7px',
  whiteSpace: 'nowrap',
});

/**
 * Atenuado del cuerpo del panel: sin selección casi apagado (0.45), heredado/propagado en
 * solo-lectura (0.55), normal al resto.
 * Ej: gridWrapperStyle(false, false) -> opacity 0.45 + pointer-events none.
 */
export const gridWrapperStyle = (hasTarget: boolean, propagado: boolean): CSSProperties => ({
  opacity: !hasTarget ? 0.45 : propagado ? 0.55 : 1,
  pointerEvents: hasTarget ? 'auto' : 'none',
  transition: 'opacity .25s',
  filter: hasTarget ? 'none' : 'grayscale(.6)',
});
