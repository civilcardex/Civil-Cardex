import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import FormField from '../../components/FormField';
import AuthSubmitButton from './AuthSubmitButton';
import { useAuth } from '../../context/AuthContext';
import { usePageMeta } from '../../hooks/usePageMeta';

const PAGE_S1: React.CSSProperties = {
  color: '#F04545',
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  textAlign: 'center',
  padding: '8px',
  background: 'rgba(240,69,69,.08)',
  border: '1px solid rgba(240,69,69,.2)',
  borderRadius: 4,
};
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
  | { tipo: 'sin-link' }
  | { tipo: 'recovery' }
  | { tipo: 'invalido'; razon: string };

/** Clasifica el fragment de la URL (implicit flow) sin timer: hash con `error` = link
 *  vencido/usado; `type=recovery` = sesión en camino (esperar loading); sin hash =
 *  llegada normal al formulario de pedir correo. */
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

/** Restablecimiento de contraseña, doble modo en una página: sin sesión = solicitar el
 *  correo de recuperación; con sesión (el link del correo vuelve con sesión recovery y el
 *  cliente la detecta en la URL) = formulario de nueva contraseña. */
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
    <div
      className="landing-root min-h-screen flex flex-col"
      style={{ background: '#0a0e14', color: '#e2e2e8' }}
    >
      <Navbar />
      <div className="flex-1 flex items-center justify-center relative pt-16">
        <div className="absolute inset-0 login-grid pointer-events-none" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'rgba(0,170,255,0.06)' }}
        />

        <div className="relative z-10 w-full max-w-[420px] mx-4">
          <div
            className="border border-outline-variant"
            style={{ background: 'rgba(10,14,20,0.8)', backdropFilter: 'blur(16px)' }}
          >
            <div className="px-8 pt-10 pb-6 text-center">
              <div className="flex justify-center mb-5">
                <img
                  src="/logos/civilCardexlogo-v2.webp"
                  alt="CivilCardex"
                  className="w-24 h-24 object-contain"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(0,170,255,0.25))' }}
                  width={96}
                  height={96}
                  loading="lazy"
                />
              </div>
              <h1
                className="text-2xl font-black tracking-tight uppercase mb-1"
                style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                <span style={{ color: '#dce3ea' }}>RESTABLECER</span>
                <span style={{ color: '#e8c84a' }}> CONTRASEÑA</span>
              </h1>
              <p
                className="text-xs uppercase tracking-widest"
                style={{ color: '#6b8cae', fontFamily: 'Geist, monospace', fontWeight: 600 }}
              >
                {modoNueva ? 'Defina su nueva contraseña' : 'Recupere el acceso a su cuenta'}
              </p>
            </div>

            {estado.tipo === 'invalido' ? (
              <div role="alert" className="px-8 pb-10 text-sm text-center" style={PAGE_S1}>
                {estado.razon}
              </div>
            ) : loading ? (
              <p
                role="status"
                className="px-8 pb-10 text-xs text-center"
                style={{ color: '#6b8cae' }}
              >
                Verificando...
              </p>
            ) : cambiada ? (
              <p role="status" className="px-8 pb-10 text-sm text-center" style={PAGE_OK}>
                Contraseña actualizada. Redirigiendo al inicio de sesión...
              </p>
            ) : modoNueva ? (
              <form onSubmit={guardarNueva} className="px-8 pb-6 space-y-5">
                <div style={{ position: 'relative' }}>
                  <FormField
                    label="NUEVA CONTRASEÑA"
                    type={showPwd ? 'text' : 'password'}
                    value={pwd1}
                    onChange={(e) => setPwd1(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PWD}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((prev) => !prev)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPwd}
                    className="absolute right-2 bottom-[12px] text-base opacity-50 hover:opacity-90 transition-opacity"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#8AB4D6',
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    {showPwd ? '⬡' : '👁'}
                  </button>
                </div>
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
                  <div role="alert" style={PAGE_S1}>
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
                  <div role="alert" style={PAGE_S1}>
                    {error}
                  </div>
                )}
              </form>
            )}

            <div className="px-8 py-5 border-t text-center" style={{ borderColor: '#3a494a' }}>
              <p className="text-xs" style={{ color: '#6b8cae' }}>
                Volver a{' '}
                <Link
                  to="/login"
                  className="font-bold hover:underline"
                  style={{ color: '#00dce5' }}
                >
                  Iniciar sesión
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
