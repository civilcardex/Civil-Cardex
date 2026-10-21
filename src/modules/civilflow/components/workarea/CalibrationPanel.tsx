import { pisoLbl } from '../../constants';
import type { Piso } from '../../lib/shared/proyectoTipos.ts';
import type { PlanItem } from '../../context/PlanosContexto.tsx';
import {
  PlanoConfigurator_S3,
  PlanoConfigurator_S4,
  PlanoConfigurator_S5,
  PlanoConfigurator_S6,
  PlanoConfigurator_S7,
  PlanoConfigurator_S8,
  PlanoConfigurator_S9,
  PlanoConfigurator_S10,
  PlanoConfigurator_S11,
  PlanoConfigurator_bannerBase,
  PlanoConfigurator_stepHeader,
  PlanoConfigurator_origenBtn,
  PlanoConfigurator_trazarBtn,
} from './PlanoConfiguradorEstilos.ts';

/**
 * Panel de calibración a la derecha del visor: asignar nivel, marcar origen, calibrar X/Y y guardar.
 * Ej: plano sin origen -> el paso de origen queda activo y Guardar deshabilitado hasta completar.
 */

/** Estado de calibración que el panel muestra (viene del hook useCalibration). */
export interface EstadoCalibracionPanel {
  origen: { x_px: number; y_px: number } | null;
  modoOrigen: boolean;
  modoCalX: boolean;
  modoCalY: boolean;
  lenX: string;
  lenY: string;
  factorX: number | null;
  factorY: number | null;
  scaleM: number | null;
  definedScale: number | null;
  preScaleM: number | null;
}

export interface PanelCalibracionProps {
  cal: EstadoCalibracionPanel;
  /** Nivel asignado al plano (null = sin asignar). */
  planNivel: number | null;
  planId: number;
  pisos: Piso[];
  plans: PlanItem[];
  /** La lámina es un PDF (72 dpi) y no una imagen (96 dpi). */
  isPdf: boolean;
  saved: boolean;
  hasSaved: boolean;
  onUpdateNivel: (planId: number, nivel: number | null) => void;
  onSetDefinedScale: (v: number | null) => void;
  onSetPreScale: (v: number | null) => void;
  onActivarOrigen: () => void;
  onQuitarOrigen: () => void;
  onSetLenX: (v: string) => void;
  onSetLenY: (v: string) => void;
  onActivarCalX: () => void;
  onActivarCalY: () => void;
  onQuitarFactorX: () => void;
  onQuitarFactorY: () => void;
  onGuardar: () => void;
  /** Marca el formulario como modificado: al cambiar algo, la calibración deja de estar completada. */
  onMarcarModificado: () => void;
}

/** Panel de calibración en 4 pasos más guardar. Ej: plano sin origen -> paso 2 activo. */
export function PanelCalibracion(props: PanelCalibracionProps) {
  const {
    cal,
    planNivel,
    planId,
    pisos,
    plans,
    isPdf,
    saved,
    hasSaved,
    onUpdateNivel,
    onSetDefinedScale,
    onSetPreScale,
    onActivarOrigen,
    onQuitarOrigen,
    onSetLenX,
    onSetLenY,
    onActivarCalX,
    onActivarCalY,
    onQuitarFactorX,
    onQuitarFactorY,
    onGuardar,
    onMarcarModificado,
  } = props;
  const {
    origen,
    modoOrigen,
    modoCalX,
    modoCalY,
    lenX,
    lenY,
    factorX,
    factorY,
    scaleM,
    definedScale,
    preScaleM,
  } = cal;
  const tieneOrigen = origen !== null;
  const pisoCompletado =
    planNivel !== null && tieneOrigen && (scaleM !== null || preScaleM !== null) && hasSaved;

  return (
    <div
      style={{
        width: 230,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--line)',
        background: 'var(--bg)',
        overflowY: 'auto',
      }}
    >
      {/* Banner de cabecera - cambia de color cuando la calibración del piso está completa */}
      <div
        style={{
          ...PlanoConfigurator_bannerBase,
          background: pisoCompletado ? 'rgba(14,204,122,0.15)' : 'rgba(245,158,11,0.08)',
          color: pisoCompletado ? 'var(--ok)' : '#F5A623',
          border: `1px solid ${pisoCompletado ? 'var(--ok)' : 'rgba(245,158,11,0.2)'}`,
        }}
      >
        {pisoCompletado ? '✓ Calibración Completada' : '⚠ Calibración Pendiente'}
      </div>

      {/* Paso 1: Nivel */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
        <div
          style={{
            ...PlanoConfigurator_stepHeader,
            color: planNivel !== null ? 'var(--ok)' : 'var(--txt3)',
          }}
        >
          <span>1. Asignar nivel</span>
          {planNivel !== null && <span style={{ color: 'var(--ok)' }}>✓</span>}
        </div>
        <select
          value={planNivel ?? ''}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            onUpdateNivel(planId, v);
            onMarcarModificado();
          }}
          aria-label="Seleccionar nivel de plano"
          style={PlanoConfigurator_S3}
        >
          <option value="">— Nivel —</option>
          {pisos
            .toSorted((a, b) => b.n - a.n)
            .map((s) => {
              const ocupado = plans.some(
                (x) => x.id !== planId && x.status === 'confirmed' && x.nivel === s.n,
              );
              return (
                <option key={s.id} value={s.n} disabled={ocupado}>
                  {pisoLbl(s.n)} ({s.npt} m){ocupado ? ' (ocupado)' : ''}
                </option>
              );
            })}
        </select>

        {/* Escala - definida y calibrada lado a lado */}
        <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: definedScale ? 'var(--ok)' : 'var(--txt3)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
                whiteSpace: 'nowrap',
              }}
            >
              Escala definida
            </div>
            <select
              value={definedScale ? Math.round(definedScale * 100) : ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                if (val) {
                  const dScale = val / 100;
                  onSetDefinedScale(dScale);
                  onSetPreScale(dScale * (96 / (isPdf ? 72 : 96)));
                } else {
                  onSetDefinedScale(null);
                  onSetPreScale(null);
                }
                onMarcarModificado();
              }}
              aria-label="Seleccionar escala definida del plano"
              style={PlanoConfigurator_S4}
            >
              <option value="">— Escala —</option>
              {(() => {
                const PREDEF = [50, 75, 100, 125, 150, 200, 250, 500];
                const calVal = definedScale ? Math.round(definedScale * 100) : 0;
                const hasCal = calVal > 0 && !PREDEF.includes(calVal);
                const opts = hasCal ? [...PREDEF, calVal].sort((a, b) => a - b) : PREDEF;
                return opts.map((v) => (
                  <option key={v} value={v}>
                    1:{v}
                  </option>
                ));
              })()}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: scaleM ? 'var(--ok)' : 'var(--txt3)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
                whiteSpace: 'nowrap',
              }}
            >
              Escala calibrada
            </div>
            {scaleM ? (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--acc)',
                  fontFamily: 'monospace',
                  padding: '5px 0',
                  whiteSpace: 'nowrap',
                }}
              >
                1:{Math.round(scaleM * 100)}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--txt4)',
                  padding: '5px 0',
                  whiteSpace: 'nowrap',
                }}
              >
                — Sin calibrar
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paso 2: Origen */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
        <div
          style={{
            ...PlanoConfigurator_stepHeader,
            color: tieneOrigen ? 'var(--ok)' : 'var(--txt3)',
          }}
        >
          <span>2. Definir origen</span>
          {tieneOrigen && <span style={{ color: 'var(--ok)' }}>✓</span>}
        </div>
        <button
          type="button"
          onClick={onActivarOrigen}
          style={{
            ...PlanoConfigurator_origenBtn,
            background: modoOrigen ? 'rgba(245,166,35,0.15)' : 'var(--bg3)',
            border: `1.5px solid ${modoOrigen ? '#F5A623' : 'var(--line)'}`,
            color: modoOrigen ? '#F5A623' : 'var(--txt2)',
          }}
        >
          📍 Definir origen en plano
        </button>
        {origen && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--ok)', fontFamily: 'monospace' }}>
              ✓ ({origen.x_px.toFixed(0)}, {origen.y_px.toFixed(0)}) px
            </span>
            <button
              type="button"
              aria-label="Quitar origen"
              onClick={onQuitarOrigen}
              style={PlanoConfigurator_S5}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Pasos 3 y 4: Calibrar X e Y */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...PlanoConfigurator_stepHeader,
              color: factorX !== null ? 'var(--ok)' : 'var(--txt3)',
            }}
          >
            <span>3. Cal X</span>
            {factorX !== null && <span style={{ color: 'var(--ok)' }}>✓</span>}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="(m)"
              value={lenX}
              onChange={(e) => onSetLenX(e.target.value.replace(/,/g, '.'))}
              aria-label="Longitud del eje X (m)"
              disabled={modoCalX}
              style={PlanoConfigurator_S6}
            />
            <button
              type="button"
              onClick={onActivarCalX}
              style={{
                ...PlanoConfigurator_trazarBtn,
                background: modoCalX ? 'rgba(77,143,247,0.15)' : 'var(--bg3)',
                border: `1.5px solid ${modoCalX ? '#4D8FF7' : 'var(--line)'}`,
                color: modoCalX ? '#4D8FF7' : 'var(--txt2)',
              }}
            >
              {modoCalX ? 'Cancelar' : 'Trazar'}
            </button>
          </div>
          {factorX && (
            <div style={PlanoConfigurator_S7}>
              ✓ {factorX.toFixed(4)}
              <button
                type="button"
                aria-label="Quitar factor X"
                onClick={onQuitarFactorX}
                style={PlanoConfigurator_S8}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...PlanoConfigurator_stepHeader,
              color: factorY !== null ? 'var(--ok)' : 'var(--txt3)',
            }}
          >
            <span>4. Cal Y</span>
            {factorY !== null && <span style={{ color: 'var(--ok)' }}>✓</span>}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="(m)"
              value={lenY}
              onChange={(e) => onSetLenY(e.target.value.replace(/,/g, '.'))}
              aria-label="Longitud del eje Y (m)"
              disabled={modoCalY}
              style={PlanoConfigurator_S9}
            />
            <button
              type="button"
              onClick={onActivarCalY}
              style={{
                ...PlanoConfigurator_trazarBtn,
                background: modoCalY ? 'rgba(14,204,122,0.15)' : 'var(--bg3)',
                border: `1.5px solid ${modoCalY ? '#0ECC7A' : 'var(--line)'}`,
                color: modoCalY ? '#0ECC7A' : 'var(--txt2)',
              }}
            >
              {modoCalY ? 'Cancelar' : 'Trazar'}
            </button>
          </div>
          {factorY && (
            <div style={PlanoConfigurator_S10}>
              ✓ {factorY.toFixed(4)}
              <button
                type="button"
                aria-label="Quitar factor Y"
                onClick={onQuitarFactorY}
                style={PlanoConfigurator_S11}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div
        style={{
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <button
          type="button"
          onClick={onGuardar}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: saved ? 'rgba(14,204,122,0.15)' : 'var(--acc)',
            border: saved ? '1.5px solid #0ECC7A' : 'none',
            borderRadius: 'var(--r)',
            color: saved ? '#0ECC7A' : '#fff',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            transition: 'background-color .15s, border-color .15s, color .15s',
          }}
        >
          {saved ? '✓ Configuración guardada' : '💾 Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
