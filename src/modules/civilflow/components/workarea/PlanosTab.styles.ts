/**
 * Estilos en línea del panel "Planos" del área de trabajo (carga de planos por
 * piso, pendientes por cargar y acciones por plano: confirmar, ver, borrar).
 * Los S1..S14 son bloques anónimos en orden de aparición en el componente; los
 * de nombre largo (reqBtnBase, pendingLi, verBtn) son bloques semánticos.
 */
/** Botón "← VOLVER A CARGA DE PLANOS" de la barra del modo calibración. */
export const PlanosTab_S1: React.CSSProperties = {
  padding: '4px 12px',
  background: 'var(--bg3)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  color: 'var(--txt2)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

/** Botón verde "✓ CONFIRMAR PLANO" (cierre de la calibración). */
export const PlanosTab_S2: React.CSSProperties = {
  padding: '4px 14px',
  background: 'rgba(14,204,122,0.12)',
  border: '1.5px solid rgba(14,204,122,0.3)',
  borderRadius: 'var(--r)',
  color: '#0ECC7A',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap',
};
/** Barra superior del modo calibración: nombre + nivel del plano y sus acciones. */
export const PlanosTab_S3: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  borderBottom: '1px solid var(--line)',
  flexShrink: 0,
  background: 'var(--bg)',
  minHeight: 36,
};
/** Botón cian "DIBUJAR REDES EN ESTE PLANO →" (salta al visor con ese plano activo). */
export const PlanosTab_S4: React.CSSProperties = {
  padding: '3px 10px',
  background: 'rgba(0,220,229,0.08)',
  border: '1px solid rgba(0,220,229,0.3)',
  borderRadius: 'var(--r)',
  color: '#00dce5',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
/** Overlay punteado que cubre la zona del plano mientras arrastras un PDF encima (feedback de drag & drop). */
export const PlanosTab_S5: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 10,
  background: 'rgba(0,220,229,.12)',
  border: '3px dashed rgba(0,220,229,.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};
/** Botón-plano: la gran zona clicable del área vacía que abre el selector de archivo (bajo el aviso "Sube un plano o arrastra un PDF aquí"). */
export const PlanosTab_S6: React.CSSProperties = {
  flex: 1,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  background: 'var(--bg)',
  border: 'none',
  padding: 0,
  fontFamily: 'inherit',
  color: 'inherit',
  textAlign: 'center',
  cursor: 'pointer',
  position: 'relative',
};
/** Dropzone punteado "importar plano" del panel lateral derecho. */
export const PlanosTab_S7: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: 'rgba(0,220,229,0.06)',
  border: '1.5px dashed rgba(0,220,229,0.3)',
  borderRadius: 'var(--r)',
  color: '#00dce5',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  transition: 'all .15s',
};
/** Cabecera de la sección "Pendientes (n)" de la lista lateral. */
export const PlanosTab_S8: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--txt3)',
  borderBottom: '1px solid var(--line)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
/** Botón-zona vacía "Subir planos" de la lista de pendientes cuando aún no hay nada. */
export const PlanosTab_S9: React.CSSProperties = {
  flex: 1,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  gap: 8,
  background: 'transparent',
  border: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--txt4)',
  textAlign: 'center',
  lineHeight: 1.6,
};
/** Lista (ul) de planos pendientes de la lista lateral. */
export const PlanosTab_S10: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 10px',
  listStyle: 'none',
  margin: 0,
};
/** Botón verde "CONFIRMAR" de una fila pendiente (solo si el plano ya está calibrado). */
export const PlanosTab_S11: React.CSSProperties = {
  padding: '1px 6px',
  background: 'rgba(14,204,122,0.12)',
  border: '1px solid rgba(14,204,122,0.3)',
  borderRadius: 'var(--r)',
  color: '#0ECC7A',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
};
/** Botón rojo "ELIMINAR" de una fila pendiente. */
export const PlanosTab_S12: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 'var(--r)',
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: '#ef5350',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
};
/** Cabecera de la sección "Cargados (n)" de la lista lateral. */
export const PlanosTab_S13: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--txt3)',
  borderBottom: '1px solid var(--line)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
/** Botón rojo "ELIMINAR" de una fila cargada. */
export const PlanosTab_S14: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 'var(--r)',
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: '#ef5350',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
};
/** Base del botón "📋 Requisitos para carga": color/borde los agrega el hover del consumidor. */
export const PlanosTab_reqBtnBase: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 'var(--r)',
  cursor: 'pointer',
  fontSize: 12,
  transition: 'all .2s ease',
  marginBottom: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};
/** Tarjeta de un plano pendiente en la lista (título + acciones). */
export const PlanosTab_pendingLi: React.CSSProperties = {
  padding: '10px',
  borderRadius: 'var(--r)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  transition: 'all 0.15s ease',
};
/** Botón pequeño "VER" de una fila cargada (el color lo agrega el consumidor según la selección). */
export const PlanosTab_verBtn: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 'var(--r)',
  border: '1px solid var(--line)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
};
