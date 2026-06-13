import React from 'react';

function LoadingSpinner() {
  return <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite" style={{ color: 'var(--on-surface)' }}>Cargando...</div>;
}

export default LoadingSpinner;
