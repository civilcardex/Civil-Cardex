// @vitest-environment jsdom
import { act, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NombreProyectoDialog } from '../../components/shared/NombreProyectoDialog.tsx';
import { renderEnJsdom } from '../render.tsx';

describe('NombreProyectoDialog', () => {
  it('el evento nativo de Escape cierra desde un botón; el fondo no descarta el diálogo', async () => {
    const onClose = vi.fn();
    function AbrirProyecto() {
      const [open, setOpen] = useState(true);
      return (
        <NombreProyectoDialog
          open={open}
          titulo="Nuevo proyecto"
          onCreate={vi.fn()}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      );
    }

    const { container, unmount } = await renderEnJsdom(<AbrirProyecto />);
    try {
      const dialog = container.querySelector('dialog')!;
      const cancelar = dialog.querySelector('button')!;
      await act(() => dialog.click());
      expect(onClose).not.toHaveBeenCalled();

      cancelar.focus();
      expect(document.activeElement).toBe(cancelar);
      await act(() => {
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(container.querySelector('dialog')).toBeNull();
    } finally {
      await unmount();
    }
  });

  it.each([false, true])('valida el envío nativo del formulario (creando=%s)', async (creating) => {
    const onCreate = vi.fn();
    const { container, unmount } = await renderEnJsdom(
      <NombreProyectoDialog
        open
        titulo="Nuevo proyecto"
        onClose={vi.fn()}
        onCreate={onCreate}
        creating={creating}
      />,
    );
    try {
      const form = container.querySelector('form')!;
      const input = form.querySelector('input')!;
      const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
      const submitForm = () =>
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      expect(submit.disabled).toBe(true);
      await act(() => {
        submitForm();
      });
      expect(onCreate).not.toHaveBeenCalled();

      await act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          input,
          ' Obra norte ',
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(submit.disabled).toBe(creating);
      await act(() => {
        submitForm();
      });
      if (creating) expect(onCreate).not.toHaveBeenCalled();
      else expect(onCreate).toHaveBeenCalledExactlyOnceWith('Obra norte');
    } finally {
      await unmount();
    }
  });
});
