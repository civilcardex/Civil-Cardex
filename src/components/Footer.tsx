import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="border-t border-outline-variant" style={{ background: '#0c0e12' }}>
      <div className="flex flex-col md:flex-row justify-between items-center px-6 lg:px-8 py-8 w-full gap-4">
        <span className="text-[11px] tracking-[0.08em] font-bold text-primary uppercase" style={{ fontFamily: 'Geist, monospace' }}>CivilCore</span>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link to="/docs" className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant hover:text-primary uppercase transition-colors" style={{ fontFamily: 'Geist, monospace' }}>API</Link>
          <Link to="/docs" className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant hover:text-primary uppercase transition-colors" style={{ fontFamily: 'Geist, monospace' }}>SDK</Link>
        </div>
        <span className="text-[13px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>© 2026 CivilCore Engineering. Todos los derechos reservados.</span>
      </div>
    </footer>
  );
}

export default Footer;
