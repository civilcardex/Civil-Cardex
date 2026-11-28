// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderEnJsdom } from '../../../../../test/render.tsx';
import { makeEngine } from '../../../../../test/engineFixture.ts';
import { ViewerDrawingActions } from '../ViewerDrawingActions.tsx';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';

// H-09 (G6, plan 2026-11-27): colocar vértices, terminar, guardar y deshacer un ramal SOLO
// con teclado — un solo camino de creación (los botones llaman a las mismas operaciones del
// motor que el mouse: addPoint implícito vía mousedown sintético + finishRamal/cancelRamal).
// El anuncio por aria-live cubre la retroalimentación sin mirar el canvas.

function tecla(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('trazado de ramal solo con teclado (H-09)', () => {
  it('coloca dos puntos por coordenadas, termina y anuncia por aria-live', async () => {
    const pts: number[][] = [];
    let finished = 0;
    const engine = makeEngine({
      pageW: 800,
      pageH: 600,
      dpr: 1,
      zoom: 1,
      offX: 0,
      offY: 0,
      finishRamal: () => {
        finished += 1;
      },
      cancelRamal: () => {},
    }) as unknown as PlanoEngine;
    // Cada "clic" del formulario agrega el punto al ramal activo del motor (mismo camino
    // que el mouse: mousedown en la coordenada transformada).
    const activo = {
      pts: [
        [100, 120],
        [300, 120],
      ],
    };
    (engine as unknown as { activeRamal: unknown }).activeRamal = activo;
    (engine as unknown as { _onDownHandler: (e: MouseEvent) => void })._onDownHandler = (e) => {
      // El camino REAL del motor: el mousedown agrega el vértice al ramal activo (igual
      // que el mouse). El stub replica eso para que addPoint cuente puntos nuevos.
      activo.pts.push([e.clientX, e.clientY]);
      pts.push([e.clientX, e.clientY]);
    };
    (engine as unknown as { toCvs: (x: number, y: number) => { x: number; y: number } }).toCvs = (
      x,
      y,
    ) => ({ x, y });
    (engine as unknown as { _cachedRect: () => DOMRect })._cachedRect = () =>
      new DOMRect(0, 0, 800, 600);
    (engine as unknown as { canv: HTMLCanvasElement }).canv = Object.assign(
      document.createElement('canvas'),
      { width: 800, height: 600 },
    );

    const { container, unmount, flush } = await renderEnJsdom(
      <ViewerDrawingActions
        engineRef={{ current: engine }}
        drawing
        disabled={false}
        onSave={() => {}}
        onUndo={() => {}}
      />,
    );
    try {
      const x = container.querySelector<HTMLInputElement>('input[name="x"]')!;
      const y = container.querySelector<HTMLInputElement>('input[name="y"]')!;
      const enviar = async () => {
        x.closest('form')!.requestSubmit();
        await flush();
      };
      x.value = '100';
      x.dispatchEvent(new Event('input', { bubbles: true }));
      y.value = '120';
      y.dispatchEvent(new Event('input', { bubbles: true }));
      await enviar();
      x.value = '300';
      x.dispatchEvent(new Event('input', { bubbles: true }));
      y.value = '120';
      y.dispatchEvent(new Event('input', { bubbles: true }));
      await enviar();
      expect(pts).toEqual([
        [100, 120],
        [300, 120],
      ]);

      // Terminar y Deshacer SOLO con teclado: foco + Enter en cada botón.
      const terminar = [...container.querySelectorAll('button')].find(
        (b) => b.textContent === 'Terminar',
      )!;
      terminar.focus();
      tecla(terminar, 'Enter');
      // jsdom NO sintetiza la activación (click) de un botón al recibir Enter — el
      // navegador sí. La disparamos a mano: foco + Enter = click del botón enfocado.
      (terminar as HTMLButtonElement).click();
      await flush();
      expect(finished).toBe(1);
      const salida = container.querySelector('output')!;
      expect(salida.textContent).toContain('Trazado finalizado');

      const deshacer = [...container.querySelectorAll('button')].find(
        (b) => b.textContent === 'Deshacer',
      )!;
      deshacer.focus();
      tecla(deshacer, 'Enter');
      expect(deshacer.getAttribute('class')).toContain('viewer-coarse-action');
    } finally {
      await unmount();
    }
  });
});
