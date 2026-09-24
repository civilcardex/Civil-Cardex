/**
 * Diálogo "¿en qué módulo desea crear el proyecto?": lista SOLO los módulos
 * comprados y vigentes del usuario. Con 0 activos ofrece ir a /pricing; con
 * exactamente 1 entra directo (sin paso de selección).
 */
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CATALOGO, type ModuloId, type ModuloVenta } from '../../lib/suscripciones/catalogo';
import { estaActiva } from '../../lib/suscripciones/suscripcionesService';
import { useSuscripciones } from '../../hooks/useSuscripciones';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (modulo: ModuloId) => void;
}

const DIALOG_STYLE: CSSProperties = {
  background: 'var(--surface-container, #1e1e24)',
  border: '1px solid var(--outline-variant, #3a3a44)',
  borderRadius: 8,
  padding: 24,
  minWidth: 360,
  maxWidth: 420,
  boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
};

export default function ModuleSelectDialog({ open, onClose, onPick }: Props) {
  const { rows, loading } = useSuscripciones();
  const [elegido, setElegido] = useState<ModuloId | null>(null);

  const disponibles: ModuloVenta[] = CATALOGO.filter((m) =>
    rows.some((r) => r.modulo === m.id && estaActiva(r)),
  );

  // Reset al (re)abrir o al llegar datos, y con UN solo módulo comprado va
  // preseleccionado — patrón de ajuste de estado durante render (react-hooks).
  const estadoKey = `${open}|${loading}|${rows.length}`;
  const [prevKey, setPrevKey] = useState(estadoKey);
  if (estadoKey !== prevKey) {
    setPrevKey(estadoKey);
    setElegido(null);
    if (open && !loading && disponibles.length === 1) {
      setElegido(disponibles[0].id);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
    >
      <div style={DIALOG_STYLE} role="dialog" aria-modal="true" aria-label="Elegir módulo">
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--on-surface, #e2e2e8)',
            margin: '0 0 4px',
          }}
        >
          Nuevo proyecto
        </h3>
        <p
          style={{ fontSize: 12, color: 'var(--on-surface-variant, #9ba8aa)', margin: '0 0 16px' }}
        >
          ¿En qué módulo desea crear el proyecto?
        </p>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)' }}>
            Verificando suscripciones...
          </p>
        ) : disponibles.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)' }}>
              No tiene módulos activos. Adquiera un plan para crear proyectos.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose} style={BTN_SECUNDARIO}>
                Cerrar
              </button>
              <Link to="/pricing" style={BTN_PRIMARIO_LINK} onClick={onClose}>
                Ver planes
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div
              role="radiogroup"
              aria-label="Módulos disponibles"
              style={{ display: 'grid', gap: 8 }}
            >
              {disponibles.map((m) => {
                const vig = rows.find((r) => r.modulo === m.id && estaActiva(r));
                return (
                  <label
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      border: `1px solid ${
                        elegido === m.id
                          ? 'var(--primary, #4D8FF7)'
                          : 'var(--outline-variant, #3a3a44)'
                      }`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background:
                        elegido === m.id ? 'var(--surface-container-low, #141418)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="modulo-proyecto"
                      value={m.id}
                      checked={elegido === m.id}
                      onChange={() => setElegido(m.id)}
                      aria-label={m.nombre}
                    />
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--on-surface, #e2e2e8)',
                        }}
                      >
                        {m.nombre}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--on-surface-variant, #9ba8aa)' }}>
                        {vig
                          ? `Activo hasta ${new Date(vig.fecha_fin).toLocaleDateString('es-CO')}`
                          : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={onClose} style={BTN_SECUNDARIO}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!elegido}
                onClick={() => elegido && onPick(elegido)}
                style={{
                  ...BTN_CREAR,
                  background: elegido
                    ? 'var(--primary, #4D8FF7)'
                    : 'var(--surface-container-low, #141418)',
                  color: elegido ? 'var(--on-primary, #fff)' : 'var(--on-surface-variant, #9ba8aa)',
                  cursor: elegido ? 'pointer' : 'default',
                }}
              >
                Continuar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const BTN_SECUNDARIO: CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  background: 'transparent',
  border: '1px solid var(--outline-variant, #3a3a44)',
  borderRadius: 4,
  color: 'var(--on-surface, #e2e2e8)',
  cursor: 'pointer',
};

const BTN_CREAR: CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  borderRadius: 4,
};

const BTN_PRIMARIO_LINK: CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  background: 'var(--primary, #4D8FF7)',
  border: 'none',
  borderRadius: 4,
  color: 'var(--on-primary, #fff)',
  textDecoration: 'none',
  display: 'inline-block',
};
