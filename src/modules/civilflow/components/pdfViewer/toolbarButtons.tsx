/**
 * Las dos rutas de render de la barra de herramientas del visor: colapsada (franja vertical
 * compacta de iconos) y expandida (botones con etiqueta). Extraídas VERBATIM de
 * PdfViewerToolbar — la paridad entre las dos rutas es contrato (mismas herramientas, mismo
 * orden, mismos títulos). Los handlers llegan por props desde el orquestador.
 * Ej: <ToolbarCollapsed visibleTools={...} isToolActive={...} onToolClick={...} />.
 */
import './toolbarButtons.css';
import { Link } from 'react-router-dom';
import type { ToolDef } from './toolbarNetTools.ts';

export const STATUS: Record<string, { color: string; label: string }> = {
  saved: { color: '#22c55e', label: '✔ Guardado' },
  saving: { color: '#3b82f6', label: '⏳ Guardando...' },
  error: { color: '#ef4444', label: '⚠ Sin guardar' },
};

/** Mensaje amable cuando el guardado a BD falla por suscripción vencida (excepción Postgres 'suscripcion_requerida'). */
export const SUSCRIPCION_VENCIDA_TXT =
  'Suscripción vencida — tu trabajo se guarda solo en este dispositivo. Renueva en Precios para volver a guardar en la nube.';

// "Espacio" ya no aparece en la barra (herramienta Mover eliminada) — el helper queda por si
// algún shortcut vuelve a necesitar abreviarse en la franja colapsada.
export const compactShortcut = (s: string) => (s === 'Espacio' ? 'Esp' : s);

/** Estado efectivo del guardado (cualquier valor desconocido cae a 'error', como antes). */
const statusDe = (s: string): 'saved' | 'saving' | 'error' =>
  s === 'saved' || s === 'saving' ? s : 'error';

/** Props compartidas por las dos rutas: las herramientas ya filtradas + la regla de resaltado
 *  + los handlers. isToolActive/onToolClick son funciones (no identidad estable). */
export interface ToolbarRouteProps {
  visibleTools: ToolDef[];
  isToolActive: (id: string) => boolean;
  onToolClick: (id: string) => void;
  snapOn: boolean;
  gridOn: boolean;
  onSnapToggle: () => void;
  onGridToggle: () => void;
  onFit: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onClearGuides: () => void;
  currentFile: File | null;
  saveStatus: string;
  esSuscripcionVencida: boolean;
  bdError?: string | null;
}

/** Franja colapsada: columnas de iconos compactos (herramientas, snap/grilla, acciones). */
export function ToolbarCollapsed({
  visibleTools,
  isToolActive,
  onToolClick,
  snapOn,
  gridOn,
  onSnapToggle,
  onGridToggle,
  onFit,
  onSave,
  onUndo,
  onRedo,
  onClear,
  onClearGuides,
  currentFile,
  saveStatus,
  esSuscripcionVencida,
  bdError,
}: ToolbarRouteProps) {
  return (
    <>
      <div className="tb-pad">
        <div className="tb-list">
          {visibleTools.map((t) => {
            const activo = isToolActive(t.id);
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => onToolClick(t.id)}
                aria-label={t.label}
                title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
                data-active={activo ? 'true' : 'false'}
                className="tb-tool"
              >
                {/* Color del ícono: viene del catálogo de herramientas (fijo por herramienta). */}
                <span className="tb-ico" style={{ color: activo ? '#fff' : t.icoCol }}>
                  {t.ico}
                </span>
                <span className="tb-kbd">{compactShortcut(t.shortcut)}</span>
              </button>
            );
          })}
        </div>
        <div className="tb-mt-2">
          <button
            type="button"
            onClick={onSnapToggle}
            aria-label="Snap"
            title={`Snap (${'G'})`}
            data-on={snapOn ? 'true' : 'false'}
            className="tb-tool"
          >
            <span className="tb-ico">{snapOn ? '◉' : '○'}</span>
            <span className="tb-kbd">G</span>
          </button>
          <button
            type="button"
            onClick={onGridToggle}
            aria-label="Grilla (H)"
            title="Mostrar/ocultar grilla (H)"
            data-on={gridOn ? 'true' : 'false'}
            className="tb-tool"
          >
            <span className="tb-ico">{gridOn ? '▦' : '▢'}</span>
            <span className="tb-kbd">#</span>
          </button>
        </div>
      </div>

      <div className="tb-pad-bare">
        <div className="tb-list">
          <button
            type="button"
            onClick={onFit}
            disabled={!currentFile}
            aria-label="Ajustar PDF al visor"
            title={currentFile ? 'Ajustar PDF al visor' : 'Carga un plano para poder ajustarlo'}
            className="tb-tool tb-fit"
          >
            <span className="tb-ico">{'⛶'}</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            aria-label="Guardar"
            className="tb-tool"
            title={
              esSuscripcionVencida
                ? SUSCRIPCION_VENCIDA_TXT
                : bdError
                  ? `Error guardando a BD: ${bdError}`
                  : 'Guarda los trazados y cambios realizados en el plano para la red activa'
            }
          >
            <span className="tb-status-save" data-status={statusDe(saveStatus)}>
              {'💾'}
            </span>
          </button>
          {esSuscripcionVencida && (
            <Link
              to="/pricing"
              title="Ir a Precios para renovar la suscripción"
              className="tb-renew"
            >
              Renovar
            </Link>
          )}
          <button
            type="button"
            onClick={onUndo}
            aria-label="Deshacer"
            className="tb-tool"
            title="Deshacer (Ctrl + Z)"
          >
            <span className="tb-ico">{'↩'}</span>
          </button>
          <button
            type="button"
            onClick={onRedo}
            aria-label="Rehacer"
            className="tb-tool"
            title="Rehacer (Ctrl + Y)"
          >
            <span className="tb-ico">{'↪'}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpiar trazado de la red activa"
            className="tb-tool tb-danger"
            title="Eliminar todo el trazado de la red activa"
          >
            <span className="tb-ico">{'🗑'}</span>
          </button>
          <button
            type="button"
            onClick={onClearGuides}
            aria-label="Borrar todas las líneas guía"
            className="tb-tool tb-ok-soft"
            title="Borrar todas las líneas guía de todos los pisos"
          >
            <span className="tb-ico">{'≋'}</span>
          </button>
        </div>
      </div>
    </>
  );
}

/** Ruta expandida: botones con icono + etiqueta + atajo, banner de suscripción vencida. */
export function ToolbarExpanded({
  visibleTools,
  isToolActive,
  onToolClick,
  snapOn,
  gridOn,
  onSnapToggle,
  onGridToggle,
  onFit,
  onSave,
  onUndo,
  onRedo,
  onClear,
  onClearGuides,
  currentFile,
  saveStatus,
  esSuscripcionVencida,
}: ToolbarRouteProps) {
  return (
    <>
      <div className="tb-head">
        <div className="tb-head-label">Herramientas</div>
        <div className="tb-list-3">
          {visibleTools.map((t) => {
            const activo = isToolActive(t.id);
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => onToolClick(t.id)}
                aria-label={t.label}
                title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
                data-active={activo ? 'true' : 'false'}
                className="tb-btn"
              >
                <span className="tb-ico-18" style={{ color: activo ? '#fff' : t.icoCol }}>
                  {t.ico}
                </span>
                <span className="tb-btn-label">{t.label}</span>
                <span className="tb-shortcut">{t.shortcut}</span>
              </button>
            );
          })}
        </div>
        <div className="tb-mt-4">
          <button
            type="button"
            onClick={onSnapToggle}
            aria-label="Snap"
            data-on={snapOn ? 'true' : 'false'}
            className="tb-btn"
          >
            <span className="tb-ico-18">{snapOn ? '◉' : '○'}</span>
            <span className="tb-btn-label">Snap</span>
            <span className="tb-kbd-right">G</span>
          </button>
          <button
            type="button"
            onClick={onGridToggle}
            aria-label="Mostrar/ocultar grilla"
            data-on={gridOn ? 'true' : 'false'}
            className="tb-btn"
          >
            <span className="tb-ico-18">{gridOn ? '▦' : '▢'}</span>
            <span className="tb-btn-label">Grilla</span>
            <span className="tb-kbd-right">H</span>
          </button>
        </div>
      </div>

      <div className="tb-head">
        <div className="tb-head-label">Acciones</div>
        <div className="tb-list-4">
          {esSuscripcionVencida && (
            <div role="alert" className="tb-warn-banner">
              {SUSCRIPCION_VENCIDA_TXT}{' '}
              <Link
                to="/pricing"
                title="Ir a Precios para renovar la suscripción"
                className="tb-link"
              >
                Renovar
              </Link>
            </div>
          )}
          <button
            type="button"
            onClick={onFit}
            disabled={!currentFile}
            className="tb-acc tb-acc-fit"
            title={currentFile ? 'Ajustar PDF al visor' : 'Carga un plano para poder ajustarlo'}
          >
            <span className="tb-ico">{'⛶'}</span>
            <div className="tb-stack">
              <span className="tb-title">Ajustar</span>
              <span className="tb-sub">Encajar PDF al visor</span>
            </div>
          </button>
          <button
            type="button"
            onClick={onSave}
            className="tb-acc"
            title={
              esSuscripcionVencida
                ? SUSCRIPCION_VENCIDA_TXT
                : 'Guarda los trazados y cambios realizados en el plano para la red activa'
            }
          >
            <span className="tb-ico">{'\uD83D\uDCBE'}</span>
            <div className="tb-stack">
              <span className="tb-title">Guardar</span>
              <span className="tb-sub-status" data-status={statusDe(saveStatus)}>
                {STATUS[saveStatus]?.label ?? STATUS.error.label}
              </span>
            </div>
          </button>
          <button type="button" onClick={onUndo} className="tb-acc" title="Deshacer (Ctrl + Z)">
            <span className="tb-ico">{'\u21A9'}</span>
            <div className="tb-stack">
              <span className="tb-title">Deshacer (Ctrl + Z)</span>
            </div>
          </button>
          <button type="button" onClick={onRedo} className="tb-acc" title="Rehacer (Ctrl + Y)">
            <span className="tb-ico">{'\u21AA'}</span>
            <div className="tb-stack">
              <span className="tb-title">Rehacer (Ctrl + Y)</span>
            </div>
          </button>
          <button
            type="button"
            onClick={onClear}
            className="tb-acc tb-acc-danger"
            title="Eliminar todo el trazado de la red activa"
          >
            <span className="tb-ico">{'\uD83D\uDDD1'}</span>
            <div className="tb-stack">
              <span className="tb-title">Borrar elementos de red</span>
            </div>
          </button>
          <button
            type="button"
            onClick={onClearGuides}
            className="tb-acc tb-acc-ok"
            title="Borrar todas las líneas guía de todos los pisos"
          >
            <span className="tb-ico">{'\u224B'}</span>
            <div className="tb-stack">
              <span className="tb-title">Borrar líneas guía</span>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}
