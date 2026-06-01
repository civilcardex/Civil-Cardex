import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../lib/supabase';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!supabase) { setError('Servicio no configurado'); setLoading(false); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      navigate('/civilflowareatrabajo');
    } catch (err) {
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
                  style={{ filter: 'drop-shadow(0 0 20px rgba(0,170,255,0.25))' }} />
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
              <div>
                <label className="block text-[10px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>
                  CORREO ELECTRÓNICO
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-4 border text-sm focus:outline-none transition-colors"
                  style={{ background: '#0a0e14', borderColor: '#3a494a', color: '#e2e2e8', fontFamily: 'Geist, monospace' }}
                  onFocus={(e) => e.target.style.borderColor = '#00dce5'}
                  onBlur={(e) => e.target.style.borderColor = '#3a494a'}
                  placeholder="usuario@civilcore.com"
                />
              </div>

        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase mb-2"
            style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>
            CONTRASEÑA
          </label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-4 pr-10 border text-sm focus:outline-none transition-colors"
              style={{ background: '#0a0e14', borderColor: '#3a494a', color: '#e2e2e8', fontFamily: 'Geist, monospace' }}
              onFocus={(e) => e.target.style.borderColor = '#00dce5'}
              onBlur={(e) => e.target.style.borderColor = '#3a494a'}
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-base opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b8cae', padding: 0, lineHeight: 1 }}>
              {showPwd ? '⬡' : '👁'}
            </button>
          </div>
        </div>

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
                onMouseEnter={(e) => e.target.style.boxShadow = '0 0 30px rgba(0,220,229,0.4)'}
                onMouseLeave={(e) => e.target.style.boxShadow = '0 0 20px rgba(0,220,229,0.2)'}
              >
          {loading ? 'INGRESANDO...' : 'INICIAR SESIÓN'}
        </button>
        {error && (
          <div style={{ color: '#F04545', fontSize: 12, fontFamily: 'Geist, monospace', textAlign: 'center', padding: '8px', background: 'rgba(240,69,69,.08)', border: '1px solid rgba(240,69,69,.2)', borderRadius: 4 }}>
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
