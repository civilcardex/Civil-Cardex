import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import FormField from '../../components/FormField';
import { useAuth } from '../../context/AuthContext';
import { usePageMeta } from '../../hooks/usePageMeta';
const RegisterPage_S1: React.CSSProperties = {
  color: '#F04545',
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  textAlign: 'center',
  padding: '8px',
  background: 'rgba(240,69,69,.08)',
  border: '1px solid rgba(240,69,69,.2)',
  borderRadius: 4,
};

const REGISTER_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Registro — CivilCardex',
  description:
    'Cree su cuenta en CivilCardex para acceder a herramientas de diseño hidrosanitario, estructural y gestión de proyectos.',
  url: 'https://civilcardex.app/register',
};

function RegisterPage() {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    profesion: '',
    matricula: '',
    telefono: '',
    password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();
  usePageMeta(
    'Registro',
    'Cree su cuenta en CivilCardex para acceder a herramientas de diseño hidrosanitario, estructural y gestión de proyectos.',
  );

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!aceptaTerminos) {
      setError('Debe aceptar los Términos de Servicio y la Política de Privacidad');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await signUp(form.email, form.password, {
        data: {
          nombre: form.nombre,
          apellido: form.apellido,
          profesion: form.profesion,
          matricula: form.matricula,
          telefono: form.telefono,
        },
      });
      navigate('/profile');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear la cuenta';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="landing-root min-h-screen flex flex-col"
      style={{ background: '#0a0e14', color: '#e2e2e8' }}
    >
      <script type="application/ld+json">{JSON.stringify(REGISTER_JSONLD)}</script>
      <Navbar />

      <div className="flex-1 flex items-center justify-center relative pt-16 py-12">
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
                <span style={{ color: '#dce3ea' }}>CIVIL</span>
                <span style={{ color: '#e8c84a' }}>CARDEX</span>
              </h1>
              <p
                className="text-xs uppercase tracking-widest"
                style={{ color: '#8AB4D6', fontFamily: 'Geist, monospace', fontWeight: 600 }}
              >
                Crear Cuenta
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-4">
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="sr-only">Datos de registro</legend>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="NOMBRE"
                    value={form.nombre}
                    onChange={handleChange('nombre')}
                    autoComplete="given-name"
                    required
                  />
                  <FormField
                    label="APELLIDO"
                    value={form.apellido}
                    onChange={handleChange('apellido')}
                    autoComplete="family-name"
                    required
                  />
                </div>

                <FormField
                  label="CORREO ELECTRÓNICO"
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="usuario@civilcardex.com"
                  autoComplete="email"
                  required
                />

                <FormField
                  label="PROFESIÓN"
                  value={form.profesion}
                  onChange={handleChange('profesion')}
                  placeholder="Ingeniero Civil"
                  autoComplete="organization-title"
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="MATRÍCULA PROFESIONAL"
                    value={form.matricula}
                    onChange={handleChange('matricula')}
                    placeholder="12345-ABC"
                  />
                  <FormField
                    label="TELÉFONO"
                    type="tel"
                    value={form.telefono}
                    onChange={handleChange('telefono')}
                    placeholder="+57 300 123 4567"
                    autoComplete="tel"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div style={{ position: 'relative' }}>
                    <FormField
                      label="CONTRASEÑA"
                      type={showPwd ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange('password')}
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((prev) => !prev)}
                      aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-2 bottom-[12px] text-sm opacity-50 hover:opacity-90 transition-opacity"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#8AB4D6',
                        padding: 0,
                      }}
                    >
                      {showPwd ? '⬡' : '👁'}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <FormField
                      label="CONFIRMAR"
                      type={showConfirm ? 'text' : 'password'}
                      value={form.confirm}
                      onChange={handleChange('confirm')}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((prev) => !prev)}
                      aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-2 bottom-[12px] text-sm opacity-50 hover:opacity-90 transition-opacity"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#8AB4D6',
                        padding: 0,
                      }}
                    >
                      {showConfirm ? '⬡' : '👁'}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    aria-label="Acepto los Términos de Servicio y la Política de Privacidad"
                    className="w-4 h-4 mt-0.5 border accent-[#00dce5]"
                    style={{ borderColor: '#3a494a', background: '#0a0e14' }}
                  />
                  <span className="text-[11px] leading-tight" style={{ color: '#8AB4D6' }}>
                    Acepto los{' '}
                    <button
                      type="button"
                      className="cursor-pointer hover:underline"
                      style={{
                        color: '#00dce5',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                      }}
                    >
                      Términos de Servicio
                    </button>{' '}
                    y la{' '}
                    <button
                      type="button"
                      className="cursor-pointer hover:underline"
                      style={{
                        color: '#00dce5',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                      }}
                    >
                      Política de Privacidad
                    </button>
                  </span>
                </div>
              </fieldset>

              <button
                type="submit"
                className="w-full h-12 font-bold text-[11px] tracking-widest uppercase transition-all"
                style={{
                  background: '#00dce5',
                  color: '#0a0e14',
                  fontFamily: 'Geist, monospace',
                  boxShadow: '0 0 20px rgba(0,220,229,0.2)',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                  (e.currentTarget.style.boxShadow = '0 0 30px rgba(0,220,229,0.4)')
                }
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
                  (e.currentTarget.style.boxShadow = '0 0 20px rgba(0,220,229,0.2)')
                }
              >
                {loading ? 'CREANDO CUENTA...' : 'CREAR CUENTA'}
              </button>
              {error && (
                <div role="alert" style={RegisterPage_S1}>
                  {error}
                </div>
              )}
            </form>

            <div className="px-8 py-5 border-t text-center" style={{ borderColor: '#3a494a' }}>
              <p className="text-xs" style={{ color: '#8AB4D6' }}>
                ¿Ya tiene cuenta?{' '}
                <Link
                  to="/login"
                  className="font-bold hover:underline"
                  style={{ color: '#00dce5' }}
                >
                  Iniciar Sesión
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
