import React from 'react';
import { Link } from 'react-router-dom';

const ESTILO: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  height: '100%',
  padding: 24,
  textAlign: 'center',
};

const AVISO_ESTILO: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 16px',
  background: 'rgba(180, 83, 9, 0.15)',
  border: '1px solid rgba(217, 119, 6, 0.4)',
  borderRadius: 6,
  color: '#fbbf24',
  fontSize: 13,
  fontFamily: 'var(--body)',
};

/** Enlace legacy (id sin formato uuid, de antes del cambio a identificadores universales):
 *  aviso centrado SIN workspace/visor montado — abrir el activo en silencio haría que el
 *  usuario dibuje en el proyecto equivocado. Compartido por el visor y el workarea. */
export function EnlaceLegacyBanner() {
  return (
    <main className="h-full" style={ESTILO}>
      <h1 className="sr-only">Área de trabajo</h1>
      <div role="alert" style={AVISO_ESTILO}>
        Este enlace corresponde a una versión antigua del proyecto — ábrelo desde tu lista de
        proyectos.
      </div>
      <Link to="/perfil" style={{ color: 'var(--acc, #4d8ff7)', fontSize: 13, fontWeight: 600 }}>
        Ir a mis proyectos
      </Link>
    </main>
  );
}
