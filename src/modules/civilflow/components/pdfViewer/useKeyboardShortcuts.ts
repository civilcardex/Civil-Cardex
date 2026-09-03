// Atajos de teclado globales del visor (fuera de inputs/selects): 'g' alterna snap, 'c'
// selecciona contador (af/gas) o canal (si la red recolectora está activa), 'h' calentador,
// y Suprimir/Backspace borra la selección fantasma (el borrado del resto de elementos lo
// maneja el propio engine en su keydown). Los valores se leen vía ref para que el listener
// registrado una sola vez siempre vea el estado actual.
import { useEffect, useRef } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';

interface UseKeyboardShortcutsParams {
  setSnapOn: React.Dispatch<React.SetStateAction<boolean>>;
  setTool: (t: string) => void;
  activeNet: string;
  recolectoraActive: boolean;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
}

/** Atajos de teclado del visor: g alterna snap, c elige contador o canal, h calentador y
 *  Suprimir borra la selección fantasma. El estado se lee vía ref para que el listener único
 *  siempre vea los valores actuales. */
export function useKeyboardShortcuts({
  setSnapOn,
  setTool,
  activeNet,
  recolectoraActive,
  engineRef,
}: UseKeyboardShortcutsParams): void {
  const latest = useRef({ setSnapOn, setTool, activeNet, recolectoraActive, engineRef });
  useEffect(() => {
    latest.current = { setSnapOn, setTool, activeNet, recolectoraActive, engineRef };
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
        activeNet: net,
        recolectoraActive: recActive,
        engineRef: engRef,
      } = latest.current;
      if (e.key.toLowerCase() === 'g') {
        toggleSnap((p) => !p);
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'c') {
        // Espejo del manejador 'c' del engine: contador en af/gas, canal en el resto (si canal
        // recolectora está activa).
        if (net === 'af' || net === 'gas') {
          selectTool('cont');
        } else if (recActive) {
          selectTool('canal');
        } else {
          selectTool('cont');
        }
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'h') {
        selectTool('calent');
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
