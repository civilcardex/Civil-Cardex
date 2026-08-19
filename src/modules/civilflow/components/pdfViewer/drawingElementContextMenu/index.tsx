import { memo, useEffect, useRef, useState } from 'react';
import { loadFromStorage } from '../../../services/storageService';
import { APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys';
import { junctionRespectsTributarioDirection } from '../../../utils/flowDirection';
import { aparatoEnExtremoInvalido } from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import { moveAllAparatoCounts } from '../../../utils/syncExtremeAccessory';
import { writeHydroDrawingSync } from '../../../utils/drawingSync';
import UcMoveModal, { type UcMoveModalState } from '../UcMoveModal';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../../lib/shared/projectTypes';
import type { PlanItem } from '../../../context/PlansContext';
import type { MaterialItem } from '../../../context/ProjectContext';
import {
  DrawingElementContextMenuCtx,
  useDrawingElementContextMenu,
  MENU_PANEL_STYLE,
  type ContextMenuState,
  type LowerFloorRamales,
  type ProbedElement,
} from './context';
import { BajanteMenu } from './bajanteMenus';
import { AreaMenu, ContadorMenu, CalentadorMenu, CanalMenu } from './otherMenus';
import { GuideLineMenu } from './guideLineMenu';
import { RamalMenu } from './ramalMenu';

interface DrawingElementContextMenuProps {
  contextMenuState: ContextMenuState | null;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  selectedNivel: number | null;
  pisos: Piso[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  lowerFloorsRamales: LowerFloorRamales[];
  upperFloorGroup: LowerFloorRamales | null;
  planosCtx: { plans: PlanItem[] };
  mats: Record<string, MaterialItem[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
}

export default memo(function DrawingElementContextMenu(props: DrawingElementContextMenuProps) {
  const state = props.contextMenuState;

  // El modal "Cambio de dirección de flujo" vive en el raíz (NO dentro del menú): al abrirlo se
  // cierra el menú contextual y el modal queda portaleado a body — el plano se ve completo, el
  // modal queda centrado y movible (ver UcMoveModal.tsx). Como el raíz puede volver a renderizar
  // con el menú cerrado, el estado y la lógica de confirmación se mantienen aquí, no en RamalMenu.
  const [ucMoveState, setUcMoveState] = useState<UcMoveModalState>({
    isOpen: false,
    sourceLabel: '',
    options: [],
  });
  const closeUcMove = () => setUcMoveState({ isOpen: false, sourceLabel: '', options: [] });

  const openUcMove = (s: UcMoveModalState) => {
    setUcMoveState(s);
    props.setContextMenuState(null);
  };

  // F1: al invertir la dirección de un ramal interconectado (af/ac/gas, no tributario) con UC
  // asignadas y al menos un vecino directo, el usuario elige a qué ramal de la conexión se
  // mueven las unidades de consumo. Sin UC o sin vecinos → toggle directo sin modal.
  const readUcInfo = (ramal: PlanoRamal): { planId: string | number | null; total: number } => {
    const all =
      loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {}) || {};
    for (const p of props.planosCtx?.plans || []) {
      if (p.status !== 'confirmed') continue;
      const rec = all[`${ramal.net}_${ramal.id}_${p.id}`];
      if (rec && Object.keys(rec).length > 0) {
        const total = Object.values(rec).reduce((s, n) => s + (n || 0), 0);
        if (total > 0) return { planId: p.id, total };
      }
    }
    return { planId: null, total: 0 };
  };

  const doInvert = (ramal: PlanoRamal, targetId: string | null) => {
    const eng = props.engineRef.current;
    if (!eng) return;
    // Sin objetivo (toggle directo sin modal): se mantiene el toggle de _tribReversed sobre el
    // ramal del menú con validación de unión, como antes.
    if (!targetId) {
      const val = !ramal._tribReversed;
      eng.updateElementById(ramal.id, { _tribReversed: val });
      const fresh = eng.ramales.find((x) => x.id === ramal.id);
      // Cuando un tributario participa en la unión de cualquiera de los dos extremos,
      // la regla se endurece a "exactamente 1 entrada" (ver
      // junctionRespectsTributarioDirection) — "al menos 1 salida" no basta ahí, porque
      // el tributario ya aporta su propia salida fija sin importar qué pase con el
      // resto del grupo (existing/downstream podrían quedar los dos como salida o los
      // dos como entrada, y "al menos 1 salida" no lo detectaría).
      const okAtBothEnds = fresh
        ? [fresh.pts[0], fresh.pts[fresh.pts.length - 1]].every((ep) =>
            junctionRespectsTributarioDirection(eng.ramales, ramal.net, ep),
          )
        : true;
      // Ítem 2 (rev 5): con aparato asignado, el toggle deja el aparato en contra del flujo o
      // en un extremo conectado — se deshace y alerta. Se evalúa PRIMERO que la validación de
      // conexión sin salida.
      if (fresh && aparatoEnExtremoInvalido(eng.ramales, eng.bajantes || [], fresh)) {
        eng.updateElementById(ramal.id, { _tribReversed: !val });
        props.setContextMenuState(null);
        eng.triggerAlert(
          'Aparato en extremo inválido',
          'Al invertir la dirección del flujo, el aparato asignado queda en contra del flujo o en un extremo conectado a la red. Quita o reasigna el aparato antes de invertir la dirección.',
        );
        eng.render();
        return;
      }
      if (!okAtBothEnds) {
        eng.updateElementById(ramal.id, { _tribReversed: !val });
        props.setContextMenuState(null);
        eng.triggerAlert(
          'Conexión sin salida',
          'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo saliendo de ella.',
        );
        eng.render();
        return;
      }
      if (props.selElement?.id === ramal.id) {
        props.setSelElement({ ...props.selElement, _tribReversed: val });
      }
      eng.render();
      eng._markDirty();
      props.setContextMenuState(null);
      return;
    }
    // Con objetivo (confirmado en el modal "Cambio de dirección de flujo"): DOBLE cambio de
    // dirección — se invierten el ramal del menú (A) Y el ramal elegido en el modal (B). Es el
    // pivote de la conexión: en la unión compartida uno queda como entrada y el otro como
    // salida (1-entrada/1-salida), y las UC de A se cargan a B.
    const aFresh = eng.ramales.find((x) => x.id === ramal.id) || ramal;
    const target = eng.ramales.find((x) => x.id === targetId);
    if (!target) return;
    if (target.tipo === 'tributario' || aFresh.tipo === 'tributario') {
      props.setContextMenuState(null);
      eng.triggerAlert(
        'Dirección de flujo inconsistente',
        'Un ramal tributario tiene dirección de flujo fija (cola siempre hacia la unión) y no se puede invertir. Elige otro ramal de la conexión.',
      );
      return;
    }
    // Para af/ac/gas la dirección EFECTIVA (flecha renderRamales.ts:993/1243 Y validaciones
    // junctionHasOutgoingFlow/junctionRespectsTributarioDirection) es
    // `_tribReversed ? pts[last] : pts[0]` — un XOR. Combinar flipRamalFlow (pts.reverse) con
    // toggle del flag se CANCELA: flecha y validación no cambian. La inversión real de estas
    // redes es SOLO el toggle del flag.
    aFresh._tribReversed = !aFresh._tribReversed;
    target._tribReversed = !target._tribReversed;
    // Validar el estado REAL tras el doble cambio, en los extremos de AMBOS ramales — si solo
    // se volteara B, la unión compartida quedaría con dos entradas (A entraba + B ahora entra)
    // y 0 salidas y la alerta saldría siempre; con el pivote ambas quedan 1-entrada/1-salida.
    const okAtBothEnds = [
      aFresh.pts[0],
      aFresh.pts[aFresh.pts.length - 1],
      target.pts[0],
      target.pts[target.pts.length - 1],
    ].every((ep) => junctionRespectsTributarioDirection(eng.ramales, target.net, ep));
    // Ítem 2 (rev 5): si tras el doble cambio alguno de los dos ramales queda con su aparato
    // en contra del flujo o en un extremo conectado, se deshacen AMBOS toggles y alerta.
    // Se evalúa PRIMERO que la validación de conexión sin salida.
    if (
      aparatoEnExtremoInvalido(eng.ramales, eng.bajantes || [], aFresh) ||
      aparatoEnExtremoInvalido(eng.ramales, eng.bajantes || [], target)
    ) {
      aFresh._tribReversed = !aFresh._tribReversed;
      target._tribReversed = !target._tribReversed;
      props.setContextMenuState(null);
      eng.triggerAlert(
        'Aparato en extremo inválido',
        'Al invertir la dirección de flujo, uno de los ramales quedaría con su aparato en contra del flujo o en un extremo conectado a la red. Quita o reasigna el aparato antes de invertir.',
      );
      eng.render();
      return;
    }
    if (!okAtBothEnds) {
      aFresh._tribReversed = !aFresh._tribReversed;
      target._tribReversed = !target._tribReversed;
      props.setContextMenuState(null);
      eng.triggerAlert(
        'Conexión sin salida',
        'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo saliendo de ella.',
      );
      eng.render();
      return;
    }
    if (props.selElement?.id === aFresh.id) {
      props.setSelElement({ ...props.selElement, _tribReversed: aFresh._tribReversed });
    }
    const ucInfo = readUcInfo(ramal);
    if (ucInfo.planId != null) {
      moveAllAparatoCounts(ramal.net, ramal.id, targetId, ucInfo.planId);
      writeHydroDrawingSync(props.planosCtx?.plans || []);
    }
    if (props.selElement?.id === target.id) {
      props.setSelElement({ ...props.selElement, ...target });
    }
    eng.render();
    eng._markDirty();
    props.setContextMenuState(null);
  };

  // Guard anti-pisado (bug 1a): cuando el menú se abre con clic derecho, `state.element` es el
  // hit fresco del motor y `selElement` puede ser una selección VIEJA del clic izquierdo con el
  // mismo id — sincronizar ahí pisaría el hit con datos anteriores. Se recuerda qué elemento
  // abrió el menú (openHitRef, por identidad de id) y qué selElement existía en ese momento
  // (selAtOpenRef): el sync solo procede si selElement CAMBIÓ después de abrir el menú (mutación
  // del propio menú o nueva selección del mismo elemento), nunca con la selección previa.
  const openHitRef = useRef<{ element: PlanoElement | null; sel: PlanoElement | null } | null>(
    null,
  );

  // Cuando cambia el id del elemento del menú (nuevo clic derecho), se re-ancla el hit y la
  // selección vigente en ese instante.
  useEffect(() => {
    if (openHitRef.current?.element?.id !== state?.element?.id) {
      openHitRef.current = { element: state?.element ?? null, sel: props.selElement };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.element]);

  // Cuando associate (BajanteAsociacion), associateOrigin, o cualquier toggle in-place del menú
  // (bloquear movimiento, invertir dirección de flujo, etc.) actualizan selElement, el menú
  // contextual usa su propia copia del elemento (contextMenuState.element). Sincronizarla para
  // que checkboxes/botones reflejen siempre el valor más reciente. Antes el arreglo de
  // dependencias solo miraba el `id` de cada lado — un toggle que cambia un campo (ej.
  // `bloqueado`) sin cambiar el id nunca volvía a disparar este efecto, así que
  // contextMenuState.element se quedaba con el valor viejo y el checkbox no se actualizaba en
  // vivo aunque el motor y `selElement` sí lo hicieran. Ahora se compara la referencia completa
  // de `selElement`, no solo su id — y se exige que `selElement` sea posterior a la apertura
  // del menú (ver openHitRef arriba).
  useEffect(() => {
    const selId = (props.selElement as { id?: string } | null)?.id;
    const ctxId = state?.element?.id;
    if (
      selId &&
      ctxId &&
      selId === ctxId &&
      props.selElement !== state?.element &&
      props.selElement !== openHitRef.current?.sel
    ) {
      props.setContextMenuState((prev) =>
        prev ? { ...prev, element: props.selElement as never } : null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selElement, state?.element]);

  const ucMoveModal = (
    <UcMoveModal
      state={ucMoveState}
      onConfirm={(targetId) => {
        const eng = props.engineRef.current;
        const ramal = eng?.ramales.find((r) => r.id === ucMoveState.ramalId);
        if (ramal) doInvert(ramal, targetId);
        closeUcMove();
      }}
      onCancel={closeUcMove}
    />
  );

  // El modal se renderiza TAMBIÉN con el menú cerrado — es el caso normal cuando el usuario lo
  // abrió (openUcMove cierra el menú inmediatamente).
  if (!state || !state.visible) return ucMoveModal;

  const ctxValue = {
    contextMenuState: state,
    setContextMenuState: props.setContextMenuState,
    element: state.element,
    selectedNivel: props.selectedNivel,
    pisos: props.pisos,
    engineRef: props.engineRef,
    selElement: props.selElement,
    setSelElement: props.setSelElement,
    lowerFloorsRamales: props.lowerFloorsRamales,
    upperFloorGroup: props.upperFloorGroup,
    planosCtx: props.planosCtx,
    mats: props.mats,
    activeNet: props.activeNet,
    setDiamSel: props.setDiamSel,
    triggerConfirm: props.triggerConfirm,
    openUcMove,
    doInvert,
    readUcInfo,
  };

  return (
    <>
      <DrawingElementContextMenuCtx.Provider value={ctxValue}>
        <DrawingElementContextMenuInner />
      </DrawingElementContextMenuCtx.Provider>
      {ucMoveModal}
    </>
  );
});

function DrawingElementContextMenuInner() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, setContextMenuState } = ctx;
  const menuRef = useRef<HTMLFormElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({
    x: contextMenuState?.x || 0,
    y: contextMenuState?.y || 0,
  });

  useEffect(() => {
    const el = menuRef.current;
    if (!el || !contextMenuState) return;
    const parentEl = el.offsetParent;
    if (!parentEl) return;
    const parentRect = parentEl.getBoundingClientRect();
    const menuRect = el.getBoundingClientRect();

    let newX = contextMenuState.x - parentRect.left;
    let newY = contextMenuState.y - parentRect.top;

    if (contextMenuState.x + menuRect.width + 10 > window.innerWidth) {
      newX = newX - menuRect.width - 5;
    } else {
      newX = newX + 5;
    }

    if (contextMenuState.y + menuRect.height + 10 > window.innerHeight) {
      newY = newY - menuRect.height - 5;
    } else {
      newY = newY + 5;
    }

    if (newX < 10) newX = 10;
    if (newY < 10) newY = 10;
    if (newX + menuRect.width > parentRect.width - 10) {
      newX = parentRect.width - menuRect.width - 10;
    }
    if (newY + menuRect.height > parentRect.height - 10) {
      newY = parentRect.height - menuRect.height - 10;
    }

    setAdjustedPos({ x: newX, y: newY });
  }, [contextMenuState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenuState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setContextMenuState]);

  const element = contextMenuState.element as ProbedElement;
  const isBajanteTipo =
    element.tipo === 'bajante' || element.tipo === 'montante' || element.id?.startsWith('B');
  const isArea = element.id?.startsWith('AR');
  // Las líneas guía también llevan `pts` (reutilizado para la detección de clics) pero nunca
  // deben caer en RamalMenu, que asume que existe todo campo exclusivo de PlanoRamal
  // (accesorios por red, diámetro, etc.).
  const isGuide = element.id?.startsWith('GL');
  const hasPts = !!element.pts && !isGuide;
  const tipo = element.tipo;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
        }}
        onClick={() => ctx.setContextMenuState(null)}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú contextual de elemento"
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            const focusable = e.currentTarget.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;
            const first = focusable[0] as HTMLElement;
            const last = focusable[focusable.length - 1] as HTMLElement;
            if (e.shiftKey) {
              if (document.activeElement === first) {
                last.focus();
                e.preventDefault();
              }
            } else {
              if (document.activeElement === last) {
                first.focus();
                e.preventDefault();
              }
            }
          }
        }}
        style={{ ...MENU_PANEL_STYLE, left: adjustedPos.x, top: adjustedPos.y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {isBajanteTipo && !hasPts ? (
          <BajanteMenu />
        ) : isArea ? (
          <AreaMenu />
        ) : isGuide ? (
          <GuideLineMenu />
        ) : hasPts ? (
          <RamalMenu />
        ) : tipo === 'contador' ? (
          <ContadorMenu />
        ) : tipo === 'calentador' ? (
          <CalentadorMenu />
        ) : tipo === 'canal' ? (
          <CanalMenu />
        ) : null}
      </form>
    </>
  );
}
