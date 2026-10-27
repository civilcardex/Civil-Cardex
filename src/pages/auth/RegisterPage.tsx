import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout.tsx';
import PwdField from './PwdField.tsx';
import FormField from '../../components/FormField.tsx';
import AuthSubmitButton from './AuthSubmitButton.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { mensajeAuthGenerico } from '../../utils/authMessage.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';

import { AUTH_ERROR_STYLE } from '../../components/shared/sharedStyles.ts';
const REGISTER_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Registro — CivilCardex',
  description:
    'Cree su cuenta en CivilCardex para acceder a herramientas de diseño hidrosanitario, estructural y gestión de proyectos.',
  url: 'https://civilcardex.com/register',
};

// Política "recommended" de Supabase (minúscula/mayúscula/dígito/símbolo): sin una de
// cada la BD la rechaza como débil. Mismo orden en el checklist visual del formulario.
const REGLAS_PWD: { rx: RegExp; label: string }[] = [
  { rx: /[a-z]/, label: 'Letra minúscula' },
  { rx: /[A-Z]/, label: 'Letra mayúscula' },
  { rx: /\d/, label: 'Número' },
  { rx: /[^A-Za-z0-9]/, label: 'Símbolo' },
];

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

  // Estado de cada regla sobre la contraseña tecleada (re-cálculo barato por render).
  const MIN_PWD = 8;
  const pwdCumple = REGLAS_PWD.map((r) => r.rx.test(form.password));
  const pwdCoinciden = form.confirm.length > 0 && form.password === form.confirm;
  const checksPwd = [
    ...REGLAS_PWD.map((r, i) => ({ ok: pwdCumple[i]!, label: r.label })),
    { ok: form.password.length >= MIN_PWD, label: `Mínimo ${MIN_PWD} caracteres` },
    { ok: pwdCoinciden, label: 'Contraseñas coinciden' },
  ];

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
    if (form.password.length < MIN_PWD) {
      setError(`La contraseña debe tener al menos ${MIN_PWD} caracteres`);
      return;
    }
    const faltantes = REGLAS_PWD.filter((_, i) => !pwdCumple[i]).map((r) => r.label.toLowerCase());
    if (faltantes.length > 0) {
      setError(`La contraseña debe incluir: ${faltantes.join(', ')}`);
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
      navigate('/perfil');
    } catch (err) {
      // Mensajes genéricos: "User already registered" confirma existencia de cuenta.
      setError(mensajeAuthGenerico(err, 'Error al crear la cuenta'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      jsonld={REGISTER_JSONLD}
      py12
      titulo={['CIVIL', 'CARDEX']}
      subtituloColor="#8AB4D6"
      subtitulo="Crear Cuenta"
    >
      <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-4">
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="sr-only">Datos de registro</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PwdField
              label="CONTRASEÑA"
              value={form.password}
              onChange={handleChange('password')}
              autoComplete="new-password"
              required
              minLength={MIN_PWD}
              show={showPwd}
              onToggle={() => setShowPwd((prev) => !prev)}
            />
            <PwdField
              label="CONFIRMAR CONTRASEÑA"
              value={form.confirm}
              onChange={handleChange('confirm')}
              autoComplete="new-password"
              required
              minLength={MIN_PWD}
              show={showConfirm}
              onToggle={() => setShowConfirm((prev) => !prev)}
            />
          </div>

          {/* Checklist en vivo de la política de contraseñas: cada regla se pinta
                    verde al cumplirse mientras el usuario teclea. */}
          <div
            className="grid grid-cols-2 gap-x-3 gap-y-1"
            style={{ gridColumn: '1 / -1', marginTop: 2 }}
            aria-live="polite"
          >
            {checksPwd.map((c) => (
              <span
                key={c.label}
                className="text-[11px] leading-tight flex items-center gap-1"
                style={{ color: c.ok ? '#2ff801' : '#5f7482' }}
              >
                {c.ok ? '✓' : '○'} {c.label}
              </span>
            ))}
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
              <Link
                to="/terminos"
                className="cursor-pointer hover:underline"
                style={{
                  color: '#00dce5',
                  padding: 0,
                  font: 'inherit',
                }}
              >
                Términos de Servicio
              </Link>{' '}
              y la{' '}
              <Link
                to="/privacidad"
                className="cursor-pointer hover:underline"
                style={{
                  color: '#00dce5',
                  padding: 0,
                  font: 'inherit',
                }}
              >
                Política de Privacidad
              </Link>
            </span>
          </div>
        </fieldset>

        <AuthSubmitButton busy={loading} label="CREAR CUENTA" busyLabel="CREANDO CUENTA..." />
        {error && (
          <div role="alert" style={AUTH_ERROR_STYLE}>
            {error}
          </div>
        )}
      </form>

      <div className="px-8 py-5 border-t text-center" style={{ borderColor: '#3a494a' }}>
        <p className="text-xs" style={{ color: '#8AB4D6' }}>
          ¿Ya tiene cuenta?{' '}
          <Link to="/login" className="font-bold hover:underline" style={{ color: '#00dce5' }}>
            Iniciar Sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default RegisterPage;
