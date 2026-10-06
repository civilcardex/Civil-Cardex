import { Link } from 'react-router-dom';

/** Footer global del sitio (mismo bloque que cierra la landing): logo + Documentación /
 *  Precios / Términos / Contacto Técnico + ©. Full-bleed con contenedor interno max-w-7xl. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-outline-variant" style={{ background: '#0a0e14' }}>
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
            <span
              className="text-2xl font-bold uppercase"
              style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              <span className="ccx-silver">Civil</span>
              <span className="ccx-gold"> Cardex</span>
            </span>
          </Link>
          <nav aria-label="Pie de página" className="flex gap-6">
            <Link
              to="/docs"
              className="uppercase tracking-widest transition-colors hover:text-on-surface"
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'Geist, monospace',
                color: '#6a8e8e',
              }}
            >
              Documentación
            </Link>
            <Link
              to="/pricing"
              className="uppercase tracking-widest transition-colors hover:text-on-surface"
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'Geist, monospace',
                color: '#6a8e8e',
              }}
            >
              Precios
            </Link>
            <Link
              to="/terminos"
              className="uppercase tracking-widest transition-colors hover:text-on-surface"
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'Geist, monospace',
                color: '#6a8e8e',
              }}
            >
              Términos
            </Link>
            <button
              type="button"
              onClick={() => {
                window.location.href = 'mailto:soporte@civilcardex.com';
              }}
              aria-label="Contacto técnico por correo"
              className="uppercase tracking-widest cursor-pointer transition-colors hover:text-on-surface"
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'Geist, monospace',
                color: '#6a8e8e',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
            >
              Contacto Técnico{' '}
              {/* ponytail: buzón pendiente de creación — remitente ya usado en SMTP */}
            </button>
          </nav>
        </div>
        <div style={{ color: '#6a8e8e', fontSize: 12 }}>
          © 2026 CivilCardex. Ingeniería de Precisión.
        </div>
      </div>
    </footer>
  );
}
