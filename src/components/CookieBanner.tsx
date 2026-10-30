import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

// Banner de consentimiento de cookies (orig. usuario: "lo típico"). CivilCardex no usa
// cookies de rastreo ni publicidad: Supabase Auth guarda tokens en localStorage (esencial),
// Vercel Analytics es sin cookies y las demás claves son preferencias de UI. El banner
// documenta y obtiene el consentimiento; el rechazo no desactiva nada esencial.
// Clave FUERA del namespace civilflow_: workspaceReset borra todas las civilflow_* y el
// banner reaparecía (orig. usuario: una vez clickado, nunca más).
const CONSENT_KEY = 'cardex_cookie_consent';

function cookieConsentDado(): boolean {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'rejected';
  } catch {
    return true; // sin storage disponible: no molestar con el banner
  }
}

const BAR_STYLE: CSSProperties = {
  position: 'fixed',
  left: 16,
  right: 16,
  bottom: 16,
  zIndex: 9999,
  maxWidth: 860,
  margin: '0 auto',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderRadius: 12,
  background: 'rgba(15,17,21,.96)',
  border: '1px solid var(--line, #2a2f3a)',
  boxShadow: '0 10px 30px rgba(0,0,0,.45)',
};

/** Banner fijo de consentimiento. Acepta/Rechaza escribe la decisión una vez y no vuelve
 *  a mostrarse (borrar la clave de storage lo re-muestra). */
export default function CookieBanner() {
  const [visible, setVisible] = useState(() => !cookieConsentDado());
  if (!visible) return null;
  const decidir = (v: 'accepted' | 'rejected') => {
    try {
      localStorage.setItem(CONSENT_KEY, v);
    } catch {
      /* ignorar */
    }
    setVisible(false);
  };
  return (
    <div role="region" aria-label="Consentimiento de cookies" style={BAR_STYLE}>
      <p
        style={{
          flex: 1,
          minWidth: 220,
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: '#b9caca',
        }}
      >
        Usamos almacenamiento local esencial para mantener tu sesión y tus preferencias de la
        aplicación. No usamos cookies de publicidad ni de rastreo.{' '}
        <Link to="/cookies" style={{ color: '#38bdf8', fontWeight: 600 }}>
          Política de cookies
        </Link>
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => decidir('rejected')}
          style={{
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 8,
            border: '1px solid var(--line, #2a2f3a)',
            background: 'transparent',
            color: '#b9caca',
            cursor: 'pointer',
          }}
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={() => decidir('accepted')}
          style={{
            padding: '7px 18px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 8,
            border: 'none',
            background: 'var(--acc, #38bdf8)',
            color: '#0f1115',
            cursor: 'pointer',
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
