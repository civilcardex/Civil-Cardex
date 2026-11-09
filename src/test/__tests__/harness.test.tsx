// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { renderEnJsdom } from '../render.tsx';

/**
 * Prueba del propio harness de render: si esto pasa, los tests de componente tienen red.
 * (Un botón que cuenta y un canvas que no rompe.)
 */
function Contador(): React.ReactElement {
  const [n, setN] = useState(0);
  return (
    <div>
      <span data-testid="valor">{n}</span>
      <button onClick={() => setN((v) => v + 1)}>+1</button>
      <canvas width={10} height={10} />
    </div>
  );
}

describe('harness de render (jsdom + React.act)', () => {
  it('monta, dispara eventos y se desmonta limpio', async () => {
    const { container, unmount } = await renderEnJsdom(<Contador />);
    expect(container.querySelector('[data-testid="valor"]')?.textContent).toBe('0');

    const boton = container.querySelector('button') as HTMLButtonElement;
    boton.click();
    await Promise.resolve();
    // React 19 act: el click fuera de act avisa, pero el estado se actualiza en el microtask.
    expect(container.querySelector('[data-testid="valor"]')?.textContent).toBe('1');

    await unmount();
    expect(container.innerHTML).toBe('');
  });

  it('el canvas 2D no rompe (stub)', () => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    expect(ctx).toBeTruthy();
    expect(() => {
      ctx!.fillRect(0, 0, 10, 10);
      ctx!.fillText('x', 1, 1);
    }).not.toThrow();
  });
});
