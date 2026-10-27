import { Link } from 'react-router-dom';
import LegalShell from './LegalShell.tsx';
import { LEGAL_H2, LEGAL_P } from './LegalShell.tsx';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { metaDeRuta } from '../seo/routeMeta.ts';

/** Página pública de Política de Tratamiento de Datos Personales (Ley 1581 de 2012).
 *  Contenido inline con placeholders [ENTRE CORCHETES] editable por el titular (ponytail). */

function PrivacyPage() {
  usePageMeta(metaDeRuta('/privacidad')?.title, metaDeRuta('/privacidad')?.description);
  return (
    <LegalShell
      titulo="Política de Privacidad"
      subtitulo={<>Tratamiento de datos personales · Ley 1581 de 2012 · [FECHA]</>}
    >
      <h2 style={LEGAL_H2}>1. Responsable del tratamiento</h2>
      <p style={LEGAL_P}>
        <strong>[RAZÓN SOCIAL]</strong>, identificado con NIT <strong>[NIT]</strong>, con domicilio
        en <strong>[CIUDAD, DEPARTAMENTO], Colombia</strong>, correo electrónico de contacto{' '}
        <strong>[CORREO DE CONTACTO]</strong> (en adelante, &laquo;el Responsable&raquo;).
      </p>

      <h2 style={LEGAL_H2}>2. Datos que se tratan</h2>
      <p style={LEGAL_P}>
        Nombre, correo electrónico, contraseña cifrada (inaccesible incluso para el Responsable) e
        información profesional que el Usuario registre voluntariamente (profesión, matrícula
        profesional, teléfono). Adicionalmente, los contenidos técnicos que el Usuario carga o
        genera en la Plataforma (planos, trazados, memorias de cálculo, presupuestos). Los datos de
        instrumentos de pago NO son tratados por el Responsable: los procesa exclusivamente la
        pasarela de pagos bajo su propia certificación de seguridad.
      </p>

      <h2 style={LEGAL_H2}>3. Finalidades del tratamiento</h2>
      <p style={LEGAL_P}>
        (i) Prestación del servicio: autenticación, almacenamiento de proyectos, planos, cálculos y
        presupuestos del Usuario; (ii) gestión de suscripciones, pagos y facturación; (iii) soporte
        técnico y atención de solicitudes; (iv) comunicaciones operativas sobre el estado de la
        cuenta, la vigencia de la suscripción o del servicio; (v) seguridad de la Plataforma y
        prevención de fraude.
      </p>
      <p style={LEGAL_P}>
        No se realizan transferencias a terceros para fines comerciales ni publicidad no solicitada.
      </p>

      <h2 style={LEGAL_H2}>4. Derechos del titular</h2>
      <p style={LEGAL_P}>
        Conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013, el titular de los datos puede:
        acceder, conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización;
        ser informado del uso dado a los mismos; revocar la autorización y solicitar la supresión de
        los datos cuando no exista deber legal de conservarlos.
      </p>

      <h2 style={LEGAL_H2}>5. Procedimiento para ejercer derechos</h2>
      <p style={LEGAL_P}>
        Las solicitudes se presentan escribiendo a <strong>[CORREO DE CONTACTO]</strong> con
        identificación del titular y descripción de la petición. La consulta se responderá en un
        término máximo de diez (10) días hábiles y los reclamos en quince (15) días hábiles,
        prorrogables conforme al artículo 15 de la Ley 1581 de 2012.
      </p>
      <p style={LEGAL_P}>
        El Usuario puede además actualizar o eliminar sus datos directamente desde su perfil y
        eliminar su cuenta, lo que conlleva la supresión de los contenidos asociados.
      </p>

      <h2 style={LEGAL_H2}>6. Conservación</h2>
      <p style={LEGAL_P}>
        Los datos se conservan mientras exista la cuenta del Usuario o un deber legal o contractual
        de conservación. Suprimida la cuenta, los datos personales se eliminan o anonimizan salvo
        los que deba conservar la ley.
      </p>

      <h2 style={LEGAL_H2}>7. Encargados del tratamiento</h2>
      <p style={LEGAL_P}>
        El Responsable utiliza proveedores tecnológicos que procesan datos en su nombre bajo
        contratos de encargo: [PROVEEDOR DE ALOJAMIENTO/Base de datos], [PASARELA DE PAGOS],
        [PROVEEDOR DE CORREO ELECTRÓNICO]. La información se almacena y procesa con medidas de
        seguridad técnicas y administrativas razonables.
      </p>

      <div className="px-6 py-5 border-t mt-12 text-center" style={{ borderColor: '#3a494a' }}>
        <p className="text-xs" style={{ color: '#6b8cae' }}>
          Volver a{' '}
          <Link to="/terminos" className="font-bold hover:underline" style={{ color: '#00dce5' }}>
            Términos y Condiciones
          </Link>{' '}
          ·{' '}
          <Link to="/" className="font-bold hover:underline" style={{ color: '#00dce5' }}>
            inicio
          </Link>
        </p>
      </div>
    </LegalShell>
  );
}

export default PrivacyPage;
