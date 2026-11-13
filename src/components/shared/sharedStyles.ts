/** Estilos compartidos de accesibilidad/formularios usados por muchas pantallas.
 *  ponytail: 21 copias inline del mismo objeto sr-only y 3 del aviso de error de auth. */

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
