/* eslint-disable react-hooks/refs */
import { memo, useEffect, useRef, useState } from "react";
import PlanoEngine from "../../lib/PlanoEngine/PlanoEngine";
import BajanteDirectionSelector from "./BajanteDirectionSelector";
import BajanteDiameterSelector from "./BajanteDiameterSelector";
import BajanteConnectionPanel from "./BajanteConnectionPanel";
import BajanteCodeEditor from "./BajanteCodeEditor";

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  bajante: any;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
}

interface LowerFloorRamales {
  planId: string;
  planName: string;
  npt: number;
  ramales: any[];
}

interface BajanteContextMenuProps {
  contextMenuState: ContextMenuState | null;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  selectedNivel: number | null;
  pisos: any[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  lowerFloorsRamales: LowerFloorRamales[];
  planosCtx: { plans: any[] };
  mats: Record<string, any[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

function BajanteContextMenu({
  contextMenuState,
  setContextMenuState,
  selectedNivel,
  pisos,
  engineRef,
  selElement,
  setSelElement,
  lowerFloorsRamales,
  planosCtx,
  mats,
  activeNet,
  setDiamSel,
}: BajanteContextMenuProps) {
  const menuRef = useRef<HTMLFormElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: contextMenuState?.x || 0, y: contextMenuState?.y || 0 });

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
  }, [contextMenuState?.x, contextMenuState?.y, contextMenuState?.visible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenuState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setContextMenuState]);

  if (!contextMenuState || !contextMenuState.visible) return null;

  const bajante = contextMenuState.bajante;
  const isBajanteTipo = bajante.tipo === 'bajante' || bajante.tipo === 'montante' || bajante.id?.startsWith('B');
  const isArea = bajante.id?.startsWith('AR');
  const hasPts = !!bajante.pts;
  const isGhostClick = contextMenuState.isGhostClick || false;
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(activeNet);
  const tipo = bajante.tipo;

  return (
    <>
      <div role="presentation" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100
      }} onClick={() => setContextMenuState(null)} onContextMenu={(e) => e.preventDefault()} />
      <form ref={menuRef} role="dialog" aria-label="Menú contextual de elemento" onSubmit={e => e.preventDefault()} onKeyDown={e => {
          if (e.key === 'Tab') {
            const focusable = e.currentTarget.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            const first = focusable[0] as HTMLElement;
            const last = focusable[focusable.length - 1] as HTMLElement;
            if (e.shiftKey) {
              if (document.activeElement === first) { last.focus(); e.preventDefault(); }
            } else {
              if (document.activeElement === last) { first.focus(); e.preventDefault(); }
            }
          }
        }} style={{
        position: 'absolute', left: adjustedPos.x, top: adjustedPos.y, zIndex: 101,
        background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: '4px', minWidth: 180, maxWidth: 320,
        display: 'flex', flexDirection: 'column', gap: 2,
      }} onContextMenu={(e) => e.preventDefault()}>
        {isBajanteTipo && !hasPts ? (
          <>
            <BajanteDirectionSelector
              bajante={bajante}
              isGhostClick={isGhostClick}
              selectedNivel={selectedNivel}
              pisos={pisos}
              engineRef={engineRef}
              selElement={selElement}
              setSelElement={setSelElement}
              setContextMenuState={setContextMenuState}
            />
            <BajanteDiameterSelector
              bajante={bajante}
              isGhostClick={isGhostClick}
              selectedNivel={selectedNivel}
              engineRef={engineRef}
              selElement={selElement}
              setSelElement={setSelElement}
              setContextMenuState={setContextMenuState}
              lowerFloorsRamales={lowerFloorsRamales}
              planosCtx={planosCtx}
            />
            {isSanOrLl && (
              <BajanteConnectionPanel
                bajante={bajante}
                isGhostClick={isGhostClick}
                ramalEndpoint={null}
                engineRef={engineRef}
                selElement={selElement}
                setSelElement={setSelElement}
                setContextMenuState={setContextMenuState}
                mats={mats}
                activeNet={activeNet}
              />
            )}
          </>
        ) : isArea ? (
          <BajanteCodeEditor
            bajante={bajante}
            engineRef={engineRef}
            selElement={selElement}
            setSelElement={setSelElement}
            setContextMenuState={setContextMenuState}
            mats={mats}
            activeNet={activeNet}
            setDiamSel={setDiamSel}
            planosCtx={planosCtx}
          />
        ) : hasPts ? (
          <>
            {contextMenuState.ramalEndpoint && (
              <BajanteConnectionPanel
                bajante={bajante}
                isGhostClick={isGhostClick}
                ramalEndpoint={contextMenuState.ramalEndpoint}
                engineRef={engineRef}
                selElement={selElement}
                setSelElement={setSelElement}
                setContextMenuState={setContextMenuState}
                mats={mats}
                activeNet={activeNet}
              />
            )}
            <BajanteCodeEditor
              bajante={bajante}
              engineRef={engineRef}
              selElement={selElement}
              setSelElement={setSelElement}
              setContextMenuState={setContextMenuState}
              mats={mats}
              activeNet={activeNet}
              setDiamSel={setDiamSel}
              planosCtx={planosCtx}
            />
          </>
        ) : tipo === 'contador' ? (
          <BajanteCodeEditor
            bajante={bajante}
            engineRef={engineRef}
            selElement={selElement}
            setSelElement={setSelElement}
            setContextMenuState={setContextMenuState}
            mats={mats}
            activeNet={activeNet}
            setDiamSel={setDiamSel}
            planosCtx={planosCtx}
          />
        ) : tipo === 'calentador' ? (
          <BajanteCodeEditor
            bajante={bajante}
            engineRef={engineRef}
            selElement={selElement}
            setSelElement={setSelElement}
            setContextMenuState={setContextMenuState}
            mats={mats}
            activeNet={activeNet}
            setDiamSel={setDiamSel}
            planosCtx={planosCtx}
          />
        ) : null}
      </form>
    </>
  );
}

export default memo(BajanteContextMenu);
