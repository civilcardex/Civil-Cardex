/** /empresa — administración de puestos de los planes empresariales del usuario: por cada suscripción propia con puestos > 1: miembros (email, puede-editar,
 * quitar), asignación por correo (solo usuarios registrados) y CTA para ampliar puestos. */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { CATALOGO, SUSCRIPCIONES_ACTIVAS } from '../lib/subscriptions/catalog.ts';
import {
  asignarPuesto,
  cambiarPermisoMiembro,
  estaActiva,
  fetchMiembros,
  quitarPuesto,
  type SuscripcionRow,
} from '../lib/subscriptions/subscriptionsService.ts';
import { useSuscripciones } from '../hooks/useSubscriptions.ts';
import { devError } from '../utils/devError.ts';

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
  no_autenticado: 'Tu sesión expiró. Vuelve a entrar e intenta de nuevo.',
  miembro_no_encontrado: 'Ese miembro ya no está en la lista; recarga la página.',
  email_invalido: 'Correo inválido.',
  no_autorizado: 'No autorizado.',
};

function mensajeDeError(error: { message: string }): string {
  return MSG_ERROR[error.message] ?? 'No se pudo completar la operación. Intenta de nuevo.';
}

/** Para el modo EJEMPLO de esta misma página: mientras el sistema de suscripciones
 * está apagado, CompanyPage pasa mock (miembros falsos, sin RPCs) + soloLectura para NO
 * disparar RPCs reales (asignar_puesto tocaría datos de verdad). */
function PanelSuscripcion({
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
    // Mock: sin RPCs — el estado ya nace con los miembros falsos (useState) y el
    // effect de carga ni siquiera dispara (guard de abajo).
    if (mock) return;
    const { data, error } = await fetchMiembros(sus.id);
    if (error) {
      devError('mis_miembros:', error.message);
      setMiembros([]);
      return;
    }
    setMiembros(((data as Miembro[]) ?? []) as Miembro[]);
  }, [sus.id, mock]);

  // Carga inicial vía refetch (mismo RPC, mismo estado) — el effect solo lo dispara.
  useEffect(() => {
    if (mock) return; // el estado ya nace con los miembros falsos (ver useState de abajo)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch es async RPC: sin mock no hay setState síncrono
    void refetch();
  }, [refetch, mock]);

  async function asignar() {
    const correo = email.trim();
    // soloLectura: el preview mockea mis_miembros pero NO asignar_puesto — sin este
    // guard el Enter del input dispararía el RPC real aunque el botón esté disabled.
    if (!correo || ocupado || soloLectura) return;
    setOcupado(true);
    setAviso('');
    const { error } = await asignarPuesto(sus.id, correo);
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
    const { error } = await quitarPuesto(sus.id, userId);
    if (error) {
      setAvisoOk(false);
      setAviso(mensajeDeError(error));
      return;
    }
    void refetch();
  }

  async function toggleEditar(m: Miembro) {
    if (mock) return; // preview: sin RPC real
    const { error } = await cambiarPermisoMiembro(sus.id, m.user_id, !m.puede_editar);
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
    <section className="company-panel">
      <header className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h2 className="company-panel-title">{nombre}</h2>
          <p className="company-panel-meta">
            {usados} de {total} puestos en uso · {libres} libres · Activo hasta{' '}
            {new Date(sus.fecha_fin).toLocaleDateString('es-CO')}
          </p>
        </div>
        <Link to="/pricing" className="company-btn company-btn-ghost company-btn-small">
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
          className="company-input"
        />
        <button
          type="button"
          onClick={() => void asignar()}
          disabled={ocupado || !email.trim() || soloLectura}
          title={soloLectura ? 'Solo lectura — preview' : undefined}
          className="company-btn"
        >
          {ocupado ? 'Asignando…' : 'Asignar puesto'}
        </button>
      </div>
      {aviso && (
        <p role="status" data-ok={avisoOk ? 'true' : 'false'} className="company-aviso">
          {aviso}
        </p>
      )}

      {miembros === null ? (
        <p className="company-muted mt-3">Cargando miembros…</p>
      ) : miembros.length === 0 ? (
        <p className="company-muted mt-3">Aún no hay miembros asignados.</p>
      ) : (
        <table className="company-table">
          <thead>
            <tr>
              <th scope="col">Miembro</th>
              <th scope="col">Puede editar</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {miembros.map((m) => (
              <tr key={m.user_id}>
                <td>{m.email}</td>
                <td>
                  <label className="company-check-label inline-flex items-center gap-2">
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
                <td className="company-td-right">
                  <button
                    type="button"
                    onClick={() => void quitar(m.user_id)}
                    disabled={soloLectura}
                    title={soloLectura ? 'Solo lectura — preview' : undefined}
                    className="company-btn company-btn-ghost company-btn-small"
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

// Datos de EJEMPLO (antes vivían en /empresa-preview, borrada): se muestran mientras el
// sistema de suscripciones esté apagado; con el flag activo la página usa datos reales.
const EJEMPLO: { sus: SuscripcionRow; miembros: Miembro[] }[] = [
  {
    sus: {
      id: -1,
      modulo: 'flow',
      periodo: 'anual',
      estado: 'activa',
      fecha_fin: new Date(Date.now() + 86400000 * 300).toISOString(),
      puestos: 5,
      user_id: '',
    },
    miembros: [
      { user_id: 'u1', email: 'ana@constructora.com', puede_editar: true, asignado_en: '' },
      { user_id: 'u2', email: 'luis@constructora.com', puede_editar: false, asignado_en: '' },
      { user_id: 'u3', email: 'maria@constructora.com', puede_editar: true, asignado_en: '' },
    ],
  },
  {
    sus: {
      id: -2,
      modulo: 'manage',
      periodo: 'semestral',
      estado: 'activa',
      fecha_fin: new Date(Date.now() + 86400000 * 150).toISOString(),
      puestos: 2,
      user_id: '',
    },
    miembros: [{ user_id: 'u4', email: 'jefe@obra.com', puede_editar: true, asignado_en: '' }],
  },
];

/** Página /empresa: gestionar los puestos (miembros del equipo) de las suscripciones empresariales — asignar por email, cambiar permiso de edición, quitar. En modo EJEMPLO muestra datos mock sin tocar BD. */
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

  // ponytail: mientras el sistema de suscripciones NO está activo, la página muestra los
  // DATOS DE EJEMPLO en solo lectura (cero RPCs — PanelSuscripcion corta con mock+soloLectura).
  // Cuando se active el flag, este bloque desaparece solo y quedan los planes reales.
  if (!SUSCRIPCIONES_ACTIVAS) {
    return (
      <div className="container mx-auto px-6 py-10 company-wrap">
        {/* h2: la rama real de esta misma ruta ya usa el único h1 de la vista. */}
        <h2 className="company-title">Equipo</h2>
        <p className="company-lead">
          Asigna puestos de tus planes empresariales por correo (el miembro debe tener cuenta
          registrada) y define quién puede editar los proyectos de la empresa.
        </p>
        <div role="status" className="company-aviso-box">
          Vista de ejemplo — el sistema de suscripciones todavía no está activo. Cuando lo esté,
          aquí verás tus planes y puestos reales.
        </div>
        <div className="company-grid">
          {EJEMPLO.map(({ sus, miembros }) => (
            <PanelSuscripcion key={sus.id} sus={sus} soloLectura mock={{ miembros }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-10 company-wrap">
      <h1 className="company-title">Equipo</h1>
      <p className="company-lead company-lead-real">
        Asigna puestos de tus planes empresariales por correo (el miembro debe tener cuenta
        registrada) y define quién puede editar los proyectos de la empresa.
      </p>

      {loading ? (
        <p className="company-muted">Cargando suscripciones…</p>
      ) : empresa.length === 0 ? (
        <div className="company-empty-box">
          <p className="company-muted">
            Aquí administrarás los puestos de tus planes empresariales. Aún no tienes una compra con
            más de un puesto.
          </p>
          <Link to="/pricing" className="company-btn company-cta">
            Ver planes
          </Link>
        </div>
      ) : (
        <div className="company-grid">
          {empresa.map((sus) => (
            <PanelSuscripcion key={sus.id} sus={sus} />
          ))}
        </div>
      )}
    </div>
  );
}
