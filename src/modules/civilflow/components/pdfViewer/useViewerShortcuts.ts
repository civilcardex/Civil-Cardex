import { useCallback, useEffect } from 'react';
import type React from 'react';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { ContextMenuState } from './drawingElementContextMenu/context.ts';
import type { ProbedElement } from './tramoEditor/context.ts';

/**
 * Revertir/rehacer/encuadrar del visor: undo/redo (limpiando las copias congeladas del panel y
 * del menú contextual), "Ajustar" (re-encuadre sobre el dibujo) y girar la etiqueta. El Ctrl+Z
 * de teclado lo maneja el propio engine; los atajos r/t/c/h/g ya viven en
 * pdfViewer/useKeyboardShortcuts.ts.
 *
 * Ejemplo: tras un undo que quitó el aparato que el menú mostraba, clearFrozenUi cierra menú y
 * panel — el usuario no sigue editando un elemento que ya no existe.
 */
export function useViewerShortcuts(args: {
  engineRef: React.RefObject<PlanoEngine | null>;
  setSelElement: React.Dispatch<React.SetStateAction<ProbedElement | null>>;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
}) {
  const { engineRef, setSelElement, setContextMenuState } = args;

  // El Ctrl+Z de teclado lo maneja el propio engine (keydown en document) — este listener
  // limpia las copias congeladas de la UI (menú contextual/panel) tras cada undo/redo.
  // (Setters estables listados en deps: identidad fija, no re-suscribe nada.)
  useEffect(() => {
    const clearFrozenUi = () => {
      setSelElement(null);
      setContextMenuState(null);
    };
    window.addEventListener('civilflow_undone', clearFrozenUi);
    return () => window.removeEventListener('civilflow_undone', clearFrozenUi);
  }, [setSelElement, setContextMenuState]);

  const handleUndo = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.undoLast();
      // El menú contextual y el panel muestran COPIAS congeladas del elemento — tras revertir
      // hay que cerrarlas o el usuario sigue viendo el aparato/accesorio que el undo ya quitó.
      setSelElement(null);
      setContextMenuState(null);
    }
    // Setters estables (identidad fija por contrato de React): listarlos no añade corridas.
  }, [engineRef, setSelElement, setContextMenuState]);
  const handleRedo = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.redoLast();
      setSelElement(null);
      setContextMenuState(null);
    }
  }, [engineRef, setSelElement, setContextMenuState]);
  const handleFit = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    // Encuadre sobre el DIBUJO (lo que el usuario trazó): recorta el fondo negro de la lámina.
    // Sin dibujo (piso vacío) cae a la hoja completa. MISMA fórmula que la entrada del visor
    // (reEncuadrarContenido) — Ajustar devuelve a la cámara de entrada exacta.
    eng.reEncuadrarContenido();
    eng.scheduleRender();
    // ponytail: sin setScale(ceil) — el observer bgOnly re-rasteriza a la densidad del
    // zoom ajustado; el setScale disparaba un renderPage COMPLETO (bg+draw+reload) duplicado.
  }, [engineRef]);

  const handleRotateLabel = useCallback(() => {
    if (engineRef.current) engineRef.current.rotateLabelSnap();
  }, [engineRef]);

  return { handleUndo, handleRedo, handleFit, handleRotateLabel };
}
