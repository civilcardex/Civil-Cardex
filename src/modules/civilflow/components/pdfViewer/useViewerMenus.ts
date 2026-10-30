/** Estado del menú contextual del lienzo (clic derecho): posición, elemento y snapshot re-sincronizado con el motor para mostrar diámetro/material vivos. Ej: si el motor sube el diámetro de RAF1 con el menú abierto, el menú se re-estampa con el valor fresco. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement } from '../../lib/PlanoEngine/PlanoState.ts';
import type { ContextMenuState } from './drawingElementContextMenu/context.ts';
import type { ProbedElement } from './tramoEditor/context.ts';

/** Snapshot re-sincronizado con el motor: si cambia el diámetro/material con el menú abierto, el efecto lo re-estampa con el valor fresco. */
export function useViewerMenus(args: {
  engineRef: React.RefObject<PlanoEngine | null>;
  selElement: ProbedElement | null;
}) {
  const { engineRef, selElement } = args;

  // ── Estado de diálogos ──
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  // ponytail: keep context menu snapshot in sync with engine source of truth for diametro/material etc.
  useEffect(() => {
    if (!contextMenuState?.visible || !contextMenuState.element) return;
    const eng = engineRef.current;
    if (!eng) return;
    const eid = (contextMenuState.element as { id?: string }).id;
    if (!eid) return;
    const fresh =
      eng.ramales.find((r) => r.id === eid) ||
      eng.bajantes.find((b) => b.id === eid) ||
      eng.textAnnots.find((t) => t.id === eid) ||
      eng.areas.find((a) => a.id === eid) ||
      eng.guideLines.find((g) => g.id === eid);
    if (!fresh) return;
    const snap = contextMenuState.element as unknown as Record<string, unknown>;
    const live = fresh as unknown as Record<string, unknown>;
    if (
      snap.diametro !== live.diametro ||
      snap.material !== live.material ||
      snap.accesorioInicio !== live.accesorioInicio ||
      snap.accesorioFin !== live.accesorioFin ||
      snap.aparatoInicio !== live.aparatoInicio ||
      snap.aparatoFin !== live.aparatoFin
    ) {
      setContextMenuState((prev) =>
        prev ? { ...prev, element: { ...fresh } as unknown as typeof prev.element } : null,
      );
    }
    // engineRef añadido: ref estable (identidad fija) — sin cambio de conducta.
  }, [selElement, contextMenuState?.visible, contextMenuState?.element, engineRef]);

  const contextMenuCbRef = useRef<
    | ((
        bajante: PlanoElement,
        x: number,
        y: number,
        isGhostClick?: boolean,
        ramalEndpoint?: { idx: number; x: number; y: number } | null,
        midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
      ) => void)
    | null
  >(null);
  const onContextMenuCb = useCallback(
    (
      bajante: PlanoElement,
      x: number,
      y: number,
      isGhostClick?: boolean,
      ramalEndpoint?: { idx: number; x: number; y: number } | null,
      midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
    ) => {
      setContextMenuState({
        visible: true,
        x,
        y,
        element: bajante,
        isGhostClick,
        ramalEndpoint,
        midRamalHit,
      });
    },
    [],
  );
  // (Vivía tras useViewerDialogs en PdfViewer; asignar una ref no interactúa con nada.)
  useEffect(() => {
    contextMenuCbRef.current = onContextMenuCb;
  }, [onContextMenuCb]);

  return { contextMenuState, setContextMenuState, onContextMenuCb, contextMenuCbRef };
}
