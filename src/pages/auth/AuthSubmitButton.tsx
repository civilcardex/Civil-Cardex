import React from 'react';

/** Botón de submit de las páginas de auth: cian con glow al hover compartido.
 *  Sin `busy` el botón queda habilitado y opaco (comportamiento de login/register). */
export default function AuthSubmitButton({
  busy,
  label,
  busyLabel,
}: {
  busy?: boolean;
  label: string;
  busyLabel: string;
}): React.JSX.Element {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full h-12 font-bold text-[11px] tracking-widest uppercase transition-all"
      style={{
        background: '#00dce5',
        color: '#0a0e14',
        fontFamily: 'Geist, monospace',
        boxShadow: '0 0 20px rgba(0,220,229,0.2)',
        opacity: busy ? 0.6 : 1,
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
        (e.currentTarget.style.boxShadow = '0 0 30px rgba(0,220,229,0.4)')
      }
      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
        (e.currentTarget.style.boxShadow = '0 0 20px rgba(0,220,229,0.2)')
      }
    >
      {busy ? busyLabel : label}
    </button>
  );
}
