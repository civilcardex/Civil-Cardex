import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';

interface Props {
  engineRef: RefObject<PlanoEngine | null>;
  drawing: boolean;
  disabled: boolean;
  onSave: () => void;
  onUndo: () => void;
  onOptions?: (button: HTMLButtonElement) => void;
  /** Punta táctil (tablet): la franja se reduce a «Opciones» (acceso al menú contextual, que
   *  en PC es el clic derecho). Terminar queda en escritorio; Cancelar también en tablet. */
  tablet?: boolean;
}

export function ViewerDrawingActions({
  engineRef,
  drawing,
  disabled,
  onSave,
  onUndo,
  onOptions,
  tablet,
}: Props) {
  const [message, setMessage] = useState('');
  /* H-10: el keydown global del motor trata Enter/Escape como CANCELAR el trazado — sin
   * frenarlo, enviar el form por Enter cancelaba el ramal en curso. El listener va IMPERATIVO
   * (ref + addEventListener, sin stopPropagation en JSX) para satisfacer jsx-a11y
   * no-noninteractive-element-interactions en <details>/<form>. */
  const coordRef = useRef<HTMLDetailsElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    const details = coordRef.current;
    if (!details) return;
    const frenar = (e: Event): void => e.stopPropagation();
    details.addEventListener('keydown', frenar);
    return () => details.removeEventListener('keydown', frenar);
    /* `drawing` en deps: el <details> SOLO existe dibujando (montaje diferido) — sin esto el
     * ref era null al correr el efecto y el freno nunca se adjuntaba (H-10). */
  }, [drawing]);

  /* H-10 (remediación 2026-11-27): entrada de puntos POR COORDENADAS, recuperada como opción
   * accesible del visor de ESCRITORIO (crear/completar un ramal sin puntero). Los límites del
   * plano se validan y el error se anuncia en el output aria-live. */
  function addPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const engine = engineRef.current;
    if (!engine || disabled) return;
    const data = new FormData(event.currentTarget);
    const x = Number(data.get('x'));
    const y = Number(data.get('y'));
    if (
      data.get('x') === '' ||
      data.get('y') === '' ||
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
      {drawing && !tablet && (
        <>
          <button
            type="button"
            className="viewer-trace-action"
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
            <span>Terminar</span>
          </button>
          {/* Accesible con teclado (H-10): X/Y + Enter agrega el punto sin puntero. */}
          <details ref={coordRef}>
            <summary>Trazar por coordenadas</summary>
            {/* stopPropagation: el keydown global del motor trata Enter/Escape como
             *  CANCELAR el trazado — sin esto, enviar el form por Enter cancelaba el
             *  ramal que se está trazando (H-10). */}
            <form ref={formRef} onSubmit={addPoint} noValidate>
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
      {drawing && (
        <button
          type="button"
          className="viewer-trace-action"
          disabled={disabled}
          onClick={() => {
            engineRef.current?.cancelRamal();
            setMessage('Trazado cancelado.');
          }}
        >
          <span>Cancelar</span>
        </button>
      )}
      {onOptions && (
        <button
          type="button"
          className="viewer-trace-action"
          disabled={disabled}
          onClick={(event) => onOptions(event.currentTarget)}
        >
          <span>Opciones</span>
        </button>
      )}
      {/* Deshacer/Guardar SOLO escritorio: en tablet la franja se reduce a «Opciones» — el
       *  autosave (1,5 s) guarda solo. */}
      {!tablet && (
        <>
          <button
            type="button"
            className="viewer-coarse-action"
            disabled={disabled}
            onClick={onUndo}
          >
            Deshacer
          </button>
          <button
            type="button"
            className="viewer-coarse-action"
            disabled={disabled}
            onClick={onSave}
          >
            Guardar
          </button>
        </>
      )}
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
