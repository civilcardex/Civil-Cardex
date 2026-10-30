/** Handlers de la toolbar del visor: limpiar red, borrar líneas guía (con confirmación), guardar ya, snap y cuadrícula. Ej: "Limpiar red" pregunta antes de borrar el trazado af (Agua Fria) activo y deja revertir con Ctrl+Z. */
import { useCallback } from 'react';
import type React from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { NETS } from '../../lib/PlanoEngine/PlanoState.ts';
import type { ProbedElement } from './tramoEditor/context.ts';

export function useViewerToolbarActions(args: {
  engineRef: React.RefObject<PlanoEngine | null>;
  activeNet: string;
  setSelElement: (el: ProbedElement | null) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  doSave: () => void;
  autoSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setSnapOn: React.Dispatch<React.SetStateAction<boolean>>;
  setGridOn: React.Dispatch<React.SetStateAction<boolean>>;
}): {
  handleClear: () => void;
  handleClearGuides: () => void;
  handleSave: () => void;
  handleSnapToggle: () => void;
  handleGridToggle: () => void;
} {
  const {
    engineRef,
    activeNet,
    setSelElement,
    triggerConfirm,
    doSave,
    autoSaveTimerRef,
    setSnapOn,
    setGridOn,
  } = args;
  const handleClear = useCallback(() => {
    if (!engineRef.current) return;
    const netId = activeNet;
    const netName = NETS.find((n) => n.id === netId)?.name || netId;
    triggerConfirm(
      'Limpiar red',
      `¿Deseas eliminar todo el trazado de la red activa (${netName})? Puedes revertirlo con Ctrl + Z.`,
      () => {
        engineRef.current?.clearNet(netId);
        setSelElement(null);
      },
    );
  }, [engineRef, activeNet, setSelElement, triggerConfirm]);
  const handleClearGuides = useCallback(() => {
    if (!engineRef.current) return;
    triggerConfirm(
      'Borrar líneas guía',
      '¿Deseas eliminar todas las líneas guía de todos los pisos? Puedes revertirlo con Ctrl + Z.',
      () => {
        const eng = engineRef.current;
        if (eng) {
          eng.guideLines = [];
          eng.selId = null;
          eng.render();
          eng._markDirty();
        }
        setSelElement(null);
      },
    );
  }, [engineRef, setSelElement, triggerConfirm]);
  const handleSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    doSave();
  }, [autoSaveTimerRef, doSave]);
  const handleSnapToggle = useCallback(() => setSnapOn((prev) => !prev), [setSnapOn]);
  const handleGridToggle = useCallback(() => setGridOn((prev) => !prev), [setGridOn]);
  return { handleClear, handleClearGuides, handleSave, handleSnapToggle, handleGridToggle };
}
