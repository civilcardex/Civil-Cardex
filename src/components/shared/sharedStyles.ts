/** Estilos compartidos de accesibilidad/formularios usados por muchas pantallas.
 *  ponytail: 21 copias inline del mismo objeto sr-only y 3 del aviso de error de auth. */

/** Oculta el elemento visualmente pero lo deja legible por lectores de pantalla (patrón sr-only de Tailwind). */
export const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** Aviso de error de los formularios de auth (login/registro/restablecer). */
export const AUTH_ERROR_STYLE: React.CSSProperties = {
  color: '#F04545',
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  textAlign: 'center',
  padding: '8px',
  background: 'rgba(240,69,69,.08)',
  border: '1px solid rgba(240,69,69,.2)',
  borderRadius: 4,
};
