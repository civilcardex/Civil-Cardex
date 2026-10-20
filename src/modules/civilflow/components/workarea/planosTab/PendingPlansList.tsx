import { pisoLbl } from '../../../constants';
import type { PlanItem } from '../../../context/PlansContext';
import {
  PlanosTab_S8,
  PlanosTab_S9,
  PlanosTab_S10,
  PlanosTab_S11,
  PlanosTab_S12,
  PlanosTab_verBtn,
  PlanosTab_pendingLi,
} from '../PlanosTab.styles';

/**
 * Lista los planos subidos pero sin confirmar, con su estado de calibración y acciones por fila.
 * Ej: PDF recién subido -> fila con Ver, Asignar piso, Calibrar y Eliminar.
 */
export interface ListaPendientesProps {
  planos: PlanItem[];
  selectedPlanId: number | null;
  /** El plan ya tiene origen y escala propios. */
  isCalibrated: (planId: number) => boolean;
  /** Hay calibración global del proyecto (ofrece ASIGNAR PISO). */
  hayCalibracionGlobal: boolean;
  arrastrando: boolean;
  onSoltarArchivos: (files: FileList) => void;
  onArrastrar: (activo: boolean) => void;
  onSelect: (planId: number) => void;
  onAsignarPiso: (planId: number) => void;
  onCalibrar: (planId: number) => void;
  onConfirmar: (planId: number) => void;
  onEliminar: (planId: number) => void;
  onAbrirArchivos: () => void;
}

/** Panel de planos pendientes. Ej: sin planos -> zona para arrastrar PDFs. */
export function ListaPendientes(props: ListaPendientesProps) {
  const {
    planos,
    selectedPlanId,
    isCalibrated,
    hayCalibracionGlobal,
    arrastrando,
    onSoltarArchivos,
    onArrastrar,
    onSelect,
    onAsignarPiso,
    onCalibrar,
    onConfirmar,
    onEliminar,
    onAbrirArchivos,
  } = props;
  return (
    <div
      style={{
        flex: '1 1 50%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderBottom: '1px solid var(--line)',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onArrastrar(true);
      }}
      onDragLeave={() => onArrastrar(false)}
      onDrop={(e) => {
        e.preventDefault();
        onArrastrar(false);
        const fl = e.dataTransfer?.files;
        if (fl && fl.length > 0) onSoltarArchivos(fl);
      }}
    >
      <div style={PlanosTab_S8}>
        <img
          src="/iconos_civilflow/carga_planos/pendientes.webp"
          alt="Pendientes"
          width={24}
          height={24}
          style={{ width: 24, height: 24, verticalAlign: 'middle' }}
          loading="lazy"
        />
        Pendientes {planos.length > 0 && `(${planos.length})`}
      </div>
      {planos.length === 0 ? (
        <button
          type="button"
          style={PlanosTab_S9}
          aria-label="Subir planos"
          onClick={onAbrirArchivos}
        >
          {arrastrando ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#00dce5' }}>
              &#x1F4D0; SOLTAR PARA SUBIR
            </div>
          ) : (
            <>
              <div style={{ fontSize: 24, opacity: 0.3 }}>&#x1F4D0;</div>
              <span>Arrastra PDFs aquí o haz clic para subir varios planos</span>
            </>
          )}
        </button>
      ) : (
        <ul style={PlanosTab_S10}>
          {planos.map((p) => {
            const calOk = isCalibrated(p.id);
            const isSelected = selectedPlanId === p.id;
            return (
              <li
                key={p.id}
                style={{
                  ...PlanosTab_pendingLi,
                  border: isSelected
                    ? '1px solid rgba(0, 220, 229, 0.35)'
                    : '1px solid var(--line)',
                  background: isSelected ? 'rgba(0, 220, 229, 0.03)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--txt)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </span>
                  {p.nivel !== null && (
                    <span
                      style={{
                        fontSize: 12,
                        padding: '1px 5px',
                        background: 'var(--bg3)',
                        borderRadius: 'var(--r)',
                        color: 'var(--txt3)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {pisoLbl(p.nivel)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {calOk ? (
                      <span
                        style={{
                          color: 'var(--ok)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 12 }}>●</span> Calibrado
                        </span>
                        {p.definedScale ? (
                          <span style={{ color: 'var(--txt3)' }}>
                            Diseño 1:{Math.round(p.definedScale * 100)}
                          </span>
                        ) : null}
                        <span style={{ color: 'var(--txt2)' }}>
                          | Calibrada 1:{Math.round((p.scale / 100) * 100)}
                        </span>
                      </span>
                    ) : (
                      <span
                        style={{
                          color: '#F5A623',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 12 }}>●</span> Sin calibrar
                      </span>
                    )}
                  </div>

                  {calOk && p.nivel !== null && p.nivel !== undefined && (
                    <button type="button" onClick={() => onConfirmar(p.id)} style={PlanosTab_S11}>
                      CONFIRMAR
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.id)}
                    style={{
                      ...PlanosTab_verBtn,
                      background: isSelected ? 'rgba(0, 220, 229, 0.12)' : 'var(--bg3)',
                      color: isSelected ? '#00dce5' : 'var(--txt2)',
                    }}
                    title="Vista previa"
                  >
                    VER
                  </button>

                  {hayCalibracionGlobal ? (
                    <button
                      type="button"
                      onClick={() => onAsignarPiso(p.id)}
                      style={{
                        ...PlanosTab_verBtn,
                        background: 'rgba(14,204,122,0.1)',
                        color: '#0ECC7A',
                        borderColor: 'rgba(14,204,122,0.3)',
                      }}
                      title="Asignar piso al plano"
                    >
                      ASIGNAR PISO
                    </button>
                  ) : (
                    // Sin calibración global todavía, el primer plano debe calibrarse antes
                    // que nada: se ofrece CALIBRAR directo en la fila.
                    <button
                      type="button"
                      onClick={() => onCalibrar(p.id)}
                      style={{
                        ...PlanosTab_verBtn,
                        background: 'rgba(0,220,229,0.08)',
                        color: '#00dce5',
                        borderColor: 'rgba(0,220,229,0.3)',
                      }}
                      title="Calibrar el plano (primera calibración del proyecto)"
                    >
                      CALIBRAR
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onEliminar(p.id)}
                    style={PlanosTab_S12}
                    title="Eliminar plano"
                  >
                    ELIMINAR
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
