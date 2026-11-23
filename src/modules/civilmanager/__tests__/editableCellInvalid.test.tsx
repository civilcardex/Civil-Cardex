// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditableCell } from '../shared/EditableCell.tsx';
import { renderEnJsdom } from '../../../test/render.tsx';

// H-04: un importe ambiguo («850.000») NO se pierde en silencio — se conserva tipeado con
// borde rojo y aviso; al corregir («850000») confirma. El rechazo lo fija parseNumInput.
describe('EditableCell numérica con importe ambiguo', () => {
  it('rechaza 850.000 con aviso visible y confirma 850000 al corregir', async () => {
    const commits: string[] = [];
    const { container, unmount, flush } = await renderEnJsdom(
      <EditableCell editing value="0" tipo="numero" onCommit={(v) => commits.push(v)} />,
    );
    try {
      const input = container.querySelector('input')!;
      const teclear = async (v: string) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        // React delega onBlur en el nativo 'focusout' (blur NO dispara los handlers).
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await flush();
      };
      await teclear('850.000');
      expect(commits).toEqual([]);
      expect(container.querySelector('.cm-num-error')).not.toBeNull();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      await teclear('850000');
      expect(container.querySelector('.cm-num-error')).toBeNull();
      expect(commits).toEqual(['850000']);
    } finally {
      await unmount();
    }
  });
});
