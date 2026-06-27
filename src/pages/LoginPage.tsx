import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import FormField from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { signIn } = useAuth();
  usePageMeta('Iniciar Sesión', 'Acceda a su cuenta de CivilCore para gestionar proyectos de ingeniería civil, diseño hidrosanitario y memorias de cálculo.');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/civilflowareatrabajo');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0e14', color: '#e2e2e8' }}>
      <style>{`
        .login-grid {
          background-image: linear-gradient(rgba(0,170,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,170,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }
      `}</style>

      <Navbar />

      <div className="flex-1 flex items-center justify-center relative pt-16">
        <div className="absolute inset-0 login-grid pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'rgba(0,170,255,0.06)' }} />

        <div className="relative z-10 w-full max-w-[420px] mx-4">
          <div className="border border-outline-variant" style={{ background: 'rgba(10,14,20,0.8)', backdropFilter: 'blur(16px)' }}>

            <div className="px-8 pt-10 pb-6 text-center">
              <div className="flex justify-center mb-5">
                <img src="/logos/civilCorelogo.webp" alt="CivilCore" className="w-24 h-24 object-contain"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(0,170,255,0.25))' }}  width={96} height={96} loading="lazy" />
              </div>
              <h1 className="text-2xl font-black tracking-tight uppercase mb-1"
                style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
                <span style={{ color: '#e8f4fd' }}>CIVIL</span>
                <span style={{ color: '#00dce5' }}>CORE</span>
              </h1>
              <p className="text-xs uppercase tracking-widest" style={{ color: '#6b8cae', fontFamily: 'Geist, monospace', fontWeight: 600 }}>
                Ingeniería de Precisión 
              </p>
            </div>

<form onSubmit={handleSubmit} className="px-8 pb-6 space-y-5">
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="sr-only">Datos de inicio de sesión</legend>
                <FormField label="CORREO ELECTRÓNICO" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@civilcore.com" autoComplete="email" required />

                <div style={{position:'relative'}}>
                  <FormField label="CONTRASEÑA" type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required minLength={6} />
                  <button type="button" onClick={() => setShowPwd(prev => !prev)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 bottom-[12px] text-base opacity-50 hover:opacity-90 transition-opacity"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8AB4D6', padding: 0, lineHeight: 1 }}>
                    {showPwd ? '⬡' : '👁'}
                  </button>
                </div>
              </fieldset>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 border accent-[#00dce5]"
                    style={{ borderColor: '#3a494a', background: '#0a0e14' }} />
                  <span className="text-xs" style={{ color: '#6b8cae' }}>Recordarme</span>
                </label>
                <button type="button" className="text-xs hover:underline" style={{ color: '#00dce5' }}>
                  ¿Olvidó su contraseña?
                </button>
              </div>

              <button
                type="submit"
                className="w-full h-12 font-bold text-[11px] tracking-widest uppercase transition-all"
                style={{ background: '#00dce5', color: '#0a0e14', fontFamily: 'Geist, monospace',
                  boxShadow: '0 0 20px rgba(0,220,229,0.2)' }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.boxShadow = '0 0 30px rgba(0,220,229,0.4)'}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.boxShadow = '0 0 20px rgba(0,220,229,0.2)'}
              >
          {loading ? 'INGRESANDO...' : 'INICIAR SESIÓN'}
        </button>
        {error && (
          <div role="alert" aria-live="polite" style={{ color: '#F04545', fontSize: 12, fontFamily: 'Geist, monospace', textAlign: 'center', padding: '8px', background: 'rgba(240,69,69,.08)', border: '1px solid rgba(240,69,69,.2)', borderRadius: 4 }}>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
