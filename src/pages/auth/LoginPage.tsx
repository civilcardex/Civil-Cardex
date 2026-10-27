import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout.tsx';
import PwdField from './PwdField.tsx';
import FormField from '../../components/FormField.tsx';
import AuthSubmitButton from './AuthSubmitButton.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { mensajeAuthGenerico } from '../../utils/authMessage.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';

import { AUTH_ERROR_STYLE } from '../../components/shared/sharedStyles.ts';
const LOGIN_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Iniciar Sesión — CivilCardex',
  description:
    'Acceda a su cuenta de CivilCardex para gestionar proyectos de ingeniería civil, diseño hidrosanitario y memorias de cálculo.',
  url: 'https://civilcardex.com/login',
};

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  // Recordarme: DESMARCADO = la sesión se cierra al cerrar el navegador (ver AuthContext).
  const [recordarme, setRecordarme] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { signIn } = useAuth();
  usePageMeta(
    'Iniciar Sesión',
    'Acceda a su cuenta de CivilCardex para gestionar proyectos de ingeniería civil, diseño hidrosanitario y memorias de cálculo.',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (recordarme) localStorage.removeItem('civilflow_no_recordar');
      else localStorage.setItem('civilflow_no_recordar', '1');
      await signIn(email, password);
      // Volver al destino que pidió login (ModulePage pasa state.from) — default /perfil.
      // useLocation() (react-router), NO el location global: window.location.state no existe.
      const from = (routeLocation.state as { from?: string } | null)?.from ?? '/perfil';
      navigate(from);
    } catch (err) {
      // Mensajes genéricos: el error crudo de Supabase enumera cuentas ("Email not confirmed").
      setError(mensajeAuthGenerico(err, 'Error al iniciar sesión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      jsonld={LOGIN_JSONLD}
      titulo={['CIVIL', ' CARDEX']}
      subtituloColor="#6b8cae"
      subtitulo="Ingeniería de Precisión"
    >
      <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-5">
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="sr-only">Datos de inicio de sesión</legend>
          <FormField
            label="CORREO ELECTRÓNICO"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@civilcardex.com"
            autoComplete="email"
            required
          />

          <PwdField
            label="CONTRASEÑA"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            minLength={6}
            show={showPwd}
            onToggle={() => setShowPwd((prev) => !prev)}
          />
        </fieldset>

        <div className="flex items-center justify-between">
          <label
            className="flex items-center gap-2 cursor-pointer"
            title="Desmarcado: la sesión termina al cerrar el navegador"
          >
            <input
              type="checkbox"
              checked={recordarme}
              onChange={(e) => setRecordarme(e.target.checked)}
              className="w-4 h-4 border accent-[#00dce5]"
              style={{ borderColor: '#3a494a', background: '#0a0e14' }}
            />
            <span className="text-xs" style={{ color: '#6b8cae' }}>
              Recordarme
            </span>
          </label>
          <Link to="/restablecer" className="text-xs hover:underline" style={{ color: '#00dce5' }}>
            ¿Olvidó su contraseña?
          </Link>
        </div>

        <AuthSubmitButton busy={loading} label="INICIAR SESIÓN" busyLabel="INGRESANDO..." />
        {error && (
          <div role="alert" style={AUTH_ERROR_STYLE}>
            {error}
          </div>
        )}
      </form>

      <div className="px-8 py-5 border-t text-center" style={{ borderColor: '#3a494a' }}>
        <p className="text-xs" style={{ color: '#6b8cae' }}>
          ¿No tiene cuenta?{' '}
          <Link to="/register" className="font-bold hover:underline" style={{ color: '#00dce5' }}>
            Registrarse
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
