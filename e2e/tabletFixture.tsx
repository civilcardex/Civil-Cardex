import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { supabase } from '../src/lib/supabase.ts';
import PlanoEngine from '../src/modules/civilflow/lib/PlanoEngine/PlanoEngine.ts';
import {
  ViewerDrawingActions,
  ViewerPlanSteps,
} from '../src/modules/civilflow/components/pdfViewer/ViewerDrawingActions.tsx';
import { ViewerMobileChrome } from '../src/modules/civilflow/components/pdfViewer/ViewerMobileChrome.tsx';
import { useViewerResponsive } from '../src/modules/civilflow/components/pdfViewer/useViewerResponsive.ts';
import { RciRamalesTable } from '../src/modules/civilflow/components/rci/RCIRamalesTable.tsx';
import WorkAreaCivilManager from '../src/modules/civilmanager/WorkAreaCivilManager.tsx';
import { TOURS } from '../src/components/tour/tourSteps.ts';
import '../src/styles/controls.css';
import '../src/styles/tables.css';

function FlowFixture() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const eng = useRef<PlanoEngine>(null);
  const [line, setLine] = useState(false);
  const [count, setCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [selected, setSelected] = useState(false);
  const [options, setOptions] = useState(false);
  const [index, setIndex] = useState(0);
  const { isMobile, isNarrow } = useViewerResponsive();
  useEffect(() => {
    const engine = new PlanoEngine(wrap.current!, null, canvas.current!);
    engine.pageW = 500;
    engine.pageH = 250;
    engine._loadedPlanId = 'fixture';
    engine.snapMode = false;
    engine.gridMode = false;
    engine.resizeCanvas(500, 250);
    engine.onDirty(() => {
      setCount(engine.ramales.length);
      setPoints(engine.ramales.at(-1)?.pts.length ?? 0);
    });
    engine.onSelect(() => setSelected(!!engine.getSelected()));
    eng.current = engine;
    const drawing = canvas.current!;
    const snapshot = () => {
      drawing.dataset.gesture = JSON.stringify({
        zoom: engine.zoom,
        dx: engine.offX,
        dy: engine.offY,
        points: engine.ramales[0]?.pts,
      });
    };
    drawing.addEventListener('touchmove', snapshot);
    drawing.addEventListener('touchend', snapshot);
    drawing.addEventListener('touchcancel', snapshot);
    return () => {
      drawing.removeEventListener('touchmove', snapshot);
      drawing.removeEventListener('touchend', snapshot);
      drawing.removeEventListener('touchcancel', snapshot);
      engine.destroy();
    };
  }, []);
  return (
    <>
      <div aria-label="Plano activo">Plano {index + 1}</div>
      <ViewerPlanSteps index={index} count={2} onSelect={setIndex} />
      {!isMobile && (
        <>
          <button
            type="button"
            onClick={() => {
              eng.current?.setTool('line');
              setLine(true);
            }}
          >
            Dibujar ramal
          </button>
          <button
            type="button"
            onClick={() => {
              eng.current?.setTool('sel');
              setLine(false);
            }}
          >
            Seleccionar
          </button>
          <button
            type="button"
            onClick={() => {
              eng.current?.setTool('pan');
              setLine(false);
            }}
          >
            Panear
          </button>
        </>
      )}
      <div ref={wrap} style={{ width: 500, height: 250, position: 'relative' }}>
        <canvas ref={canvas} aria-label="Lienzo de prueba" style={{ touchAction: 'none' }} />
        {!isMobile && (
          <ViewerDrawingActions
            engineRef={eng}
            drawing={line}
            disabled={false}
            onSave={() => {}}
            onUndo={() => {}}
            onOptions={selected ? () => setOptions(true) : undefined}
          />
        )}
        <ViewerMobileChrome
          isMobile={isMobile}
          isNarrow={isNarrow || matchMedia('(any-pointer: coarse)').matches}
          currentFile={null}
          onFit={() => {}}
          onZoomStep={(factor) => eng.current?.zoomStep(factor)}
        />
      </div>
      <p data-testid="ramales">{count}</p>
      <p data-testid="puntos">{points}</p>
      {options && (
        <>
          <p>Opciones del ramal seleccionado</p>
          <button
            type="button"
            onClick={() => {
              const engine = eng.current;
              const selected = engine?.getSelected();
              if (selected) engine?.updateElementById(selected.id, { bloqueado: false });
            }}
          >
            Desbloquear movimiento
          </button>
        </>
      )}
      <div style={{ minWidth: 0, maxWidth: '100%' }}>
        <RciRamalesTable
          rams={[]}
          piso="P1"
          rd={null}
          editRam={false}
          setRamal={() => () => {}}
          zRamTxt="5"
          okN={false}
          roc={{ Nreq: 4, Nramal: 4, Llargo: 14.17 }}
        />
      </div>
    </>
  );
}

const id = '11111111-1111-4111-8111-111111111111';
const fixture = {
  proyectos: [{ id, updated_at: '2026-01-01T00:00:00Z' }],
  equipos: [
    {
      id: 'eq',
      codigo: 'EQ-001',
      nombre: 'Mezcladora',
      tipo: 'Equipo menor',
      unidad: 'hr',
      costo_hora: 3000,
    },
  ],
};
const isManager = location.pathname.startsWith('/civilmanagerareatrabajo/');
if (isManager) {
  localStorage.setItem('cm_proyecto_activo_id', id);
  for (const tour of Object.keys(TOURS).filter((key) => key.startsWith('cm:'))) {
    localStorage.setItem(`cardex_tour_${tour.replaceAll(':', '_')}`, '1');
  }
  // Rest calls here are local fixtures. The route does not use real user accounts.
  Object.defineProperty(supabase.auth, 'getSession', {
    value: async () => ({ data: { session: { user: { id } } } }),
  });
  Object.defineProperty(supabase, 'rpc', {
    value: async (name: string, args: { p_state?: typeof fixture }) => {
      const saved = sessionStorage.getItem('tablet-cm');
      if (name === 'cm_get_data') {
        return { data: saved ? JSON.parse(saved) : fixture, error: null };
      }
      if (name !== 'cm_save_state_versioned') throw new Error('RPC inesperado en fixture');
      const updated_at = new Date().toISOString();
      sessionStorage.setItem(
        'tablet-cm',
        JSON.stringify({ ...args.p_state, proyectos: [{ id, updated_at }] }),
      );
      return { data: updated_at, error: null };
    },
  });
}

createRoot(document.getElementById('root')!).render(
  isManager ? (
    <BrowserRouter>
      <Routes>
        <Route path="/civilmanagerareatrabajo/*" element={<WorkAreaCivilManager />} />
      </Routes>
    </BrowserRouter>
  ) : (
    <FlowFixture />
  ),
);
