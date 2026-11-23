import { useState, type FormEvent, type RefObject } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';

interface Props {
  engineRef: RefObject<PlanoEngine | null>;
  drawing: boolean;
  disabled: boolean;
  onSave: () => void;
  onUndo: () => void;
  onOptions?: (button: HTMLButtonElement) => void;
}

export function ViewerDrawingActions({
  engineRef,
  drawing,
  disabled,
  onSave,
  onUndo,
  onOptions,
}: Props) {
  const [message, setMessage] = useState('');

  function addPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const engine = engineRef.current;
    if (!engine || disabled) return;
    const data = new FormData(event.currentTarget);
    const x = Number(data.get('x'));
    const y = Number(data.get('y'));
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 ||
      y < 0 ||
      (engine.pageW > 0 && x > engine.pageW) ||
      (engine.pageH > 0 && y > engine.pageH)
    ) {
      setMessage('El punto debe quedar dentro del plano.');
      return;
    }
    const point = engine.toCvs(x, y);
    const rect = engine._cachedRect();
    const width = engine.canv.width / engine.dpr;
    const height = engine.canv.height / engine.dpr;
    if (!width || !height) return;
    const previous = engine.activeRamal?.pts.length ?? 0;
    engine._onDownHandler(
      new MouseEvent('mousedown', {
        clientX: rect.left + (point.x * rect.width) / width,
        clientY: rect.top + (point.y * rect.height) / height,
      }),
    );
    const count = engine.activeRamal?.pts.length ?? 0;
    setMessage(
      count > previous
        ? `Puntos del ramal: ${count}`
        : 'Sin puntos nuevos. Revisa el estado del lienzo.',
    );
  }

  return (
    <div className="viewer-drawing-actions" role="group" aria-label="Acciones del dibujo">
      {drawing && (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const engine = engineRef.current;
              if ((engine?.activeRamal?.pts.length ?? 0) < 2) {
                setMessage('Coloca al menos dos puntos para terminar el ramal.');
                return;
              }
              engine?.finishRamal();
              setMessage('Trazado finalizado.');
            }}
          >
            Terminar
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              engineRef.current?.cancelRamal();
              setMessage('Trazado cancelado.');
            }}
          >
            Cancelar
          </button>
          <details>
            <summary>Trazar por coordenadas</summary>
            <form onSubmit={addPoint}>
              <label>
                X (px) <input name="x" type="number" min="0" step="any" required />
              </label>
              <label>
                Y (px) <input name="y" type="number" min="0" step="any" required />
              </label>
              <button disabled={disabled}>Añadir punto</button>
            </form>
          </details>
        </>
      )}
      {onOptions && (
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => onOptions(event.currentTarget)}
        >
          Opciones
        </button>
      )}
      <button type="button" className="viewer-coarse-action" disabled={disabled} onClick={onUndo}>
        Deshacer
      </button>
      <button type="button" className="viewer-coarse-action" disabled={disabled} onClick={onSave}>
        Guardar
      </button>
      <output aria-live="polite">{drawing ? message : ''}</output>
    </div>
  );
}

export function ViewerPlanSteps({
  index,
  count,
  onSelect,
}: {
  index: number;
  count: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="viewer-plan-steps" role="group" aria-label="Cambiar de plano">
      <button
        type="button"
        className="viewer-plan-control"
        aria-label="Plano anterior"
        disabled={index <= 0}
        onClick={() => onSelect(index - 1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="viewer-plan-control"
        aria-label="Plano siguiente"
        disabled={index < 0 || index >= count - 1}
        onClick={() => onSelect(index + 1)}
      >
        ›
      </button>
    </div>
  );
}
