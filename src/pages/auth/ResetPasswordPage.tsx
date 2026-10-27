import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout.tsx';
import PwdField from './PwdField.tsx';
import FormField from '../../components/FormField.tsx';
import AuthSubmitButton from './AuthSubmitButton.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { usePageMeta } from '../../hooks/usePageMeta.ts';

import { AUTH_ERROR_STYLE } from '../../components/shared/sharedStyles.ts';
const PAGE_OK: React.CSSProperties = {
  color: '#2ff801',
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  textAlign: 'center',
  padding: '8px',
  background: 'rgba(47,248,1,.07)',
  border: '1px solid rgba(47,248,1,.2)',
  borderRadius: 4,
};

/** Espejo de la config GoTrue del proyecto; mantener sincronizado. */
const MIN_PWD = 6;

/** Resultado de clasificar la URL al llegar desde el correo de recovery. */
type EstadoRecovery =
  { tipo: 'sin-link' } | { tipo: 'recovery' } | { tipo: 'invalido'; razon: string };

/** Clasifica el fragment de la URL (implicit flow) sin timer: hash con `error` = link vencido/usado; `type=recovery` = sesión en camino (esperar
 * loading); sin hash = llegada normal al formulario de pedir correo. */
function clasificarRecovery(): EstadoRecovery {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (h.get('error')) {
    return {
      tipo: 'invalido',
      razon: h.get('error_description') ?? 'El enlace no es válido o ya fue utilizado.',
    };
  }
  return h.get('type') === 'recovery' ? { tipo: 'recovery' } : { tipo: 'sin-link' };
}

/** Restablecimiento de contraseña, doble modo en una página: sin sesión = solicitar el correo de recuperación; con sesión (el link del correo vuelve con sesión
 * recovery y el cliente la detecta en la URL) = formulario de nueva contraseña. */
function ResetPasswordPage() {
  const { user, loading, resetPassword, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [cambiada, setCambiada] = useState(false);
  usePageMeta('Restablecer contraseña', 'Recupere el acceso a su cuenta de CivilCardex.', true);

  // La URL se clasifica UNA vez al montar (lazy init): el hash no cambia durante la vida de la página.
  const [estado] = useState<EstadoRecovery>(clasificarRecovery);

  const pedirCorreo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await resetPassword(email);
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo');
    } finally {
      setBusy(false);
    }
  };

  const guardarNueva = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pwd1 !== pwd2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(pwd1);
      setCambiada(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña');
    } finally {
      setBusy(false);
    }
  };

  const modoNueva = !loading && !!user && estado.tipo !== 'invalido';

  // Redirige al login tras dejar leer el mensaje; cleanup cancela si el usuario ya se fue.
  React.useEffect(() => {
    if (!cambiada) return;
    const t = window.setTimeout(() => navigate('/login'), 1500);
    return () => window.clearTimeout(t);
  }, [cambiada, navigate]);

  return (
    <AuthLayout
      titulo={['RESTABLECER', ' CONTRASEÑA']}
      subtituloColor="#6b8cae"
      subtitulo={modoNueva ? 'Defina su nueva contraseña' : 'Recupere el acceso a su cuenta'}
    >
      {estado.tipo === 'invalido' ? (
        <div role="alert" className="px-8 pb-10 text-sm text-center" style={AUTH_ERROR_STYLE}>
          {estado.razon}
        </div>
      ) : loading ? (
        <p role="status" className="px-8 pb-10 text-xs text-center" style={{ color: '#6b8cae' }}>
          Verificando...
        </p>
      ) : cambiada ? (
        <p role="status" className="px-8 pb-10 text-sm text-center" style={PAGE_OK}>
          Contraseña actualizada. Redirigiendo al inicio de sesión...
        </p>
      ) : modoNueva ? (
        <form onSubmit={guardarNueva} className="px-8 pb-6 space-y-5">
          <PwdField
            label="NUEVA CONTRASEÑA"
            value={pwd1}
            onChange={(e) => setPwd1(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PWD}
            show={showPwd}
            onToggle={() => setShowPwd((prev) => !prev)}
          />
          <FormField
            label="CONFIRMAR CONTRASEÑA"
            type={showPwd ? 'text' : 'password'}
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
          <AuthSubmitButton busy={busy} label="GUARDAR CONTRASEÑA" busyLabel="GUARDANDO..." />
          {error && (
            <div role="alert" style={AUTH_ERROR_STYLE}>
              {error}
            </div>
          )}
        </form>
      ) : enviado ? (
        <p role="status" className="px-8 pb-10 text-sm text-center" style={PAGE_OK}>
          Si el correo está registrado, recibirá un link de restablecimiento en los próximos
          minutos. Reviselo, incluida la carpeta de spam.
        </p>
      ) : (
        <form onSubmit={pedirCorreo} className="px-8 pb-6 space-y-5">
          <FormField
            label="CORREO ELECTRÓNICO"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@civilcardex.com"
            autoComplete="email"
            required
          />
          <AuthSubmitButton
            busy={busy}
            label="ENVIAR LINK DE RESTABLECIMIENTO"
            busyLabel="ENVIANDO..."
          />
          {error && (
            <div role="alert" style={AUTH_ERROR_STYLE}>
              {error}
            </div>
          )}
        </form>
      )}

      <div className="px-8 py-5 border-t text-center" style={{ borderColor: '#3a494a' }}>
        <p className="text-xs" style={{ color: '#6b8cae' }}>
          Volver a{' '}
          <Link to="/login" className="font-bold hover:underline" style={{ color: '#00dce5' }}>
            Iniciar sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
