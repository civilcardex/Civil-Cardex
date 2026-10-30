/* eslint-disable no-empty */
import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import PlanoEngine, { type ElementItem } from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { usePdfAutoSave } from './usePdfAutoSave';
import { useViewerDirtySweep } from './useViewerDirtySweep.ts';
import { useSaveStatusBanner } from './useSaveStatusBanner.ts';
import { persistTrazosSnapshot } from './persistStrokes.ts';
import type { ProbedElement } from './tramoEditor/context.ts';

/**
 * Ciclo de guardado del visor: autosave (1.5 s tras editar), el snapshot de trazos que corre
 * en cada onDirty del motor, el sweep de aparatos inviables y la franja roja de error de
 * guardado. Extraído de PdfViewer en el MISMO orden en que sus piezas se ejecutan — el
 * código de guardado no se reescribe, solo cambia de archivo.
 *
 * Ejemplo: el usuario mueve un ramal → engine._emitDirty → onDirtyHandler marca sucio
 * (markDirtyRef), refresca el panel, barre aparatos inviables, persiste el snapshot local y
 * sincroniza los dibujos; 1.5 s después el autosave de usePdfAutoSave sube a BD.
 */
export function useViewerPersistence(args: {
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  currentIdRef: React.MutableRefObject<string | number | undefined>;
  loadingPlanRef: React.MutableRefObject<boolean>;
  activeNetRef: React.MutableRefObject<string>;
  syncDrawings: () => void;
  plans: PlanItem[];
  setDrawnElements: React.Dispatch<React.SetStateAction<ElementItem[]>>;
  setSelElement: React.Dispatch<React.SetStateAction<ProbedElement | null>>;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const {
    engineRef,
    currentIdRef,
    loadingPlanRef,
    activeNetRef,
    syncDrawings,
    plans,
    setDrawnElements,
    setSelElement,
    setDiamSel,
  } = args;
  const markDirtyRef = useRef<() => void>(() => {});

  const { saveStatus, setSaveStatus, doSave, autoSaveTimerRef, markDirty } = usePdfAutoSave(
    engineRef,
    currentIdRef,
    plans,
    loadingPlanRef,
  );
  useEffect(() => {
    markDirtyRef.current = markDirty;
  }, [markDirty]);
  // Sweep de aparatos inviables (dedupe + ventana anti-borrado) — refs vivían en este archivo.
  const { barreAparatos, suprimirPorBorrado } = useViewerDirtySweep();

  const onDirtyHandler = useCallback(
    (eng: PlanoEngine) => {
      markDirtyRef.current();
      setDrawnElements(eng.getElementsByNet(activeNetRef.current || 'af'));
      if (eng.selId) {
        const sel = eng.getSelected();
        if (sel) {
          const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = sel as unknown as Record<
            string,
            unknown
          >;
          setSelElement(rest as unknown as ProbedElement);
          // ponytail: single source of truth — sync diamSel immediately so panel & menu dropdowns reflect new diametro without reselection
          const d = (rest as unknown as { diametro?: string }).diametro;
          if (d)
            setDiamSel((prev) => ({
              ...prev,
              [(eng.activeNet || activeNetRef.current || 'af') as string]: d,
            }));
        }
      }
      if (loadingPlanRef.current) return;
      // Sweep de aparatos inviables + auto-bump de diámetros (hook pdfViewer/useViewerDirtySweep).
      barreAparatos(eng);
      try {
        const id = eng._loadedPlanId || currentIdRef.current || 'work';
        if (id) persistTrazosSnapshot(eng, id);
      } catch {}
      syncDrawings();
    },
    // deps verbatim de PdfViewer (los setters son estables; listarlos no añade corridas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [syncDrawings, barreAparatos],
  );

  // Error de guardado (BD o cuota local): franja roja + motivo — hook pdfViewer/useSaveStatusBanner.
  // (Vivía tras el efecto de syncEngine en PdfViewer; sus 4 listeners son de eventos globales
  // asíncronos y sin co-oyentes en el visor, así que registrarlos antes no cambia nada.)
  const bdError = useSaveStatusBanner({ setSaveStatus });

  return {
    onDirtyHandler,
    saveStatus,
    setSaveStatus,
    doSave,
    autoSaveTimerRef,
    suprimirPorBorrado,
    bdError,
  };
}
