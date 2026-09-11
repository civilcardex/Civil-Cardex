// Atajos de teclado globales del visor (fuera de inputs/selects): 'r' ramal principal,
// 't' tributario, 'c' texto, 'h' grilla, 'g' snap, y Suprimir/Backspace borra la selección
// fantasma (el borrado del resto de elementos lo maneja el propio engine en su keydown).
// Los valores se leen vía ref para que el listener registrado una sola vez siempre vea el
// estado actual.
import { useEffect, useRef } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';

interface UseKeyboardShortcutsParams {
  setSnapOn: React.Dispatch<React.SetStateAction<boolean>>;
  setTool: (t: string) => void;
  setTipoTramo: (t: 'ramal' | 'tributario') => void;
  setGridOn: React.Dispatch<React.SetStateAction<boolean>>;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
}

/** Atajos de teclado del visor: r ramal principal, t tributario, c texto, h grilla, g snap y
 *  Suprimir borra la selección fantasma (el borrado del resto de elementos lo maneja el propio
 *  engine en su keydown). Los valores se leen vía ref para que el listener registrado una sola
 *  vez siempre vea el estado actual. */
export function useKeyboardShortcuts({
  setSnapOn,
  setTool,
  setTipoTramo,
  setGridOn,
  engineRef,
}: UseKeyboardShortcutsParams): void {
  const latest = useRef({ setSnapOn, setTool, setTipoTramo, setGridOn, engineRef });
  useEffect(() => {
    latest.current = { setSnapOn, setTool, setTipoTramo, setGridOn, engineRef };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA'
      )
        return;
      const {
        setSnapOn: toggleSnap,
        setTool: selectTool,
        setTipoTramo: selectTipo,
        setGridOn: toggleGrid,
        engineRef: engRef,
      } = latest.current;
      if (e.key.toLowerCase() === 'g') {
        toggleSnap((p) => !p);
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'r') {
        selectTipo('ramal');
        selectTool('line');
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 't') {
        selectTipo('tributario');
        selectTool('line');
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'c') {
        selectTool('text');
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'h') {
        toggleGrid((p) => !p);
        e.preventDefault();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (engRef.current) {
          const eng = engRef.current;
          // El engine ya maneja Suprimir por completo (PlanoEngine._onKeyDownHandler):
          // multiSel, ramal único (recorte del segmento del clic de selección vía
          // _selPointCvs) y deleteSelected — este listener solo cubre el borrado de la
          // selección fantasma, que el engine no toca.
          if (eng.selectedGhostId) {
            eng.deleteSelected([eng.selectedGhostId]);
            e.preventDefault();
          }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}
