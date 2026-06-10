import React from 'react';

function MobileOnlyMessage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4 lg:hidden" style={{ background: '#0c0e12' }}>
      <div className="text-center">
        <span className="material-symbols-outlined text-4xl mb-4 text-on-surface">desktop_windows</span>
        <p className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Disponible solo en escritorio</p>
        <p className="text-sm text-on-surface-variant mt-2" style={{ fontFamily: 'Geist, sans-serif' }}>Para una experiencia completa, accede desde tu computador</p>
      </div>
    </div>
  );
}

export default MobileOnlyMessage;
