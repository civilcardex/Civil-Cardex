import type React from 'react';

const CARGANDO_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  height: '100%',
  minHeight: 120,
  color: 'var(--txt2)',
  fontSize: 13,
};

/** Pantalla de carga GLOBAL del proyecto (workarea + visor): una sola pieza para el gate de
 *  datos (useProyectoCargado) y para la espera del render del PDF en el visor. */
export function CargandoProyecto({ texto = 'Cargando proyecto…' }: { texto?: string }) {
  return (
    <div role="status" style={CARGANDO_STYLE}>
      <span className="sp" aria-hidden="true" />
      {texto}
    </div>
  );
}
