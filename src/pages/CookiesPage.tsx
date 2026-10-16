import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePageMeta } from '../hooks/usePageMeta';

/** Página pública de Política de Cookies. Contenido inline con placeholders [ENTRE
 *  CORCHETES] editable por el titular (ponytail) — mismo estilo que PrivacyPage. */
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
const LI: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#b9caca',
  margin: '0 0 6px 18px',
};

function CookiesPage() {
  usePageMeta(
    'Política de Cookies',
    'Política de cookies y almacenamiento local de CivilCardex: qué se guarda, para qué, y cómo gestionar el consentimiento.',
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
          <span style={{ color: '#dce3ea' }}>Política de Cookies</span>
        </h1>
        <p
          className="text-xs uppercase tracking-widest mb-8"
          style={{ color: '#6b8cae', fontFamily: 'Geist, monospace', fontWeight: 600 }}
        >
          Cookies y almacenamiento local · [FECHA]
        </p>

        <h2 style={H2}>1. Qué usamos</h2>
        <p style={P}>
          CivilCardex es una aplicación de una sola página que{' '}
          <strong>no utiliza cookies de publicidad, rastreo ni perfilamiento</strong>. El
          almacenamiento que empleamos se limita a:
        </p>
        <ul style={{ listStyle: 'disc', padding: 0 }}>
          <li style={LI}>
            <strong>Esenciales — sesión (Supabase Auth):</strong> tokens de autenticación guardados
            en el almacenamiento local del navegador (<code>sb-*-auth-token</code>). Sin ellos no es
            posible iniciar sesión. No son cookies HTTP y no se comparten con terceros con fines de
            rastreo.
          </li>
          <li style={LI}>
            <strong>Preferencias y trabajo en curso:</strong> colores personalizados por red,
            selecciones de planos, datos de dibujo en curso y demás claves <code>civilflow_*</code>.
            Son estrictamente funcionales: mejoran tu experiencia y pueden eliminarse sin perder
            acceso a la cuenta.
          </li>
          <li style={LI}>
            <strong>Consentimiento:</strong> guardamos tu decisión del banner bajo la clave{' '}
            <code>cardex_cookie_consent</code> para no volver a preguntar.
          </li>
        </ul>

        <h2 style={H2}>2. Analítica</h2>
        <p style={P}>
          Usamos Vercel Analytics, que <strong>no utiliza cookies</strong> ni almacena datos
          personales identificables: solo métricas agregadas de visitas y rendimiento.
        </p>

        <h2 style={H2}>3. Terceros</h2>
        <p style={P}>
          La infraestructura de autenticación y base de datos es <strong>Supabase</strong> y el
          alojamiento es <strong>Vercel</strong>. Ninguno de los dos recibe cookies de rastreo
          nuestras. Consulta su documentación para sus propias políticas.
        </p>

        <h2 style={H2}>4. Cómo gestionar el almacenamiento</h2>
        <p style={P}>
          Puedes borrar el almacenamiento local y las cookies desde la configuración de tu navegador
          en cualquier momento. Al hacerlo se cerrará tu sesión y se restablecerán las preferencias
          locales. Para re-visitar tu decisión del banner, borra la clave{' '}
          <code>cardex_cookie_consent</code> y el banner volverá a aparecer.
        </p>

        <h2 style={H2}>5. Contacto</h2>
        <p style={P}>
          <strong>[RAZÓN SOCIAL]</strong> — <strong>[CORREO DE CONTACTO]</strong>.
        </p>

        <p style={{ ...P, marginTop: 24 }}>
          Ver también:{' '}
          <Link to="/privacidad" style={{ color: '#38bdf8', fontWeight: 600 }}>
            Política de Privacidad
          </Link>{' '}
          ·{' '}
          <Link to="/terminos" style={{ color: '#38bdf8', fontWeight: 600 }}>
            Términos y Condiciones
          </Link>
        </p>
      </main>
    </div>
  );
}

export default CookiesPage;
