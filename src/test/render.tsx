import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { aplicarStubsDom } from './domStubs';

/**
 * Harness de render para los tests de componente (entorno jsdom por archivo:
 * `// @vitest-environment jsdom`).
 *
 * No usa @testing-library: createRoot + React.act basta para montar, consultar el DOM y
 * desmontar. Los stubs de jsdom (ResizeObserver, matchMedia, canvas 2D) se aplican solos.
 */

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

export interface RenderResult {
  container: HTMLElement;
  rerender: (ui: React.ReactNode) => Promise<void>;
  unmount: () => Promise<void>;
  /** Espera a que se vacíen los efectos y las microtareas pendientes. */
  flush: () => Promise<void>;
}

/** Monta un componente en un div suelto y devuelve sus utilidades (async: el primer
 *  render de React 19 es concurrente y necesita `act` para quedar despejado). */
export async function renderEnJsdom(ui: React.ReactNode): Promise<RenderResult> {
  aplicarStubsDom();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const rerender = async (next: React.ReactNode) => {
    await act(async () => {
      root.render(next);
    });
  };
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };
  const unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
  await act(async () => {
    root.render(ui);
  });
  return { container, rerender, unmount, flush };
}

/** Monta, ejecuta y desmonta: para tests que solo quieren ver el resultado. */
export async function renderYVer(ui: React.ReactNode): Promise<HTMLElement> {
  const r = await renderEnJsdom(ui);
  await r.flush();
  return r.container;
}

/**
 * React 17+ mapea `onBlur` al evento `focusout` (no a `blur`) y `onChange` a `input`:
 * disparar los eventos del DOM a mano sin esos nombres NO llega al handler.
 */

/** Escribe un valor en un input controlado y avisa a React (onChange). */
export function escribirEnInput(el: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(el, valor);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Dispara el blur de React (focusout) sobre un input. */
export function blurEnInput(el: HTMLInputElement | HTMLTextAreaElement): void {
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}
