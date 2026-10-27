// Estilos compartidos de las tablas de aguas lluvias (th compactos con wrap a 2-3 líneas).
import React from 'react';

/** th compacto (orig. usuario: la tabla sin scroll horizontal): wrap + minWidth por celda
 *  — sin él, con 18 columnas las palabras parten a la mitad ('MATERIA-L'). */
export const thC: React.CSSProperties = {
  fontSize: 9.5,
  textAlign: 'center',
  padding: '2px 3px',
  whiteSpace: 'normal',
  minWidth: 52,
  hyphens: 'auto',
  overflowWrap: 'anywhere',
};

/** Variante de grupo (bold). */
export const thCg: React.CSSProperties = { ...thC, fontWeight: 700, letterSpacing: 0.3 };
