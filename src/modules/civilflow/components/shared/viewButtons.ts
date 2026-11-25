/** Cluster de vistas de los visores 3D: mismas cuatro etiquetas y mismo estilo en todos
 *  (aparatos, ep (Equipo de Presion), rci (Red Contra Incendio), red RCI). Una sola fuente
 *  evita que un visor quede con tipografía o alto de botón distinto. */
import type { CSSProperties } from 'react';
import { MONO_3D } from './config3d';

/** Vistas fijas de cámara de un visor 3D. */
export type VistaKey = 'iso' | 'front' | 'side' | 'top';

/** Botones del cluster, en el orden en que se pintan. */
export const BOTONES_VISTA: Array<{ key: VistaKey; label: string }> = [
  { key: 'iso', label: 'ISO' },
  { key: 'front', label: 'FRENTE' },
  { key: 'side', label: 'LATERAL' },
  { key: 'top', label: 'PLANTA' },
];

/** Estilo de un botón del cluster: resalta la vista activa. Ej: btnVista(vista === 'iso'). */
export const btnVista = (active: boolean): CSSProperties => ({
  background: active ? '#0d1f3c' : '#161b22',
  border: `1px solid ${active ? '#1f6feb' : '#30363d'}`,
  color: active ? '#388bfd' : '#e6edf3',
  fontFamily: MONO_3D,
  fontSize: '0.68rem',
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  lineHeight: 1,
});
