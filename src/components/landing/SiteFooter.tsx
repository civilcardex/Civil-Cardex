import { Link } from 'react-router-dom';

/** Enlaces internos del pie (mismo estilo); el botón de correo va aparte (no es Link). */
const LINKS: [string, string][] = [
  ['/docs', 'Documentación'],
  ['/aprende', 'Aprende'],
  ['/pricing', 'Precios'],
  ['/terminos', 'Términos'],
];

/** Footer global del sitio (mismo bloque que cierra la landing): logo + Documentación /
 *  Precios / Términos / Contacto Técnico + ©. Full-bleed con contenedor interno max-w-7xl. */
export default function SiteFooter() {
  return (
    <footer className="site-footer border-t border-outline-variant">
      <div className="flex flex-col md:flex-row justify-between items-center py-8 px-6 lg:px-8 gap-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logos/civilCardexlogo-v2.webp"
              alt="CivilCardex"
              className="h-11 w-11 object-contain"
              width={44}
              height={44}
              loading="lazy"
            />
            <span className="site-footer-brand text-2xl font-bold uppercase">
              <span className="ccx-silver">Civil</span>
              <span className="ccx-gold"> Cardex</span>
            </span>
          </Link>
          <nav aria-label="Pie de página" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {LINKS.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="site-footer-link uppercase tracking-widest transition-colors hover:text-on-surface"
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                window.location.href = 'mailto:soporte@civilcardex.com';
              }}
              aria-label="Contacto técnico por correo"
              className="site-footer-email uppercase tracking-widest cursor-pointer transition-colors hover:text-on-surface"
            >
              Contacto Técnico{' '}
              {/* ponytail: buzón pendiente de creación — remitente ya usado en SMTP */}
            </button>
          </nav>
        </div>
        <div className="site-footer-copy">© 2026 CivilCardex. Ingeniería de Precisión.</div>
      </div>
    </footer>
  );
}
