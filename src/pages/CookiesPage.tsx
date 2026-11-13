import { Link } from 'react-router-dom';
import LegalShell from './LegalShell.tsx';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { metaDeRuta } from '../seo/routeMeta.ts';

/** Página pública de Política de Cookies. Contenido inline con placeholders [ENTRE
 *  CORCHETES] editable por el titular (ponytail) — mismo estilo que PrivacyPage. */

function CookiesPage() {
  usePageMeta(metaDeRuta('/cookies')?.title, metaDeRuta('/cookies')?.description);
  return (
    <LegalShell
      titulo="Política de Cookies"
      subtitulo={<>Cookies y almacenamiento local · [FECHA]</>}
    >
      <h2 className="legal-h2">1. Qué usamos</h2>
      <p className="legal-p">
        CivilCardex es una aplicación de una sola página que{' '}
        <strong>no utiliza cookies de publicidad, rastreo ni perfilamiento</strong>. El
        almacenamiento que empleamos se limita a:
      </p>
      <ul className="legal-list">
        <li className="legal-li">
          <strong>Esenciales — sesión (Supabase Auth):</strong> tokens de autenticación guardados en
          el almacenamiento local del navegador (<code>sb-*-auth-token</code>). Sin ellos no es
          posible iniciar sesión. No son cookies HTTP y no se comparten con terceros con fines de
          rastreo.
        </li>
        <li className="legal-li">
          <strong>Preferencias y trabajo en curso:</strong> colores personalizados por red,
          selecciones de planos, datos de dibujo en curso y demás claves <code>civilflow_*</code>.
          Son estrictamente funcionales: mejoran tu experiencia y pueden eliminarse sin perder
          acceso a la cuenta.
        </li>
        <li className="legal-li">
          <strong>Consentimiento:</strong> guardamos tu decisión del banner bajo la clave{' '}
          <code>cardex_cookie_consent</code> para no volver a preguntar.
        </li>
      </ul>

      <h2 className="legal-h2">2. Analítica</h2>
      <p className="legal-p">
        Usamos Vercel Analytics, que <strong>no utiliza cookies</strong> ni almacena datos
        personales identificables: solo métricas agregadas de visitas y rendimiento.
      </p>

      <h2 className="legal-h2">3. Terceros</h2>
      <p className="legal-p">
        La infraestructura de autenticación y base de datos es <strong>Supabase</strong> y el
        alojamiento es <strong>Vercel</strong>. Ninguno de los dos recibe cookies de rastreo
        nuestras. Consulta su documentación para sus propias políticas.
      </p>

      <h2 className="legal-h2">4. Cómo gestionar el almacenamiento</h2>
      <p className="legal-p">
        Puedes borrar el almacenamiento local y las cookies desde la configuración de tu navegador
        en cualquier momento. Al hacerlo se cerrará tu sesión y se restablecerán las preferencias
        locales. Para re-visitar tu decisión del banner, borra la clave{' '}
        <code>cardex_cookie_consent</code> y el banner volverá a aparecer.
      </p>

      <h2 className="legal-h2">5. Contacto</h2>
      <p className="legal-p">
        <strong>[RAZÓN SOCIAL]</strong> — <strong>[CORREO DE CONTACTO]</strong>.
      </p>

      <p className="legal-p legal-p-spaced">
        Ver también:{' '}
        <Link to="/privacidad" className="legal-link-strong">
          Política de Privacidad
        </Link>{' '}
        ·{' '}
        <Link to="/terminos" className="legal-link-strong">
          Términos y Condiciones
        </Link>
      </p>
    </LegalShell>
  );
}

export default CookiesPage;
