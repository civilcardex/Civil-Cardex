import React from 'react';
import { SeccionFlujoHidraulico } from './FlujoSeccion.tsx';
import type { AcometidaProps } from './tipos.ts';
import { SCROLL_INNER } from './estilos.ts';
import { SeccionResumenParametros } from './ParametrosSeccion.tsx';
import { SeccionVerificacion } from './VerificationSeccion.tsx';

/** La tabla de acometida: tres secciones (flujo hidráulico, resumen de parámetros y
 *  verificación final). Cada sección vive en su propio archivo. */
function Acometida(props: AcometidaProps) {
  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/general/Acometida.webp"
            alt="Acometida"
            width={24}
            height={24}
            style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
            loading="lazy"
          />{' '}
          Acometida
        </h3>
      </div>
      <div className="scroll-top" style={{ padding: '16px' }}>
        <div className="scroll-inner" style={SCROLL_INNER}>
          <SeccionFlujoHidraulico {...props} />
          <SeccionResumenParametros {...props} />
          <SeccionVerificacion {...props} />
        </div>
      </div>
    </section>
  );
}

export default React.memo(Acometida);
