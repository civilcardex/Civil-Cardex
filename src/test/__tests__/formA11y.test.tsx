// @vitest-environment jsdom
// A11y de formularios (quick-win del reporte 2026-11-17): los errores de campo deben ser
// anunciados — aria-invalid + aria-describedby → role="alert". Antes: 0 en todo el repo.
import { describe, expect, it } from 'vitest';
import { renderEnJsdom } from '../render.tsx';
import FormField from '../../components/FormField.tsx';

describe('FormField con error (aria-invalid + aria-describedby)', () => {
  it('sin error: input limpio, sin atributos de invalidez ni alerta', async () => {
    const { container, unmount } = await renderEnJsdom(
      <FormField label="NOMBRE" value="" onChange={() => {}} />,
    );
    const input = container.querySelector('input')!;
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await unmount();
  });

  it('con error: aria-invalid=true, describedby apunta al mensaje role=alert', async () => {
    const { container, unmount } = await renderEnJsdom(
      <FormField
        label="CONFIRMAR CONTRASEÑA"
        type="password"
        value="x"
        onChange={() => {}}
        error="Las contraseñas no coinciden"
      />,
    );
    const input = container.querySelector('input')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const msg = container.querySelector(`#${describedBy}`)!;
    expect(msg.getAttribute('role')).toBe('alert');
    expect(msg.textContent).toBe('Las contraseñas no coinciden');
    await unmount();
  });
});
