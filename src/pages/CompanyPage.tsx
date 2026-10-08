/**
 * /empresa — administración de puestos de los planes empresariales del usuario:
 * por cada suscripción propia con puestos > 1: miembros (email, puede-editar, quitar),
 * asignación por correo (solo usuarios registrados) y CTA para ampliar puestos.
 * El candado real vive en BD (app_suscripciones_miembros + policies/RPCs).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAuth } from '../context/AuthContext';
import { CATALOGO } from '../lib/subscriptions/catalog';
import { estaActiva, type SuscripcionRow } from '../lib/subscriptions/subscriptionsService';
import { useSuscripciones } from '../hooks/useSubscriptions';
import { devError } from '../utils/devError';

interface Miembro {
  user_id: string;
  email: string;
  puede_editar: boolean;
  asignado_en: string;
}

/** Mensajes claros para los errores del RPC (el mensaje del server es un código). */
const MSG_ERROR: Record<string, string> = {
  usuario_no_encontrado:
    'No existe una cuenta con ese correo. El usuario debe registrarse primero.',
  sin_puestos_disponibles: 'No hay puestos libres. Amplía tu plan en Precios.',
  ya_es_miembro: 'Ese correo ya es miembro del equipo.',
  no_puedes_asignarte: 'No puedes asignarte un puesto a ti mismo.',
  suscripcion_vencida: 'Tu suscripción está vencida; renuévala para gestionar puestos.',
  email_invalido: 'Correo inválido.',
  no_autorizado: 'No autorizado.',
};

function mensajeDeError(error: { message: string }): string {
  return MSG_ERROR[error.message] ?? 'No se pudo completar la operación. Intenta de nuevo.';
}

const BTN_PRIMARIO: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: 600,
  background: 'var(--primary, #4D8FF7)',
  border: 'none',
  borderRadius: 4,
  color: 'var(--on-primary, #fff)',
  cursor: 'pointer',
};

const BTN_FANTASMA: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  background: 'transparent',
  border: '1px solid var(--outline-variant, #3a3a44)',
  borderRadius: 4,
  color: 'var(--on-surface, #e2e2e8)',
  cursor: 'pointer',
};

/** Exportado solo para el preview de desarrollo (/empresa-preview), que pasa mock (miembros
 *  falsos, sin RPCs) + soloLectura para NO disparar RPCs reales (asignar_puesto tocaría
 *  datos de verdad). */
export function PanelSuscripcion({
  sus,
  soloLectura = false,
  mock,
}: {
  sus: SuscripcionRow;
  soloLectura?: boolean;
  mock?: { miembros: Miembro[] };
}) {
  const [miembros, setMiembros] = useState<Miembro[] | null>(mock?.miembros ?? null);
  const [email, setEmail] = useState('');
  const [aviso, setAviso] = useState('');
  const [avisoOk, setAvisoOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const refetch = useCallback(async () => {
    // Mock del preview: corta antes de tocar Supabase.
    if (mock) {
      setMiembros(mock.miembros);
      return;
    }
    const { data, error } = await supabase.rpc('mis_miembros', { p_suscripcion_id: sus.id });
    if (error) {
      devError('mis_miembros:', error.message);
      setMiembros([]);
      return;
    }
    setMiembros(((data as Miembro[]) ?? []) as Miembro[]);
  }, [sus.id, mock]);

  // Carga inicial con bandera ignore (patrón ProfilePage) — evita setState síncrono
  // en el effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (mock) return; // el estado ya nace con los miembros falsos (ver useState de abajo)
    let ignore = false;
    async function cargar() {
      const { data, error } = await supabase.rpc('mis_miembros', { p_suscripcion_id: sus.id });
      if (ignore) return;
      if (error) {
        devError('mis_miembros:', error.message);
        setMiembros([]);
        return;
      }
      setMiembros(((data as Miembro[]) ?? []) as Miembro[]);
    }
    void cargar();
    return () => {
      ignore = true;
    };
  }, [sus.id, mock]);

  async function asignar() {
    const correo = email.trim();
    // soloLectura: el preview mockea mis_miembros pero NO asignar_puesto — sin este
    // guard el Enter del input dispararía el RPC real aunque el botón esté disabled.
    if (!correo || ocupado || soloLectura) return;
    setOcupado(true);
    setAviso('');
    const { error } = await supabase.rpc('asignar_puesto', {
      p_suscripcion_id: sus.id,
      p_email: correo,
    });
    setOcupado(false);
    if (error) {
      setAvisoOk(false);
      setAviso(mensajeDeError(error));
      return;
    }
    setEmail('');
    setAvisoOk(true);
    setAviso('Puesto asignado.');
    void refetch();
  }

  async function quitar(userId: string) {
    if (mock) return; // preview: sin RPC real
    const { error } = await supabase.rpc('quitar_puesto', {
      p_suscripcion_id: sus.id,
      p_user_id: userId,
    });
    if (error) {
      setAvisoOk(false);
      setAviso(mensajeDeError(error));
      return;
    }
    void refetch();
  }

  async function toggleEditar(m: Miembro) {
    if (mock) return; // preview: sin RPC real
    const { error } = await supabase.rpc('cambiar_permiso_miembro', {
      p_suscripcion_id: sus.id,
      p_user_id: m.user_id,
      p_puede_editar: !m.puede_editar,
    });
    if (error) {
      devError('cambiar_permiso_miembro:', error.message);
      return;
    }
    void refetch();
  }

  const nombre = CATALOGO.find((c) => c.id === sus.modulo)?.nombre ?? sus.modulo;
  const total = sus.puestos ?? 1;
  const usados = miembros?.length ?? 0;
  const libres = Math.max(0, total - usados);

  return (
    <section
      style={{
        border: '1px solid var(--outline-variant, #3a3a44)',
        borderRadius: 10,
        padding: 20,
        maxWidth: 640,
      }}
    >
      <header className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{nombre}</h2>
          <p
            style={{ fontSize: 12, color: 'var(--on-surface-variant, #9ba8aa)', margin: '2px 0 0' }}
          >
            {usados} de {total} puestos en uso · {libres} libres · Activo hasta{' '}
            {new Date(sus.fecha_fin).toLocaleDateString('es-CO')}
          </p>
        </div>
        <Link to="/pricing" style={BTN_FANTASMA}>
          Ampliar puestos
        </Link>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void asignar();
          }}
          placeholder="correo del miembro (cuenta registrada)"
          aria-label="Correo del miembro a asignar"
          style={{
            flex: 1,
            minWidth: 220,
            padding: '8px 10px',
            fontSize: 13,
            background: 'var(--surface-container-low, #141418)',
            border: '1px solid var(--outline-variant, #3a3a44)',
            borderRadius: 4,
            color: 'var(--on-surface, #e2e2e8)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void asignar()}
          disabled={ocupado || !email.trim() || soloLectura}
          title={soloLectura ? 'Solo lectura — preview' : undefined}
          style={BTN_PRIMARIO}
        >
          {ocupado ? 'Asignando…' : 'Asignar puesto'}
        </button>
      </div>
      {aviso && (
        <p
          role="status"
          style={{ fontSize: 12, marginTop: 8, color: avisoOk ? '#2ff801' : '#f28b82' }}
        >
          {aviso}
        </p>
      )}

      {miembros === null ? (
        <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)', marginTop: 12 }}>
          Cargando miembros…
        </p>
      ) : miembros.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)', marginTop: 12 }}>
          Aún no hay miembros asignados.
        </p>
      ) : (
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--on-surface-variant, #9ba8aa)' }}>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Miembro</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Puede editar</th>
              <th style={{ padding: '6px 8px' }} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {miembros.map((m) => (
              <tr
                key={m.user_id}
                style={{ borderTop: '1px solid var(--outline-variant, #3a3a44)' }}
              >
                <td style={{ padding: '8px' }}>{m.email}</td>
                <td style={{ padding: '8px' }}>
                  <label className="inline-flex items-center gap-2" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={m.puede_editar}
                      onChange={() => void toggleEditar(m)}
                      disabled={soloLectura}
                      aria-label={`Puede editar — ${m.email}`}
                    />
                    {m.puede_editar ? 'Editor' : 'Solo lectura'}
                  </label>
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => void quitar(m.user_id)}
                    disabled={soloLectura}
                    title={soloLectura ? 'Solo lectura — preview' : undefined}
                    style={BTN_FANTASMA}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function CompanyPage() {
  usePageMeta(
    'Equipo',
    'Administra los puestos y permisos de tus planes empresariales CivilCardex.',
  );
  const { user } = useAuth();
  const { rows, loading } = useSuscripciones();
  const empresa = user
    ? rows.filter((r) => r.user_id === user.id && (r.puestos ?? 1) > 1 && estaActiva(r))
    : [];

  return (
    <div className="container mx-auto px-6 py-10" style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Equipo</h1>
      <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)', marginBottom: 24 }}>
        Asigna puestos de tus planes empresariales por correo (el miembro debe tener cuenta
        registrada) y define quién puede editar los proyectos de la empresa.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)' }}>
          Cargando suscripciones…
        </p>
      ) : empresa.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--outline-variant, #3a3a44)',
            borderRadius: 10,
            padding: 24,
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)' }}>
            Aquí administrarás los puestos de tus planes empresariales. Aún no tienes una compra con
            más de un puesto.
          </p>
          <Link
            to="/pricing"
            style={{
              ...BTN_PRIMARIO,
              display: 'inline-block',
              marginTop: 12,
              textDecoration: 'none',
            }}
          >
            Ver planes
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {empresa.map((sus) => (
            <PanelSuscripcion key={sus.id} sus={sus} />
          ))}
        </div>
      )}
    </div>
  );
}
