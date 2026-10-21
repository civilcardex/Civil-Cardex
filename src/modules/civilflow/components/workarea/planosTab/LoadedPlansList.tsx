import { pisoLbl } from '../../../constants';
import type { PlanItem } from '../../../context/PlansContext.tsx';
import { PlanosTab_S13, PlanosTab_S14, PlanosTab_verBtn } from '../PlanosTab.styles.ts';

/**
 * Lista los planos ya confirmados con su piso, calibración y avisos de origen compartido.
 * Ej: 3 planos cargados -> 3 filas con Ver / Calibrar / Eliminar.
 */
export interface ListaCargadosProps {
  planos: PlanItem[];
  selectedPlanId: number | null;
  /** Orígenes (px) que comparten más de una lámina. */
  origenesCompartidos: Set<string>;
  onSelect: (planId: number) => void;
  onCalibrar: (planId: number) => void;
  onEliminar: (planId: number) => void;
}

/** Panel de planos cargados. Ej: plano sin calibrar -> botón Calibrar visible. */
export function ListaCargados(props: ListaCargadosProps) {
  const { planos, selectedPlanId, origenesCompartidos, onSelect, onCalibrar, onEliminar } = props;
  return (
    <div
      style={{
        flex: '1 1 50%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={PlanosTab_S13}>
        <img
          src="/iconos_civilflow/carga_planos/cargados.webp"
          alt="Cargados"
          width={24}
          height={24}
          style={{ width: 24, height: 24, verticalAlign: 'middle' }}
          loading="lazy"
        />
        Cargados {planos.length > 0 && `(${planos.length})`}
      </div>
      {planos.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              color: 'var(--txt3)',
              fontSize: 12,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>{'\u{1F4CB}'}</div>
            Aún no hay planos cargados
          </div>
        </div>
      ) : (
        <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}>
          {planos.map((p) => (
            <li
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderBottom: '1px solid var(--line)',
                background: selectedPlanId === p.id ? 'rgba(27,110,243,.08)' : 'transparent',
                transition: 'background .1s',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--txt3)',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {p.nivel !== null && <span>{pisoLbl(p.nivel)}</span>}
                  {p.origen && origenesCompartidos.has(`${p.origen.x_px}|${p.origen.y_px}`) && (
                    <span
                      style={{ color: '#F5A623', fontSize: 11, fontWeight: 600 }}
                      title="Esta lámina comparte el origen px con otra: si las hojas no están exactamente alineadas, re-marque el origen (CALIBRAR) en el mismo punto físico del AutoCAD para que copias e isometría queden verticales entre pisos."
                    >
                      ⚠ Origen compartido
                    </span>
                  )}
                  {p.scale ? (
                    <>
                      <span style={{ color: 'var(--line)' }}>|</span>
                      {p.definedScale ? (
                        <span>Diseño 1:{Math.round(p.definedScale * 100)}</span>
                      ) : null}
                      {p.definedScale ? <span style={{ color: 'var(--line)' }}>|</span> : null}
                      <span style={{ color: 'var(--txt2)' }}>
                        Calibrada 1:{Math.round(p.scale)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCalibrar(p.id)}
                style={{ ...PlanosTab_verBtn, flexShrink: 0 }}
                title="Re-marcar origen / recalibrar esta lámina"
              >
                CALIBRAR
              </button>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                style={{
                  ...PlanosTab_verBtn,
                  background: selectedPlanId === p.id ? 'rgba(0, 220, 229, 0.12)' : 'var(--bg3)',
                  color: selectedPlanId === p.id ? '#00dce5' : 'var(--txt2)',
                  flexShrink: 0,
                }}
                title="Vista previa"
              >
                VER
              </button>
              <button
                type="button"
                onClick={() => onEliminar(p.id)}
                style={PlanosTab_S14}
                title="Eliminar"
              >
                ELIMINAR
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
