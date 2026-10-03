import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePageMeta } from '../hooks/usePageMeta';

/** Página pública de Términos y Condiciones. Contenido legal inline con placeholders
 *  [ENTRE CORCHETES] para que el titular los edite (ponytail: sin CMS ni MDX). */
const H2: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#dce3ea',
  fontFamily: 'Geist, monospace',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  margin: '28px 0 8px',
};
const P: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#b9caca',
  margin: '0 0 10px',
};

function TermsPage() {
  usePageMeta(
    'Términos y Condiciones',
    'Términos y condiciones de uso de CivilCardex: cuenta de usuario, suscripciones por módulo con renovación manual, propiedad intelectual, datos personales y ley aplicable colombiana.',
  );
  return (
    <div
      className="landing-root min-h-screen flex flex-col"
      style={{ background: '#0a0e14', color: '#e2e2e8' }}
    >
      <Navbar />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-24 pb-16">
        <h1
          className="text-2xl font-black tracking-tight uppercase mb-1"
          style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
        >
          <span style={{ color: '#dce3ea' }}>Términos y Condiciones</span>
        </h1>
        <p
          className="text-xs uppercase tracking-widest mb-8"
          style={{ color: '#6b8cae', fontFamily: 'Geist, monospace', fontWeight: 600 }}
        >
          Fecha de entrada en vigencia: [FECHA]
        </p>

        <h2 style={H2}>1. Identificación del titular</h2>
        <p style={P}>
          CivilCardex (&laquo;la Plataforma&raquo;) es un servicio de software como servicio (SaaS)
          titularidad de <strong>[RAZÓN SOCIAL]</strong>, identificado con NIT{' '}
          <strong>[NIT]</strong>, con domicilio en <strong>[CIUDAD, DEPARTAMENTO], Colombia</strong>
          , y correo electrónico de contacto <strong>[CORREO DE CONTACTO]</strong> (en adelante,
          &laquo;el Titular&raquo;).
        </p>

        <h2 style={H2}>2. Objeto y aceptación</h2>
        <p style={P}>
          Estos Términos y Condiciones regulan el acceso y uso de la Plataforma, que comprende: (i)
          herramientas de diseño y cálculo de redes hidrosanitarias sobre planos digitalizados
          (CivilFlow) y (ii) herramientas de análisis de precios unitarios y presupuestos
          (CivilManager), así como toda funcionalidad asociada.
        </p>
        <p style={P}>
          Al crear una cuenta, marcar la casilla de aceptación en el registro o utilizar la
          Plataforma en cualquier modalidad, el usuario (&laquo;el Usuario&raquo;) declara haber
          leído, entendido y aceptado plenamente estos Términos y la{' '}
          <Link to="/privacidad" style={{ color: '#00dce5' }} className="hover:underline">
            Política de Tratamiento de Datos Personales
          </Link>
          .
        </p>
        <p style={P}>
          Si el Usuario actúa en nombre de una persona jurídica, declara contar con facultades para
          vincularla.
        </p>

        <h2 style={H2}>3. Cuenta de usuario</h2>
        <p style={P}>
          3.1. El acceso a las funcionalidades de diseño requiere una cuenta registrada con correo
          electrónico y contraseña. El Usuario es el único responsable de la confidencialidad de sus
          credenciales y de toda actividad ocurrida bajo su cuenta.
        </p>
        <p style={P}>
          3.2. El Usuario se compromete a suministrar información veraz y a mantenerla actualizada.
          Una misma cuenta es de uso personal e intransferible; la explotación simultánea por varios
          usuarios requiere las licencias correspondientes.
        </p>
        <p style={P}>
          3.3. El Usuario podrá eliminar su cuenta en cualquier momento desde su perfil. La
          eliminación implica la supresión de los contenidos asociados, sin perjuicio de los datos
          que deban conservarse por ley.
        </p>

        <h2 style={H2}>4. Suscripciones, pagos y vigencia</h2>
        <p style={P}>
          4.1. Las funcionalidades de trabajo se habilitan por módulos (CivilFlow, CivilManager)
          mediante suscripciones con vigencia determinada: mensual, semestral o anual. El precio de
          cada módulo y periodo es el publicado en la sección de Precios al momento de la compra.
        </p>
        <p style={P}>
          4.2. <strong>La renovación es manual.</strong> La suscripción NO se renueva ni se cobra
          automáticamente: al vencer la vigencia el Usuario decide si paga un nuevo periodo. El
          tiempo restante de una suscripción vigente no se pierde: al renovar antes del vencimiento,
          el nuevo periodo se acumula a la vigencia actual.
        </p>
        <p style={P}>
          4.3. Los pagos se procesan a través de una pasarela de pagos electrónica autorizada. El
          Titular no almacena datos de tarjetas de crédito, débito u otros instrumentos de pago:
          dichos datos son tratados exclusivamente por la pasarela bajo su propia certificación de
          seguridad.
        </p>
        <p style={P}>
          4.4. La suscripción se activa una vez la pasarela confirma el pago. El comprobante es la
          referencia de pago emitida al momento de la transacción.
        </p>
        <p style={P}>
          4.5. <strong>Reembolsos:</strong> dado que la renovación es manual y el servicio se presta
          de inmediato, no se realizan reembolsos por periodos ya iniciados, salvo defecto grave e
          imputable a la Plataforma que la inhabilite por completo, caso en el cual procederá
          reposición del servicio o devolución proporcional a criterio del Titular. Lo anterior sin
          perjuicio de las facultades de la Superintendencia de Industria y Comercio y del régimen
          de retracto legal cuando aplique conforme a la ley colombiana. [AJUSTA SEGÚN TU POLÍTICA
          REAL]
        </p>
        <p style={P}>
          4.6. El Titular podrá modificar los precios publicados. La modificación no afecta
          suscripciones ya pagadas: rige para compras posteriores.
        </p>

        <h2 style={H2}>5. Uso de la Plataforma</h2>
        <p style={P}>
          El Usuario se compromete a: (i) usar la Plataforma conforme a su objeto (proyectos de
          ingeniería); (ii) no introducir código malicioso, intentar vulnerar la seguridad, realizar
          ingeniería inversa, ni extraer contenidos mediante medios no previstos; (iii) no revender
          ni sublicenciar el servicio sin autorización; (iv) no utilizar la Plataforma para
          actividades ilícitas.
        </p>
        <p style={P}>
          El Titular podrá suspender cuentas que incumplan estos Términos, con notificación
          razonable salvo que la ley o la seguridad del servicio exijan suspensión inmediata.
        </p>

        <h2 style={H2}>6. Contenidos del Usuario y propiedad intelectual</h2>
        <p style={P}>
          6.1. Los planos, trazados, memorias de cálculo, presupuestos y demás documentos que el
          Usuario cargue o genere son propiedad exclusiva del Usuario o de quien este represente. El
          Titular no los comercializa ni los comparte con terceros; solo los trata para prestar el
          servicio (almacenamiento, cálculo y visualización).
        </p>
        <p style={P}>
          6.2. El software, interfaz, marca, catálogos técnicos, fórmulas implementadas y demás
          elementos de la Plataforma son propiedad del Titular y están protegidos por el régimen de
          derechos de autor y propiedad industrial colombiano (Ley 23 de 1982, Decisión 486 de la
          CAN). Estos Términos otorgan una licencia de uso personal, no exclusiva e intransferible,
          limitada a la vigencia de la suscripción.
        </p>
        <p style={P}>
          6.3. El Usuario conserva la responsabilidad profesional de los resultados: las
          herramientas de cálculo son ayudas al diseño y no sustituyen el juicio del ingeniero
          responsable ni la revisión conforme a las normas técnicas aplicables (RAS, NSR-10, NTC y
          demás que resulten obligatorias).
        </p>

        <h2 style={H2}>7. Disponibilidad y soporte</h2>
        <p style={P}>
          El Titular procurará la disponibilidad continua del servicio, sin garantizarla de forma
          absoluta. Podrá realizar mantenimiento programado y suspensiones temporales por causas
          técnicas o de fuerza mayor. Soporte técnico: <strong>[CORREO/CANAL DE SOPORTE]</strong>.
        </p>

        <h2 style={H2}>8. Limitación de responsabilidad</h2>
        <p style={P}>
          8.1. La Plataforma se suministra &laquo;tal cual&raquo;. El Titular no responde por
          decisiones de diseño, construcción o contractuales adoptadas por el Usuario con base en
          los resultados de las herramientas: los cálculos deben ser verificados por el profesional
          responsable (ver numeral 6.3).
        </p>
        <p style={P}>
          8.2. En la máxima medida permitida por la ley, la responsabilidad total del Titular frente
          al Usuario se limita al valor pagado por la suscripción vigente al momento del hecho
          generador. No se responde por lucro cesante, pérdida de datos no atribuible a la
          Plataforma ni daños indirectos.
        </p>
        <p style={P}>
          8.3. Nada en estos Términos limita responsabilidades que la ley prohíba limitar.
        </p>

        <h2 style={H2}>9. Modificaciones</h2>
        <p style={P}>
          El Titular podrá modificar estos Términos. Publicará la versión vigente en esta página con
          nueva fecha de entrada. Los cambios sustanciales se comunicarán a los usuarios con
          suscripción activa por correo o aviso dentro de la Plataforma con razonable antelación. El
          uso continuado tras la entrada en vigencia implica aceptación.
        </p>

        <h2 style={H2}>10. Ley aplicable y jurisdicción</h2>
        <p style={P}>
          Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia
          se someterá a los jueces competentes de <strong>[CIUDAD]</strong>, salvo la competencia
          del régimen de protección al consumidor aplicable.
        </p>

        <div className="px-6 py-5 border-t mt-12 text-center" style={{ borderColor: '#3a494a' }}>
          <p className="text-xs" style={{ color: '#6b8cae' }}>
            Volver al{' '}
            <Link to="/" className="font-bold hover:underline" style={{ color: '#00dce5' }}>
              inicio
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default TermsPage;
