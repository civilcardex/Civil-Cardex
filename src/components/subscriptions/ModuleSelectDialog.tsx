import { ModalShell } from '../shared/ModalShell.tsx';
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { CATALOGO, type ModuloId, type ModuloVenta } from '../../lib/subscriptions/catalog.ts';
import { estaActiva } from '../../lib/subscriptions/subscriptionsService.ts';
import { useSuscripciones } from '../../hooks/useSubscriptions.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (modulo: ModuloId) => void;
}

/** Diálogo "¿en qué módulo desea crear el proyecto?". Con el candado de suscripciones activo lista SOLO los módulos vigentes del usuario ("Activo hasta X") y con ninguno ofrece /pricing; sin candado lista todo el catálogo. Con UN solo módulo disponible va preseleccionado. */
export default function ModuleSelectDialog({ open, onClose, onPick }: Props) {
  const { rows, activos, bloqueando, decidido } = useSuscripciones();
  const [elegido, setElegido] = useState<ModuloId | null>(null);

  // Con candado: solo los módulos que tiene vigentes. Asientos de empresa incluidos:
  // `activos` (RPC mis_accesos) trae módulos por asiento sin fila propia visible para
  // el miembro. Sin candado (sistema apagado) puede crear en cualquier módulo.
  const disponibles: ModuloVenta[] = bloqueando
    ? CATALOGO.filter(
        (m) => activos.has(m.id) || rows.some((r) => r.modulo === m.id && estaActiva(r)),
      )
    : CATALOGO;

  // Reset de la elección al (re)abrir o al cambiar los módulos disponibles — patrón de
  // ajuste de estado durante render (react-hooks).
  const estadoKey = `${open}|${decidido}|${rows.length}|${activos.size}`;
  const [prevKey, setPrevKey] = useState(estadoKey);
  if (estadoKey !== prevKey) {
    setPrevKey(estadoKey);
    setElegido(null);
  }
  // Con UN solo módulo disponible va elegido de una. Derivado (no estado): también al
  // montar ya resuelto, que es lo habitual con la caché de sesión.
  // Una elección anterior solo vale si SIGUE en el catálogo visible: si el módulo se cayó
  // al revalidar, «Continuar» no debe abrir un proyecto para un módulo que ya no se ofrece.
  const elegidoValido = elegido && disponibles.some((m) => m.id === elegido) ? elegido : null;
  const elegidoActual: ModuloId | null =
    elegidoValido ?? (disponibles.length === 1 ? disponibles[0].id : null);

  if (!open) return null;

  return (
    <ModalShell ariaLabel="Elegir módulo" onClose={onClose}>
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
      <p style={{ fontSize: 12, color: 'var(--on-surface-variant, #9ba8aa)', margin: '0 0 16px' }}>
        ¿En qué módulo desea crear el proyecto?
      </p>

      {!decidido ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant, #9ba8aa)' }}>
            Verificando suscripciones...
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={onClose} style={BTN_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </>
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
                      elegidoActual === m.id
                        ? 'var(--primary, #4D8FF7)'
                        : 'var(--outline-variant, #3a3a44)'
                    }`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background:
                      elegidoActual === m.id
                        ? 'var(--surface-container-low, #141418)'
                        : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="modulo-proyecto"
                    value={m.id}
                    checked={elegidoActual === m.id}
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
                      {/* Solo las filas propias tienen fecha (fecha_fin); los asientos
                            de empresa no exponen la vigencia del titular. */}
                      {vig
                        ? `Activo hasta ${new Date(vig.fecha_fin).toLocaleDateString('es-CO')}`
                        : 'Activo'}
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
              disabled={!elegidoActual}
              onClick={() => elegidoActual && onPick(elegidoActual)}
              style={{
                ...BTN_CREAR,
                background: elegidoActual
                  ? 'var(--primary, #4D8FF7)'
                  : 'var(--surface-container-low, #141418)',
                color: elegidoActual
                  ? 'var(--on-primary, #fff)'
                  : 'var(--on-surface-variant, #9ba8aa)',
                cursor: elegidoActual ? 'pointer' : 'default',
              }}
            >
              Continuar
            </button>
          </div>
        </>
      )}
    </ModalShell>
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
