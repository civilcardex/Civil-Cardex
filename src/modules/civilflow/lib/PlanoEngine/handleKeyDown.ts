/**
 * Despachador de atajos de teclado del visor (cuerpo de _onKeyDownHandler). El foco manda:
 * INPUT/SELECT/TEXTAREA conservan el undo nativo del texto; Ctrl+Z/Y y Ctrl+S se tratan ANTES
 * del guard de foco (un <select> no edita texto y el undo debe llegar siempre).
 */
import type { IPlanoEngineCore } from './PlanoState';
import { commitOpenGuide, eraseRamalAt } from './PlanoEngineDrawing';

/** Procesa un keydown del canvas: herramientas (S/J/L/D/U/B/M/A/E/X/K/espacio), Enter/Esc
 *  (terminar/cancelar trazo, área o guía) y borrado (Supr/Backspace con eraseRamalAt para
 *  ramales). Los preventDefault y el orden de ramas se copian tal cual del hub. */
export function handleKeyDown(engine: IPlanoEngineCore, e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement).tagName;
  const k = e.key.toLowerCase();
  // Ctrl+Z/Ctrl+Y funcionan AUNQUE el foco haya quedado en un <select> (p. ej. el selector de
  // aparato del menú contextual, que no hace blur al elegir): un select no edita texto y el
  // undo debe llegar siempre. En INPUT/TEXTAREA Ctrl+Z es el deshacer nativo del texto.
  if (e.ctrlKey && (k === 'z' || k === 'y') && tag !== 'INPUT' && tag !== 'TEXTAREA') {
    if (k === 'z' && e.shiftKey) engine.redoLast();
    else if (k === 'z') engine.undoLast();
    else engine.redoLast();
    e.preventDefault();
    return;
  }
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.ctrlKey && k === 's') {
    e.preventDefault();
    return;
  }
  if (k === 's') {
    engine.setTool('sel');
    e.preventDefault();
  } else if (k === 'j') {
    // 'J' → Caja de recolección (CAN en san, CALL en ll) — solo con esas redes activas,
    // espejo de isToolDisabledForNet('caja') en la barra. ('X' ya es "borrar montante".)
    if (['san', 'll'].includes(engine.activeNet)) {
      engine.setTool('caja');
      e.preventDefault();
    }
  } else if (k === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Con modificadores NO es el atajo: Ctrl+L/Cmd+L es de la barra de direcciones.
    // 'L' → Canal recolectora (de aguas Lluvias) — solo con la red ll activa Y la
    // recolectora encendida, espejo de isToolDisabledForNet('canal') y del guard de
    // drawingCreations. ('C' ya es la herramienta Texto en useKeyboardShortcuts.)
    // Set indefinido = sin restricción activa conocida: habilitar (mismo criterio que
    // useActiveNetsVisibility, cuyo fallback también da true — si no, botón vivo + atajo muerto).
    if (
      engine.activeNet === 'll' &&
      (!engine.activeNetworks || engine.activeNetworks.has('recolectora'))
    ) {
      engine.setTool('canal');
      e.preventDefault();
    }
  } else if (k === 'd') {
    engine.setTool('dim');
    e.preventDefault();
  } else if (k === 'u') {
    // 'G' colisionaba con el atajo mostrado para Snap — U (de "gUía") queda libre.
    engine.setTool('guide');
    e.preventDefault();
  }
  // Bajante solo en san/vent/ll, montante solo en gas/ac/af — misma regla que PdfViewerToolbar.tsx
  // aplica en sus botones (isToolDisabledForNet); duplicada aquí como chequeo plano en vez de
  // importada, porque lib/PlanoEngine no debe depender de components/.
  else if (k === 'b') {
    if (['san', 'vent', 'll'].includes(engine.activeNet)) {
      engine.setTool('baj');
    }
    e.preventDefault();
  } else if (k === 'm') {
    if (['gas', 'ac', 'af'].includes(engine.activeNet)) {
      engine.setTool('mon');
    }
    e.preventDefault();
  } else if (k === 'a') {
    engine.setTool('area');
    e.preventDefault();
  } else if (k === 'e') {
    engine.setTool('erase');
    e.preventDefault();
  } else if (k === 'x') {
    engine.setTool('delm');
    e.preventDefault();
  } else if (k === 'k') {
    engine.setTool('segdel');
    e.preventDefault();
  } else if (k === ' ') {
    engine.setTool(engine.tool === 'pan' ? 'sel' : 'pan');
    e.preventDefault();
  } else if (k === 'enter') {
    if (engine.activeRamal) {
      engine.finishRamal();
      e.preventDefault();
    } else if (engine.activeArea) {
      engine.finishArea();
      e.preventDefault();
    } else if (engine.tool === 'guide' && engine._guideStart) {
      // Ítem 2: Enter también cierra (commitea) la guía en construcción.
      commitOpenGuide(engine);
      e.preventDefault();
    }
  } else if (k === 'escape') {
    if (engine.activeRamal) {
      engine.cancelRamal();
      e.preventDefault();
    } else if (engine.activeArea) {
      engine.cancelArea();
      e.preventDefault();
    } else if (engine._dimStart) {
      engine._dimStart = null;
      engine.render();
      e.preventDefault();
    } else if (engine._guideStart) {
      // Ítem 2: Esc cierra (commitea) la guía multisegmento en vez de descartarla.
      commitOpenGuide(engine);
      e.preventDefault();
    } else if (engine._canalStart) {
      engine._canalStart = null;
      engine.render();
      e.preventDefault();
    } else {
      if (engine.tool !== 'sel') {
        engine.setTool('sel');
        e.preventDefault();
      } else {
        engine.selId = null;
        engine._emitSelect(null);
        engine.render();
      }
    }
  } else if (k === 'delete' || k === 'backspace') {
    if (!engine.activeRamal && !engine.activeArea) {
      if (engine.multiSel && engine.multiSel.length > 0) {
        // Sin noMerge: los brazos de yee doble ya se protegen por id dentro de
        // deleteSelected (borrado individual sin re-unir) y splitMembersFor los excluye.
        // Con noMerge los splits del tronco causados por los tributarios borrados nunca
        // se re-unían y el ramal principal quedaba partido (orig. usuario).
        engine.deleteSelected(engine.multiSel);
        engine.multiSel = [];
      } else if (engine.selId) {
        const sel = engine.getSelected() as Record<string, unknown> | null;
        const ptsArr = ((sel as { pts?: unknown } | null)?.pts ?? []) as number[][];
        // ÁREAS fuera: con pts pasaban por eraseRamalAt y el borrador recortaba UN VÉRTICE
        // ("se borra la mitad del área") en vez del elemento completo.
        const esArea =
          (sel as { tipo?: string } | null)?.tipo === 'area' ||
          String((sel as { id?: unknown }).id ?? '').startsWith('AR');
        const isRamalLike =
          ptsArr.length >= 2 &&
          !esArea &&
          !String((sel as { id?: unknown }).id ?? '').startsWith('GL');
        if (isRamalLike) {
          const sp = engine._selPointCvs;
          const cv =
            sp && (sp.x !== 0 || sp.y !== 0)
              ? { x: sp.x, y: sp.y }
              : (() => {
                  const mid = ptsArr[0];
                  return engine.toCvs(mid[0], mid[1]);
                })();
          eraseRamalAt(engine, sel as never, cv.x, cv.y);
        } else {
          engine.deleteSelected();
        }
      }
      e.preventDefault();
    }
  }
}
