/**
 * Estilos de las secciones del panel de conexión/acometida (Acometida,
 * FlowSection, ParametersSection, VerificationSection): tarjetas con cabecera,
 * mini-tablas de parámetros (valor | unidad) y selects embebidos compactos.
 */
import React from 'react';

/** Ped. usuario: sin EDITAR la celda es texto plano (sin borde ni fondo). */
export const estiloPlano: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontWeight: 600,
};

/** Fila resultado compacta en monospace 9 px (rótulo a la izquierda, caudal/valor a la derecha). */
export const SupplyConnection_S1: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  lineHeight: 1.4,
  color: 'var(--txt2)',
  background: 'var(--bg3)',
  padding: '8px',
  borderRadius: '4px',
  border: '1px solid var(--line)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

/** Select oscuro centrado embebido en las mini-tablas de parámetros (textAlignLast centra la opción). */
export const SupplyConnection_S2: React.CSSProperties = {
  width: '100%',
  padding: '3px 4px',
  border: '1px solid #3a494a',
  borderRadius: 3,
  background: '#1e2024',
  color: '#e2e2e8',
  fontSize: 11,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  textAlign: 'center',
  textAlignLast: 'center',
};

/** Columna-tarjeta de una sección (borde, fondo, esquinas recortadas por overflow). */
export const SECTION_COL: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  overflow: 'hidden',
  background: 'var(--bg)',
};

export const SECTION_HDR: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--line)',
  background: 'var(--bg2)',
};

export const SECTION_H4: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--txt)',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

export const TH_CENTER: React.CSSProperties = { textAlign: 'center', padding: '2px 6px' };

export const TD_PARAM_LABEL: React.CSSProperties = {
  padding: '2px 8px',
  textAlign: 'left',
  fontWeight: 600,
};

export const TD_PARAM_VALUE: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--txt2)',
  fontWeight: 600,
  padding: '1px 2px',
};

export const TD_PARAM_UNIT: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--txt3)',
  padding: '1px 2px',
};

/** Envoltorio flexible (wrap, gap 16 px) del área con scroll donde se acomodan las tarjetas de sección. */
export const SCROLL_INNER: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  alignItems: 'stretch',
  paddingBottom: '16px',
};
