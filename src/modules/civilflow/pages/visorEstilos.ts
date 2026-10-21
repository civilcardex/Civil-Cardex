import type React from 'react';

/**
 * Estilos y datos estructurados de la página del visor.
 *
 * Por qué viven aquí: eran constantes de módulo dentro de `ViewerPage.tsx`, que ya
 * estaba en el tope de líneas del guard anti-monolito (700). Separarlas deja la página
 * con la LÓGICA (carga, overlay, selector de planos) y este módulo con la CAPA.
 */

/** Texto solo para lectores de pantalla (el rótulo visible va en otro elemento). */
export const ViewerPage_S1: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** Barra superior del visor. */
export const ViewerPage_S2: React.CSSProperties = {
  height: 36,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 16px',
  background: '#111317',
  borderBottom: '1px solid #3a494a',
  position: 'relative',
};

/** Botón compacto de la barra. */
export const ViewerPage_S3: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 10px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  cursor: 'pointer',
  fontFamily: 'Geist, monospace',
  fontSize: 12,
};

/** Desplegable del selector de planos. */
export const ViewerPage_S4: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  minWidth: 240,
  background: '#15171b',
  border: '1px solid #3a494a',
  borderRadius: 6,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  overflow: 'hidden',
  zIndex: 100,
};

/** Zona "soltar plano" (línea punteada). */
export const ViewerPage_S5: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  background: '#1e2024',
  border: '1px dashed #3a494a',
  borderRadius: 3,
  color: '#b9caca',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  fontWeight: 600,
  textAlign: 'center',
};

/** Botón secundario de la zona "soltar plano". */
export const ViewerPage_S6: React.CSSProperties = {
  padding: '5px 8px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#9BA8AA',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  textAlign: 'center',
};

/** Datos estructurados (JSON-LD) de la ruta /visor para los buscadores. */
export const VIEWER_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Visor de planos — CivilCardex',
  description:
    'Visor de planos PDF con superposición de redes hidrosanitarias. Herramientas de dibujo, calibración y medición.',
  url: 'https://civilcardex.com/visor',
  applicationCategory: 'ViewerApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requiere JavaScript y WebGL',
};
