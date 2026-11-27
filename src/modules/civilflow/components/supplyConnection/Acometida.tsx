import React from 'react';
import { SeccionFlujoHidraulico } from './FlowSection.tsx';
import TableScroll from '../shared/TableScroll.tsx';
import type { AcometidaProps } from './types.ts';
import { SCROLL_INNER } from './styles.ts';
import { SeccionResumenParametros } from './ParametersSection.tsx';
import { SeccionVerificacion } from './VerificationSection.tsx';

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
      <TableScroll label="Tablas de acometida" className="san-pad-16">
        <div className="scroll-inner" style={SCROLL_INNER}>
          <SeccionFlujoHidraulico {...props} />
          <SeccionResumenParametros {...props} />
          <SeccionVerificacion {...props} />
        </div>
      </TableScroll>
    </section>
  );
}

export default React.memo(Acometida);
